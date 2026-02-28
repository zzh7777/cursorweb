# CursorWeb 开发经验总结

本文档记录了在开发 CursorWeb（Cursor CLI 的 Web 前端封装）过程中积累的实战经验和踩坑记录。

---

## 1. Windows 端口管理：幽灵进程与陈旧 Socket

### 问题

在 Windows 上频繁启停 `uvicorn`（尤其是 `--reload` 模式）后，端口会出现"幽灵占用"现象：

- `netstat -ano` 显示端口仍有 `LISTENING` 状态的 PID
- `Get-Process -Id <PID>` 却找不到对应进程
- 新服务启动时报 `[Errno 10048] 地址已被占用`

### 根因

- uvicorn 的 `--reload` 模式会创建 **reloader 父进程 + worker 子进程**，`taskkill` 如果只杀子进程，父进程可能残留
- Windows 的 TCP socket 在进程被强制终止后，可能在 `TIME_WAIT` 或 `LISTENING` 状态残留数十秒
- `netstat` 输出有缓存延迟，不能完全实时反映端口状态

### 解决方案

```powershell
# 使用 /T 参数杀掉进程树
taskkill /F /PID <parent_pid> /T

# 如果端口持续被占用，最实际的做法是换端口
# 比如 3001 → 3002，同步更新 vite proxy 和 package.json
```

### 经验

- 开发环境应预留备用端口方案
- 每次重启服务前，先用 `netstat -ano | Select-String ":PORT"` 确认端口状态
- 优先使用 `taskkill /F /PID <pid> /T` 杀整棵进程树

---

## 2. Cursor CLI 的 Windows 集成

### 问题

Cursor 的 `agent` 命令在 Windows 上是一个 `.ps1` 脚本，从 Python 的 `asyncio.create_subprocess_exec` 直接调用 `agent` 会遇到 shell 编码和路径问题。

### 解决方案

绕过 `.ps1` 入口，直接定位底层的 `node.exe + index.js`：

```python
def resolve_agent_binary() -> tuple[str, str] | None:
    agent_dir = Path(os.environ["LOCALAPPDATA"]) / "cursor-agent"
    versions_dir = agent_dir / "versions"
    # 按版本号倒序查找最新的 node.exe + index.js
    # 这样可以直接用 create_subprocess_exec 调用，避免 shell 介入
```

### 关键参数

```
agent -p                       # headless print 模式
  --output-format stream-json  # JSON 流式输出
  --stream-partial-output      # 逐片段输出（而非等完整响应）
  --trust                      # 信任工作区
  --model claude-4.6-opus      # 指定模型
```

### 环境变量

必须设置以下环境变量才能正常调用：

```python
env["CURSOR_INVOKED_AS"] = "agent"
env.setdefault("NODE_COMPILE_CACHE", str(
    Path(os.environ.get("LOCALAPPDATA", "")) / "cursor-compile-cache"
))
```

---

## 3. 原始输出日志：调试的救命稻草

### 背景

AI 生成了重复内容（同一段文字出现两次），但无法判断是 CLI 输出就重复了，还是前端解析逻辑有 bug。

### 方案

在 CLI 封装层增加原始输出日志，将每次调用的 **全部 stdout 行**原样写入文件：

```python
LOG_DIR = Path(__file__).resolve().parent.parent / "data" / "logs"

def _write_log(log_file, raw_lines, prompt):
    with open(log_file, "w", encoding="utf-8") as f:
        f.write(f"# Prompt: {prompt[:200]}\n")
        f.write(f"# Time: {datetime.now().isoformat()}\n")
        f.write(f"# Lines: {len(raw_lines)}\n\n")
        for line in raw_lines:
            f.write(line + "\n")
```

### 配套的 Debug 系统

后端提供 `/admin` 页面和 `/api/debug/*` 接口，可以：

- 查看所有会话和消息原文（`/api/debug/conversations`）
- 浏览原始 CLI 日志文件列表（`/api/debug/logs`）
- 读取某个日志文件的完整内容（`/api/debug/logs/{filename}`）

### 经验

- **永远保留原始数据**：在每个数据变换层（CLI 原始输出 → 解析后的事件 → 前端展示）都应有可观测性
- 日志文件命名包含 **时间戳 + PID**，方便按时间排查
- Debug 接口只应在开发环境暴露，生产环境需加权限控制

---

## 4. FastAPI 路由与 SPA 静态文件的冲突

### 问题

使用 `app.mount("/", StaticFiles(...))` 作为 SPA fallback 后，`/admin` 和 `/api/debug/*` 等后来添加的路由全部返回 `index.html` 而非 API 响应。

### 根因

Starlette 的 `Mount` 在路径 `"/"` 上注册后，会以 **前缀匹配**方式拦截所有请求。虽然 FastAPI 的 `@app.get()` 路由会注册为 `FULL` 匹配优先，但 `Mount("/")` 也会返回 `FULL` 匹配（因为所有路径都以 `/` 开头）。

### 解决方案

确保 API 路由定义在 `app.mount` **之前**，并使用 `exception_handler` 做 404 fallback：

```python
# 先定义所有 @app.get/@app.post 路由
# ...

# 最后挂载静态文件
if DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="spa")

    @app.exception_handler(StarletteHTTPException)
    async def spa_fallback(request, exc):
        if exc.status_code == 404 and not request.url.path.startswith("/api/"):
            return FileResponse(str(DIST_DIR / "index.html"))
        return JSONResponse({"error": exc.detail}, status_code=exc.status_code)
```

### 经验

- FastAPI/Starlette 的路由匹配顺序是**定义顺序**，`Mount` 应该放在最后
- 对 `/api/` 开头的路径，404 应直接返回 JSON 错误，而非 SPA 的 `index.html`
- 开发时用 Vite proxy 可以完全绕开这个问题，但生产部署时必须正确处理

---

## 5. SSE 流式传输的前端消费

### 要点

后端使用 `StreamingResponse` + `text/event-stream` 推送实时数据：

```python
def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"
```

前端使用 `fetch` + `ReadableStream` 消费（而非 `EventSource`，因为需要 POST）：

```javascript
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    // 解析 "data: {...}" 行
}
```

### Vite Proxy 配置

SSE 通过代理时，必须禁用缓冲，否则数据会被攒批发送：

```javascript
proxy: {
    '/api': {
        target: 'http://localhost:3002',
        configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
                if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
                    proxyRes.headers['cache-control'] = 'no-cache';
                    proxyRes.headers['x-accel-buffering'] = 'no';
                }
            });
        },
    },
}
```

### 经验

- `EventSource` 只支持 GET，流式 POST 必须手动用 `ReadableStream`
- 代理层的缓冲是流式传输的隐形杀手，`X-Accel-Buffering: no` 是关键 header
- 前端解析时必须维护 `buffer` 处理半行数据，`split('\n')` 后最后一个元素可能是不完整的

---

## 6. React 流式状态管理：useRef 解决闭包陷阱

### 问题

用户在 AI 正在流式响应时切换到另一个会话，原会话的响应在 UI 上"消失"了。数据库中数据完好，但 UI 状态丢失。

### 根因

`handleSend` 中的 SSE 回调捕获的是**发送时刻的 `activeId`**（闭包）。当用户切换会话后，`activeId` 已变，但流式回调仍在向旧会话的 UI 状态写入数据——或者更糟，写入了新会话的 UI 状态。

### 解决方案

使用 `useRef` 追踪实时值，在回调中通过 ref 判断：

```javascript
const activeIdRef = useRef(activeId);
const streamingConvIdRef = useRef(null);  // 当前正在流式输出的会话 ID

useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

// 在 SSE 回调中：
if (event.type === 'text') {
    if (activeIdRef.current === currentConvId) {
        setMessages(prev => /* 更新 */);
    }
    // 如果用户已切走，跳过 UI 更新（但流仍继续，数据会存入数据库）
}

// 在 loadMessages 中：切回正在流式输出的会话时恢复状态
if (streamingConvIdRef.current === convId) {
    setStreaming(true);
}
```

### 经验

- React 的 `useState` 值在异步闭包中是"快照"，不会自动更新
- 需要实时追踪的值（如当前选中的会话 ID），使用 `useRef` + `useEffect` 同步
- 流式操作的生命周期可能跨越多次用户交互，必须设计好"归属"机制

---

## 7. PowerShell 环境下的开发陷阱

### JSON 引号问题

PowerShell 对 `curl.exe` 传递 JSON 参数时，双引号会被吃掉：

```powershell
# 错误：双引号会被 PowerShell 解释
curl.exe -d "{\"key\":\"value\"}" ...

# 正确：先存变量，或写入文件
$body = '{"key":"value"}'
curl.exe -d $body ...

# 或
'{"key":"value"}' | Out-File -Encoding ascii body.json
curl.exe -d "@body.json" ...
```

### Git Commit Message

PowerShell 不支持 heredoc 语法，多行 commit message 需要借助临时文件：

```powershell
# 写入临时文件
Set-Content -Path .commitmsg -Value "line1`nline2" -Encoding UTF8
git commit -F .commitmsg
Remove-Item .commitmsg
```

### 经验

- 在 PowerShell 中操作 CLI 工具时，引号和编码是最常见的坑
- 涉及特殊字符（中文、JSON）时，优先使用文件传参而非命令行参数
- 注意 `Out-File` 默认编码是 UTF-16，需要显式指定 `-Encoding UTF8`

---

## 8. Node.js 到 Python 的迁移要点

### 对照关系

| Node.js | Python (FastAPI) |
|---------|-------------------|
| `express` | `FastAPI` |
| `better-sqlite3` | `sqlite3`（标准库） |
| `child_process.spawn` | `asyncio.create_subprocess_exec` |
| `EventEmitter` | `AsyncGenerator` / `asyncio.Queue` |
| `uuid` | `uuid`（标准库） |
| `cors` 中间件 | `CORSMiddleware` |

### 关键差异

1. **异步模型**：Node.js 是事件循环 + 回调，Python (FastAPI) 是 `async/await` + `AsyncGenerator`
2. **SQLite 线程安全**：Python `sqlite3` 默认不允许跨线程使用同一连接，需要 `check_same_thread=False` 或每次请求创建新连接
3. **进程管理**：`asyncio.create_subprocess_exec` 不需要 shell，直接调用可执行文件，避免了 shell 注入风险
4. **静态文件服务**：Express 的 `express.static` 对应 FastAPI 的 `StaticFiles`，但后者的路由匹配行为不同（见第4节）

---

## 9. 项目架构总览

```
cursorweb/
├── server/              # Python 后端
│   ├── app.py           # FastAPI 应用、路由、SSE
│   ├── cli.py           # Cursor CLI 封装、日志
│   ├── db.py            # SQLite 数据层
│   └── admin.html       # 调试后台页面
├── src/                 # React 前端
│   ├── App.jsx          # 主应用组件、状态管理
│   ├── components/      # UI 组件
│   └── index.css        # 样式
├── data/
│   ├── cursorweb.db     # SQLite 数据库
│   └── logs/            # CLI 原始输出日志
├── dist/                # 前端构建产物
├── .venv/               # Python 虚拟环境
├── vite.config.js       # Vite + 代理配置
├── package.json         # 前端依赖 + 启动脚本
└── requirements.txt     # Python 依赖
```

---

## 10. 通用经验总结

1. **可观测性优先**：在每个数据变换层都保留原始数据的查看入口（日志文件、debug API、admin 页面）
2. **端口是稀缺资源**：开发环境中要有端口冲突的应急方案，不要死守一个端口号
3. **前后端分离开发**：Vite proxy 在开发时非常好用，但要注意 SSE/WebSocket 等长连接的代理配置
4. **Windows 不是二等公民**：但确实需要额外关注路径分隔符、编码、进程管理等差异
5. **流式交互的状态管理**：比请求-响应模式复杂得多，需要考虑中途切换、断连、重连等边界场景
6. **先让它工作，再让它优雅**：遇到诡异问题时，临时加 `print`/`console.log` 往往比精心设计的日志系统更快定位问题
