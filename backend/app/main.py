from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.command import router as command_router
from app.api.routes.health import router as health_router
from app.api.routes.speech import router as speech_router
from app.core.config import load_environment

load_environment()

app = FastAPI(title="VoiceCanvas API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(command_router, prefix="/api/commands")
app.include_router(health_router, prefix="/api")
app.include_router(speech_router, prefix="/api/speech")
