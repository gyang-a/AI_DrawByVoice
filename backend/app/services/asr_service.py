from __future__ import annotations

import base64
import hashlib
import hmac
from io import BytesIO
import json
import os
import ssl
from collections.abc import Callable
from datetime import datetime, timezone
from email.utils import format_datetime
from threading import Event
from threading import Thread
from time import sleep
from typing import Any
from urllib.parse import quote, urlencode, urlparse
from wave import Error as WaveError
from wave import open as open_wave

from fastapi import HTTPException, UploadFile, status
from websocket import WebSocketApp


IAT_URL = "wss://iat-api.xfyun.cn/v2/iat"
PCM_FRAME_SIZE = 1280
FIRST_FRAME = 0
CONTINUE_FRAME = 1
LAST_FRAME = 2


ResultCallback = Callable[[str, bool], None]
ErrorCallback = Callable[[str], None]


def recognize_audio_file(audio_file: UploadFile) -> str:
    app_id, api_key, api_secret = _get_xfyun_credentials()

    audio_bytes = _read_upload_file(audio_file)
    pcm_bytes = _extract_pcm_from_wav(audio_bytes)
    if not pcm_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="音频内容为空。",
        )

    return _recognize_with_xfyun(pcm_bytes, app_id, api_key, api_secret)


class XfyunStreamingRecognizer:
    def __init__(self, on_result: ResultCallback, on_error: ErrorCallback) -> None:
        self._app_id, self._api_key, self._api_secret = _get_xfyun_credentials()
        self._on_result = on_result
        self._on_error = on_error
        self._is_first_frame = True
        self._is_closed = False
        self._is_finish_requested = False
        self._is_final_emitted = False
        self._open_event = Event()
        self._segments: dict[int, str] = {}
        self._ws = WebSocketApp(
            _create_authorized_url(IAT_URL, self._api_key, self._api_secret),
            on_open=self._on_open,
            on_message=self._on_message,
            on_error=self._on_ws_error,
            on_close=self._on_close,
        )
        self._thread = Thread(
            target=lambda: self._ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE}),
            daemon=True,
        )

    def start(self) -> None:
        self._thread.start()
        if not self._open_event.wait(timeout=8):
            self.close()
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="讯飞 ASR 连接超时。",
            )

    def send_audio(self, audio_bytes: bytes) -> None:
        if self._is_closed or not audio_bytes:
            return

        frame_status = FIRST_FRAME if self._is_first_frame else CONTINUE_FRAME
        self._ws.send(json.dumps(_create_frame_payload(audio_bytes, frame_status, self._app_id)))
        self._is_first_frame = False

    def finish(self) -> None:
        if self._is_closed:
            return

        self._is_finish_requested = True
        self._ws.send(json.dumps(_create_frame_payload(b"", LAST_FRAME, self._app_id)))

    def close(self) -> None:
        self._is_closed = True
        self._ws.close()

    def _on_open(self, _ws: WebSocketApp) -> None:
        self._open_event.set()

    def _on_close(
        self,
        _ws: WebSocketApp,
        _close_status_code: int | None,
        _close_message: str | None,
    ) -> None:
        self._emit_final_result_if_needed()
        self._is_closed = True

    def _on_ws_error(self, _ws: WebSocketApp, error: Exception) -> None:
        self._on_error(str(error))

    def _on_message(self, ws: WebSocketApp, message: str) -> None:
        response = json.loads(message)
        code = response.get("code", -1)

        if code != 0:
            self._on_error(response.get("message", "讯飞 ASR 识别失败。"))
            ws.close()
            return

        data = response.get("data", {})
        result = data.get("result", {})
        serial_number = int(result.get("sn", len(self._segments)))
        replacement_range = result.get("rg")

        if result.get("pgs") == "rpl" and isinstance(replacement_range, list):
            for index in range(int(replacement_range[0]), int(replacement_range[1]) + 1):
                self._segments.pop(index, None)

        text = _extract_result_text(result)
        if text:
            self._segments[serial_number] = text

        full_text = "".join(self._segments[index] for index in sorted(self._segments)).strip()
        is_final = data.get("status") == LAST_FRAME
        if full_text:
            self._on_result(full_text, is_final)
            if is_final:
                self._is_final_emitted = True

        if is_final:
            ws.close()

    def _emit_final_result_if_needed(self) -> None:
        if not self._is_finish_requested or self._is_final_emitted:
            return

        full_text = "".join(self._segments[index] for index in sorted(self._segments)).strip()
        if full_text:
            self._on_result(full_text, True)
            self._is_final_emitted = True


def _read_upload_file(audio_file: UploadFile) -> bytes:
    try:
        return audio_file.file.read()
    finally:
        audio_file.file.close()


def _extract_pcm_from_wav(audio_bytes: bytes) -> bytes:
    try:
        with open_wave(BytesIO(audio_bytes), "rb") as wav_file:
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            frame_rate = wav_file.getframerate()

            if channels != 1 or sample_width != 2 or frame_rate != 16000:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="请上传 16kHz、16-bit、单声道 WAV 音频。",
                )

            return wav_file.readframes(wav_file.getnframes())
    except WaveError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法读取 WAV 音频。",
        ) from exc


def _recognize_with_xfyun(
    pcm_bytes: bytes,
    app_id: str,
    api_key: str,
    api_secret: str,
) -> str:
    results: list[str] = []
    errors: list[str] = []

    def on_open(ws: WebSocketApp) -> None:
        def send_audio() -> None:
            offset = 0
            frame_status = FIRST_FRAME

            while offset < len(pcm_bytes):
                chunk = pcm_bytes[offset : offset + PCM_FRAME_SIZE]
                offset += PCM_FRAME_SIZE

                payload = _create_frame_payload(chunk, frame_status, app_id)
                ws.send(json.dumps(payload))

                if frame_status == FIRST_FRAME:
                    frame_status = CONTINUE_FRAME

                sleep(0.04)

            ws.send(json.dumps(_create_frame_payload(b"", LAST_FRAME, app_id)))

        Thread(target=send_audio, daemon=True).start()

    def on_message(ws: WebSocketApp, message: str) -> None:
        response = json.loads(message)
        code = response.get("code", -1)

        if code != 0:
            errors.append(response.get("message", "讯飞 ASR 识别失败。"))
            ws.close()
            return

        result = response.get("data", {}).get("result", {})
        words = result.get("ws", [])
        for word_group in words:
            for candidate in word_group.get("cw", []):
                text = candidate.get("w")
                if text:
                    results.append(text)

        if response.get("data", {}).get("status") == LAST_FRAME:
            ws.close()

    def on_error(_ws: WebSocketApp, error: Exception) -> None:
        errors.append(str(error))

    ws = WebSocketApp(
        _create_authorized_url(IAT_URL, api_key, api_secret),
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
    )
    ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})

    if errors:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=errors[0],
        )

    text = "".join(results).strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="未识别到有效语音文本。",
        )

    return text


def _get_xfyun_credentials() -> tuple[str, str, str]:
    app_id = os.getenv("XFYUN_APP_ID")
    api_key = os.getenv("XFYUN_API_KEY")
    api_secret = os.getenv("XFYUN_API_SECRET")

    if not app_id or not api_key or not api_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="讯飞 ASR 环境变量未配置。",
        )

    return app_id, api_key, api_secret


def _extract_result_text(result: dict[str, Any]) -> str:
    words = result.get("ws", [])
    text_parts: list[str] = []
    for word_group in words:
        for candidate in word_group.get("cw", []):
            text = candidate.get("w")
            if text:
                text_parts.append(text)

    return "".join(text_parts)


def _create_frame_payload(audio_bytes: bytes, frame_status: int, app_id: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "data": {
            "status": frame_status,
            "format": "audio/L16;rate=16000",
            "encoding": "raw",
            "audio": base64.b64encode(audio_bytes).decode("utf-8"),
        }
    }

    if frame_status == FIRST_FRAME:
        payload["common"] = {"app_id": app_id}
        payload["business"] = {
            "language": "zh_cn",
            "domain": "iat",
            "accent": "mandarin",
            "vad_eos": 5000,
        }

    return payload


def _create_authorized_url(request_url: str, api_key: str, api_secret: str) -> str:
    parsed_url = urlparse(request_url)
    host = parsed_url.netloc
    path = parsed_url.path
    date = format_datetime(datetime.now(timezone.utc), usegmt=True)
    signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
    signature_sha = hmac.new(
        api_secret.encode("utf-8"),
        signature_origin.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    signature = base64.b64encode(signature_sha).decode("utf-8")
    authorization_origin = (
        f'api_key="{api_key}", algorithm="hmac-sha256", '
        f'headers="host date request-line", signature="{signature}"'
    )
    authorization = base64.b64encode(authorization_origin.encode("utf-8")).decode("utf-8")
    query = urlencode({"authorization": authorization, "date": date, "host": host}, quote_via=quote)
    return f"{request_url}?{query}"
