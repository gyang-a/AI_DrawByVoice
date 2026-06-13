import asyncio
import json
import math
import struct
from contextlib import suppress
from time import monotonic

from fastapi import APIRouter, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from pydantic import TypeAdapter

from app.schemas.command import CanvasItem
from app.schemas.speech import SpeechRecognitionResponse
from app.services.asr_service import recognize_audio_file, recognize_pcm_audio
from app.services.command_parser import parse_command as parse_command_service

router = APIRouter(tags=["speech"])

AUDIO_RMS_THRESHOLD = 2300
SILENCE_TIMEOUT_SECONDS = 1.20
MIN_UTTERANCE_BYTES = 16000
PRE_SPEECH_BYTES = 16000
canvas_item_list_adapter = TypeAdapter(list[CanvasItem])


@router.post("/asr", response_model=SpeechRecognitionResponse)
def recognize_speech(audio: UploadFile = File(...)) -> SpeechRecognitionResponse:
    text = recognize_audio_file(audio)
    return SpeechRecognitionResponse(text=text)


@router.websocket("/asr/stream")
async def stream_recognize_speech(websocket: WebSocket) -> None:
    await websocket.accept()
    scene: list[CanvasItem] = []
    thread_id = "default-canvas"
    utterance_buffer = bytearray()
    pre_speech_buffer = bytearray()
    has_speech = False
    last_speech_at = 0.0
    send_lock = asyncio.Lock()
    utterance_queue: asyncio.Queue[tuple[bytes, list[CanvasItem], str] | None] = asyncio.Queue()

    async def send_event(event: dict) -> None:
        if websocket.client_state != WebSocketState.CONNECTED:
            return

        async with send_lock:
            if websocket.client_state != WebSocketState.CONNECTED:
                return

            await websocket.send_json(event)

    async def process_utterance(audio_bytes: bytes, current_scene: list[CanvasItem], current_thread_id: str) -> None:
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

    async def process_utterance_queue() -> None:
        while True:
            item = await utterance_queue.get()

            if item is None:
                utterance_queue.task_done()
                break

            audio_bytes, current_scene, current_thread_id = item

            try:
                await process_utterance(audio_bytes, current_scene, current_thread_id)
            finally:
                utterance_queue.task_done()

    def enqueue_utterance(audio_bytes: bytes) -> None:
        utterance_queue.put_nowait((bytes(audio_bytes), list(scene), thread_id))

    try:
        queue_worker = asyncio.create_task(process_utterance_queue())
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
                                enqueue_utterance(bytes(utterance_buffer))

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
                    scene = canvas_item_list_adapter.validate_python(event.get("scene", []))
                    thread_id = str(event.get("threadId") or thread_id)
            except Exception:
                continue
    except WebSocketDisconnect:
        pass
    finally:
        if "queue_worker" in locals():
            utterance_queue.put_nowait(None)
            queue_worker.cancel()
            with suppress(asyncio.CancelledError):
                await queue_worker


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
