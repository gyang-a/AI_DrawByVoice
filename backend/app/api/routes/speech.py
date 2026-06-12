from fastapi import APIRouter, File, UploadFile

from app.schemas.speech import SpeechRecognitionResponse
from app.services.asr_service import recognize_audio_file

router = APIRouter(tags=["speech"])


@router.post("/asr", response_model=SpeechRecognitionResponse)
def recognize_speech(audio: UploadFile = File(...)) -> SpeechRecognitionResponse:
    text = recognize_audio_file(audio)
    return SpeechRecognitionResponse(text=text)
