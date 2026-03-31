# Agents Studio — guide for AI coding assistants

Use this file to orient quickly before changing code or answering questions about the repo.

## What this project is

**Agents Studio** is an open-source **control plane** (web UI + API) for teams or individuals who run a **small multi-agent system** defined in YAML and text prompts. Operators configure agents, edit prompts, run test tasks, inspect memory files, and see an audit trail—**without** putting LLM orchestration secrets in the browser.

The **orchestrator** is a separate Python service (**`agent_core`**, FastAPI) in `apps/agent-core/`. The **BFF** (**`api`**, NestJS) holds the shared token and proxies HTTP to `agent_core`. The **UI** is Next.js in `apps/web/`.

## What this project is not

- Not a hosted chat product or a general RAG framework.
- **Not LangGraph / LangChain** — the bundled orchestrator is FastAPI + YAML routing + (typically) one LLM call per run; graph engines can be integrated **beside** or **instead of** `agent_core` if you match the HTTP contract.
- Not a replacement for your LLM provider; `agent_core` calls an API (default: DeepSeek) per run.
- The NestJS app does **not** embed the Python logic; integration is **HTTP + `X-Agent-Core-Token`** on the Docker network.

## Problems this repo solves

| Need | Where it is addressed |
|------|------------------------|
| Edit `assistants.yaml` and `prompts/*.txt` safely from a browser | `apps/api` config-editor module + `apps/web` studio screens |
| List agents per logical assistant (`me` / `wife`) | `GET /agents` on `agent_core`; BFF wraps for UI |
| Run a task through routing + one LLM call | `POST /run` on `agent_core` |
| Durable + working memory on disk | `apps/agent-core/memory/` + data volume `users/...` |
| Audit who changed config | Prisma + SQLite in `apps/api` |

## Stack (high level)

| Layer | Path | Runtime |
|-------|------|---------|
| UI | `apps/web` | Next.js 14 |
| BFF | `apps/api` | NestJS 10, Prisma, SQLite |
| Orchestrator | `apps/agent-core` | FastAPI, uvicorn |
| Deploy | `docker-compose.yml` | Three services, internal network `agents-studio` |

## Critical paths (do not guess—read these)

| Topic | Location |
|-------|----------|
| Env vars / defaults | `apps/api/src/config/configuration.ts`, `.env.example` |
| Calls to `agent_core` | `apps/api/src/modules/agents/agents.service.ts` |
| Catalog YAML | `apps/agent-core/assistants.yaml` (mounted at `/data/agent-core` in Compose) |
| Prompt file resolution | `apps/agent-core/agents/runner.py` (`AGENT_CORE_CONFIG_ROOT`) |
| Disk memory layout | `apps/agent-core/memory/manager.py` |
| Routing / run endpoint | `apps/agent-core/main.py`, `apps/agent-core/router.py` |
| HTTP contract summary | root `README.md` (contract table) |

## Assistant IDs

The codebase and `RunRequest` in `agent_core` currently allow assistant IDs **`me`** and **`wife`** (see `main.py` Pydantic models). Renaming requires coordinated changes in API auth users, UI labels, YAML keys, and validation in Python.

## Common failure: empty agent tree in the UI

Typical causes:

1. **JWT / session**: user not logged in or wrong password.
2. **`AGENT_CORE_TOKEN`** mismatch between `api` and `agent_core`.
3. **Network**: `api` cannot resolve `http://agent_core:8766` (Compose service name must be `agent_core`).
4. **Response shape**: BFF expects `agent_core` to return `{ assistant_id, agents: [...] }` with agent objects the frontend can map (see `apps/web` hooks / api client).
5. **Empty catalog**: `assistants.yaml` has no agents for the selected assistant.

## Security invariants

- Never expose `AGENT_CORE_TOKEN` or provider API keys to the frontend bundle.
- Do not publish `agent_core` port 8766 to the public internet without a deliberate threat model.
- Studio users are JWT-authenticated; map `me`/`wife` to real policy in your deployment.

## How to run locally

See root **`README.md`** → Quick start (Docker Compose). For tests: `apps/api` (`npm test`), `apps/api` (`pytest` in `apps/agent-core`).

## Further reading

| Doc | Purpose |
|-----|---------|
| [README.md](README.md) | Install, env vars, operations, troubleshooting |
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/DEFINING_AGENTS.md](docs/DEFINING_AGENTS.md) | YAML + prompts + memory for operators |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, volumes, networks |
| [docs/OPENCLAW.md](docs/OPENCLAW.md) | Calling `agent_core` from another container (e.g. gateway) |

When suggesting changes, prefer **small diffs**, match existing naming and patterns, and update docs if behavior or env vars change.
