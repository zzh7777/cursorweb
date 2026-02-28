import asyncio
import json
import logging
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator

LOG_DIR = Path(__file__).resolve().parent.parent / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger("cli")


def resolve_agent_binary() -> tuple[str, str] | None:
    """
    On Windows, `agent` is a .ps1 script that delegates to a versioned node binary.
    Resolve the actual node.exe + index.js path to avoid shell-encoding issues.
    """
    if sys.platform != "win32":
        return None

    local_app = os.environ.get("LOCALAPPDATA", "")
    if not local_app:
        return None

    agent_dir = Path(local_app) / "cursor-agent"
    versions_dir = agent_dir / "versions"

    if versions_dir.is_dir():
        pattern = re.compile(r"^\d{4}\.\d{1,2}\.\d{1,2}-[a-f0-9]+$")
        versions = sorted(
            [d.name for d in versions_dir.iterdir() if d.is_dir() and pattern.match(d.name)],
            reverse=True,
        )
        if versions:
            latest = versions[0]
            node_path = versions_dir / latest / "node.exe"
            index_path = versions_dir / latest / "index.js"
            if node_path.exists() and index_path.exists():
                return (str(node_path), str(index_path))

    direct_node = agent_dir / "node.exe"
    direct_index = agent_dir / "index.js"
    if direct_node.exists() and direct_index.exists():
        return (str(direct_node), str(direct_index))

    return None


_resolved = resolve_agent_binary()


MODEL = "claude-4.6-opus"


async def run_agent(prompt: str, *, workspace: str | None = None) -> AsyncGenerator[dict, None]:
    """
    Spawn Cursor Agent CLI in headless print mode.
    Yields parsed event dicts: {type: "text"/"tool"/"init"/"done"/"error", ...}
    """
    cli_args = ["-p", "--output-format", "stream-json", "--stream-partial-output", "--trust",
                "--model", MODEL]

    if workspace:
        cli_args.extend(["--workspace", workspace])

    cli_args.append(prompt)

    env = os.environ.copy()
    env["CURSOR_INVOKED_AS"] = "agent"
    env.setdefault("NODE_COMPILE_CACHE", str(Path(os.environ.get("LOCALAPPDATA", "")) / "cursor-compile-cache"))

    if _resolved:
        node_path, index_path = _resolved
        proc = await asyncio.create_subprocess_exec(
            node_path, index_path, *cli_args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
    else:
        proc = await asyncio.create_subprocess_exec(
            "agent", *cli_args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = LOG_DIR / f"{timestamp}_{proc.pid}.jsonl"

    accumulated = ""
    finished = False
    raw_lines: list[str] = []

    async for raw_line in proc.stdout:
        line = raw_line.decode("utf-8", errors="replace").strip()
        if not line:
            continue

        raw_lines.append(line)

        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue

        evt_type = event.get("type")
        subtype = event.get("subtype")

        if evt_type == "assistant":
            content = event.get("message", {}).get("content", [])
            if isinstance(content, list):
                for part in content:
                    text = part.get("text", "")
                    if text:
                        accumulated += text
                        yield {"type": "text", "content": text}

        elif evt_type == "tool_call":
            tool_call = event.get("tool_call", {})
            tool_name = "unknown"
            for k in tool_call:
                if k.endswith("ToolCall"):
                    tool_name = k.replace("ToolCall", "")
                    break
            yield {"type": "tool", "name": tool_name, "status": subtype or "unknown"}

        elif evt_type == "result":
            finished = True
            yield {"type": "done", "content": accumulated}
            _write_log(log_file, raw_lines, prompt)
            return

        elif evt_type == "system" and subtype == "init":
            yield {"type": "init", "model": event.get("model", "")}

    stderr_out = ""
    if proc.stderr:
        stderr_bytes = await proc.stderr.read()
        stderr_out = stderr_bytes.decode("utf-8", errors="replace").strip()
        if stderr_out:
            raw_lines.append(f"[STDERR] {stderr_out}")

    await proc.wait()
    _write_log(log_file, raw_lines, prompt)

    if not finished:
        if proc.returncode and proc.returncode != 0 and not accumulated:
            yield {"type": "error", "message": f"agent exited with code {proc.returncode}"}
        else:
            yield {"type": "done", "content": accumulated}


def _write_log(log_file: Path, raw_lines: list[str], prompt: str):
    try:
        with open(log_file, "w", encoding="utf-8") as f:
            f.write(f"# Prompt: {prompt[:200]}\n")
            f.write(f"# Time: {datetime.now().isoformat()}\n")
            f.write(f"# Lines: {len(raw_lines)}\n\n")
            for line in raw_lines:
                f.write(line + "\n")
    except Exception as e:
        logger.warning("Failed to write CLI log: %s", e)
