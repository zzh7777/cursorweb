"""Shared utilities for CLI adapters."""

import logging
from datetime import datetime
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parent.parent / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

AGENT_TIMEOUT = 300

logger = logging.getLogger("cli")


def write_log(log_file: Path, raw_lines: list[str], prompt: str):
    try:
        with open(log_file, "w", encoding="utf-8") as f:
            f.write(f"# Prompt: {prompt[:200]}\n")
            f.write(f"# Time: {datetime.now().isoformat()}\n")
            f.write(f"# Lines: {len(raw_lines)}\n\n")
            for line in raw_lines:
                f.write(line + "\n")
    except Exception as e:
        logger.warning("Failed to write CLI log: %s", e)
