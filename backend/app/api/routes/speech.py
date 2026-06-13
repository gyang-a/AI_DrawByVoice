import asyncio
import json
import math
import struct
from contextlib import suppress
from time import monotonic

from fastapi import APIRouter, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from pydantic import TypeAdapter

from app.schemas.command import Shape
from app.schemas.speech import SpeechRecognitionResponse
from app.services.asr_service import recognize_audio_file, recognize_pcm_audio
from app.services.command_parser import parse_command as parse_command_service

router = APIRouter(tags=["speech"])

AUDIO_RMS_THRESHOLD = 500
SILENCE_TIMEOUT_SECONDS = 2.0
MIN_UTTERANCE_BYTES = 16000
PRE_SPEECH_BYTES = 16000
shape_list_adapter = TypeAdapter(list[Shape])


@router.post("/asr", response_model=SpeechRecognitionResponse)
def recognize_speech(audio: UploadFile = File(...)) -> SpeechRecognitionResponse:
    text = recognize_audio_file(audio)
    return SpeechRecognitionResponse(text=text)


@router.websocket("/asr/stream")
async def stream_recognize_speech(websocket: WebSocket) -> None:
    await websocket.accept()
    scene: list[Shape] = []
    thread_id = "default-canvas"
    utterance_buffer = bytearray()
    pre_speech_buffer = bytearray()
    has_speech = False
    last_speech_at = 0.0
    send_lock = asyncio.Lock()
    tasks: set[asyncio.Task[None]] = set()

    async def send_event(event: dict) -> None:
        if websocket.client_state != WebSocketState.CONNECTED:
            return

        async with send_lock:
            if websocket.client_state != WebSocketState.CONNECTED:
                return

            await websocket.send_json(event)

    async def process_utterance(audio_bytes: bytes, current_scene: list[Shape], current_thread_id: str) -> None:
        try:
            await send_event({"type": "recognizing", "text": ""})
            recognized_text = await asyncio.to_thread(recognize_pcm_audio, audio_bytes)
            recognized_text = recognized_text.strip()

            if not recognized_text:
                await send_event({"type": "listening", "text": ""})
                return

            await send_event({"type": "recognized", "text": recognized_text})

            command_response = await asyncio.to_thread(
                parse_command_service,
                recognized_text,
                current_scene,
                current_thread_id,
            )
            await send_event({
                "type": "command",
                "text": recognized_text,
                "response": command_response.model_dump(mode="json"),
            })
        except HTTPException as exc:
            if exc.status_code == 422:
                await send_event({"type": "listening", "text": ""})
                return

            await send_event({"type": "error", "text": str(exc.detail)})
        except Exception as exc:
            await send_event({"type": "error", "text": str(exc)})

    def start_utterance_task(audio_bytes: bytes) -> None:
        task = asyncio.create_task(process_utterance(bytes(audio_bytes), list(scene), thread_id))
        tasks.add(task)
        task.add_done_callback(tasks.discard)

    try:
        await send_event({"type": "ready", "text": ""})

        while True:
            message = await websocket.receive()

            try:
                if "bytes" in message and message["bytes"]:
                    audio_chunk = message["bytes"]
                    rms = calculate_pcm_rms(audio_chunk)
                    now = monotonic()
                    started_now = False

                    if not has_speech:
                        pre_speech_buffer.extend(audio_chunk)
                        if len(pre_speech_buffer) > PRE_SPEECH_BYTES:
                            del pre_speech_buffer[: len(pre_speech_buffer) - PRE_SPEECH_BYTES]

                    if rms >= AUDIO_RMS_THRESHOLD:
                        if not has_speech:
                            utterance_buffer.extend(pre_speech_buffer)
                            pre_speech_buffer.clear()
                            started_now = True
                        has_speech = True
                        last_speech_at = now

                    if has_speech and not started_now:
                        utterance_buffer.extend(audio_chunk)

                        if now - last_speech_at >= SILENCE_TIMEOUT_SECONDS:
                            if len(utterance_buffer) >= MIN_UTTERANCE_BYTES:
                                start_utterance_task(bytes(utterance_buffer))

                            utterance_buffer.clear()
                            has_speech = False
                            last_speech_at = 0.0

                    continue

                text_message = message.get("text")
                if not text_message:
                    continue

                if text_message == "close":
                    break

                event = json.loads(text_message)
                if event.get("type") == "scene":
                    scene = shape_list_adapter.validate_python(event.get("scene", []))
                    thread_id = str(event.get("threadId") or thread_id)
            except Exception:
                continue
    except WebSocketDisconnect:
        pass
    finally:
        for task in list(tasks):
            task.cancel()
        for task in list(tasks):
            with suppress(asyncio.CancelledError):
                await task


def calculate_pcm_rms(audio_bytes: bytes) -> float:
    if len(audio_bytes) < 2:
        return 0

    usable_length = len(audio_bytes) - (len(audio_bytes) % 2)
    samples = struct.iter_unpack("<h", audio_bytes[:usable_length])
    total = 0
    count = 0

    for (sample,) in samples:
        total += sample * sample
        count += 1

    if count == 0:
        return 0

    return math.sqrt(total / count)
