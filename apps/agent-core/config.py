"""Load assistants catalog from YAML."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml

_APP_DIR = Path(__file__).resolve().parent


def assistants_yaml_path() -> Path:
    raw = os.environ.get("ASSISTANTS_YAML", "").strip()
    if raw:
        return Path(raw)
    return _APP_DIR / "assistants.yaml"


@lru_cache
def load_assistants() -> dict:
    path = assistants_yaml_path()
    if not path.is_file():
        raise FileNotFoundError(f"assistants.yaml not found: {path}")
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict) or "assistants" not in data:
        raise ValueError("assistants.yaml must contain top-level 'assistants' key")
    return data["assistants"]


def reload_assistants_catalog() -> dict:
    """Clear cache and reload assistants.yaml from disk (hot reload)."""
    load_assistants.cache_clear()
    return load_assistants()


def get_agent_catalog(assistant_id: str) -> dict:
    assistants = load_assistants()
    block = assistants.get(assistant_id)
    if not isinstance(block, dict):
        return {}
    agents = block.get("agents", {})
    return agents if isinstance(agents, dict) else {}
