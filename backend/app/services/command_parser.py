from uuid import uuid4

from app.schemas.command import (
    CanvasItem,
    CircleShape,
    ClearCanvasCommand,
    DrawShapeCommand,
    ParseCommandResponse,
    PathShape,
    RectShape,
    Shape,
    ShapePatch,
    UndoCommand,
    UpdateShapeCommand,
)
from app.services.drawing_agent import is_drawing_agent_enabled, parse_command_with_agent


def parse_command(text: str, scene: list[CanvasItem], thread_id: str) -> ParseCommandResponse:
    if not is_drawing_agent_enabled():
        response = parse_mock_command(text, scene)
        response.reply = f"[mock] {response.reply}"
        return response

    return parse_command_with_agent(text, scene, thread_id)


def parse_mock_command(text: str, scene: list[CanvasItem]) -> ParseCommandResponse:
    # 这里先用规则模拟 AI 输出，保证接口形状和前端命令协议先跑通。
    # 真正的大模型解析会在后续 PR 放到独立 llm_client / parser 服务中。
    normalized_text = text.strip()

    if "撤销" in normalized_text:
        return ParseCommandResponse(
            command=UndoCommand(action="undo"),
            reply="已撤销上一步操作。",
            recognizedText=normalized_text,
        )

    if "清空" in normalized_text:
        return ParseCommandResponse(
            command=ClearCanvasCommand(action="clearCanvas"),
            reply="画布已清空。",
            recognizedText=normalized_text,
        )

    if "改成蓝色" in normalized_text or "变成蓝色" in normalized_text:
        # 简单模拟上下文引用：优先修改当前 scene 中最近的圆形。
        target = _find_latest_shape(scene, "circle")

        if target is not None:
            return ParseCommandResponse(
                command=UpdateShapeCommand(
                    action="updateShape",
                    targetId=target.id,
                    params=ShapePatch(fill="#3b82f6"),
                ),
                reply="已把圆形改成蓝色。",
                recognizedText=normalized_text,
            )

    if "矩形" in normalized_text:
        return ParseCommandResponse(
            command=DrawShapeCommand(
                action="drawShape",
                shape=RectShape(
                    id=_create_shape_id(),
                    type="rect",
                    x=96,
                    y=96,
                    width=180,
                    height=112,
                    fill="#3b82f6",
                    stroke="#1d4ed8",
                    strokeWidth=2,
                ),
            ),
            reply="好的，已为你画一个蓝色的矩形。",
            recognizedText=normalized_text,
        )

    if "爱心" in normalized_text or "心形" in normalized_text or "heart" in normalized_text.lower():
        return ParseCommandResponse(
            command=DrawShapeCommand(
                action="drawShape",
                shape=PathShape(
                    id=_create_shape_id(),
                    type="path",
                    data=(
                        "M400 520 C250 390 180 300 220 220 "
                        "C250 160 330 160 400 240 "
                        "C470 160 550 160 580 220 "
                        "C620 300 550 390 400 520 Z"
                    ),
                    fill="#ef233c",
                    stroke="#991b1b",
                    strokeWidth=2,
                ),
            ),
            reply="好的，已为你画一个红色的爱心。",
            recognizedText=normalized_text,
        )

    return ParseCommandResponse(
        command=DrawShapeCommand(
            action="drawShape",
            shape=CircleShape(
                id=_create_shape_id(),
                type="circle",
                x=400,
                y=300,
                radius=100,
                fill="#ef233c",
                stroke="#111827",
                strokeWidth=3,
            ),
        ),
        reply="好的，已为你画一个红色的圆形。",
        recognizedText=normalized_text,
    )


def _create_shape_id() -> str:
    # 后端是 mock 命令生产者，因此由后端生成完整 shape id。
    return f"shape_{uuid4().hex}"


def _find_latest_shape(scene: list[CanvasItem], shape_type: str) -> Shape | None:
    for item in reversed(scene):
        if isinstance(item, Shape) and item.type == shape_type:
            return item

    return None
