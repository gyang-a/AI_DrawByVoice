# VoiceCanvas

VoiceCanvas 是一个 AI 语音绘图工具。用户可以通过文字或语音输入自然语言指令，由后端模型解析为结构化绘图命令，前端根据命令更新 Konva 画布。

项目采用前后端同仓库结构，包含前端页面、后端 API、讯飞 ASR 语音识别、LangChain 绘图指令解析、SVG 绘制和对象级动画能力。

## 设计文档

见：

- [docs/design.md](docs/design.md)

## 项目结构

```txt
.
├── README.md
├── AI_skill.md
├── .env.example
├── docs/
│   └── design.md
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── CanvasBoard/
│       │   ├── CommandPanel/
│       │   ├── Header/
│       │   ├── MainLayout/
│       │   └── VoicePanel/
│       ├── hooks/
│       │   ├── useAudioRecorder.ts
│       │   └── useStreamingSpeechRecognition.ts
│       ├── services/
│       │   ├── commandApi.ts
│       │   └── speechApi.ts
│       ├── types/
│       │   └── drawing.ts
│       └── utils/
│           └── executeCommand.ts
└── backend/
    ├── pyproject.toml
    └── app/
        ├── main.py
        ├── api/
        │   └── routes/
        │       ├── command.py
        │       ├── health.py
        │       └── speech.py
        ├── schemas/
        │   ├── command.py
        │   └── speech.py
        └── services/
            ├── asr_service.py
            ├── command_parser.py
            └── drawing_agent.py
```

## 启动方式

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认前端开发地址：

```txt
http://127.0.0.1:5173
```

### 启动后端

```bash
cd backend
uv sync
uv run fastapi dev app/main.py
```

默认后端地址：

```txt
http://127.0.0.1:8000
```

## 接口

### 健康检查

```txt
GET /api/health
```

### 绘图指令解析

```txt
POST /api/commands/parse
```

请求体：

```json
{
  "text": "画一个红色圆形",
  "scene": [],
  "threadId": "default-canvas"
}
```

### 讯飞 ASR HTTP 识别

```txt
POST /api/speech/asr
```

### 讯飞 ASR WebSocket 持续监听

```txt
WebSocket /api/speech/asr/stream
```

前端会持续发送 16kHz PCM 音频分片，后端根据静音检测自动断句，并把识别结果解析为绘图命令返回给前端。

## 环境变量

复制根目录下的 `.env.example`：

```bash
cp .env.example .env
```

### 绘图模型

未配置 `DRAWING_MODEL` 时，后端会使用 mock fallback，方便前端链路开发。配置后，后端会通过 LangChain 调用绘图模型并校验结构化输出。

```txt
DRAWING_MODEL=
DRAWING_MODEL_BASE_URL=
DRAWING_MODEL_API_KEY=
```

DeepSeek 等 OpenAI-compatible 模型示例：

```txt
DRAWING_MODEL=deepseek-chat
DRAWING_MODEL_BASE_URL=https://api.deepseek.com
DRAWING_MODEL_API_KEY=your_model_api_key
```

### 讯飞 ASR

```txt
XFYUN_APP_ID=
XFYUN_API_KEY=
XFYUN_API_SECRET=
```

### 后端地址

```txt
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
```

前端可通过 `VITE_API_BASE_URL` 指定后端地址；未配置时默认使用 `http://127.0.0.1:8000`。

## 技术栈

### 前端

- React 19：构建用户界面。
- Vite 8：前端开发服务器和构建。
- TypeScript 6：类型约束。
- Konva 10：Canvas 图形渲染。
- react-konva 19：在 React 中使用 Konva。

### 后端

- Python 3.12+：后端运行环境。
- FastAPI：后端 API。
- Pydantic：请求、响应和绘图命令校验。
- LangChain：绘图模型接入和模型调用编排。
- langchain-openai：接入 DeepSeek 等 OpenAI-compatible 模型。
- langchain-ollama：支持本地 Ollama 模型配置。
- websocket-client：连接讯飞语音听写 WebSocket API。

## 第三方依赖说明

| 依赖 | 用途 | 使用位置 |
| --- | --- | --- |
| react | 构建前端 UI | `frontend/` |
| react-dom | 挂载 React 应用 | `frontend/` |
| vite | 前端开发服务和构建 | `frontend/` |
| typescript | 静态类型检查 | `frontend/` |
| @vitejs/plugin-react | React JSX 转换和开发体验 | `frontend/` |
| konva | Canvas 图形渲染引擎 | `frontend/src/components/CanvasBoard/` |
| react-konva | React 中使用 Konva | `frontend/src/components/CanvasBoard/` |
| fastapi[standard] | 后端 API 和开发服务 | `backend/` |
| pydantic | 数据结构和命令协议校验 | `backend/app/schemas/` |
| langchain | 绘图模型调用编排 | `backend/app/services/drawing_agent.py` |
| langchain-openai | OpenAI-compatible 模型接入 | `backend/app/services/drawing_agent.py` |
| langchain-ollama | Ollama 本地模型接入 | `backend/app/services/drawing_agent.py` |
| websocket-client | 讯飞 ASR WebSocket 客户端 | `backend/app/services/asr_service.py` |

## 当前已实现功能

### 前端

- React + Vite + TypeScript 前端工程。
- 基础页面布局：顶部状态栏、左侧语音面板、中间画布、右侧命令和历史记录面板。
- Konva 画布渲染。
- 支持基础图形渲染：圆形、矩形、线段、文本、多边形、SVG path。
- 支持完整 SVG 对象渲染。
- 支持 SVG 安全清洗，过滤危险标签和事件属性。
- 支持右侧展示当前识别文本、模型返回命令和历史记录。
- 历史记录区域固定高度并带自定义滚动条。
- 命令 JSON 显示区域带自定义滚动条。
- 支持作品自动保存草稿，刷新页面后恢复正在编辑的作品。
- 支持手动保存和加载本地作品快照。
- 支持将当前画布导出为 PNG 图片。
- 支持测试按钮触发示例绘图命令。
- 支持通过后端 `/api/commands/parse` 解析文本命令。
- 支持持续麦克风监听，并通过 WebSocket 发送音频分片到后端。
- 支持本地采集音频并重采样为 16kHz PCM。
- 支持自动断句后的语音指令绘图链路。

### 后端

- FastAPI 后端工程。
- `/api/health` 健康检查接口。
- `/api/commands/parse` 绘图指令解析接口。
- `/api/speech/asr` 讯飞 ASR HTTP 识别接口。
- `/api/speech/asr/stream` 讯飞 ASR WebSocket 持续监听接口。
- 后端静音检测和自动断句。
- 讯飞语音听写 WebSocket 接入。
- 未配置绘图模型时提供 mock fallback。
- 配置绘图模型后通过 LangChain 调用模型。
- 使用 Pydantic 校验模型返回的结构化命令。
- 支持模型输出格式错误后的重试和 fallback。

### 绘图命令

当前已实现的命令：

- `drawShape`：绘制基础图形。
- `drawSvg`：绘制复杂 SVG 对象。
- `updateShape`：修改已有对象。
- `updateSvgPart`：按语义 part 修改 SVG 局部片段。
- `deleteShape`：删除对象。
- `clearCanvas`：清空画布。
- `undo`：撤销上一步。
- `batch`：批量执行命令，支持嵌套。
- `clearHistory`：清空右侧历史记录，同时清空 scene 和撤销栈。

### SVG 能力

- 支持完整 SVG 绘制。
- 支持 `parts` 语义化 SVG 片段。
- 支持按 `part` 替换 SVG 局部片段。
- 支持模型根据 scene 中的 SVG parts 修改局部对象。

### 动画能力

- 支持对象级通用动画协议。
- 支持 `drawShape`、`drawSvg` 和 `updateShape.params` 携带 `animation`。
- 支持动画属性：
  - `x`
  - `y`
  - `opacity`
  - `rotation`
  - `scaleX`
  - `scaleY`
  - `width`
  - `height`
- 支持 `tracks + keyframes` 表达属性变化。
- 支持 `loop` 无限循环。
- 支持 `linear`、`easeIn`、`easeOut`、`easeInOut` 缓动。
- 支持通过 `animation: null` 停止已有对象动画。

## 未完成功能

详细说明见 [docs/design.md](docs/design.md#未完成部分及原因)。

当前未完成或仅部分完成的能力：

- 画布直接编辑：尚未支持鼠标选择、拖拽、缩放控制点。
- 更稳定的复杂引用理解：当前依赖模型根据 scene 判断目标。
- SVG 内部动画：当前只支持 Konva 对象级动画，不执行 SVG 内部动画。
- 多作品管理和服务端同步：当前作品保存仅使用浏览器本地存储。
- SVG 导出和导出参数配置：当前只支持 PNG 导出。

## 开发计划

1. 增加画布对象选择和直接编辑。
2. 增加多作品列表和服务端同步。
3. 支持 SVG 导出、透明背景和导出尺寸配置。
4. 强化目标选择策略，降低复杂引用误判。
5. 扩展动画协议，支持颜色插值、路径变化和分组动画。

## 验证命令

前端构建：

```bash
cd frontend
npm run build
```

后端编译检查：

```bash
cd backend
uv run python -m compileall app
```
