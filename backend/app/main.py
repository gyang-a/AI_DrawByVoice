from fastapi import FastAPI

from app.api.routes.command import router as command_router
from app.api.routes.health import router as health_router

app = FastAPI(title="VoiceCanvas API")

app.include_router(command_router, prefix="/api/commands")
app.include_router(health_router, prefix="/api")
