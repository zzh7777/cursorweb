# Cursor CLI 服务器部署指南

## 1. 背景

### 1.1 什么是 Cursor CLI

Cursor CLI（命令行名称为 `agent`）是 Cursor 编辑器官方提供的命令行工具，允许用户在终端中直接使用 Cursor 的 AI 能力，无需图形界面。它特别适用于以下场景：

- **无头服务器（Headless Server）**：在没有 GUI 的远程 Linux 服务器上使用 AI 辅助编程
- **自动化脚本**：将 AI 代码分析、生成、重构集成到 CI/CD 或批处理流程中
- **远程开发**：通过 SSH 连接到服务器，直接在服务器上进行 AI 辅助开发

### 1.2 核心能力

| 能力 | 说明 |
|------|------|
| 代码分析 | 理解项目结构、分析代码逻辑 |
| 代码生成 | 根据自然语言描述生成代码 |
| 代码重构 | 自动重构、优化现有代码 |
| 文件操作 | 读取、创建、修改、删除文件 |
| Shell 执行 | 执行 shell 命令 |
| 多种输出格式 | 支持 text、json、stream-json 格式输出 |

### 1.3 注意事项

> **安全提醒**：Cursor CLI 在 `--force` 模式下可以直接读写和删除文件、执行 shell 命令。请仅在可信环境中使用，切勿在生产环境中开放不受控的访问权限。

---

## 2. 服务器环境信息

本次部署的目标服务器信息如下：

| 属性 | 值 |
|------|------|
| 域名 | zpj.io |
| 实例名称 | us-sv |
| 区域 | 美国（硅谷） |
| 公网 IP | 47.251.5.22 |
| 配置 | 2 vCPU / 4 GiB |
| 云盘 | 49 GiB（已用 3.4G，可用 44G） |
| 系统版本 | Ubuntu 24.04.3 LTS |
| 内核版本 | 6.8.0-90-generic |
| 主机名 | PicoScenesHost |

### 2.1 最低要求

- **操作系统**：Linux（推荐 Ubuntu 20.04+）、macOS 或 WSL
- **架构**：x86_64 (x64) 或 aarch64 (ARM)
- **磁盘空间**：至少 2 GB 可用空间
- **网络**：需能访问 Cursor API 服务（cursor.com）

---

## 3. 部署步骤

### 3.1 SSH 登录服务器

```bash
ssh root@47.251.5.22
```

### 3.2 确认系统架构

```bash
uname -m
```

预期输出 `x86_64`，表示 x64 架构，与 Cursor CLI 兼容。

### 3.3 安装 Cursor CLI

执行官方一键安装脚本：

```bash
curl https://cursor.com/install -fsS | bash
```

安装过程会自动完成以下操作：

1. 检测操作系统和架构（linux/x64）
2. 下载并解压安装包
3. 安装到 `~/.local/bin` 目录
4. 创建 `agent` 命令的符号链接

安装成功后会输出类似以下信息：

```
Cursor Agent Installer

✓ Detected linux/x64
✓ Package downloaded and extracted
✓ Package installed successfully
✓ Bin directory ready
✓ Symlink created

✨ Installation Complete!
```

### 3.4 配置 PATH 环境变量

安装完成后，需要将 `~/.local/bin` 添加到 PATH 中，否则终端找不到 `agent` 命令：

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

> 如果使用的是 zsh，将上面的 `.bashrc` 替换为 `.zshrc`。

### 3.5 验证安装

```bash
agent --version
```

如果正确输出版本号，说明安装成功。

---

## 4. 认证配置

Cursor CLI 需要认证后才能使用 AI 功能。：

### ：API Key 环境变量（适合脚本/自动化）

1. 登录 https://cursor.com/dashboard?tab=integrations 获取 API Key

2. 设置环境变量：

```bash
export CURSOR_API_KEY=your_api_key_here
```

3. 如需持久化，写入 shell 配置文件：

```bash
echo 'export CURSOR_API_KEY=your_api_key_here' >> ~/.bashrc
source ~/.bashrc
```

> **安全提醒**：API Key 是敏感信息，请勿将其提交到版本控制系统或暴露在公共环境中。

---

## 5. 使用方法

### 5.1 交互模式

直接启动进入对话式界面：

```bash
agent
```

在交互模式中可以与 AI 进行多轮对话，AI 可以读取、修改当前目录下的文件。

### 5.2 非交互模式（Print 模式）

使用 `-p` 或 `--print` 参数，适合脚本和自动化：

```bash
# 分析代码（只读，不修改文件）
agent -p "这个项目是做什么的？"

# 允许修改文件（需加 --force）
agent -p --force "重构这段代码，使用现代 ES6+ 语法"
```

### 5.3 输出格式

| 格式 | 参数 | 用途 |
|------|------|------|
| text（默认） | `--output-format text` | 纯文本输出，适合人类阅读 |
| json | `--output-format json` | 结构化 JSON 输出，适合程序解析 |
| stream-json | `--output-format stream-json` | 流式 JSON 输出，适合实时进度追踪 |

示例：

```bash
# JSON 格式输出
agent -p --output-format json "分析项目代码结构"

# 流式 JSON + 增量输出
agent -p --output-format stream-json --stream-partial-output "分析项目结构并生成报告"
```

### 5.4 批处理示例

对目录下所有 Python 文件添加文档注释：

```bash
find src/ -name "*.py" | while read file; do
  agent -p --force "给 $file 中的所有函数添加详细的 docstring"
done
```

### 5.5 恢复会话

使用 `--resume` 参数可以恢复之前的对话上下文：

```bash
agent --resume
```

---

## 6. 常用命令速查

| 命令 | 说明 |
|------|------|
| `agent` | 进入交互模式 |
| `agent --version` | 查看版本 |
| `agent auth login` | 交互式登录认证 |
| `agent -p "提示词"` | 非交互模式（只读） |
| `agent -p --force "提示词"` | 非交互模式（允许修改文件） |
| `agent -p --output-format json "提示词"` | JSON 格式输出 |
| `agent --resume` | 恢复上一次会话 |

---

## 7. 故障排查

### 7.1 `agent: command not found`

**原因**：`~/.local/bin` 未加入 PATH。

**解决**：

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 7.2 网络连接失败

**原因**：服务器无法访问 Cursor API 服务。

**排查**：

```bash
curl -I https://cursor.com
```

如果无法连接，检查防火墙规则或代理设置。如需使用代理：

```bash
export HTTPS_PROXY=http://proxy_host:proxy_port
```

### 7.3 认证失败

**原因**：API Key 无效或未设置。

**排查**：

```bash
echo $CURSOR_API_KEY
agent auth login
```

---

## 8. 参考资料

- [Cursor CLI 官方文档](https://cursor.com/docs/cli)
- [Cursor CLI Headless 模式文档](https://cursor.com/docs/cli/headless)
- [Cursor CLI 安装文档](https://cursor.com/docs/cli/installation)
- [Cursor CLI 认证文档](https://cursor.com/docs/cli/reference/authentication)
- [Cursor CLI 博客公告](https://cursor.com/blog/cli)
