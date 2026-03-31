"""Layered routing: explicit command → hint → keywords → DeepSeek classifier or general."""

from __future__ import annotations

import logging
import re

import httpx

from config import get_agent_catalog

log = logging.getLogger("agent_core.router")

CLASSIFIER_MODEL = "deepseek-chat"
CLASSIFIER_MAX_TOKENS = 24
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"


def normalize_command(command: str | None) -> str | None:
    if not command:
        return None
    c = command.strip()
    if c.startswith("/"):
        c = c[1:]
    return c.lower() if c else None


async def route_task(
    task: str,
    assistant_id: str,
    command: str | None,
    agent_hint: str | None,
    *,
    api_key: str,
    http_timeout: float,
) -> tuple[str, str]:
    """
    Returns (agent_name | 'general', routing_reason).
    routing_reason ∈ command_explicit, agent_hint, keyword_match, llm_classifier, no_match
    """
    agents = get_agent_catalog(assistant_id)

    cmd_agent = normalize_command(command)
    if cmd_agent:
        if cmd_agent in agents:
            return cmd_agent, "command_explicit"
        # Invalid command for this assistant — caller should 404
        raise KeyError(cmd_agent)

    if agent_hint and agent_hint in agents:
        return agent_hint, "agent_hint"

    task_lower = task.lower()
    for name, cfg in agents.items():
        for kw in cfg.get("keywords", []) or []:
            if str(kw).lower() in task_lower:
                return name, "keyword_match"

    if not api_key.strip():
        log.warning("DEEPSEEK_API_KEY empty; skipping LLM classifier → general")
        return "general", "no_match"

    agent_names = list(agents.keys())
    if not agent_names:
        return "general", "no_match"

    descs = "\n".join(f"- {k}: {v.get('description', '')}" for k, v in agents.items())
    system = (
        f"Clasifica en exactamente una categoría: {', '.join(agent_names)}, general.\n"
        "Responde SOLO con una palabra: el nombre exacto de la categoría, sin puntuación ni explicación.\n"
        f"Categorías:\n{descs}"
    )
    payload = {
        "model": CLASSIFIER_MODEL,
        "max_tokens": CLASSIFIER_MAX_TOKENS,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": task[:2000]},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=http_timeout) as client:
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
        text = (
            body.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
            .lower()
        )
        # Take first alphanumeric token (model may add whitespace)
        m = re.match(r"^[\s:]*([a-z0-9_\-]+)", text)
        token = m.group(1) if m else ""
        if token in agents:
            return token, "llm_classifier"
    except Exception as exc:
        log.warning("classifier failed: %s → general", exc)

    return "general", "no_match"
