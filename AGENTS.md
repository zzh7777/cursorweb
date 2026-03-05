# AIRC (AI Rule Center) - 项目规则

## 项目概述

AIRC 是一个 AI 聊天 + 医保监管规则管理的 Web 应用。前端使用 React + Vite + Tailwind CSS，后端使用 FastAPI（Python），支持 Cursor CLI 和 OpenCode 双后端。

## 技术栈

- **前端**: React 19 + Vite 6 + Tailwind CSS 4
- **后端**: FastAPI + uvicorn
- **数据库**: SQLite（应用数据） + MySQL/PostgreSQL（医保业务数据）
- **AI 引擎**: Cursor CLI (subprocess) / OpenCode (HTTP API 直连 LLM)

## 医保监管规则工作流程

当用户给出医保监管规则时：

1. 阅读 `.opencode/skills/medical-insurance-sql/SKILL.md` 获取 SQL 生成指南
2. 分析规则的违规类型（重复收费 / 数量超标 / 折扣收费 / 周期频次）
3. 按 SKILL.md 的输出要求生成规范的 SQL
4. 将 SQL 放在 ```sql 代码块中输出
5. 完成自审检查清单

## 严禁行为

- **不要**创建 Python 脚本来插入规则到数据库
- **不要**直接操作 SQLite 数据库文件（`data/aircweb.db`）
- **不要**调用 API 来创建规则
- **不要**使用 Shell 工具执行数据库操作
- **不要**修改项目中的任何文件来存储规则

## 原因

Web UI 中的 MessageBubble 组件会自动识别 SQL 代码块，并在代码块上显示「保存为规则」按钮。用户点击该按钮即可将 SQL 保存到规则管理系统中。你只需要专注于生成高质量的 SQL。

## 代码风格约定

- 前端组件使用函数式组件 + Hooks
- CSS 使用 Tailwind 工具类，遵循暗色主题（zinc-950 背景色系）
- 后端 API 路由统一在 `server/app.py` 中定义
- 配置管理通过 `server/config.py` + `data/settings.json`
- 始终使用中文回复用户
