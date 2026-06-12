from pydantic import BaseModel, Field


class SpeechRecognitionResponse(BaseModel):
    text: str = Field(min_length=1)
