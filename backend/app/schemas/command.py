from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


ShapeType = Literal["circle", "rect", "line", "text", "polygon", "path"]
MAX_BATCH_DEPTH = 10


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


class SvgPart(BaseModel):
    part: str
    svg: str


class SvgCanvasItem(BaseModel):
    id: str
    kind: Literal["svg"]
    svg: str
    viewBox: str | None = None
    parts: list[SvgPart] | None = None
    x: float
    y: float
    width: float
    height: float


CanvasItem = Shape | SvgCanvasItem


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
    svg: str | None = None
    viewBox: str | None = None
    parts: list[SvgPart] | None = None
    x: float
    y: float
    width: float
    height: float

    @model_validator(mode="after")
    def validate_svg_content(self) -> DrawSvgCommand:
        if not self.svg and not self.parts:
            raise ValueError("drawSvg requires either svg or parts")

        return self


class UpdateShapeCommand(BaseModel):
    action: Literal["updateShape"]
    targetId: str
    params: ShapePatch


class UpdateSvgPartCommand(BaseModel):
    action: Literal["updateSvgPart"]
    targetId: str
    part: str
    svg: str


class DeleteShapeCommand(BaseModel):
    action: Literal["deleteShape"]
    targetId: str


class ClearCanvasCommand(BaseModel):
    action: Literal["clearCanvas"]


class BatchCommand(BaseModel):
    action: Literal["batch"]
    commands: list[ExecutableDrawingCommand]

    @model_validator(mode="after")
    def validate_batch_depth(self) -> BatchCommand:
        if _get_batch_depth(self) > MAX_BATCH_DEPTH:
            raise ValueError(f"batch nesting depth cannot exceed {MAX_BATCH_DEPTH}")

        return self


ExecutableDrawingCommand = (
    DrawShapeCommand
    | DrawSvgCommand
    | UpdateShapeCommand
    | UpdateSvgPartCommand
    | DeleteShapeCommand
    | ClearCanvasCommand
    | BatchCommand
)


class UndoCommand(BaseModel):
    action: Literal["undo"]


DrawingCommand = ExecutableDrawingCommand | UndoCommand


def _get_batch_depth(command: ExecutableDrawingCommand) -> int:
    if not isinstance(command, BatchCommand):
        return 0

    if not command.commands:
        return 1

    return 1 + max(_get_batch_depth(sub_command) for sub_command in command.commands)


class ParseCommandRequest(BaseModel):
    text: str = Field(min_length=1)
    scene: list[CanvasItem] = Field(default_factory=list)
    threadId: str = "default-canvas"


class ParseCommandResponse(BaseModel):
    command: DrawingCommand
    reply: str
    recognizedText: str
