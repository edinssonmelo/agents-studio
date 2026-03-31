"""
agent-core-extensions/reload_config_patch.py
============================================
PATCH INSTRUCTIONS
==================
This file shows exactly which code to add to agent_core/main.py
to support the /admin/reload-config endpoint required by Agents Studio.

HOW TO APPLY
------------
1. Open agent_core/main.py in your editor.
2. Apply each section as described below.

This endpoint:
- Is protected by the same X-Agent-Core-Token auth.
- Reloads assistants.yaml from disk without restarting the process.
- Returns {reloaded: true, agents_count: N} on success.
- Is only reachable from net_internal (never public via Traefik).

SECURITY NOTE
-------------
- This endpoint does NOT restart the process, it only re-reads the YAML.
- The file path is taken from the environment variable / config, not from
  the request body, preventing path traversal.
"""

# ============================================================
# SECTION 1: Add to imports (top of main.py)
# ============================================================

# import threading   ← already present in most FastAPI apps; add if missing
# import time        ← for reload timestamp

# ============================================================
# SECTION 2: Add module-level variable near the top,
# after assistants.yaml is first loaded:
# ============================================================

# _config_lock = threading.Lock()
# _last_reload: float = time.time()

# ============================================================
# SECTION 3: Add the reload function
# ============================================================

def _reload_assistants_yaml(app_state: dict, yaml_path: str) -> dict:
    """
    Re-reads assistants.yaml from disk into app_state.
    Thread-safe via _config_lock.
    Returns summary dict.
    """
    import yaml
    import threading
    import time

    lock = app_state.get("_config_lock") or threading.Lock()

    with lock:
        with open(yaml_path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)

        # Replicate how the original loader builds the assistants dict
        # Adjust key names to match what your codebase uses.
        app_state["assistants"] = raw.get("assistants", raw)
        app_state["_last_reload"] = time.time()

    total_agents = sum(
        len(v.get("agents", {}))
        for v in app_state["assistants"].values()
        if isinstance(v, dict)
    )
    return {
        "reloaded": True,
        "agents_count": total_agents,
        "ts": app_state["_last_reload"],
    }


# ============================================================
# SECTION 4: Add the FastAPI route (paste inside main.py,
# after the existing route definitions)
# ============================================================

RELOAD_CONFIG_ROUTE = """
@app.post("/admin/reload-config")
async def admin_reload_config(request: Request):
    \"\"\"
    Reload assistants.yaml from disk without restarting.
    Protected by X-Agent-Core-Token.
    Only reachable from net_internal — never via public Traefik.
    \"\"\"
    # Auth check (same pattern used in other protected routes)
    token = request.headers.get("X-Agent-Core-Token", "")
    if token != settings.AGENT_CORE_TOKEN:
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})

    try:
        result = _reload_assistants_yaml(app.state.__dict__, settings.ASSISTANTS_YAML_PATH)
        return JSONResponse(content=result)
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail={"error": "assistants_yaml_not_found", "path": settings.ASSISTANTS_YAML_PATH},
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "reload_failed", "detail": str(e)},
        )
"""

# ============================================================
# SECTION 5: Add ASSISTANTS_YAML_PATH to settings/config
# (if not already present):
# ============================================================

SETTINGS_ADDITION = """
# In your settings / config class:
ASSISTANTS_YAML_PATH: str = os.getenv(
    "AGENT_CORE_ASSISTANTS_YAML",
    "/app/agent-core/assistants.yaml",  # adjust to your actual path
)
"""

# ============================================================
# SECTION 6: Test the endpoint manually:
# ============================================================

TEST_CURL = """
# From another container on net_internal:
curl -s -X POST http://agent_core:8766/admin/reload-config \\
  -H "X-Agent-Core-Token: $AGENT_CORE_TOKEN" | python3 -m json.tool

# Expected response:
# {
#   "reloaded": true,
#   "agents_count": 6,
#   "ts": 1719000000.123
# }
"""

print("Patch documentation loaded. See sections above for integration steps.")
