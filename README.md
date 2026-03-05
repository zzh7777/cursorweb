# AIRC - AI Rule Center

AI 驱动的医保智能监管规则中心。通过自然语言描述监管规则，AI 自动生成 SQL 查询，支持规则保存、管理和批量执行。

## 环境要求

- **Node.js** >= 18
- **Python** >= 3.10
- **Cursor CLI** 已安装（[安装指南](https://cursor.com/docs/cli/installation)）
- 已通过 `agent login` 登录，或设置 `CURSOR_API_KEY` 环境变量

## 快速开始

```bash
# 安装前端依赖
npm install

# 创建 Python 虚拟环境并安装后端依赖
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt

# 开发模式（前端 + 后端同时启动）
npm run dev

# 访问 http://localhost:5173
```

## 环境变量

在项目根目录创建 `.env` 文件配置 MySQL 连接（用于执行监管规则 SQL）：

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=medical_insurance
```

## 项目结构

```
airc/
├── server/               # FastAPI 后端
│   ├── app.py            # API 路由 + SSE 流式端点
│   ├── cli.py            # Cursor CLI 封装
│   ├── db.py             # SQLite 数据持久化（对话 + 规则）
│   └── mysql_runner.py   # MySQL 只读查询执行器
├── src/                  # React 前端
│   ├── App.jsx           # 主布局
│   └── components/
│       ├── ChatWindow.jsx    # 对话窗口
│       ├── MessageBubble.jsx # 消息气泡 + SQL 保存
│       ├── MessageInput.jsx  # 输入框
│       ├── Sidebar.jsx       # 侧边栏导航
│       ├── RulesPanel.jsx    # 规则管理面板
│       └── SettingsPanel.jsx # 设置面板
├── .env                  # MySQL 连接配置
├── requirements.txt      # Python 依赖
├── vite.config.js        # Vite 配置
└── package.json
```

## 功能

- **AI 对话** — 描述监管规则，AI 生成对应 SQL 查询
- **规则管理** — 保存、编辑、分类管理监管规则
- **批量执行** — 一键运行所有启用的规则
- **结果导出** — 查询结果支持 CSV 导出
- **流式输出** — 通过 SSE 实时显示 AI 回复
- **对话历史** — 自动保存，侧边栏浏览历史对话
- **Markdown 渲染** — AI 回复支持代码块、表格等格式
- **深色主题** — 现代化深色 UI
