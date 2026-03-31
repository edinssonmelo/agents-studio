"""Parse slash-commands from user messages (mirror for tests; OpenClaw applies same rules)."""

from __future__ import annotations

# Superset for parsing; catalog validation happens in Core against assistants.yaml
KNOWN_AGENT_SLUGS = ("design", "marketing", "business", "dev")

COMMANDS_TO_AGENTS = {f"/{a}": a for a in KNOWN_AGENT_SLUGS}


def parse_command(message: str) -> dict:
    """
    Returns:
        type: agent | list_agents | general | reset_agent | none
        agent: str | None
        clean_task: str
    """
    parts = message.strip().split(None, 2)
    if not parts:
        return {"type": "none", "agent": None, "clean_task": message}

    token = parts[0].lower()

    if token == "/agentes":
        return {"type": "list_agents", "agent": None, "clean_task": ""}

    if token == "/general":
        return {"type": "general", "agent": None, "clean_task": " ".join(parts[1:])}

    if token in COMMANDS_TO_AGENTS:
        return {
            "type": "agent",
            "agent": COMMANDS_TO_AGENTS[token],
            "clean_task": " ".join(parts[1:]),
        }

    if token == "/reset-agent" and len(parts) >= 2:
        agent = parts[1].lower()
        return {"type": "reset_agent", "agent": agent, "clean_task": ""}

    return {"type": "none", "agent": None, "clean_task": message}
