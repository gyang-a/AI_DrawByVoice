# VoiceCanvas

VoiceCanvas 是一个 AI 语音绘图工具项目。本仓库采用前后端同仓库结构，当前阶段只完成项目脚手架，为后续画布、命令执行器、AI 指令解析和语音能力做准备。

## 项目结构

```txt
.
├── README.md
├── .env.example
├── .gitignore
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.css
│       ├── App.tsx
│       ├── components/
│       │   ├── CanvasBoard/
│       │   ├── CommandPanel/
│       │   ├── Header/
│       │   ├── MainLayout/
│       │   └── VoicePanel/
│       ├── types/
│       │   └── drawing.ts
│       ├── utils/
│       │   └── executeCommand.ts
│       ├── index.css
│       ├── main.tsx
│       └── vite-env.d.ts
└── backend/
    ├── pyproject.toml
    ├── app/
    │   ├── __init__.py
    │   ├── main.py
    │   └── api/
    │       ├── __init__.py
    │       └── routes/
    │           ├── __init__.py
    │           └── health.py
    └── tests/
        └── __init__.py
```

## 启动方式

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 启动后端

```bash
cd backend
uv sync
uv run fastapi dev app/main.py
```

健康检查接口：

```txt
GET /api/health
```

## 环境变量

复制根目录下的 `.env.example`，按后续阶段需要配置变量。

```bash
cp .env.example .env
```

当前 PR 不接入真实 AI、语音识别或数据库，因此没有必填环境变量。

## 技术栈

### 前端

- React 19.2.7：用于构建用户界面。
- Vite 8.0.16：用于前端开发服务器和构建。
- TypeScript 6.0.3：用于类型约束。
- @vitejs/plugin-react 6.0.2：用于 Vite 的 React 支持。
- Konva 10.3.0：用于 Canvas 图形渲染。
- react-konva 19.2.5：用于在 React 组件中使用 Konva。

### 后端

- Python 3.12+：后端运行环境。
- FastAPI 0.136.3：用于构建后端 API。
- Pydantic 2.13.4：用于后续请求和响应数据校验。

## 第三方依赖说明

| 依赖 | 用途 | 使用位置 |
| --- | --- | --- |
| react | 构建前端 UI | `frontend/` |
| react-dom | 将 React 应用挂载到浏览器 DOM | `frontend/` |
| vite | 前端开发服务和构建 | `frontend/` |
| typescript | 提供静态类型检查 | `frontend/` |
| @vitejs/plugin-react | 支持 React JSX 转换和开发体验 | `frontend/` |
| konva | Canvas 图形渲染引擎 | `frontend/src/components/CanvasBoard/` |
| react-konva | 在 React 中使用 Konva 渲染图形 | `frontend/src/components/CanvasBoard/` |
| fastapi[standard] | 提供 FastAPI 应用和 `fastapi dev` 命令 | `backend/` |
| pydantic | 后续 API schema 校验 | `backend/` |

## 当前已实现功能

- 前后端同仓库目录结构。
- 最小 React + Vite + TypeScript 前端入口。
- 前端基础布局骨架和职责拆分组件。
- 前端静态页面内容和基础视觉样式。
- 前端绘图类型与命令协议。
- 前端命令执行器纯函数，绘图命令需携带图形 `id`。
- 前端 Konva 静态画布渲染。
- 前端测试按钮模拟绘图命令。
- 最小 FastAPI 后端入口。
- `/api/health` 健康检查接口。

## 开发计划

1. 后端 mock / AI 指令解析接口。
2. 语音识别和语音反馈。
