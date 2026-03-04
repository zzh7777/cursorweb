# cursor-CLI / opencode-CLI 集成方案与 AIRC Web UI 原型探索

> **作者：** 王荣斌  
> **日期：** 2026-03-03  
> **关联 Issue：** [CHS-XDU/TeamDiscussions#18](https://github.com/CHS-XDU/TeamDiscussions/issues/18)

---

## 一、调研概述

本报告调研 cursor-CLI 与 opencode-CLI 两款命令行 AI 编程工具的核心能力，分析其在 AIRC 医保监管算法端项目中的适用性，并给出将 **代码生成**、**规则执行**、**问数（Text-to-SQL）** 三项能力接入 Web UI 的集成方案设计。

---

## 二、cursor-CLI 调研

### 2.1 安装方式

| 平台 | 命令 |
|------|------|
| macOS / Linux / WSL | `curl https://cursor.com/install -fsS \| bash` |
| Windows PowerShell | `irm 'https://cursor.com/install?win32=true' \| iex` |

安装后通过 `agent login` 或设置 `CURSOR_API_KEY` 环境变量完成认证。

### 2.2 基本用法

```bash
# 启动交互式对话
agent

# 带初始 prompt 的对话
agent "refactor the auth module to use JWT tokens"

# 非交互（Headless）模式，用于脚本/CI
agent -p "分析这段代码的安全隐患"

# 指定模型
agent --model claude-4.6-opus "生成单元测试"
```

**三种工作模式：**

| 模式 | 切换方式 | 说明 |
|------|---------|------|
| Agent（默认） | `--mode=agent` | 完整工具访问，可读写文件、执行命令 |
| Plan | `--plan` 或 `/plan` | 只读模式，先设计方案再编码 |
| Ask | `--mode=ask` | 只读代码探索，不做任何修改 |

### 2.3 对话管理

```bash
# 列出历史会话
agent ls

# 恢复指定会话
agent resume <chat-id>

# 通过参数恢复
agent --resume="chat-id" "继续上次的任务"
```

对话支持 **Cloud Agent 移交**——在消息前加 `&` 或使用 `-c` 标志，可将对话推送到云端继续运行。

### 2.4 Skill 定义机制

Cursor 通过目录约定加载 Skill：

```
.cursor/skills/<skill-name>/SKILL.md
```

每个 `SKILL.md` 包含 YAML 前置元数据（name, description）和详细的指导说明。Agent 在处理任务时会根据技能描述自动匹配并加载对应的 Skill。

**当前项目已定义的 Skill 示例：** `.cursor/skills/medical-insurance-sql/SKILL.md`，用于医保监管规则的 SQL 生成。

### 2.5 MCP（Model Context Protocol）接入

Cursor 通过 `.cursor/mcp.json` 或 IDE 设置配置 MCP 服务器。CLI 层面支持：

```bash
# 在 CLI 会话中启用/禁用 MCP 服务器
/mcp enable <server-name>
/mcp disable <server-name>
```

MCP 扩展 API 支持动态注册 MCP 服务器，无需修改配置文件，适合企业级部署。

### 2.6 Headless 模式（关键集成能力）

```bash
# 非交互模式 + JSON 流式输出
agent -p --output-format stream-json --stream-partial-output "你的指令"

# 允许自动修改文件（CI/CD 场景）
agent -p --force "重构为 ES6+ 语法"
```

输出格式支持 `text`、`json`、`stream-json`，其中 `stream-json` 可逐行解析事件，适合被外部程序包装。

**已知限制：**
- Headless 模式在某些场景下可能在响应结束后挂起
- 不支持通过 stdin 管道传入 prompt（需通过命令行参数）
- 无原生 REST API 服务器，需通过封装 subprocess 实现

---

## 三、opencode-CLI 调研

### 3.1 安装方式

```bash
# 通过 npm 全局安装
npm install -g @opencode-ai/cli

# 初始化配置
opencode init
```

**前置条件：** Node.js >= 18、Git、Docker（可选，用于沙箱容器）。

### 3.2 基本用法

```bash
# 启动 TUI 交互界面
opencode

# 执行单次任务
opencode run "分析项目依赖安全漏洞"

# 启动 headless API 服务器
opencode serve --port 4096

# 启动带浏览器界面的 Web 服务
opencode web --port 8080
```

**核心交互模式：**

| 模式 | 命令 | 说明 |
|------|------|------|
| TUI 交互 | `opencode` / `opencode tui` | 终端图形界面，支持探索与调试 |
| 单次执行 | `opencode run "task"` | 脚本与自动化场景 |
| Headless 服务 | `opencode serve` | 暴露 OpenAPI 端点，供自定义前端调用 |
| Web 界面 | `opencode web` | 内置浏览器界面 |
| 附加连接 | `opencode attach` | 连接到运行中的后端服务 |

### 3.3 对话管理

```bash
# 继续上一次会话
opencode --continue

# 附加到运行中的服务
opencode attach
```

支持 Session 持久化，多客户端可连接同一后端实例。

### 3.4 Skill 定义机制

OpenCode 的 Skill 机制与 Cursor 类似，通过 `SKILL.md` 文件定义：

- **项目级目录：** `.opencode/skills/`、`.claude/skills/`、`.agents/skills/`
- **全局级目录：** `~/.config/opencode/skills/`

2026 年 1 月起，Skill 可作为 TUI 中的斜杠命令调用（`/skillname`），并支持通过 `opencode.json` 自定义技能目录。

### 3.5 MCP 接入

```bash
# 添加 MCP 服务器
opencode mcp add

# 列出已配置的 MCP 服务器
opencode mcp list

# 认证 MCP 服务器
opencode mcp auth <name>

# 调试连接
opencode mcp debug <name>
```

MCP 服务器可在配置文件中声明，支持本地/远程部署、环境变量注入。

### 3.6 Headless 服务模式（关键集成能力）

`opencode serve` 启动一个标准的 HTTP 服务器，暴露 OpenAPI 3.1 规范的 REST API：

- **API 文档：** `http://<host>:<port>/doc`
- **默认端口：** 4096
- **认证方式：** HTTP Basic Auth（通过 `OPENCODE_SERVER_PASSWORD` 环境变量）
- **跨域支持：** 内置 CORS 配置
- **服务发现：** 支持 mDNS

**API 覆盖范围：** 项目管理、会话管理、VCS 信息、配置管理、Provider 管理等。

---

## 四、cursor-CLI vs opencode-CLI 对比分析

### 4.1 核心能力对比

| 维度 | cursor-CLI | opencode-CLI |
|------|-----------|-------------|
| **开源性** | 闭源，商业产品 | 开源（MIT），45,000+ GitHub Stars |
| **安装方式** | 一键脚本安装 | npm 全局安装 + `opencode init` |
| **模型支持** | Anthropic / OpenAI / Gemini 等（内置） | 75+ Provider，支持自带 API Key |
| **免费使用** | 有限免费额度，需付费订阅 | 免费（自带 API Key），支持免费模型（Grok 等） |
| **Skill 机制** | `.cursor/skills/SKILL.md` | `.opencode/skills/SKILL.md`（兼容多目录） |
| **MCP 支持** | IDE 设置 + CLI 命令 | CLI 命令 + 配置文件 |
| **Headless 模式** | `-p` 标志，输出 stream-json | `opencode serve`，原生 REST API |
| **Web 界面** | 无内置（需自行封装，如本项目） | 内置 `opencode web` 命令 |
| **对话持久化** | `agent ls` / `agent resume` | `--continue` / `opencode attach` |
| **CI/CD 集成** | `-p --force` + `CURSOR_API_KEY` | `opencode run` + API Key |
| **IDE 集成度** | 深度集成 Cursor IDE | 终端原生，IDE 无关 |

### 4.2 集成架构对比

```
cursor-CLI 集成模式：
┌──────────┐   subprocess    ┌──────────┐   stream-json    ┌──────────┐
│  Web UI  │ ──────────────> │ 封装层   │ <──────────────> │ agent -p │
│ (前端)   │ <── SSE ─────── │ (FastAPI)│                  │ (CLI)    │
└──────────┘                 └──────────┘                  └──────────┘

opencode-CLI 集成模式：
┌──────────┐   HTTP/REST     ┌─────────────────┐
│  Web UI  │ ──────────────> │ opencode serve   │
│ (前端)   │ <── JSON ────── │ (原生 API 服务器) │
└──────────┘                 └─────────────────┘
```

**关键差异：**
- cursor-CLI 需要通过 subprocess 封装（如本项目 `server/cli.py` 的实现），解析 `stream-json` 输出
- opencode-CLI 提供原生 REST API（`opencode serve`），前端可直接调用，集成更简洁

### 4.3 在 AIRC 项目中的适用场景

| 场景 | 推荐工具 | 理由 |
|------|---------|------|
| **日常开发（IDE 内编码）** | cursor-CLI | 深度集成 IDE，Skill/Rule 机制成熟，团队已有实践 |
| **CI/CD 自动化** | 两者均可 | cursor 的 `-p --force` 和 opencode 的 `run` 均适用 |
| **Web UI 原型集成** | opencode-CLI（首选） | 原生 REST API，无需 subprocess 封装，架构更简洁 |
| **服务器部署** | opencode-CLI | 开源免费、原生服务模式、无 IDE 依赖 |
| **医保规则 SQL 生成** | cursor-CLI | 已有完整 Skill 定义和知识库，迁移成本较高 |
| **多模型切换测试** | opencode-CLI | 75+ Provider 支持，灵活切换 |

---

## 五、AIRC 算法端 Web UI 原型集成方案

### 5.1 轻量 Web UI 方案调研

| 方案 | 特点 | 集成方式 | 适用性评估 |
|------|------|---------|-----------|
| **Open WebUI** | 功能丰富的 LLM 聊天平台，支持 OpenAPI Tool Server | 通过 OpenAPI Tool Server 接入自定义后端 | ⭐⭐⭐⭐ 功能全面，但偏重通用对话 |
| **Gradio** | Python 快速原型，内置 MCP Client/Server 支持 | `gr.ChatInterface` + MCP/subprocess 集成 | ⭐⭐⭐⭐⭐ 最适合快速原型 + MCP 集成 |
| **Streamlit** | Python 数据应用框架，st.chat_message 聊天组件 | subprocess 调用 CLI + Streamlit 状态管理 | ⭐⭐⭐ 简单但缺少原生流式支持 |
| **自研前端（当前项目）** | React + FastAPI + Cursor CLI 封装 | 已实现，见 `server/cli.py` + `server/app.py` | ⭐⭐⭐⭐ 高度可控，已有基础 |

### 5.2 推荐方案：基于 Gradio 的三合一 Web UI

选择 Gradio 作为 Web UI 框架，理由：
1. **MCP 原生支持** — `pip install "gradio[mcp]"`，可作为 MCP Client 连接 opencode/cursor
2. **流式输出** — 内置 generator 流式渲染，无需额外 SSE 框架
3. **开发效率** — Python 单文件即可完成原型
4. **部署灵活** — `launch(share=True)` 一键共享，`.launch(server_name="0.0.0.0")` 局域网访问

### 5.3 三项能力的集成设计

#### 能力一：代码生成（AI 生成规则代码）

```
┌─────────────────────────────────────────────────────────┐
│                    Gradio Web UI                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Tab 1: 规则代码生成                              │    │
│  │  [规则描述输入框]                                  │    │
│  │  [模板选择下拉框: 门诊/住院/药品/...]              │    │
│  │  [生成] → 流式输出代码 + Markdown 渲染             │    │
│  │  [复制代码] [下载 .py 文件]                        │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│  方案 A: cursor-CLI      │   agent -p --output-format stream-json
│  (利用已有 Skill)        │   "根据规则描述生成 SQL: {user_input}"
├─────────────────────────┤
│  方案 B: opencode serve  │   POST /api/chat { prompt: "..." }
│  (原生 REST API)         │
├─────────────────────────┤
│  方案 C: 直接 LLM API    │   调用 Claude/GPT API + System Prompt
│  (最轻量)                │   加载 SKILL.md 作为上下文
└─────────────────────────┘
```

**推荐方案 A + C 混合：** 简单的 SQL 生成直接调用 LLM API（方案 C，低延迟），复杂的多步骤代码生成通过 cursor-CLI（方案 A，利用 Skill 和工具能力）。

#### 能力二：规则执行（触发执行并查看结果）

```
┌─────────────────────────────────────────────────────────┐
│                    Gradio Web UI                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Tab 2: 规则执行                                  │    │
│  │  [SQL 编辑器 / 代码预览]                           │    │
│  │  [目标数据库选择]                                  │    │
│  │  [执行] → 进度显示                                 │    │
│  │  [结果表格展示] [导出 CSV/Excel]                   │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│  FastAPI 后端服务         │
│  - /api/execute-sql      │   接收 SQL，执行查询，返回结果
│  - /api/execute-rule     │   接收规则代码，在沙箱中执行
│  - 连接 MySQL 数据库      │   使用 pymysql/sqlalchemy
│  - 权限控制 (只读连接)    │   防止误操作
└─────────────────────────┘
```

**实现要点：**
- 数据库连接使用**只读账号**，防止 Web UI 误修改数据
- SQL 执行前进行**安全校验**（禁止 DROP/DELETE/UPDATE 等写操作）
- 结果使用 `gr.Dataframe` 组件展示，支持排序、筛选
- 大结果集分页加载，前端展示 Top N 行 + 总数提示

#### 能力三：问数（Text-to-SQL）

```
┌─────────────────────────────────────────────────────────┐
│                    Gradio Web UI                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Tab 3: 智能问数                                  │    │
│  │  [自然语言输入: "查询2025年门诊费用超过1万的参保人"] │    │
│  │  ↓ AI 生成 SQL                                    │    │
│  │  [SQL 预览 + 编辑]                                 │    │
│  │  [确认执行] → 查询结果表格                          │    │
│  │  [AI 解读结果]                                     │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│                处理流水线                                 │
│  1. 自然语言 → LLM + SKILL.md 上下文 → 生成 SQL         │
│  2. SQL 安全校验 → 只读检查 + 语法检查                    │
│  3. 用户确认 → 执行查询                                  │
│  4. 结果 → LLM 解读 → 自然语言总结                       │
└─────────────────────────────────────────────────────────┘
```

**实现要点：**
- 加载 `SKILL.md` 中的表结构、字段说明作为 LLM 上下文
- 采用 **"生成 → 预览 → 确认 → 执行"** 的安全流程，避免直接执行 AI 生成的 SQL
- 支持 SQL 手动编辑修正
- 执行后由 AI 对结果进行自然语言解读

### 5.4 整体架构设计

```
┌────────────────────────────────────────────────────────────────────┐
│                          Gradio Web UI                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │ 代码生成 Tab  │  │ 规则执行 Tab  │  │  智能问数 Tab         │     │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘     │
└─────────┼─────────────────┼─────────────────────┼─────────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                       FastAPI 后端                                  │
│                                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐      │
│  │ /api/generate│  │ /api/execute│  │ /api/text-to-sql      │      │
│  │  代码生成     │  │  规则执行    │  │  自然语言→SQL→执行→解读 │      │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬───────────┘      │
│         │                │                     │                   │
│  ┌──────┴──────────────────────────────────────┴──────────┐       │
│  │              AI 引擎层                                   │       │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │       │
│  │  │ cursor-CLI   │  │ opencode API │  │ 直接 LLM API  │  │       │
│  │  │ (subprocess) │  │ (REST)       │  │ (Claude/GPT)  │  │       │
│  │  └─────────────┘  └──────────────┘  └───────────────┘  │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │              数据层                                       │       │
│  │  ┌──────────┐  ┌─────────────┐  ┌────────────────────┐ │       │
│  │  │ MySQL    │  │ SKILL.md    │  │ knowledge-base.md  │ │       │
│  │  │ (医保库)  │  │ (表结构/规则) │  │ (积累的知识)        │ │       │
│  │  └──────────┘  └─────────────┘  └────────────────────┘ │       │
│  └─────────────────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────────────┘
```

### 5.5 技术栈选型

| 层次 | 技术选型 | 理由 |
|------|---------|------|
| **前端 UI** | Gradio（原型阶段） / React（生产阶段） | Gradio 快速验证，React 用于生产级 UI |
| **后端 API** | FastAPI（已有基础） | 异步支持、流式 SSE、自动 OpenAPI 文档 |
| **AI 引擎** | cursor-CLI + 直接 LLM API | 复杂任务走 CLI，简单任务直接调 API |
| **数据库连接** | pymysql + SQLAlchemy | 连接医保 MySQL 数据库 |
| **MCP 桥接** | Gradio MCP Client（可选） | 连接 MCP 服务器扩展工具能力 |

---

## 六、可行性评估

### 6.1 已有基础

本项目（`cursorweb`）已实现的能力为原型提供了坚实基础：

| 已实现 | 文件 | 说明 |
|--------|------|------|
| Cursor CLI 封装 | `server/cli.py` | subprocess 调用 + stream-json 解析 |
| SSE 流式输出 | `server/app.py` | FastAPI SSE 端点 |
| 对话管理 | `server/db.py` | SQLite 持久化 |
| 前端聊天界面 | `src/` | React + Vite |
| 医保 SQL Skill | `.cursor/skills/` | 表结构、规则、知识库 |

### 6.2 需要新增的工作

| 工作项 | 工作量估计 | 优先级 |
|--------|-----------|--------|
| Gradio 原型 UI（三个 Tab） | 2-3 天 | P0 |
| MySQL 数据库只读连接 + SQL 执行接口 | 1 天 | P0 |
| Text-to-SQL 流水线（生成→预览→执行→解读） | 2-3 天 | P0 |
| 代码生成接口（cursor-CLI / LLM API） | 1-2 天 | P1 |
| opencode-CLI 服务模式集成（可选） | 1-2 天 | P2 |
| 安全机制（SQL 校验、权限控制） | 1 天 | P1 |
| 生产级 React UI 替换 Gradio | 5-7 天 | P3 |

**预计原型验证周期：1-2 周**

### 6.3 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| cursor-CLI Headless 模式偶尔挂起 | 影响响应可靠性 | 设置超时机制（已实现 5 分钟超时），备用直接 LLM API 通道 |
| AI 生成的 SQL 可能有安全隐患 | 数据库风险 | 只读连接 + SQL 白名单校验 + 用户确认环节 |
| 模型 API 成本 | 预算控制 | opencode 可切换免费模型，cursor 有额度限制 |
| 医保数据隐私合规 | 法律风险 | Web UI 部署在内网，禁止外网访问 |

---

## 七、下一步推进建议

### 第一阶段（1-2 周）：Gradio 快速原型

1. 基于 Gradio 搭建三合一 Web UI 原型
2. 接入当前 `server/cli.py` 的 cursor-CLI 封装能力
3. 实现 MySQL 只读查询接口
4. 完成 Text-to-SQL 端到端 Demo

### 第二阶段（2-3 周）：opencode-CLI 评估集成

1. 在服务器上部署 `opencode serve`
2. 对比 cursor-CLI 和 opencode serve 在代码生成任务上的响应质量和稳定性
3. 根据评估结果决定主力 AI 引擎

### 第三阶段（按需）：生产化

1. 将 Gradio 原型替换为 React 生产级 UI（可复用当前 `src/` 组件）
2. 接入团队统一认证
3. 部署到 AIRC 内网环境

---

## 八、总结

| 结论 | 说明 |
|------|------|
| **日常开发推荐 cursor-CLI** | Skill/Rule 机制成熟，IDE 集成度高，团队已有积累 |
| **服务端集成推荐 opencode-CLI** | 原生 REST API，开源免费，适合 Headless 场景 |
| **Web UI 原型推荐 Gradio** | 开发效率最高，原生 MCP 支持，适合快速验证 |
| **两者可互补使用** | cursor-CLI 用于开发阶段，opencode serve 用于运行时服务 |
| **本项目已有良好基础** | `cursorweb` 的 CLI 封装和前端架构可直接复用 |
