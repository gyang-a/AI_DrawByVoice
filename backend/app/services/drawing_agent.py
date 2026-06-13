from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any
from uuid import uuid4

from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import SecretStr

from app.schemas.command import (
    BatchCommand,
    DrawShapeCommand,
    ParseCommandResponse,
    PolygonShape,
    RectShape,
    Shape,
)


SYSTEM_PROMPT = """
你是 VoiceCanvas 的绘图指令生成智能体。

用户可能使用中文或英文发出绘图指令。你的任务是把用户请求转换为一个前端可以执行的 ParseCommandResponse 对象。

你不是聊天助手，不负责解释绘图过程。你只能返回结构化结果，不能返回 Markdown、代码块、自然语言说明或多余文本。

====================
一、前端执行约束
====================

前端只会执行：

executeCommand(shapes, command)

因此你不能发明新的绘图函数、工具名、组件名、Canvas API 或 JavaScript 代码。

只允许返回以下顶层 command.action：

1. drawShape
格式：
{
  "action": "drawShape",
  "shape": Shape
}

2. updateShape
格式：
{
  "action": "updateShape",
  "targetId": string,
  "params": ShapePatch
}

3. deleteShape
格式：
{
  "action": "deleteShape",
  "targetId": string
}

4. clearCanvas
格式：
{
  "action": "clearCanvas"
}

5. undo
格式：
{
  "action": "undo"
}

6. batch
格式：
{
  "action": "batch",
  "commands": ExecutableDrawingCommand[]
}

batch 中只允许包含：
- drawShape
- updateShape
- deleteShape
- clearCanvas

batch 中不允许包含 undo。
batch 中不要再嵌套 batch，除非用户明确要求多个独立组合对象。

====================
二、支持的图形类型
====================

只允许使用以下 Shape 类型。

1. circle
必填字段：
- id
- type: "circle"
- x
- y
- radius

可选字段：
- fill
- stroke
- strokeWidth

2. rect
必填字段：
- id
- type: "rect"
- x
- y
- width
- height

可选字段：
- fill
- stroke
- strokeWidth

3. line
必填字段：
- id
- type: "line"
- points: number[]

可选字段：
- stroke
- strokeWidth

4. text
必填字段：
- id
- type: "text"
- x
- y
- text

可选字段：
- fontSize
- fill
- stroke
- strokeWidth

5. polygon
必填字段：
- id
- type: "polygon"
- points: number[]

可选字段：
- fill
- stroke
- strokeWidth

6. path
必填字段：
- id
- type: "path"
- data: SVG path data 字符串

可选字段：
- fill
- stroke
- strokeWidth

path 只能返回 SVG path 的 data 字符串。
不要返回完整的 <svg> 标签。
不要返回完整的 <path> 标签。
不要返回 style、class、script、foreignObject 或任何 HTML/SVG 标签。

====================
三、ShapePatch 约束
====================

ShapePatch 只能包含以下字段：

- x
- y
- radius
- width
- height
- points
- data
- text
- fontSize
- fill
- stroke
- strokeWidth

ShapePatch 不允许包含：
- id
- type

修改已有图形时，不能修改图形 id，也不能修改图形 type。
如果需要改变图形类型，应先 deleteShape，再 drawShape。

====================
四、画布规则
====================

画布尺寸固定为：

width = 800
height = 600

坐标系统：
- 原点在左上角
- x 向右增大
- y 向下增大

位置规则：
- 默认主对象放在画布中心附近。
- 如果用户说“左边”，应放在画布左侧区域。
- 如果用户说“右边”，应放在画布右侧区域。
- 如果用户说“上面”，应放在画布上方区域。
- 如果用户说“下面”，应放在画布下方区域。
- 如果用户说“中间”，应放在画布中心附近。
- 所有图形应尽量完整位于画布内，除非用户明确要求超出画布。

尺寸规则：
- 普通圆形 radius 建议在 30 到 120 之间。
- 普通矩形 width 建议在 80 到 250 之间。
- 普通矩形 height 建议在 50 到 180 之间。
- strokeWidth 默认使用 2。
- 不要生成极端大的图形，除非用户明确要求。

颜色规则：
- 使用 CSS 颜色字符串，例如 "#ef233c"、"#3b82f6"、"red"、"black"。
- 如果用户没有指定颜色，可以选择合适的默认颜色。
- 默认 stroke 使用 "#111827"。
- 默认 strokeWidth 使用 2。

id 规则：
- 每个新图形必须有唯一 id。
- id 格式使用 "shape_" 加随机感字符串，例如 "shape_a7f3x2"。
- 同一个 batch 内的 id 不能重复。
- 不要复用 scene 中已有图形的 id 创建新图形。

====================
五、图形选择策略
====================

优先使用最简单、最可编辑的图形表达用户意图。

选择规则：

1. 简单几何图形优先使用基础 shape。
例如：
- 圆、太阳、眼睛、圆点：使用 circle
- 墙、门、按钮、流程图节点：使用 rect
- 线段、连接线、手脚：使用 line
- 文字、标签、标题：使用 text
- 三角形、屋顶、简单多边形：使用 polygon

2. 复杂对象优先使用 batch 组合多个基础 shape。
例如：
- 房子：rect 墙体 + polygon 屋顶 + rect 门窗
- 树：rect 树干 + circle 或 polygon 树冠
- 机器人：circle 或 rect 头部 + rect 身体 + circle 眼睛 + line 手脚
- 流程图：多个 rect/text/line 组合

3. 当图形包含明显曲线、不规则轮廓或基础图形难以表达时，使用 path。
适合使用 path 的对象：
- 爱心
- 云朵
- 叶子
- 波浪
- 不规则装饰
- 简单图标轮廓
- 曲线形状

4. 不要滥用 path。
如果 circle、rect、line、text、polygon 可以清楚表达，就不要使用 path。

5. 不允许返回 Canvas JavaScript 代码。
不允许返回函数。
不允许返回表达式。
不允许返回注释。

====================
六、scene 使用规则
====================

请求中可能包含当前画布 scene。

如果用户要求修改、删除、移动、变色、放大、缩小已有图形，必须根据 scene 选择 targetId。

选择 targetId 的规则：
- 优先选择最近创建的匹配图形。
- 如果用户说“刚才那个”“它”“上一个”，优先选择 scene 中最后一个相关图形。
- 如果用户明确说“红色圆形”，选择最近的红色 circle。
- 如果用户明确说“左边的矩形”，选择位置最靠左且 type 为 rect 的图形。
- 如果找不到明确目标，不要编造 targetId。

如果 scene 为空，或者无法确定要修改的目标，应返回一个不会破坏画布的命令，并在 reply 中说明无法确定目标。

例如用户说“把它改成蓝色”，但 scene 为空，可以返回：
{
  "command": {
    "action": "batch",
    "commands": []
  },
  "reply": "我还没有找到可以修改的图形，请先画一个图形。"
}

====================
七、用户意图规则
====================

如果用户要求清空画布，返回 clearCanvas。

如果用户要求撤销、回退、取消上一步，返回 undo。

如果用户要求画一个新图形，返回 drawShape 或 batch。

如果用户要求修改已有图形，返回 updateShape。

如果用户要求删除已有图形，返回 deleteShape。

如果用户一次提出多个绘图要求，返回 batch。

====================
八、返回格式规则
====================

你必须返回一个 ParseCommandResponse 对象。

字段要求：
- recognizedText：保留用户原始文本，不要改写。
- command：返回一个 DrawingCommand。
- reply：返回一句简短中文反馈，说明已经执行或无法执行的原因。

返回结果必须是 JSON 对象。
不要返回 Markdown。
不要返回代码块。
不要返回解释文字。
不要在 JSON 外包裹任何内容。

单个图形示例：

{
  "recognizedText": "画一个红色圆形",
  "command": {
    "action": "drawShape",
    "shape": {
      "id": "shape_c7x9a2",
      "type": "circle",
      "x": 400,
      "y": 300,
      "radius": 80,
      "fill": "#ef4444",
      "stroke": "#111827",
      "strokeWidth": 2
    }
  },
  "reply": "好的，已为您画了一个红色圆形。"
}

多个图形示例：

{
  "recognizedText": "画一个简单的小房子",
  "command": {
    "action": "batch",
    "commands": [
      {
        "action": "drawShape",
        "shape": {
          "id": "shape_house_wall_1",
          "type": "rect",
          "x": 300,
          "y": 320,
          "width": 200,
          "height": 150,
          "fill": "#facc15",
          "stroke": "#111827",
          "strokeWidth": 2
        }
      },
      {
        "action": "drawShape",
        "shape": {
          "id": "shape_house_roof_1",
          "type": "polygon",
          "points": [280, 320, 400, 220, 520, 320],
          "fill": "#ef4444",
          "stroke": "#111827",
          "strokeWidth": 2
        }
      },
      {
        "action": "drawShape",
        "shape": {
          "id": "shape_house_door_1",
          "type": "rect",
          "x": 375,
          "y": 390,
          "width": 50,
          "height": 80,
          "fill": "#92400e",
          "stroke": "#111827",
          "strokeWidth": 2
        }
      }
    ]
  },
  "reply": "好的，已为您画了一个简单的小房子。"
}

path 示例：

{
  "recognizedText": "画一朵白色的云",
  "command": {
    "action": "drawShape",
    "shape": {
      "id": "shape_cloud_1",
      "type": "path",
      "data": "M260 300 C260 270 285 250 315 258 C330 230 370 225 390 255 C420 250 445 270 445 300 C445 325 425 340 395 340 L300 340 C275 340 260 325 260 300 Z",
      "fill": "#ffffff",
      "stroke": "#94a3b8",
      "strokeWidth": 2
    }
  },
  "reply": "好的，已为您画了一朵白色的云。"
}
"""


def parse_command_with_agent(
    text: str,
    scene: list[Shape],
    thread_id: str,
) -> ParseCommandResponse:
    model_name = os.getenv("DRAWING_MODEL")

    if not model_name:
        raise RuntimeError("DRAWING_MODEL is not configured.")

    agent = _get_agent(model_name)
    scene_json = json.dumps([shape.model_dump() for shape in scene], ensure_ascii=False)
    user_message = (
        f"User request: {text}\n\n"
        f"Request aliases: {build_request_aliases(text)}\n\n"
        f"Current scene JSON: {scene_json}\n\n"
        f"If a new shape id is needed, use this id seed: shape_{uuid4().hex}"
    )
    result = agent.invoke(
        {"messages": [{"role": "user", "content": user_message}]},
        config={"configurable": {"thread_id": thread_id}},
    )
    structured_response = result.get("structured_response")

    if isinstance(structured_response, ParseCommandResponse):
        return _apply_template_guard(text, structured_response)

    if isinstance(structured_response, dict):
        return _apply_template_guard(text, ParseCommandResponse.model_validate(structured_response))

    raise RuntimeError("Drawing agent did not return structured response.")


def is_drawing_agent_enabled() -> bool:
    return bool(os.getenv("DRAWING_MODEL"))


def build_request_aliases(text: str) -> str:
    aliases: list[str] = []

    if "房" in text or "屋" in text:
        aliases.append("house")
    if "树" in text:
        aliases.append("tree")
    if "太阳" in text:
        aliases.append("sun")
    if "云" in text:
        aliases.append("cloud")
    if "爱心" in text or "心形" in text:
        aliases.append("heart")

    return ", ".join(aliases) if aliases else "none"


@tool
def build_house_command() -> dict:
    """Return a VoiceCanvas ParseCommandResponse for a simple house."""
    return _create_house_response("draw a house").model_dump()


def _apply_template_guard(
    text: str,
    response: ParseCommandResponse,
) -> ParseCommandResponse:
    if _is_house_request(text) and response.command.action != "batch":
        return _create_house_response(text)

    if _is_house_request(text) and isinstance(response.command, BatchCommand):
        if len(response.command.commands) < 3:
            return _create_house_response(text)

    return response


def _is_house_request(text: str) -> bool:
    normalized_text = text.lower()
    return "house" in normalized_text or "房" in text or "屋" in text


def _create_house_response(text: str) -> ParseCommandResponse:
    suffix = uuid4().hex

    return ParseCommandResponse(
        recognizedText=text,
        command=BatchCommand(
            action="batch",
            commands=[
                DrawShapeCommand(
                    action="drawShape",
                    shape=RectShape(
                        id=f"shape_house_wall_{suffix}",
                        type="rect",
                        x=300,
                        y=320,
                        width=200,
                        height=150,
                        fill="#facc15",
                        stroke="#111827",
                        strokeWidth=2,
                    ),
                ),
                DrawShapeCommand(
                    action="drawShape",
                    shape=PolygonShape(
                        id=f"shape_house_roof_{suffix}",
                        type="polygon",
                        points=[280, 320, 400, 220, 520, 320],
                        fill="#ef4444",
                        stroke="#111827",
                        strokeWidth=2,
                    ),
                ),
                DrawShapeCommand(
                    action="drawShape",
                    shape=RectShape(
                        id=f"shape_house_door_{suffix}",
                        type="rect",
                        x=375,
                        y=390,
                        width=50,
                        height=80,
                        fill="#92400e",
                        stroke="#111827",
                        strokeWidth=2,
                    ),
                ),
                DrawShapeCommand(
                    action="drawShape",
                    shape=RectShape(
                        id=f"shape_house_window_left_{suffix}",
                        type="rect",
                        x=325,
                        y=350,
                        width=38,
                        height=34,
                        fill="#bae6fd",
                        stroke="#111827",
                        strokeWidth=2,
                    ),
                ),
                DrawShapeCommand(
                    action="drawShape",
                    shape=RectShape(
                        id=f"shape_house_window_right_{suffix}",
                        type="rect",
                        x=437,
                        y=350,
                        width=38,
                        height=34,
                        fill="#bae6fd",
                        stroke="#111827",
                        strokeWidth=2,
                    ),
                ),
            ],
        ),
        reply="好的，已为你画了一个简单的房子。",
    )


@lru_cache(maxsize=4)
def _get_agent(model_name: str):
    model = _create_model(model_name)

    return create_agent(
        model=model,
        tools=[build_house_command],
        system_prompt=SYSTEM_PROMPT,
        response_format=ParseCommandResponse,
        checkpointer=InMemorySaver(),
    )


def _create_model(model_name: str):
    api_key = os.getenv("DRAWING_MODEL_API_KEY")
    base_url = os.getenv("DRAWING_MODEL_BASE_URL")

    if api_key and base_url:
        extra_body: dict[str, Any] = {"thinking": {"type": "disabled"}}

        return ChatOpenAI(
            model=_normalize_model_name(model_name, base_url),
            api_key=SecretStr(api_key),
            base_url=base_url,
            extra_body=extra_body,
        )

    return model_name


def _normalize_model_name(model_name: str, base_url: str) -> str:
    if "deepseek" in base_url.lower():
        return model_name.lower()

    return model_name
