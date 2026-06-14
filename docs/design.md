# VoiceCanvas 设计文档

## 项目目标

VoiceCanvas 是一个面向语音交互的 AI 绘图工具。项目目标是让用户通过自然语言或语音指令控制画布，完成图形绘制、对象修改、SVG 局部编辑、动画控制和历史记录管理。

本项目不是让大模型直接生成前端代码，而是让大模型返回结构化绘图命令。前端只执行约定好的命令协议，从而保证行为可控、可校验、可回滚。

## 总体架构

项目采用前后端同仓库结构：

- `frontend/`：React + TypeScript + Konva，负责页面交互、语音采集、命令展示、画布渲染和命令执行。
- `backend/`：FastAPI + Pydantic + LangChain，负责语音识别、绘图指令解析、模型调用和命令结构校验。
- `docs/`：保存设计说明、能力规划和比赛材料。

核心链路：

```txt
用户语音/文本
  -> 前端采集并发送给后端
  -> 后端 ASR 识别语音文本
  -> 后端绘图模型解析为结构化命令
  -> 前端 executeCommand 执行命令
  -> Konva 根据 scene 渲染画布
```

## 指令协议设计

后端返回统一的 `ParseCommandResponse`：

```json
{
  "recognizedText": "用户原始输入",
  "reply": "简短中文反馈",
  "command": {
    "action": "drawShape"
  }
}
```

前端只识别 `command.action` 中定义过的命令，为避免xss攻击，不执行任意 JavaScript、Canvas API 或模型生成代码。

## 计划支持的指令能力

| 能力 | 计划说明 | 当前状态 |
| --- | --- | --- |
| 基础图形绘制 | 绘制圆、矩形、线段、文本、多边形、路径 | 已实现 |
| 复杂 SVG 绘制 | 绘制完整 SVG 对象，支持高复杂度图形 | 已实现 |
| 语义化 SVG parts | SVG 对象保留 `parts`，便于后续局部修改 | 已实现 |
| 修改已有对象 | 修改位置、尺寸、颜色、文字、路径等属性 | 已实现 |
| SVG 局部修改 | 按 `part` 替换 SVG 局部片段 | 已实现 |
| 删除对象 | 删除指定图形 | 已实现 |
| 清空画布 | 清空当前 scene | 已实现 |
| 撤销 | 回退到上一步 scene | 已实现 |
| 批量命令 | 一次执行多个绘图或修改动作 | 已实现 |
| 嵌套批量命令 | 支持 batch 中继续包含 batch | 已实现 |
| 清空历史记录 | 清空右侧历史记录，同时清空 scene 和撤销栈 | 已实现 |
| 对象级动画 | 用结构化 animation 描述闪烁、旋转、平移、缩放等效果 | 已实现 |
| 停止对象动画 | 通过 `animation: null` 停止已有动画 | 已实现 |
| 语音识别 | 前端持续监听，后端调用讯飞 ASR 识别 | 已实现 |
| 自动断句 | 检测静音后自动提交本句指令 | 已实现 |
| 保存/加载作品 | 保存当前画布并恢复，刷新页面后继续编辑 | 已实现 |
| 导出图片和动画 | 导出当前画布为 PNG 文件或 WebM 动画 | 已实现 |
| 选择/拖拽编辑 | 用户直接在画布上选择、拖拽、缩放对象 | 未完成 |
| 多轮精细编辑 | 更稳定地理解“刚才那个”“左边那个”等复杂引用 | 部分实现 |

## 已实现命令

### `drawShape`

绘制基础图形：

- `circle`
- `rect`
- `line`
- `text`
- `polygon`
- `path`

示例：

```json
{
  "action": "drawShape",
  "shape": {
    "id": "shape_circle_1",
    "type": "circle",
    "x": 400,
    "y": 300,
    "radius": 80,
    "fill": "#ef4444"
  }
}
```

### `drawSvg`

绘制完整 SVG 对象。复杂对象可以携带 `parts`，用于后续语义化局部修改。

```json
{
  "action": "drawSvg",
  "id": "shape_rocket_1",
  "svg": "<svg></svg>",
  "viewBox": "0 0 200 200",
  "parts": [
    {
      "part": "左翼",
      "svg": "<path />"
    }
  ],
  "x": 300,
  "y": 160,
  "width": 200,
  "height": 200
}
```

### `updateShape`

修改已有对象。普通图形和 SVG 对象都可以通过该命令修改位置、尺寸和部分属性。

```json
{
  "action": "updateShape",
  "targetId": "shape_circle_1",
  "params": {
    "fill": "#3b82f6",
    "x": 460
  }
}
```

### `updateSvgPart`

按 `part` 修改 SVG 局部片段。

```json
{
  "action": "updateSvgPart",
  "targetId": "shape_rocket_1",
  "part": "左翼",
  "svg": "<path d=\"...\" fill=\"#facc15\" />"
}
```

### `deleteShape`

删除指定对象。

```json
{
  "action": "deleteShape",
  "targetId": "shape_circle_1"
}
```

### `clearCanvas`

清空画布 scene。

```json
{
  "action": "clearCanvas"
}
```

### `undo`

撤销上一步画布操作。

```json
{
  "action": "undo"
}
```

### `batch`

批量执行多个命令，支持嵌套 batch。

```json
{
  "action": "batch",
  "commands": [
    {
      "action": "drawShape",
      "shape": {
        "id": "shape_rect_1",
        "type": "rect",
        "x": 300,
        "y": 300,
        "width": 180,
        "height": 120
      }
    }
  ]
}
```

### `clearHistory`

清空右下角历史记录，同时清空 scene 和撤销栈。

```json
{
  "action": "clearHistory"
}
```

## 动画协议

动画不是单独命令，而是对象上的 `animation` 字段。该字段可以出现在：

- `drawShape.shape.animation`
- `drawSvg.animation`
- `updateShape.params.animation`

动画使用通用 `tracks + keyframes` 协议描述属性变化。

```json
{
  "duration": 5000,
  "loop": true,
  "easing": "linear",
  "tracks": [
    {
      "property": "rotation",
      "keyframes": [
        { "offset": 0, "value": 0 },
        { "offset": 1, "value": 360 }
      ]
    }
  ]
}
```

当前支持的动画属性：

- `x`
- `y`
- `opacity`
- `rotation`
- `scaleX`
- `scaleY`
- `width`
- `height`

示例能力：

- 闪烁：`opacity` 在 `1 -> 0.25 -> 1` 之间循环。
- 旋转：`rotation` 在 `0 -> 360` 之间循环。
- 平移：`x` 或 `y` 在两个位置之间变化。
- 呼吸缩放：`scaleX` 和 `scaleY` 在 `1 -> 1.1 -> 1` 之间循环。

停止动画使用：

```json
{
  "action": "updateShape",
  "targetId": "shape_earth_1",
  "params": {
    "animation": null
  }
}
```

## 语音交互设计

语音识别链路为：

```txt
前端麦克风采集
  -> 重采样为 16kHz PCM
  -> WebSocket 发送音频分片
  -> 后端静音检测和自动断句
  -> 讯飞 ASR 识别
  -> 后端绘图模型解析
  -> 前端执行绘图命令
```

实现特点：

- 麦克风持续开启后，用户说完一句话无需点击停止。
- 后端检测静音后将当前语音片段提交识别。
- 后续音频会继续进入下一轮识别，不需要重启麦克风。
- 前端持续同步当前 scene 给后端，方便模型修改已有对象。

## 大模型解析设计

后端使用 LangChain 接入绘图模型。模型输出必须是 JSON，并通过 Pydantic schema 校验,校验不通过返回给模型重新输出。

模型配置通过环境变量提供：

```txt
DRAWING_MODEL=
DRAWING_MODEL_BASE_URL=
DRAWING_MODEL_API_KEY=
```

对于 DeepSeek 等 OpenAI-compatible 模型，可以通过 `DRAWING_MODEL_BASE_URL` 和 `DRAWING_MODEL_API_KEY` 接入，不需要为每个模型单独安装 SDK。

未配置 `DRAWING_MODEL` 时，后端使用 mock 解析，便于前端开发和演示基础链路。

## 未完成部分及原因

### 语音反馈

未完成。当前重点放在后端 ASR、持续监听和绘图命令执行链路。语音反馈需要补充 TTS 或浏览器播报策略，并处理频繁命令下的打断、队列和播报节流。

### 作品保存、加载和刷新恢复

已实现。当前采用浏览器 `localStorage` 保存作品快照：

- 自动保存草稿：scene、撤销栈、当前文本、AI 返回命令和右侧历史记录会自动写入本地草稿。
- 刷新恢复：页面刷新后优先恢复草稿，保证正在编辑的作品不会消失。
- 手动保存：点击“保存”会写入手动保存快照。
- 手动加载：点击“加载”会恢复最近一次手动保存的作品。

当前保存能力是单机浏览器本地保存，不包含用户账号、多作品列表或服务端同步。

### 导出图片和动画

已实现。当前支持两类导出：

- PNG：导出当前画布瞬时状态。
- WebM：通过 `canvas.captureStream()` 和 `MediaRecorder` 录制当前画布动画，默认导出 5 秒 WebM 文件。

限制：

- 暂不支持导出 SVG 文件。
- 暂不支持选择导出尺寸、透明背景、录制时长或文件格式。
- WebM 导出依赖浏览器对 `MediaRecorder`、`canvas.captureStream()` 和 WebM 编码的支持。

### 画布直接编辑

未完成。当前项目强调语音和 AI 指令驱动，尚未实现鼠标选择、拖拽、缩放、旋转控制点等交互。

### 更稳定的复杂引用理解

部分实现。当前模型会收到 scene 并可根据 id、类型、位置和 parts 选择目标，但复杂引用仍依赖模型理解能力，例如“把左边第二个小图标的眼睛变亮”这类指令还需要更强的目标选择策略。

### SVG 内部动画

未完成。当前动画是 Konva 对象级动画，不执行 SVG 内部 `<animate>`、CSS animation 或 JavaScript。这样更安全、可控，但无法表达路径变形等 SVG 内部动画。

## 当前限制

- 所有绘图和动画都必须通过结构化命令表达。
- 前端不会执行模型生成的任意代码。
- 动画作用于 Konva 对象级属性，不支持颜色插值和 SVG path morph。
- ASR 依赖讯飞服务和正确的环境变量配置。
- 模型输出质量受提示词和所选模型能力影响。

## 后续计划

1. 增加多作品列表和服务端同步。
2. 增加 SVG 导出、透明背景、导出时长和导出尺寸配置。
3. 增加画布对象选择和直接编辑。
4. 增强目标选择策略，减少复杂引用误判。
5. 扩展动画协议，支持颜色、路径和分组动画。
6. 补充自动化测试和端到端演示脚本。
