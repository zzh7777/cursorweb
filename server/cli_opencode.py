"""OpenCode adapter — calls LLM API directly via httpx streaming."""

import json
import logging
import os
from pathlib import Path
from typing import AsyncGenerator

import httpx

from server.cli_common import LOG_DIR, AGENT_TIMEOUT, write_log

# 医保规则分析时的 system 提示：确保大模型按 SKILL.md 第五节输出结构回复，且必须包含 SQL
MEDICAL_RULE_SYSTEM_PROMPT = """你是医保基金监管规则分析助手。当用户提供医保监管规则（包括 JSON 格式的序号、违规行为、医保项目编码、问题描述、政策依据等，或图片、文字描述）时，你必须按以下结构完整回复，且必须包含「生成的 SQL」部分，不得只做规则解读而不生成 SQL。

回复结构（缺一不可）：
1. 开场：说明已按《医保线上监管 SQL 生成指南》分析，并指出规则类型（类型一重复/互斥、类型二数量超标、类型三折扣收费、类型四周期频次等）。
2. 规则分析表格：规则编号、违规类型、A组/B组、折扣率或阈值、共现范围、违规判定等。
3. **生成的 SQL**：在「生成的 SQL」小标题下，给出完整、可复制执行的 MySQL 代码，用 ```sql 代码块包裹，含规则编号与政策依据的注释。
4. 自审检查：列出与本条 SQL 相关的检查项并标明已满足。
5. 逻辑说明：B 组匹配方式、A 组触发条件、违规判定与违规金额计算方式。

指南详见项目内 .cursor/skills/medical-insurance-sql/SKILL.md（表结构、字段、违规金额公式、踩坑清单等）。若信息不足可先做合理假设并说明后再生成 SQL。"""

logger = logging.getLogger("cli.opencode")

PROJECT_DIR = Path(__file__).resolve().parent.parent

PROVIDER_DEFAULTS: dict[str, dict] = {
    "zhipu": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "env_key": "ZHIPUAI_API_KEY",
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "env_key": "OPENAI_API_KEY",
    },
    "anthropic": {
        "base_url": "https://api.anthropic.com/v1",
        "env_key": "ANTHROPIC_API_KEY",
    },
}


def _load_env() -> dict[str, str]:
    """Load env vars from .env file (if present) merged with os.environ."""
    env = dict(os.environ)
    dotenv_path = PROJECT_DIR / ".env"
    if dotenv_path.is_file():
        for line in dotenv_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def _resolve_provider(model: str, env: dict[str, str]) -> tuple[str, str, str]:
    """Return (api_base_url, api_key, model_name) from a 'provider/model' string."""
    if "/" in model:
        provider, model_name = model.split("/", 1)
    else:
        provider, model_name = "zhipu", model

    defaults = PROVIDER_DEFAULTS.get(provider, {})
    base_url = defaults.get("base_url", "https://open.bigmodel.cn/api/paas/v4")
    env_key = defaults.get("env_key", "ZHIPUAI_API_KEY")
    api_key = env.get(env_key, "")

    if not api_key:
        api_key = env.get("LLM_API_KEY", "")

    return base_url, api_key, model_name


async def run(
    prompt: str,
    *,
    model: str = "zhipu/glm-5",
    history: list[dict] | None = None,
) -> AsyncGenerator[dict, None]:
    env = _load_env()
    base_url, api_key, model_name = _resolve_provider(model, env)

    if not api_key:
        yield {"type": "error", "message": f"API key not configured for model {model}. Check your .env file."}
        return

    yield {"type": "init", "model": model}

    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    messages = [{"role": "system", "content": MEDICAL_RULE_SYSTEM_PROMPT}]
    if history:
        messages.extend([{"role": m["role"], "content": m["content"]} for m in history])
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model_name,
        "messages": messages,
        "stream": True,
    }

    accumulated = ""
    raw_lines: list[str] = []
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = LOG_DIR / f"opencode_{timestamp}.jsonl"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(AGENT_TIMEOUT, connect=15)) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    err_text = body.decode("utf-8", errors="replace")
                    raw_lines.append(err_text)
                    try:
                        err_json = json.loads(err_text)
                        msg = err_json.get("error", {}).get("message", err_text)
                    except Exception:
                        msg = err_text
                    yield {"type": "error", "message": f"API error ({resp.status_code}): {msg}"}
                    write_log(log_file, raw_lines, prompt)
                    return

                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break
                    raw_lines.append(data_str)
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    choices = chunk.get("choices", [])
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        accumulated += content
                        yield {"type": "text", "content": content}

    except httpx.ConnectError as e:
        yield {"type": "error", "message": f"Connection failed: {e}"}
        return
    except httpx.TimeoutException:
        yield {"type": "error", "message": f"Request timed out after {AGENT_TIMEOUT}s"}
        return
    except Exception as e:
        yield {"type": "error", "message": f"Unexpected error: {e}"}
        return

    yield {"type": "done", "content": accumulated}
    write_log(log_file, raw_lines, prompt)
