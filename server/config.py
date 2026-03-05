import json
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parent.parent / "data"
CONFIG_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_FILE = CONFIG_DIR / "settings.json"

DEFAULTS = {
    "backend": "cursor",
    "model": "claude-4.6-opus",
    "opencode_models": [
        {"id": "zhipu/glm-5", "name": "GLM-5 (智谱)"},
        {"id": "zhipu/glm-4-plus", "name": "GLM-4-Plus (智谱)"},
        ],
    "cursor_models": [
        {"id": "claude-4.6-opus", "name": "Claude 4.6 Opus"},
        {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4"},
        ],
}


def _load() -> dict:
    if CONFIG_FILE.is_file():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            for k, v in DEFAULTS.items():
                data.setdefault(k, v)
            return data
        except Exception:
            pass
    return dict(DEFAULTS)


def _save(cfg: dict):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def get_settings() -> dict:
    return _load()


def update_settings(patch: dict) -> dict:
    cfg = _load()
    allowed = {"backend", "model", "opencode_models", "cursor_models"}
    for k, v in patch.items():
        if k in allowed:
            cfg[k] = v
    _save(cfg)
    return cfg


def get_backend() -> str:
    return _load().get("backend", "cursor")


def get_model() -> str:
    return _load().get("model", "claude-4.6-opus")
