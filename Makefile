# Makefile — Agents Studio
# Usage: make <target>
# Requires: docker compose v2, .env at repo root

COMPOSE = docker compose -p agents-studio --env-file .env
PROJECT = agents-studio

.PHONY: help up down build logs restart test clean backup rollback status

help:       ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Deploy ────────────────────────────────────────────────────────────────

up:         ## Start all services (build if needed)
	$(COMPOSE) up -d --build --remove-orphans

down:       ## Stop all services (keeps volumes)
	$(COMPOSE) down

build:      ## Build images only
	$(COMPOSE) build --no-cache

restart:    ## Restart all services
	$(COMPOSE) restart

restart-api: ## Restart API only (faster than full up)
	$(COMPOSE) restart api

restart-web: ## Restart web only
	$(COMPOSE) restart web

# ── Monitoring ────────────────────────────────────────────────────────────

status:     ## Show container status
	$(COMPOSE) ps

logs:       ## Tail all logs
	$(COMPOSE) logs -f --tail=100

logs-api:   ## Tail API logs
	$(COMPOSE) logs -f --tail=100 api

logs-web:   ## Tail web logs
	$(COMPOSE) logs -f --tail=100 web

health:     ## Check API health endpoint
	@docker exec $(PROJECT)-api wget -qO- http://localhost:3001/api/agents/health || echo "API not healthy"

# ── Database ──────────────────────────────────────────────────────────────

db-shell:   ## Open SQLite shell inside API container
	docker exec -it $(PROJECT)-api sh -c "sqlite3 /data/studio/studio.db"

db-logs:    ## Dump recent audit logs
	docker exec $(PROJECT)-api sh -c "sqlite3 /data/studio/studio.db 'SELECT createdAt,userId,action,agentName,result FROM AuditLog ORDER BY id DESC LIMIT 20;'"

# ── Testing ───────────────────────────────────────────────────────────────

test:       ## Run API unit tests
	cd apps/api && npm test -- --passWithNoTests

test-e2e:   ## Run API e2e tests
	cd apps/api && npm run test:e2e

# ── Backup & Rollback ─────────────────────────────────────────────────────

backup:     ## Backup SQLite DB to ./backups/
	@mkdir -p backups
	@docker run --rm \
	  -v $(PROJECT)_studio_db:/data \
	  -v $(shell pwd)/backups:/backup \
	  alpine sh -c "cp /data/studio.db /backup/studio_$(shell date +%Y%m%d_%H%M%S).db"
	@echo "Backup saved to backups/"

rollback:   ## Rollback to previous git commit (keeps data)
	@echo "Current HEAD: $$(git rev-parse --short HEAD)"
	@read -p "Enter commit SHA to rollback to: " sha; \
	  git checkout $$sha && \
	  $(COMPOSE) up -d --build && \
	  echo "Rolled back to $$sha"

# ── Development ───────────────────────────────────────────────────────────

dev-api:    ## Run API in dev mode (requires local node_modules)
	cd apps/api && npm run start:dev

dev-web:    ## Run web in dev mode (requires local node_modules)
	cd apps/web && npm run dev

install:    ## Install dependencies for both apps
	cd apps/api && npm install
	cd apps/web && npm install

clean:      ## Remove containers and images (keeps volumes)
	$(COMPOSE) down --rmi local
