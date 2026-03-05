"""Cursor CLI adapter for AIRC — wraps `agent` command in headless stream-json mode."""

import asyncio
import json
import logging
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator

from server.cli_common import LOG_DIR, AGENT_TIMEOUT, write_log

logger = logging.getLogger("cli.cursor")
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="cursor")


def _resolve_agent_binary() -> tuple[str, str] | None:
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


_resolved = _resolve_agent_binary()


def _readline(stdout):
    return stdout.readline()


async def run(
    prompt: str,
    *,
    model: str = "claude-4.6-opus",
    session_id: str | None = None,
) -> AsyncGenerator[dict, None]:
    cli_args = [
        "-p", "--output-format", "stream-json",
        "--stream-partial-output", "--trust",
        "--model", model,
    ]
    if session_id:
        cli_args.extend(["--resume", session_id])
    cli_args.append(prompt)

    env = os.environ.copy()
    env["CURSOR_INVOKED_AS"] = "agent"
    env.setdefault(
        "NODE_COMPILE_CACHE",
        str(Path(os.environ.get("LOCALAPPDATA", "")) / "cursor-compile-cache"),
    )

    if _resolved:
        node_path, index_path = _resolved
        cmd = [node_path, index_path] + cli_args
    else:
        cmd = ["agent"] + cli_args

    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env,
    )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = LOG_DIR / f"cursor_{timestamp}_{proc.pid}.jsonl"

    accumulated = ""
    finished = False
    raw_lines: list[str] = []
    loop = asyncio.get_event_loop()
    start_time = datetime.now()

    try:
        while True:
            elapsed = (datetime.now() - start_time).total_seconds()
            if elapsed > AGENT_TIMEOUT:
                logger.warning("Cursor agent timed out after %ds", AGENT_TIMEOUT)
                proc.kill()
                yield {"type": "error", "message": f"Cursor agent timed out after {AGENT_TIMEOUT}s"}
                return

            try:
                line = await asyncio.wait_for(
                    loop.run_in_executor(_executor, _readline, proc.stdout),
                    timeout=60,
                )
            except asyncio.TimeoutError:
                if proc.poll() is not None:
                    break
                continue

            if not line:
                break

            decoded = line.decode("utf-8", errors="replace").strip()
            if not decoded:
                continue
            raw_lines.append(decoded)

            try:
                event = json.loads(decoded)
            except json.JSONDecodeError:
                continue

            evt_type = event.get("type")
            subtype = event.get("subtype")

            if evt_type == "assistant":
                if event.get("model_call_id") or "timestamp_ms" not in event:
                    continue
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
                sid = event.get("session_id")
                if sid:
                    yield {"type": "session", "session_id": sid}
                yield {"type": "done", "content": accumulated}
                write_log(log_file, raw_lines, prompt)
                return

            elif evt_type == "system" and subtype == "init":
                yield {"type": "init", "model": event.get("model", "")}

    finally:
        if proc.poll() is None:
            proc.kill()
        try:
            stderr_bytes = proc.stderr.read()
            stderr_out = stderr_bytes.decode("utf-8", errors="replace").strip()
            if stderr_out:
                raw_lines.append(f"[STDERR] {stderr_out}")
        except Exception:
            pass
        proc.wait(timeout=5)
        write_log(log_file, raw_lines, prompt)

    if not finished:
        if proc.returncode and proc.returncode != 0 and not accumulated:
            yield {"type": "error", "message": f"agent exited with code {proc.returncode}"}
        else:
            yield {"type": "done", "content": accumulated}
