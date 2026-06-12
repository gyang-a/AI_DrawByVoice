import asyncio
from contextlib import suppress

from fastapi import APIRouter, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect

from app.schemas.speech import SpeechRecognitionResponse
from app.services.asr_service import XfyunStreamingRecognizer, recognize_audio_file

router = APIRouter(tags=["speech"])


@router.post("/asr", response_model=SpeechRecognitionResponse)
def recognize_speech(audio: UploadFile = File(...)) -> SpeechRecognitionResponse:
    text = recognize_audio_file(audio)
    return SpeechRecognitionResponse(text=text)


@router.websocket("/asr/stream")
async def stream_recognize_speech(websocket: WebSocket) -> None:
    await websocket.accept()
    loop = asyncio.get_running_loop()
    result_queue: asyncio.Queue[dict[str, str]] = asyncio.Queue()

    def enqueue_result(text: str, is_final: bool) -> None:
        event_type = "final" if is_final else "partial"
        loop.call_soon_threadsafe(result_queue.put_nowait, {"type": event_type, "text": text})

    def enqueue_error(message: str) -> None:
        loop.call_soon_threadsafe(result_queue.put_nowait, {"type": "error", "text": message})

    recognizer: XfyunStreamingRecognizer | None = None
    try:
        recognizer = XfyunStreamingRecognizer(enqueue_result, enqueue_error)
        recognizer.start()
    except HTTPException as exc:
        await websocket.send_json({"type": "error", "text": str(exc.detail)})
        await websocket.close()
        return

    async def send_results() -> None:
        while True:
            event = await result_queue.get()
            await websocket.send_json(event)

    sender_task = asyncio.create_task(send_results())

    try:
        await websocket.send_json({"type": "ready", "text": ""})

        while True:
            message = await websocket.receive()

            if "bytes" in message and message["bytes"]:
                recognizer.send_audio(message["bytes"])
                continue

            text_message = message.get("text")
            if text_message == "end":
                recognizer.finish()
            elif text_message == "close":
                break
    except WebSocketDisconnect:
        pass
    finally:
        sender_task.cancel()
        with suppress(asyncio.CancelledError):
            await sender_task
        if recognizer is not None:
            recognizer.close()
