"""Build system prompt and call DeepSeek for specialized agents."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import httpx

from memory import manager as memory_manager

log = logging.getLogger("agent_core.runner")

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
_APP_DIR = Path(__file__).resolve().parent.parent


def _prompt_root() -> Path:
    raw = os.environ.get("AGENT_CORE_CONFIG_ROOT", "").strip()
    return Path(raw) if raw else _APP_DIR


async def run_specialized(
    *,
    task: str,
    context: str | None,
    assistant_id: str,
    agent_name: str,
    agent_cfg: dict,
    agents_catalog: dict,
    api_key: str,
    llm_timeout: float,
) -> tuple[str, dict]:
    """
    Returns (assistant_text, token_usage dict with input/output ints).
    """
    prompt_file = agent_cfg.get("prompt_file", f"prompts/{agent_name}.txt")
    path = _prompt_root() / prompt_file
    if not path.is_file():
        raise FileNotFoundError(f"prompt file missing: {path}")
    base_prompt = path.read_text(encoding="utf-8")

    global_mem = memory_manager.get_memory(assistant_id, "global", agents_catalog)
    agent_mem = memory_manager.get_memory(
        assistant_id, agent_name, agents_catalog, kind="memory"
    )
    working_mem = memory_manager.get_memory(
        assistant_id, agent_name, agents_catalog, kind="working"
    )

    system = base_prompt
    if global_mem.strip():
        system += f"\n\n## Contexto del usuario (global)\n{global_mem.strip()}"
    if agent_mem.strip():
        system += f"\n\n## Memoria durable ({agent_name})\n{agent_mem.strip()}"
    if working_mem.strip():
        system += f"\n\n## Working notes ({agent_name})\n{working_mem.strip()}"

    user_content = task.strip()
    if context and context.strip():
        user_content = (
            f"Contexto reciente (conversación):\n{context.strip()}\n\n"
            f"Tarea:\n{user_content}"
        )

    model = agent_cfg.get("model", "deepseek-chat")
    max_out = int(agent_cfg.get("max_output", 1200))

    payload = {
        "model": model,
        "max_tokens": max_out,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
    }

    async with httpx.AsyncClient(timeout=llm_timeout) as client:
        r = await client.post(
            DEEPSEEK_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        r.raise_for_status()
        body = r.json()

    choice = body.get("choices", [{}])[0]
    text = (choice.get("message") or {}).get("content", "").strip()
    usage = body.get("usage") or {}
    token_usage = {
        "input": int(usage.get("prompt_tokens", 0)),
        "output": int(usage.get("completion_tokens", 0)),
    }
    return text, token_usage
