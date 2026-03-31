# Defining agents

Agents Studio uses a **declarative, file-based** model: you describe assistants and agents in YAML, behavior in text prompts, and optional context in Markdown memory files. The orchestrator (`agent_core`) loads the catalog, **routes** each `/run` request, then calls the configured LLM with the merged prompt and memory.

---

## What makes up one agent

1. **YAML** — identity, routing hints, model id, max tokens, path to the prompt file.
2. **Prompt file** — role, rules, and style (plain text under `prompts/`).
3. **Optional memory** — `global.md` per assistant; `memory.md` / `working.md` per agent (under `users/` on the data volume).

---

## Stock assistant IDs

In the current codebase, HTTP APIs accept **`assistant_id`** values **`me`** and **`wife`** only (see `apps/agent-core/main.py`). Your top-level keys under `assistants:` in YAML must match those if you use the BFF and UI as shipped. Adding new assistant ids requires changing validation in Python, the NestJS auth mapping, and the frontend.

The examples below use assistant **`me`** and agent **`planner`**.

---

## 1. Minimal YAML entry

File: `assistants.yaml` (under your config root, e.g. `apps/agent-core/` or the mounted `/data/agent-core`).

```yaml
assistants:
  me:
    agents:
      planner:
        description: Helps organize tasks and define priorities clearly.
        keywords:
          - plan
          - organize
          - tasks
          - priorities
        model: deepseek-chat
        max_output: 800
        prompt_file: prompts/planner.txt
```

After editing, reload the catalog (Studio UI save flow calls `POST /admin/reload-config`, or restart `agent_core`).

---

## 2. Prompt file

File: `prompts/planner.txt` (path relative to **config root**, same as in YAML).

```text
ROLE:
You are a planning assistant focused on clarity and execution.

MISSION:
Help the user organize ideas into clear, actionable steps.

RESPONSIBILITIES:
- break down tasks
- define priorities
- simplify decisions

STYLE:
- short responses
- structured output
- max 3–5 steps

RULES:
- avoid long explanations
- ask for missing information when needed
- never assume unknown data
```

---

## 3. Optional memory

On the **data** volume, paths are `users/<assistant_id>/...`. The `agent_core` container is configured so this lines up with `users/me/global.md`, etc.

Example: `users/me/global.md`

```markdown
## Context
User is working on multiple projects.

## Priorities
- improve productivity
- reduce overwhelm

## Constraints
- limited time
```

Per-agent durable notes go under `users/me/agents/<agent_name>/memory.md`; session scratch space uses `working.md` (same folder). You can create files as needed; the system appends when you use the UI or API.

---

## How a run flows

1. Client sends **`POST /run`** to `agent_core` with `task`, `assistant_id` (`me` or `wife`), and optional `command`, `agent_hint`, `context`.
2. **Router** picks an agent using slash-commands, hints, keywords, and optional classification.
3. **Runner** loads the prompt file from the config root, merges **global** + **memory** + **working** into the system message, then calls the LLM using the **`model`** and **`max_output`** from YAML.

Default runner targets the **DeepSeek** HTTP API (`apps/agent-core/agents/runner.py`). The `model` field must be an id that provider accepts (e.g. `deepseek-chat`, `deepseek-reasoner`). Supporting other providers means extending or replacing that runner.

---

## YAML fields

| Field | Purpose |
|-------|---------|
| `description` | Shown in the UI and agent list; human-readable role. |
| `keywords` | Used for keyword-based routing. |
| `model` | Model id sent to the provider (DeepSeek by default). |
| `max_output` | Upper bound on completion length (tokens). |
| `prompt_file` | Path under config root, e.g. `prompts/planner.txt`. |

---

## Design practices

- **One clear responsibility per agent** — easier routing and prompts.
- **Short, operational prompts** — less drift and cheaper calls.
- **Memory for slow-changing context** — keep prompts stable; put facts in `global.md` / `memory.md`.
- **Prefer simple routing** — keywords and explicit commands before heavy classification.
- **Avoid overlapping roles** — two agents with the same keywords fight the router.

### Example agent archetypes

| Type | Typical use |
|------|-------------|
| Planner | Tasks, priorities, next steps |
| Researcher | Gathering and summarizing information |
| Writer | Drafts, copy, long-form text |
| Closer | Sales follow-up, objections, CTAs |
| Analyst | Interpret metrics or structured data |

### Anti-patterns

- One mega-agent for everything.
- Overly long theoretical prompts with no actionable rules.
- Duplicate keywords across agents without disambiguation.

---

## Scaling the catalog

- Add more agents under the same assistant (`me` / `wife`) in `assistants.yaml`.
- Split domains (e.g. ops vs creative) across **two assistants** only if you stay within supported ids—or fork validation to add more.
- Reuse prompt **patterns** (sections: ROLE, RULES, STYLE) across files.
- Let **memory** specialize behavior over time without rewriting the base prompt every time.

---

## See also

- [README.md](../README.md) — install, volumes, HTTP contract
- [ARCHITECTURE.md](ARCHITECTURE.md) — layers inside `agent_core`
- [AGENTS.md](../AGENTS.md) — code locations for routing and runner
