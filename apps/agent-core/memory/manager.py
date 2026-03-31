"""Namespaced memory on disk; strict validation; optional chown for UID 1000."""

from __future__ import annotations

import os
from pathlib import Path

DATA_ROOT = Path(os.environ.get("AGENT_CORE_DATA_ROOT", "/data/users"))
WORKING_MAX_BYTES = int(os.environ.get("AGENT_CORE_WORKING_MAX_BYTES", str(200 * 1024)))
_CHOWN_UID = int(os.environ.get("AGENT_CORE_FILE_UID", "1000"))
_CHOWN_GID = int(os.environ.get("AGENT_CORE_FILE_GID", "1000"))


def _chown_if_linux(path: Path) -> None:
    if os.name != "posix":
        return
    try:
        os.chown(path, _CHOWN_UID, _CHOWN_GID)
    except (OSError, PermissionError):
        pass


def _validate(assistant_id: str, namespace: str, agents: dict) -> None:
    if assistant_id not in {"me", "wife"}:
        raise ValueError(f"assistant_id inválido: {assistant_id}")
    if namespace == "global":
        return
    if namespace not in agents:
        raise ValueError(f"namespace inválido: {namespace}")


def _maybe_trim_working(path: Path) -> None:
    if not path.exists():
        return
    size = path.stat().st_size
    if size <= WORKING_MAX_BYTES:
        return
    text = path.read_text(encoding="utf-8", errors="replace")
    # Keep tail to preserve most recent context
    encoded = text.encode("utf-8")
    if len(encoded) <= WORKING_MAX_BYTES:
        return
    tail = encoded[-WORKING_MAX_BYTES :].decode("utf-8", errors="replace")
    trimmed = (
        "\n\n<!-- agent-core: truncated working.md (size limit) -->\n\n" + tail
    )
    path.write_text(trimmed, encoding="utf-8")
    _chown_if_linux(path)


def get_memory(
    assistant_id: str,
    namespace: str,
    agents: dict,
    kind: str = "memory",
) -> str:
    _validate(assistant_id, namespace, agents)
    if namespace == "global":
        path = DATA_ROOT / assistant_id / "global.md"
    else:
        path = DATA_ROOT / assistant_id / "agents" / namespace / f"{kind}.md"
        if kind == "working":
            _maybe_trim_working(path)
    return path.read_text(encoding="utf-8") if path.exists() else ""


def append_memory(
    assistant_id: str,
    namespace: str,
    agents: dict,
    content: str,
    kind: str = "memory",
) -> Path:
    _validate(assistant_id, namespace, agents)
    if namespace == "global":
        path = DATA_ROOT / assistant_id / "global.md"
    else:
        path = DATA_ROOT / assistant_id / "agents" / namespace / f"{kind}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(f"\n{content}")
    _chown_if_linux(path)
    if kind == "working":
        _maybe_trim_working(path)
    return path


def clear_working(assistant_id: str, agent: str, agents: dict) -> Path:
    _validate(assistant_id, agent, agents)
    path = DATA_ROOT / assistant_id / "agents" / agent / "working.md"
    if path.exists():
        path.unlink()
    return path
