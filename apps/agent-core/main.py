"""Agent Core — FastAPI orchestrator (internal only)."""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field

from agents.runner import run_specialized
from config import get_agent_catalog, load_assistants, reload_assistants_catalog
from memory import manager as memory_manager
from router import normalize_command, route_task

log = logging.getLogger("agent_core")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

CLASSIFIER_TIMEOUT = float(os.environ.get("AGENT_CORE_CLASSIFIER_TIMEOUT", "12"))
LLM_TIMEOUT = float(os.environ.get("AGENT_CORE_LLM_TIMEOUT", "60"))
APP_VERSION = os.environ.get("AGENT_CORE_VERSION", "0.1.0")

_metrics_lock = threading.Lock()
_metrics: dict[str, int] = {
    "http_requests_total": 0,
    "run_total": 0,
    "run_handled_true": 0,
    "run_handled_false": 0,
    "llm_errors_total": 0,
    "auth_failures_total": 0,
}


def _inc(key: str, n: int = 1) -> None:
    with _metrics_lock:
        _metrics[key] = _metrics.get(key, 0) + n


def verify_core_auth(
    x_agent_core_token: Annotated[str | None, Header(alias="X-Agent-Core-Token")] = None,
) -> None:
    expected = os.environ.get("AGENT_CORE_TOKEN", "").strip()
    if not expected:
        log.warning("AGENT_CORE_TOKEN unset — internal API is not authenticated")
        return
    if not x_agent_core_token or x_agent_core_token != expected:
        _inc("auth_failures_total")
        raise HTTPException(
            status_code=401,
            detail={
                "error": "unauthorized",
                "detail": "missing or invalid X-Agent-Core-Token",
            },
        )


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task: str = Field(..., min_length=1, max_length=2000)
    assistant_id: str = Field(..., pattern="^(me|wife)$")
    command: str | None = Field(None, max_length=64)
    agent_hint: str | None = Field(None, max_length=64)
    context: str | None = Field(None, max_length=500)


class AppendMemoryBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(..., min_length=1, max_length=100_000)


app = FastAPI(title="agent-core", version=APP_VERSION)


@app.middleware("http")
async def structured_access_log(request: Request, call_next):
    start = time.perf_counter()
    _inc("http_requests_total")
    rid = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:16]}"
    request.state.request_id = rid
    response = await call_next(request)
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    log.info(
        "request_id=%s method=%s path=%s status=%s latency_ms=%s",
        rid,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    response.headers["X-Request-ID"] = rid
    return response


def _strict_auth_enabled() -> bool:
    return os.environ.get("AGENT_CORE_STRICT_AUTH", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


@app.on_event("startup")
def startup() -> None:
    if _strict_auth_enabled() and not os.environ.get("AGENT_CORE_TOKEN", "").strip():
        log.error(
            "AGENT_CORE_STRICT_AUTH is set but AGENT_CORE_TOKEN is empty — refusing to start"
        )
        raise RuntimeError(
            "AGENT_CORE_TOKEN is required when AGENT_CORE_STRICT_AUTH is enabled"
        )
    load_assistants()  # fail fast if yaml missing
    log.info("agent-core started version=%s", APP_VERSION)


@app.get("/healthz")
def healthz():
    return {"ok": True, "version": APP_VERSION}


@app.post("/admin/reload-config", dependencies=[Depends(verify_core_auth)])
def admin_reload_config() -> dict[str, Any]:
    """Reload assistants.yaml from disk without restarting the process."""
    try:
        reload_assistants_catalog()
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "reload_failed",
                "detail": str(exc),
            },
        ) from exc
    return {"ok": True, "reloaded": True}


@app.get("/metrics", dependencies=[Depends(verify_core_auth)])
def metrics():
    lines = [
        "# HELP agent_core_http_requests_total Total HTTP requests seen by middleware",
        "# TYPE agent_core_http_requests_total counter",
        f"agent_core_http_requests_total {_metrics.get('http_requests_total', 0)}",
        "# HELP agent_core_run_total POST /run invocations",
        "# TYPE agent_core_run_total counter",
        f"agent_core_run_total {_metrics.get('run_total', 0)}",
        "# HELP agent_core_run_handled_true Runs that returned handled=true",
        "# TYPE agent_core_run_handled_true counter",
        f"agent_core_run_handled_true {_metrics.get('run_handled_true', 0)}",
        "# HELP agent_core_run_handled_false Runs that returned handled=false",
        "# TYPE agent_core_run_handled_false counter",
        f"agent_core_run_handled_false {_metrics.get('run_handled_false', 0)}",
        "# HELP agent_core_llm_errors_total LLM call failures",
        "# TYPE agent_core_llm_errors_total counter",
        f"agent_core_llm_errors_total {_metrics.get('llm_errors_total', 0)}",
        "# HELP agent_core_auth_failures_total Rejected auth attempts",
        "# TYPE agent_core_auth_failures_total counter",
        f"agent_core_auth_failures_total {_metrics.get('auth_failures_total', 0)}",
    ]
    return PlainTextResponse("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")


@app.get("/agents", dependencies=[Depends(verify_core_auth)])
async def list_agents(assistant_id: str) -> dict[str, Any]:
    if assistant_id not in ("me", "wife"):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_assistant",
                "detail": "assistant_id debe ser 'me' o 'wife'",
            },
        )
    agents = get_agent_catalog(assistant_id)
    out = [
        {"name": name, "description": cfg.get("description", "")}
        for name, cfg in agents.items()
    ]
    return {"assistant_id": assistant_id, "agents": out}


def _new_request_id(assistant_id: str) -> str:
    return f"req_{assistant_id}_{uuid.uuid4().hex[:10]}"


@app.post("/run", dependencies=[Depends(verify_core_auth)])
async def run_endpoint(req: RunRequest, request: Request) -> dict[str, Any]:
    _inc("run_total")
    request_id = getattr(request.state, "request_id", None) or _new_request_id(
        req.assistant_id
    )
    agents = get_agent_catalog(req.assistant_id)
    api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()

    base: dict[str, Any] = {
        "assistant_id": req.assistant_id,
        "request_id": request_id,
        "token_usage": {"input": 0, "output": 0},
    }

    try:
        agent_name, routing_reason = await route_task(
            req.task,
            req.assistant_id,
            req.command,
            req.agent_hint,
            api_key=api_key,
            http_timeout=CLASSIFIER_TIMEOUT,
        )
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "agent_not_found",
                "detail": f"agente '{exc.args[0]}' no existe en catálogo de '{req.assistant_id}'",
            },
        ) from exc

    if agent_name == "general":
        _inc("run_handled_false")
        log.info(
            "run_decision request_id=%s assistant_id=%s agent=- routing_reason=%s handled=false",
            request_id,
            req.assistant_id,
            routing_reason,
        )
        return {
            **base,
            "handled": False,
            "mode": "general",
            "agent": None,
            "response": None,
            "routing_reason": routing_reason,
        }

    agent_cfg = agents[agent_name]
    if not api_key:
        _inc("run_handled_false")
        _inc("llm_errors_total")
        log.error("DEEPSEEK_API_KEY missing; cannot run specialized agent")
        return {
            **base,
            "handled": False,
            "mode": "general",
            "agent": None,
            "response": None,
            "routing_reason": "no_deepseek_key",
        }

    try:
        text, usage = await run_specialized(
            task=req.task,
            context=req.context,
            assistant_id=req.assistant_id,
            agent_name=agent_name,
            agent_cfg=agent_cfg,
            agents_catalog=agents,
            api_key=api_key,
            llm_timeout=LLM_TIMEOUT,
        )
    except httpx.TimeoutException:
        _inc("llm_errors_total")
        _inc("run_handled_false")
        return JSONResponse(
            status_code=408,
            content={
                "error": "llm_timeout",
                "detail": f"timeout tras {int(LLM_TIMEOUT)}s",
                "fallback": "general",
                "request_id": request_id,
                "assistant_id": req.assistant_id,
            },
        )
    except Exception as exc:
        _inc("llm_errors_total")
        _inc("run_handled_false")
        log.exception("run_specialized failed: %s", exc)
        return {
            **base,
            "handled": False,
            "mode": "general",
            "agent": None,
            "response": None,
            "routing_reason": "llm_error",
        }

    _inc("run_handled_true")
    log.info(
        "run_decision request_id=%s assistant_id=%s agent=%s routing_reason=%s handled=true tokens_in=%s tokens_out=%s",
        request_id,
        req.assistant_id,
        agent_name,
        routing_reason,
        usage.get("input"),
        usage.get("output"),
    )
    return {
        **base,
        "handled": True,
        "mode": "specialized",
        "agent": agent_name,
        "response": text,
        "routing_reason": routing_reason,
        "token_usage": usage,
    }


@app.delete("/session/{assistant_id}/{agent}", dependencies=[Depends(verify_core_auth)])
async def reset_working(assistant_id: str, agent: str) -> dict[str, Any]:
    if assistant_id not in ("me", "wife"):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_assistant",
                "detail": "assistant_id debe ser 'me' o 'wife'",
            },
        )
    agents = get_agent_catalog(assistant_id)
    if agent not in agents:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "agent_not_found",
                "detail": f"agente '{agent}' no existe en catálogo de '{assistant_id}'",
            },
        )
    path = memory_manager.clear_working(assistant_id, agent, agents)
    rel = f"{assistant_id}/{agent}/working.md"
    return {"ok": True, "cleared": rel}


@app.post(
    "/memory/{assistant_id}/{agent}/append",
    dependencies=[Depends(verify_core_auth)],
)
async def append_agent_memory(
    assistant_id: str,
    agent: str,
    body: AppendMemoryBody,
) -> dict[str, Any]:
    if assistant_id not in ("me", "wife"):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_assistant",
                "detail": "assistant_id debe ser 'me' o 'wife'",
            },
        )
    agents = get_agent_catalog(assistant_id)
    if agent not in agents:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "agent_not_found",
                "detail": f"agente '{agent}' no existe en catálogo de '{assistant_id}'",
            },
        )
    memory_manager.append_memory(
        assistant_id, agent, agents, body.content, kind="memory"
    )
    return {"ok": True, "target": f"{assistant_id}/{agent}/memory.md"}


@app.exception_handler(HTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    """Flat JSON for dict details (contract errors); preserve 422 validation shape."""
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
