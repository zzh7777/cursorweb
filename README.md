# Cursor Web Chat

通过 Web 界面调用 Cursor CLI（headless 模式）与 AI 对话，支持流式输出和对话历史。

## 环境要求

- **Node.js** >= 18
- **Cursor CLI** 已安装（[安装指南](https://cursor.com/docs/cli/installation)）
- 已通过 `agent login` 登录，或设置 `CURSOR_API_KEY` 环境变量

### 安装 Cursor CLI

```powershell
# Windows PowerShell
irm 'https://cursor.com/install?win32=true' | iex

# macOS / Linux / WSL
curl https://cursor.com/install -fsS | bash
```

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（前端 + 后端同时启动）
npm run dev

# 访问 http://localhost:5173
```

## 生产部署

```bash
# 构建前端
npm run build

# 启动服务
npm start

# 访问 http://localhost:3001
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 后端服务端口 | 3001 |
| `CURSOR_API_KEY` | Cursor API Key（可选，也可通过 `agent login` 认证） | - |

## 项目结构

```
cursorweb/
├── server/            # Express 后端
│   ├── index.js       # API 路由 + SSE 流式端点
│   ├── cli.js         # Cursor CLI 封装
│   └── db.js          # SQLite 数据持久化
├── src/               # React 前端
│   ├── App.jsx        # 主布局
│   └── components/    # UI 组件
├── vite.config.js     # Vite 配置
└── package.json
```

## 功能

- **流式对话** — 通过 SSE 实时显示 AI 回复
- **对话历史** — 自动保存，侧边栏浏览历史对话
- **模型选择** — 支持切换不同 AI 模型
- **Markdown 渲染** — AI 回复支持代码块、列表等格式
- **深色主题** — 现代化深色 UI
- **响应式布局** — 支持桌面端和移动端
