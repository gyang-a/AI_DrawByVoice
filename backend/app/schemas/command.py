from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ShapeType = Literal["circle", "rect", "line", "text", "polygon", "path"]


class BaseShape(BaseModel):
    id: str
    type: ShapeType
    fill: str | None = None
    stroke: str | None = None
    strokeWidth: int | None = None


class CircleShape(BaseShape):
    type: Literal["circle"]
    x: float
    y: float
    radius: float


class RectShape(BaseShape):
    type: Literal["rect"]
    x: float
    y: float
    width: float
    height: float


class LineShape(BaseShape):
    type: Literal["line"]
    points: list[float]


class TextShape(BaseShape):
    type: Literal["text"]
    x: float
    y: float
    text: str
    fontSize: int | None = None


class PolygonShape(BaseShape):
    type: Literal["polygon"]
    points: list[float]


class PathShape(BaseShape):
    type: Literal["path"]
    data: str


Shape = CircleShape | RectShape | LineShape | TextShape | PolygonShape | PathShape


class ShapePatch(BaseModel):
    x: float | None = None
    y: float | None = None
    radius: float | None = None
    width: float | None = None
    height: float | None = None
    points: list[float] | None = None
    data: str | None = None
    text: str | None = None
    fontSize: int | None = None
    fill: str | None = None
    stroke: str | None = None
    strokeWidth: int | None = None


class DrawShapeCommand(BaseModel):
    action: Literal["drawShape"]
    shape: Shape


class DrawSvgCommand(BaseModel):
    action: Literal["drawSvg"]
    id: str | None = None
    svg: str
    x: float
    y: float
    width: float
    height: float


class UpdateShapeCommand(BaseModel):
    action: Literal["updateShape"]
    targetId: str
    params: ShapePatch


class DeleteShapeCommand(BaseModel):
    action: Literal["deleteShape"]
    targetId: str


class ClearCanvasCommand(BaseModel):
    action: Literal["clearCanvas"]


class BatchCommand(BaseModel):
    action: Literal["batch"]
    # Mock 阶段只约束一层 batch，避免在还未引入 Agent 规划前增加递归 schema 复杂度。
    commands: list[DrawShapeCommand | DrawSvgCommand | UpdateShapeCommand | DeleteShapeCommand | ClearCanvasCommand]


ExecutableDrawingCommand = (
    DrawShapeCommand
    | DrawSvgCommand
    | UpdateShapeCommand
    | DeleteShapeCommand
    | ClearCanvasCommand
    | BatchCommand
)


class UndoCommand(BaseModel):
    action: Literal["undo"]


DrawingCommand = ExecutableDrawingCommand | UndoCommand


class ParseCommandRequest(BaseModel):
    text: str = Field(min_length=1)
    scene: list[Shape] = Field(default_factory=list)
    threadId: str = "default-canvas"


class ParseCommandResponse(BaseModel):
    command: DrawingCommand
    reply: str
    recognizedText: str
