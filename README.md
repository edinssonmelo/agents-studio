# Agents Studio

A **web control plane** for operating a multi-assistant agent system backed by an **`agent_core`-style HTTP API**. Use it to browse agents, edit prompts and catalog YAML, trigger test runs, stream runtime events, and keep a lightweight audit trail—without exposing orchestrator secrets to the browser.

The UI is intentionally minimal (sidebar, tree, inspector) so you can focus on configuration and observability.

---

## What problem does this solve?

| Use case | How Studio helps |
|----------|------------------|
| **Operate** | See which agents exist per assistant, run ad-hoc tasks, reset working memory, append durable notes. |
| **Configure** | Edit `assistants.yaml` and `prompts/*.txt` from the browser; optional hot-reload on the core if it supports `POST /admin/reload-config`. |
| **Observe** | SSE timeline of run start/complete, config reload, and related events (no raw chain-of-thought). |
| **Govern** | SQLite-backed audit log and config snapshots (who changed what, when). |

Studio is **not** a replacement for your LLM gateway or chat product. It sits **next to** a small internal API (“agent core”) that already owns routing, models, and file-backed memory.

---

## Architecture

```
Browser ──HTTPS──► reverse proxy (optional) ──► [web :3000] ──/api/*──► [api :3001] (BFF)
                                                                          │
                                                                          ▼
                                                              agent_core :8766 (same Docker network)
                                                                          │
                                                                          ▼
                                                              Host volumes: YAML, prompts, users/*/memory
```

- **Frontend (`web`)**: Next.js 14 (App Router). Proxies `/api` to the BFF.
- **Backend (`api`)**: NestJS. Holds `AGENT_CORE_TOKEN`, talks to `agent_core`, persists audit/preferences in **SQLite** (Prisma).
- **Realtime**: Server-Sent Events (`/api/sse/events`) from the BFF.

---

## Security model

1. **`AGENT_CORE_TOKEN` exists only in the BFF environment**—never in the browser or frontend bundle.
2. Studio users authenticate with **JWT** after login (`USER_ME_PASSWORD` / `USER_WIFE_PASSWORD` in `.env`). Map these logical users to your own policy (e.g. two operators, or rename in code later).
3. In production, terminate TLS at your reverse proxy; set `FRONTEND_ORIGIN` / `DOMAIN` to match the URL users actually use (CORS + cookies behavior).

---

## Prerequisites

- **Docker** and **Docker Compose v2** (plugin).
- A Docker **bridge network** that both Studio and `agent_core` attach to (this repo expects an **external** network named `net_internal` by default—create it once: `docker network create net_internal`).
- A running **`agent_core` (or compatible)** service on that network, reachable at `http://agent_core:8766` (or override `AGENT_CORE_URL`).
- Recommended on `agent_core`:
  - `POST /admin/reload-config` (authenticated) to reload YAML without restarting.
  - Read-only or read-write mounts for `assistants.yaml` and `prompts/` consistent with what Studio mounts from the host.

---

## Quick start (local or single host)

### 1. Clone and configure

```bash
git clone https://github.com/<your-org>/agents-studio.git
cd agents-studio
cp .env.example .env
```

Edit `.env`:

- **`DOMAIN`**: Hostname users open in the browser (e.g. `studio.example.com` or `localhost`—see CORS note below).
- **`JWT_SECRET`**: Long random string (`openssl rand -base64 48`).
- **`USER_*_PASSWORD`**: Passwords for the two built-in accounts (`me`, `wife`).
- **`AGENT_CORE_TOKEN`**: Must match the token expected by `agent_core`.
- **`AGENT_CORE_CONFIG_PATH`**: Host directory containing `assistants.yaml` and `prompts/`.
- **`AGENT_CORE_DATA_PATH`**: Host directory for per-user data (e.g. `users/<assistant>/...`).

### 2. Create the Docker network (first time only)

```bash
docker network create net_internal
```

Ensure your **`agent_core` container** is attached to **`net_internal`** and is named **`agent_core`** (or change `AGENT_CORE_URL`).

### 3. Build and run

```bash
docker compose --env-file .env up -d --build
```

### 4. Smoke checks

```bash
docker compose ps
docker exec agents-studio-api wget -qO- http://127.0.0.1:3001/api/agents/health
```

Open `https://<DOMAIN>` (or `http://localhost:3000` if you publish the web port for dev—see below) and sign in as **`me`** or **`wife`**.

**Local HTTP:** Set `FRONTEND_ORIGIN=http://localhost:3000` in `.env` (and expose port 3000 if needed) so the BFF CORS matches the browser `Origin` header.

---

## Production behind a reverse proxy

Typical patterns:

1. **Traefik / Caddy / nginx** routes `Host: your-studio.example.com` to the **`web`** container (port 3000). TLS at the edge.
2. **Do not** expose the **`api`** container publicly; only `web` should be routable.
3. Add your hostname to the proxy and point DNS to the server.
4. If you use Cloudflare Tunnel or similar, map the public hostname to your internal proxy upstream (e.g. `http://traefik:80`)—exact steps depend on your edge stack.

Traefik label examples vary by version; this repository ships a **reference** `docker-compose.yml` with labels you can adapt or remove if you use another proxy.

---

## `agent_core` contract (summary)

Studio expects (authenticated with `X-Agent-Core-Token` except where noted):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/healthz` | Liveness (no token). |
| GET | `/agents?assistant_id=me\|wife` | List agents: `{ "assistant_id", "agents": [ { "name", "description" } ] }`. |
| POST | `/run` | Run task (body per your core). |
| DELETE | `/session/{assistant}/{agent}` | Clear working memory file. |
| POST | `/memory/{assistant}/{agent}/append` | Append to durable memory. |
| GET | `/metrics` | Optional metrics text. |
| POST | `/admin/reload-config` | Optional hot-reload of YAML. |

If your core uses different assistant IDs, adapt the Studio code (`AssistantId` type, login users, and UI labels).

---

## Editing configuration from the UI

The API container mounts:

| In container | Typical host source |
|--------------|---------------------|
| `/data/agent-core` | Your `assistants.yaml` + `prompts/` tree |
| `/data/agent-core-data` | Runtime `users/` tree (memory, working files) |

After saving YAML, Studio calls **`POST /admin/reload-config`** on `agent_core` when available. If that endpoint is missing, restart the core or rely on your own reload mechanism.

**Prompt files:** the editor maps an agent name to `prompts/<agent>.txt`. Keep `prompt_file` in YAML consistent with those basenames if you use the built-in prompt tab.

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
```

### API tests (development)

```bash
cd apps/api
npm ci
npx prisma generate
npm test
```

### Rollback

Use git to check out a previous revision, rebuild, and `up -d`. The SQLite volume (`studio_db`) keeps audit data unless you remove the volume intentionally.

---

## Project layout

```
agents-studio/
├── apps/
│   ├── api/                 # NestJS BFF (Prisma + SQLite)
│   └── web/                 # Next.js 14 frontend
├── agent-core-extensions/  # Historical notes / patch snippets for reload endpoint
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Empty agent tree | API returns `{ assistant_id, agents: [...] }`. Token mismatch, wrong `assistant_id`, or empty catalog in YAML. |
| `agent_core unavailable` | From `agents-studio-api`: reachability to `AGENT_CORE_URL`, token, same Docker network. |
| Login fails | `USER_ME_PASSWORD` / `USER_WIFE_PASSWORD`, `JWT_SECRET`. |
| SSE drops | `JWT_SECRET` consistent; proxy buffering (disable for SSE path if needed). |
| Healthcheck failures on `web` | Next.js bind + path: compose uses `/login` and `HOSTNAME=0.0.0.0`—keep in sync if you change images. |
| Traefik 404 | Router labels, network attachment, container **healthy** (unhealthy backends may be skipped). |

---

## Contributing

Issues and PRs welcome. Please avoid committing `.env`, local credentials, or production URLs.

---

## License

Specify your license in a `LICENSE` file at the repository root (e.g. MIT). This README does not impose a license by itself.

---

## Acknowledgements

Built with Next.js, NestJS, Prisma, TanStack Query patterns, and Docker. Designed to pair with a small FastAPI (or other) **agent core** service you operate separately.
