// src/lib/api-client.ts
// Central HTTP client. Token is stored in localStorage and sent as Bearer.
// All calls go to /api/* (same origin via Next.js rewrites or Traefik).

const API_BASE = '/api';
const TOKEN_KEY = 'agents_studio_token';

// ── Token helpers ─────────────────────────────────────────────────────────

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Types ─────────────────────────────────────────────────────────────────

export type AssistantId = 'me' | 'wife';

export interface Agent {
  name: string;
  description: string;
  keywords?: string[];
  model?: string;
  prompt_file?: string;
  max_output?: number;
}

export interface AgentsResponse {
  assistants: Record<string, { agents: Record<string, Agent> }>;
}

export interface RunResult {
  response: string;
  agent: string;
  assistant_id: string;
  routing_path: string[];
  fallback?: boolean;
}

export interface AuditLog {
  id: number;
  createdAt: string;
  userId: string;
  action: string;
  assistantId: string;
  agentName: string | null;
  result: string;
  errorMsg: string | null;
  durationMs: number | null;
}

export interface ConfigSnapshot {
  id: number;
  createdAt: string;
  userId: string;
  configType: string;
  agentName: string | null;
  applied: boolean;
  appliedAt: string | null;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let err: ApiError;
    try {
      err = await res.json();
    } catch {
      err = { statusCode: res.status, code: 'UNKNOWN', message: res.statusText };
    }
    throw err;
  }

  // Some endpoints return empty body on success
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (username: string, password: string) => {
    const data = await apiFetch<{ access_token: string; user: AssistantId }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    saveToken(data.access_token);
    return data;
  },
};

// ── Agents ────────────────────────────────────────────────────────────────

export const agentsApi = {
  health: () => apiFetch<{ ok: boolean }>('/agents/health'),

  list: (assistantId: AssistantId) =>
    apiFetch<AgentsResponse>(`/agents?assistant_id=${assistantId}`),

  run: (payload: {
    task: string;
    assistantId: AssistantId;
    agentHint?: string;
    context?: string;
  }) =>
    apiFetch<RunResult>('/agents/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resetSession: (assistantId: AssistantId, agentName: string) =>
    apiFetch<{ deleted: boolean }>(`/agents/session/${assistantId}/${agentName}`, {
      method: 'DELETE',
    }),

  appendMemory: (assistantId: AssistantId, agentName: string, content: string) =>
    apiFetch<{ appended: boolean }>(`/agents/memory/${assistantId}/${agentName}/append`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  reloadConfig: () =>
    apiFetch<{ reloaded: boolean }>('/agents/admin/reload-config', { method: 'POST' }),
};

// ── Config Editor ─────────────────────────────────────────────────────────

export const configApi = {
  getYaml: () => apiFetch<{ content: string; parsed: unknown }>('/config/assistants-yaml'),

  updateYaml: (content: string) =>
    apiFetch<{ applied: boolean; reloadResult?: unknown }>('/config/assistants-yaml', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  listPrompts: () => apiFetch<string[]>('/config/prompts'),

  getPrompt: (agentName: string) =>
    apiFetch<{ content: string; filename: string }>(`/config/prompts/${agentName}`),

  updatePrompt: (agentName: string, content: string) =>
    apiFetch<{ saved: boolean; filename: string }>(`/config/prompts/${agentName}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  getMemory: (assistantId: string, agentName: string, type: 'memory' | 'working') =>
    apiFetch<{ content: string }>(`/config/memory/${assistantId}/${agentName}?type=${type}`),

  getGlobalMemory: (assistantId: string) =>
    apiFetch<{ content: string }>(`/config/memory/${assistantId}/global`),

  getSnapshots: (type?: string) =>
    apiFetch<ConfigSnapshot[]>(`/config/snapshots${type ? `?type=${type}` : ''}`),
};

// ── Audit ─────────────────────────────────────────────────────────────────

export const auditApi = {
  getLogs: (params?: {
    assistantId?: string;
    agentName?: string;
    action?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.assistantId) qs.set('assistantId', params.assistantId);
    if (params?.agentName) qs.set('agentName', params.agentName);
    if (params?.action) qs.set('action', params.action);
    if (params?.limit) qs.set('limit', String(params.limit));
    return apiFetch<AuditLog[]>(`/audit/logs?${qs}`);
  },
};
