# Agents Studio

**Web control plane for YAML-driven multi-agent systems.** Configure assistants and prompts from the browser, run tasks against an internal orchestrator, and keep audit history—without exposing orchestrator tokens to clients.

**Audience:** operators, solo builders, and teams who want a **self-hosted** studio over **file-backed** config (`assistants.yaml`, `prompts/*.txt`) and a small FastAPI **agent core**.

**Docs for humans:** this file and [docs/README.md](docs/README.md).  
**Docs for coding assistants:** [AGENTS.md](AGENTS.md) (repo map, invariants, common failures).

---

## Table of contents

- [Purpose](#purpose)
- [What you get](#what-you-get)
- [What this is not](#what-this-is-not)
- [Architecture](#architecture)
- [Glossary](#glossary)
- [Security model](#security-model)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Production behind a reverse proxy](#production-behind-a-reverse-proxy)
- [agent_core HTTP contract](#agent_core-http-contract)
- [Editing configuration from the UI](#editing-configuration-from-the-ui)
- [Operations](#operations)
- [Project layout](#project-layout)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Purpose

Agents Studio solves a narrow problem well:

1. **Operate** — See agents per logical assistant, run ad-hoc tasks, reset working memory, append durable notes.
2. **Configure** — Edit catalog and prompts in the UI; reload the core without rebuilding images when `POST /admin/reload-config` is available.
3. **Observe** — Server-Sent Events timeline for runs and config events (no raw chain-of-thought).
4. **Govern** — SQLite-backed audit log and config snapshots (who changed what, when).

Typical keywords for search and discovery: *self-hosted agent studio*, *YAML agent catalog*, *NestJS BFF*, *FastAPI agent orchestrator*, *Docker Compose*, *multi-assistant*, *prompt management*, *internal LLM gateway*.

---

## What you get

| Component | Role |
|-----------|------|
| **`apps/web`** | Next.js 14 UI; proxies `/api` to the BFF. |
| **`apps/api`** | NestJS BFF: JWT login, Prisma/SQLite, SSE, **only place that stores `AGENT_CORE_TOKEN`** for server-side calls. |
| **`apps/agent-core`** | FastAPI: loads `assistants.yaml`, routes tasks, calls the configured LLM API, reads/writes memory files. |

All three run together via **`docker-compose.yml`** on an internal Docker network (`agents-studio`).

---

## What this is not

- **Not** a full chat SaaS or customer-facing bot host.
- **Not** LangChain/LangGraph in this repo—the pattern is **declarative YAML + one HTTP orchestrator**.
- **Not** mandatory to use any specific gateway; see [docs/OPENCLAW.md](docs/OPENCLAW.md) for an optional integration pattern.

---

## Architecture

```
Browser ──► reverse proxy (optional) ──► [web :3000] ──/api/*──► [api :3001] (BFF)
                                                                    │
                                                                    ▼
                                                        [agent_core :8766] (internal only)
                                                                    │
                                                                    ▼
                                                        Volumes: YAML, prompts, users/*/memory
```

- **Browser → `web`**: HTML/JS; no orchestrator secrets.
- **`web` → `api`**: Same-origin or configured API base; JWT for studio users.
- **`api` → `agent_core`**: HTTP on Docker DNS name **`agent_core`**, header **`X-Agent-Core-Token`**.

Deeper detail, volume paths, and optional external networks: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Glossary

| Term | Meaning |
|------|---------|
| **BFF** | Backend-for-frontend; here, NestJS `api` that talks to `agent_core`. |
| **agent_core** | Python FastAPI service in `apps/agent-core`; the orchestrator. |
| **Assistant (logical)** | A key in `assistants.yaml` (default examples: `me`, `wife`). |
| **Agent** | A named specialist under an assistant (keywords, model, `prompt_file`). |
| **Catalog** | `assistants.yaml` + loaded prompts. |
| **Config volume** | Host path → `/data/agent-core` in containers (YAML + `prompts/`). |
| **Data volume** | Host path → `/data/agent-core-data`; contains `users/<assistant>/...`. |

---

## Security model

1. **`AGENT_CORE_TOKEN`** exists only in **`api`** and **`agent_core`** environments—never in the browser bundle.
2. Studio operators sign in with **JWT** (`USER_ME_PASSWORD` / `USER_WIFE_PASSWORD` in `.env`); rename users in code if you need different roles.
3. Terminate TLS at your reverse proxy; set **`FRONTEND_ORIGIN`** and **`DOMAIN`** to match the URL users use.
4. Keep **`agent_core`** off the public internet; expose only **`web`** (or your edge) intentionally.

---

## Prerequisites

- **Docker** and **Docker Compose v2**.
- A provider API key for real runs: default stack uses **DeepSeek** in `apps/agent-core` (see `.env.example`). Swapping providers requires code changes in the runner.

---

## Quick start

### 1. Clone and configure

```bash
git clone https://github.com/<your-org>/agents-studio.git
cd agents-studio
cp .env.example .env
```

Edit `.env`:

| Variable | Notes |
|----------|--------|
| `DOMAIN` | Hostname for Traefik-style labels; use `localhost` for local-only experiments. |
| `JWT_SECRET` | Long random string (`openssl rand -base64 48`). |
| `USER_ME_PASSWORD` / `USER_WIFE_PASSWORD` | Studio operator accounts. |
| `AGENT_CORE_TOKEN` | Same value in both services that call or serve the core. |
| `DEEPSEEK_API_KEY` | Required for live `/run` against DeepSeek. |
| `AGENT_CORE_CONFIG_PATH` / `AGENT_CORE_DATA_PATH` | Defaults: `./apps/agent-core` and `./data/agent-core-data`. |

Optional starter files for memory:

```bash
mkdir -p ./data/agent-core-data/users/me ./data/agent-core-data/users/wife
cp apps/agent-core/seed-data/users/me/global.md ./data/agent-core-data/users/me/
cp apps/agent-core/seed-data/users/wife/global.md ./data/agent-core-data/users/wife/
```

### 2. Build and run

```bash
docker compose --env-file .env up -d --build
```

No pre-created external Docker network is required; Compose defines **`agents-studio`**.

### 3. Local access without Traefik

Set `FRONTEND_ORIGIN=http://localhost:3000` in `.env` and add a port mapping on **`web`**, for example:

```yaml
ports:
  - "3000:3000"
```

### 4. Smoke checks

```bash
docker compose ps
docker exec agents-studio-api wget -qO- http://127.0.0.1:3001/api/agents/health
docker exec agents-studio-agent-core curl -sf http://127.0.0.1:8766/healthz
```

Open the UI (your published URL or `http://localhost:3000`) and sign in as **`me`** or **`wife`**.

---

## Production behind a reverse proxy

1. Route public hostname → **`web`** (port 3000); TLS at the edge.
2. Do **not** expose **`api`** or **`agent_core`** directly.
3. Ensure **`api`** resolves **`agent_core`** on the Compose network.

Traefik labels in `docker-compose.yml` are examples—adapt to your proxy. External shared networks: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## agent_core HTTP contract

Authenticated with **`X-Agent-Core-Token`** except where noted:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/healthz` | Liveness (no token). |
| GET | `/agents?assistant_id=me\|wife` | List agents: `{ "assistant_id", "agents": [ { "name", "description" } ] }`. |
| POST | `/run` | Execute routed task. |
| DELETE | `/session/{assistant}/{agent}` | Clear working memory file. |
| POST | `/memory/{assistant}/{agent}/append` | Append durable memory. |
| GET | `/metrics` | Metrics text. |
| POST | `/admin/reload-config` | Reload YAML from disk. |

Another service on the same Docker network can call **`POST http://agent_core:8766/run`** with the same header and JSON body; see **[docs/OPENCLAW.md](docs/OPENCLAW.md)**.

---

## Editing configuration from the UI

**`api`** and **`agent_core`** mount the same host paths:

| In container | Default host source |
|--------------|---------------------|
| `/data/agent-core` | `AGENT_CORE_CONFIG_PATH` → `assistants.yaml` + `prompts/` |
| `/data/agent-core-data` | `AGENT_CORE_DATA_PATH` → `users/…` tree |

After saving YAML, Studio triggers **`POST /admin/reload-config`** on `agent_core` when possible.

**Prompt paths:** `prompt_file` in YAML is resolved under **`AGENT_CORE_CONFIG_ROOT`** (see `apps/agent-core/agents/runner.py`).

---

## Operations

### Update images

```bash
git pull
docker compose --env-file .env up -d --build --remove-orphans
```

### Logs

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f agent_core
```

### API tests (development)

```bash
cd apps/api
npm ci
npx prisma generate
npm test
```

### Agent-core tests (Python)

```bash
cd apps/agent-core
python3 -m pip install -r requirements.txt
python3 -m pytest tests/ -q
```

### Rollback

Check out a previous git revision, rebuild, `up -d`. SQLite volume **`studio_db`** retains audit data unless removed.

---

## Project layout

```text
agents-studio/
├── AGENTS.md                 # Orientation for AI coding assistants
├── README.md                 # This file
├── docker-compose.yml
├── .env.example
├── apps/
│   ├── api/                  # NestJS BFF (Prisma + SQLite)
│   ├── web/                  # Next.js 14 frontend
│   └── agent-core/           # FastAPI orchestrator + YAML + prompts + tests
├── docs/
│   ├── README.md             # Documentation index
│   ├── ARCHITECTURE.md
│   └── OPENCLAW.md
└── examples/                 # Optional snippets (not loaded automatically)
```

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Empty agent tree | Token mismatch; `AGENT_CORE_URL`; YAML empty for that assistant; response shape vs frontend (see [AGENTS.md](AGENTS.md)). |
| `agent_core unavailable` | Network, service name `agent_core`, health of core container. |
| Login fails | Passwords, `JWT_SECRET`. |
| SSE drops | Proxy buffering; consistent `JWT_SECRET`. |
| `web` healthcheck fails | `HOSTNAME=0.0.0.0`, path `/login` in Compose. |
| Traefik 404 | Labels, networks, container health. |

---

## Contributing

Issues and PRs welcome. Do not commit `.env`, secrets, or production-only URLs.

---

## License

Add a `LICENSE` file at the repository root (e.g. MIT). This README does not grant a license by itself.

---

## Acknowledgements

Built with Next.js, NestJS, Prisma, FastAPI, and Docker.
