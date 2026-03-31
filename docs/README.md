# Documentation index

Start here to navigate Agents Studio documentation.

| Document | Audience | Contents |
|----------|----------|----------|
| [README.md](../README.md) | Everyone | Purpose, quick start, env vars, API contract summary, troubleshooting |
| [AGENTS.md](../AGENTS.md) | Developers & AI assistants | Repo map, invariants, common bugs, pointers to code |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Integrators & maintainers | Three-service layout, `agent_core` layers, volumes, advanced networking |
| [OPENCLAW.md](OPENCLAW.md) | Integrators | HTTP example: external gateway → `POST /run` on internal `agent_core` |

**Suggested order:** README → ARCHITECTURE (if deploying or extending) → OPENCLAW (if wiring another service) → AGENTS (if modifying code).
