# External gateway → agent_core (example: OpenClaw)

This pattern applies to **any** service that should invoke the same orchestrator as Agents Studio (e.g. a chat gateway, automation bot, or **OpenClaw**-style bridge)—**not** only OpenClaw.

## When to use it

- You want **one** YAML-defined agent catalog and **one** `agent_core` process.
- The gateway runs in Docker and can join the **same network** as `agent_core`.
- You accept that **`agent_core` stays internal** (no public port 8766 unless you harden deliberately).

## Requirements

- **`agent_core`** and the gateway container on the **same Docker network**.
- **`AGENT_CORE_TOKEN`** configured on both sides; authenticated requests include header **`X-Agent-Core-Token`**.
- **Do not** publish port **8766** on the host unless you understand the risk (the token becomes the main gate).

## Example: `POST /run`

```http
POST http://agent_core:8766/run
Content-Type: application/json
X-Agent-Core-Token: <AGENT_CORE_TOKEN>

{
  "task": "Summarize the last message in two bullets.",
  "assistant_id": "me",
  "command": null,
  "agent_hint": null,
  "context": null
}
```

| Field | Notes |
|-------|--------|
| `assistant_id` | Must exist in `assistants.yaml` (stock example: `me` or `wife`). |
| `command` | Optional slash-command (e.g. `/reset-agent design`). |
| `agent_hint` | Optional agent name to bias routing. |
| `context` | Optional short conversation context. |

Responses typically include `handled`, `mode`, `agent`, `text`, `token_usage`, and `request_id` (exact schema may evolve—inspect `apps/agent-core/main.py` for the source of truth).

## Edge routing vs internal core

- **Reverse proxy (Traefik, Caddy, nginx)** usually exposes only the Studio **`web`** service by hostname/TLS.
- **Gateway → `agent_core`** stays on the internal network at **`http://agent_core:8766`**.

## Building or pinning agent_core

Point your stack at:

- This repo’s **`apps/agent-core`** Dockerfile, or  
- A published image built from this tree, or  
- A pinned git checkout / submodule.

Keep **one** source of truth for `assistants.yaml` and `prompts/` relative to your volume mounts.

## See also

- [ARCHITECTURE.md](ARCHITECTURE.md) — Volumes and networks  
- [README.md](../README.md) — Full HTTP contract table  
