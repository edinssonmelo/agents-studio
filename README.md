# Agents Studio

Visual control plane for `agent_core` — inspect, configure, run and monitor your agents from a clean Notion-style interface.

**URL:** `https://agents.edinssonmelo.com`  
**Stack:** Next.js 14 · NestJS · Prisma/SQLite · SSE · Traefik · Docker Compose

---

## Architecture

```
Internet → Traefik (TLS) → [web :3000] → /api/* rewrites → [api :3001]
                                                               ↓
                                                   agent_core:8766 (net_internal)
                                                               ↓
                                                   /data/agent-core (volumes)
```

### Three panels — Notion-like

| Panel | Component | Purpose |
|-------|-----------|---------|
| Sidebar | `Sidebar.tsx` | Assistant selector, nav, user |
| Tree | `AgentTree.tsx` | assistant → agents hierarchy |
| Inspector | `Inspector.tsx` | 5 tabs: Overview · Runtime · Memory · Prompt · Actions |

### Security model

- `AGENT_CORE_TOKEN` lives **only** in the BFF (`api`). The browser never sees it.
- All `agent_core` calls are proxied through `AgentsService`.
- The `api` container is on `net_studio` (private) + `net_internal`. It is **not** exposed via Traefik.
- `/admin/reload-config` on `agent_core` is only reachable from `net_internal`.

---

## Prerequisites

- VPS with Docker + Docker Compose v2
- Traefik en `net_internal` con entrypoint **web** (:80); TLS en Cloudflare (igual que `me.*` / `wife.*` en el `compose/openclaw.yml` del repo de infra)
- `agent_core` running on `net_internal` as hostname `agent_core`
- Domain DNS pointing to your server (`agents.edinssonmelo.com → <VPS IP>`)

---

## First-time deployment

### 1. Clone repo on the server

```bash
ssh user@your-vps
git clone https://github.com/your-org/agents-studio /srv/apps/agents-studio
cd /srv/apps/agents-studio
```

### 2. Configure environment

```bash
cp .env.example .env
nano .env          # fill in all values — see comments in .env.example
```

Required values:

| Variable | Description |
|----------|-------------|
| `DOMAIN` | `agents.edinssonmelo.com` |
| `JWT_SECRET` | Long random string (`openssl rand -base64 48`) |
| `USER_ME_PASSWORD` | Password for user `me` (plain or bcrypt hash) |
| `USER_WIFE_PASSWORD` | Password for user `wife` |
| `AGENT_CORE_TOKEN` | Same token as in your infra `.env` |
| `AGENT_CORE_CONFIG_PATH` | Host path to `agent-core/` directory (has `assistants.yaml`) |
| `AGENT_CORE_DATA_PATH` | Host path to `agent-core` runtime data (`users/`) |

### 3. Actualizar `agent_core` en el servidor (reload + prompts montados)

En el repo de infra, `agent_core` ya incluye **`POST /admin/reload-config`** y el compose monta **`prompts/`** desde el repo. Tras `git pull`:

```bash
cd /srv/apps/infra
make openclaw-rebuild-agent-core

set -a && source .env && set +a
docker exec infra-agent_core-1 curl -fsS -X POST \
  -H "X-Agent-Core-Token: $AGENT_CORE_TOKEN" \
  http://127.0.0.1:8766/admin/reload-config
```

### 4. Cloudflare Tunnel

En Zero Trust → tu túnel → **Public Hostname**: `agents.edinssonmelo.com` → **`http://traefik:80`** (mismo origen que n8n / OpenClaw).

### 5. Launch

```bash
cd /srv/apps/agents-studio
docker compose -p agents-studio --env-file .env up -d --build
```

### 6. Verify

```bash
# Check containers
docker compose -p agents-studio ps

# API health
docker exec agents-studio-api wget -qO- http://localhost:3001/api/agents/health

# Check logs
docker compose -p agents-studio logs -f --tail=50
```

Open `https://agents.edinssonmelo.com` — sign in with `me` or `wife`.

---

## Day-to-day operations

### Update (standard deploy)

```bash
cd /srv/apps/agents-studio
git pull origin main
docker compose -p agents-studio --env-file .env up -d --build --remove-orphans
```

### View logs

```bash
docker compose -p agents-studio logs -f api
docker compose -p agents-studio logs -f web
```

### Restart a single service

```bash
docker compose -p agents-studio restart api
docker compose -p agents-studio restart web
```

### Run API tests

```bash
cd apps/api
npm ci
npx prisma generate
npm test
```

---

## Rollback procedure

### Quick rollback (previous image)

```bash
cd /srv/apps/agents-studio

# 1. Find previous commit
git log --oneline -10

# 2. Check out previous commit
git checkout <previous-sha>

# 3. Rebuild
docker compose -p agents-studio --env-file .env up -d --build

# 4. Verify
docker compose -p agents-studio ps
```

### Full rollback (keep data)

```bash
# Data is in named volume studio_db — NOT affected by rollback.
# To inspect:
docker volume inspect agents-studio_studio_db

# To backup before rollback:
docker run --rm \
  -v agents-studio_studio_db:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cp -r /data /backup/studio_db_$(date +%Y%m%d_%H%M%S)"
```

### Nuclear rollback (reset DB)

```bash
# WARNING: destroys all audit logs and preferences
docker compose -p agents-studio down
docker volume rm agents-studio_studio_db
docker compose -p agents-studio --env-file .env up -d --build
```

---

## Config file editing

Agents Studio can edit `assistants.yaml` and `prompts/*.txt` directly. The BFF writes to the host-mounted paths and then calls `/admin/reload-config` on `agent_core` to hot-reload without restart.

**Volume mapping:**

| Container path | Host path (configured in `.env`) |
|----------------|----------------------------------|
| `/data/agent-core/assistants.yaml` | `$AGENT_CORE_CONFIG_PATH/assistants.yaml` |
| `/data/agent-core/prompts/` | `$AGENT_CORE_CONFIG_PATH/prompts/` |
| `/data/agent-core-data/users/` | `$AGENT_CORE_DATA_PATH/users/` |

If `reload-config` fails (endpoint not patched yet), the file is still saved on disk. Restart `agent_core` manually to pick up changes.

---

## SSE (realtime)

The frontend connects to `/api/sse/events?token=<jwt>&assistant_id=me` via `EventSource`. Events flow:

```
agent_core HTTP call → NestJS EventEmitter2 → SseController → browser EventSource
```

EventSource auto-reconnects on disconnect. A heartbeat comment is sent every 20s to keep the connection alive through Traefik.

---

## What is NOT touched by this service

- `/srv/data/openclaw/*` — OpenClaw personal memory
- `infra-openclaw_me-1` and `infra-openclaw_wife-1` containers
- `net_internal` services other than `agent_core`
- Any existing Traefik configuration

---

## Directory structure

```
agents-studio/
├── apps/
│   ├── api/                    # NestJS BFF
│   │   ├── src/
│   │   │   ├── config/         # Env validation
│   │   │   ├── common/         # Guards, filters, decorators
│   │   │   ├── prisma/         # PrismaService
│   │   │   └── modules/
│   │   │       ├── auth/       # JWT login
│   │   │       ├── agents/     # agent_core proxy
│   │   │       ├── config-editor/ # YAML + prompt editor
│   │   │       ├── sse/        # Server-Sent Events
│   │   │       └── audit/      # Log query
│   │   ├── prisma/schema.prisma
│   │   └── Dockerfile
│   └── web/                    # Next.js 14
│       ├── src/
│       │   ├── app/
│       │   │   ├── login/
│       │   │   └── studio/
│       │   │       └── config/
│       │   ├── components/
│       │   │   ├── layout/     # StudioShell, Sidebar
│       │   │   └── studio/     # AgentTree, Inspector, tabs
│       │   ├── hooks/          # use-sse, use-agents
│       │   └── lib/            # api-client, store, utils
│       └── Dockerfile
├── agent-core-extensions/
│   └── reload_config_patch.py  # Instructions to add /admin/reload-config
├── .github/workflows/
│   └── deploy.yml
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `agent_core unavailable` | Check `docker exec agents-studio-api wget -qO- http://agent_core:8766/healthz` |
| Login fails | Check `USER_ME_PASSWORD` / `USER_WIFE_PASSWORD` in `.env` |
| Config reload shows warning | Apply the reload patch to `agent_core/main.py` |
| SSE not connecting | Check `JWT_SECRET` matches between login token and SSE token |
| 404 desde Internet | Añade el hostname en Cloudflare Tunnel (origen `http://traefik:80`) |
| Empty agent tree | Verify `AGENT_CORE_TOKEN` matches infra `.env` exactly |
