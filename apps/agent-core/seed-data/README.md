# Optional starter memory (demo)

Agent Core and the Studio API expect user data under a `users/` directory on the **data** volume:

```text
users/
  me/
    global.md
    agents/
      <agent_name>/
        memory.md
        working.md
  wife/
    ...
```

To seed empty globals for local demos:

```bash
mkdir -p ./data/agent-core-data/users/me ./data/agent-core-data/users/wife
cp seed-data/users/me/global.md ./data/agent-core-data/users/me/
cp seed-data/users/wife/global.md ./data/agent-core-data/users/wife/
```

Adjust host paths if your `AGENT_CORE_DATA_PATH` differs.
