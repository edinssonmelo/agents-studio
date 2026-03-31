# Agents Studio

> **Self-hosted control plane for multi-agent systems** — configure agents, run tasks, and watch what happens in real time, without putting orchestrator secrets in the browser.

**In one sentence:** it is a **web interface** to manage your **agent setup** (YAML + prompts), **execute** jobs through a **backend orchestrator**, and **see runtime activity** (timeline + audit log) in one place.

**Docs index:** [docs/README.md](docs/README.md) · **Define agents (YAML + prompts):** [docs/DEFINING_AGENTS.md](docs/DEFINING_AGENTS.md) · **For AI assistants:** [AGENTS.md](AGENTS.md)

---

## What you get

| Piece | What it does |
|-------|----------------|
| **Web UI** (`apps/web`) | Manage catalog and prompts, trigger runs, inspect memory files, see a live timeline. |
| **API / BFF** (`apps/api`) | Login (JWT), audit trail (SQLite), talks to the orchestrator **only on the server** with a shared token. |
| **Orchestrator** (`apps/agent-core`) | FastAPI service: reads `assistants.yaml`, **routes** each task to an agent, calls the LLM (DeepSeek by default), reads/writes **file-based memory**. |

Everything runs together with **Docker Compose** on an internal network. Cloning the repo is **step one**; you still set **secrets and API keys** in `.env` (see [Quick start](#quick-start)).

---

## Why it exists

Many tools help you **build** agents (chains, graphs, SDKs). Fewer help you **operate** them day to day: edit config safely, run tests, see executions, and keep history.

Agents Studio is aimed at **operations**: declarative config, visible runs, and a clear split between **browser**, **BFF**, and **internal orchestrator**.

---

## How it compares (honest)

| Project / idea | Typical focus |
|----------------|----------------|
| **LangChain** | Building chains and tooling around models. |
| **LangGraph** | Graph-shaped, stateful workflows in code. |
| **AutoGPT-style agents** | Autonomous loops. |
| **Agents Studio** | **Control plane**: YAML catalog, UI editing, `/run` execution, SSE timeline, audit + file memory. |

**This repository does not ship LangGraph.** The included orchestrator is **FastAPI + routing + one LLM call per handled run**. If you need LangGraph (or any other engine), you can **replace or wrap** `agent_core` as long as you keep a compatible HTTP surface—or run another service and point integrations at it.

---

## Architecture (simple)

```
Browser
   →  Next.js (web)
   →  /api  →  NestJS (api)   [JWT, audit, SSE]
   →  HTTP + token  →  FastAPI (agent_core)   [route, LLM, disk memory]
   →  LLM API + files (YAML, prompts, users/…/memory)
```

| Service | Technology | Role |
|---------|------------|------|
| `web` | Next.js 14 | Operator UI. |
| `api` | NestJS, Prisma | Auth, proxy to core, config editor, events. |
| `agent_core` | FastAPI | Catalog, router, runner, memory on disk. |

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Customize agents:** step-by-step YAML, prompt files, memory layout, and field reference — [docs/DEFINING_AGENTS.md](docs/DEFINING_AGENTS.md).

---

## Core capabilities

1. **Configure** — Assistants and agents in `assistants.yaml`; behavior in `prompts/*.txt`; editable from the UI.
2. **Run** — Tasks go to `POST /run`; routing uses commands, hints, and keywords (see code in `apps/agent-core`).
3. **Observe** — Server-Sent Events for run/config activity; no chain-of-thought in the UI by design.
4. **Remember (files)** — `global.md`, `memory.md`, `working.md` per assistant/agent under the data volume (easy to back up or version).
5. **Reload** — `POST /admin/reload-config` reloads YAML without rebuilding the image (when enabled).
6. **Integrate** — Another container on the same Docker network can call `agent_core` (e.g. a gateway). See [docs/OPENCLAW.md](docs/OPENCLAW.md).

---

## What this is not

- Not a hosted SaaS chat product.
- Not a no-code marketplace.
- Not “LangGraph in a box” — see comparison table above.

---

## Quick start

### 1. Clone and env

```bash
git clone https://github.com/<your-org>/agents-studio.git
cd agents-studio
cp .env.example .env
```

Edit `.env` at minimum: **`JWT_SECRET`**, **`USER_ME_PASSWORD`** / **`USER_WIFE_PASSWORD`**, **`AGENT_CORE_TOKEN`** (same value conceptually for api + core), **`DEEPSEEK_API_KEY`** for real LLM calls, **`DOMAIN`** (and **`FRONTEND_ORIGIN`** if you use `http://localhost:3000`).

### 2. Run

```bash
docker compose --env-file .env up -d --build
```

### 3. Open the UI

Add a port on service **`web`** if you need local access (example: `"3000:3000"` in `docker-compose.yml`), set `FRONTEND_ORIGIN=http://localhost:3000`, then open `http://localhost:3000` and sign in as **`me`** or **`wife`**.

### 4. Check health

```bash
docker compose ps
docker exec agents-studio-api wget -qO- http://127.0.0.1:3001/api/agents/health
docker exec agents-studio-agent-core curl -sf http://127.0.0.1:8766/healthz
```

Optional: seed empty global memory files — see [Editing and volumes](#editing-and-volumes).

---

## Editing and volumes

| Inside containers | What lives there |
|-------------------|------------------|
| `/data/agent-core` | `assistants.yaml` + `prompts/` (same mount on `api` and `agent_core`). |
| `/data/agent-core-data` | `users/<assistant>/…` memory tree. |

Defaults in Compose point to `./apps/agent-core` and `./data/agent-core-data` on the host.

Starter files (optional):

```bash
mkdir -p ./data/agent-core-data/users/me ./data/agent-core-data/users/wife
cp apps/agent-core/seed-data/users/me/global.md ./data/agent-core-data/users/me/
cp apps/agent-core/seed-data/users/wife/global.md ./data/agent-core-data/users/wife/
```

---

## Security (short)

- **`AGENT_CORE_TOKEN`** only on **`api`** and **`agent_core`** — never in the frontend bundle.
- Do not publish **`agent_core`** (port 8766) to the public internet unless you accept that risk.
- Use TLS at your reverse proxy in production; align **`FRONTEND_ORIGIN`** and **`DOMAIN`**.

---

## `agent_core` HTTP API (summary)

Use header **`X-Agent-Core-Token`** except where noted.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/healthz` | Liveness (no token). |
| GET | `/agents?assistant_id=me\|wife` | List agents. |
| POST | `/run` | Run a task. |
| DELETE | `/session/{assistant}/{agent}` | Clear working memory. |
| POST | `/memory/{assistant}/{agent}/append` | Append durable memory. |
| GET | `/metrics` | Metrics. |
| POST | `/admin/reload-config` | Reload YAML. |

Assistant IDs in the stock code are **`me`** and **`wife`** (change in Python + API + UI if you rename).

---

## Production

Put a reverse proxy in front of **`web`** only. Keep **`api`** and **`agent_core`** internal. Traefik labels in `docker-compose.yml` are examples—adjust to your setup. External Docker networks: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Project layout

```text
agents-studio/
├── LICENSE                 # MIT
├── README.md
├── AGENTS.md               # Guide for coding assistants
├── docker-compose.yml
├── .env.example
├── apps/
│   ├── web/                # Next.js UI
│   ├── api/                # NestJS BFF
│   └── agent-core/         # FastAPI orchestrator
├── docs/                   # Architecture, defining agents, integrations
└── examples/               # Optional snippets (not auto-loaded)
```

---

## Development

```bash
# API
cd apps/api && npm ci && npx prisma generate && npm test

# Orchestrator
cd apps/agent-core && python3 -m pip install -r requirements.txt && python3 -m pytest tests/ -q
```

---

## Troubleshooting

| Problem | Check |
|---------|--------|
| Empty agent list | Token match, `AGENT_CORE_URL`, YAML has agents for that assistant, core healthy. |
| Core unreachable | Same Compose network, service name `agent_core`. |
| Login fails | Passwords and `JWT_SECRET`. |

---

## Contributing

Issues and PRs welcome. Good first contributions: docs, provider adapters in `runner.py`, UI polish, sample catalogs under `examples/`.

Do not commit `.env` or real secrets.

---

## License

[MIT](LICENSE)
