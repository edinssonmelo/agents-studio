from __future__ import annotations

import pytest

from commands.parser import parse_command

HEADERS = {"X-Agent-Core-Token": "test-token"}


def test_healthz_no_auth(agent_core_client):
    r = agent_core_client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_run_401_missing_token(agent_core_client):
    r = agent_core_client.post(
        "/run",
        json={"task": "hola", "assistant_id": "me"},
    )
    assert r.status_code == 401
    body = r.json()
    assert body.get("error") == "unauthorized"


def test_run_general_no_match(agent_core_client):
    r = agent_core_client.post(
        "/run",
        json={"task": "¿qué tiempo hace hoy?", "assistant_id": "me"},
        headers=HEADERS,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["handled"] is False
    assert data["mode"] == "general"
    assert data["agent"] is None
    assert data["routing_reason"] == "no_match"
    assert data["token_usage"]["input"] == 0
    assert data["token_usage"]["output"] == 0
    assert "request_id" in data


def test_run_wife_dev_404(agent_core_client):
    r = agent_core_client.post(
        "/run",
        json={
            "task": "fix bug",
            "assistant_id": "wife",
            "command": "/dev",
        },
        headers=HEADERS,
    )
    assert r.status_code == 404
    body = r.json()
    assert body["error"] == "agent_not_found"


def test_run_extra_field_forbidden(agent_core_client):
    r = agent_core_client.post(
        "/run",
        json={
            "task": "hola",
            "assistant_id": "me",
            "unexpected": True,
        },
        headers=HEADERS,
    )
    assert r.status_code == 422


def test_run_invalid_assistant_pattern(agent_core_client):
    r = agent_core_client.post(
        "/run",
        json={"task": "hola", "assistant_id": "other"},
        headers=HEADERS,
    )
    assert r.status_code == 422


def test_agents_list(agent_core_client):
    r = agent_core_client.get("/agents?assistant_id=me", headers=HEADERS)
    assert r.status_code == 200
    data = r.json()
    assert data["assistant_id"] == "me"
    names = {a["name"] for a in data["agents"]}
    assert names == {"design", "marketing"}


def test_delete_session_clears_working(agent_core_client):
    import memory.manager as mm
    from config import get_agent_catalog

    agents = get_agent_catalog("me")
    mm.append_memory("me", "design", agents, "x", kind="working")
    p = mm.DATA_ROOT / "me" / "agents" / "design" / "working.md"
    assert p.exists()

    r = agent_core_client.delete("/session/me/design", headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert not p.exists()


def test_append_memory(agent_core_client):
    r = agent_core_client.post(
        "/memory/me/design/append",
        headers=HEADERS,
        json={"content": "## test\n- item"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_parse_command_agentes():
    out = parse_command("/agentes")
    assert out["type"] == "list_agents"


def test_parse_command_reset():
    out = parse_command("/reset-agent design")
    assert out["type"] == "reset_agent"
    assert out["agent"] == "design"


def test_metrics_requires_auth(agent_core_client):
    r = agent_core_client.get("/metrics")
    assert r.status_code == 401

    r2 = agent_core_client.get("/metrics", headers=HEADERS)
    assert r2.status_code == 200
    assert "agent_core_run_total" in r2.text
