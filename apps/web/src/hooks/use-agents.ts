// src/hooks/use-agents.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { agentsApi, type Agent, type AssistantId } from '@/lib/api-client';
import { useStudioStore } from '@/lib/store';
import { toast } from 'sonner';

export function useAgents() {
  const { selectedAssistant, setAgents, agents } = useStudioStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await agentsApi.list(selectedAssistant);
      // agent_core: { assistant_id, agents: [{ name, description }, ...] }
      const list = data?.agents;
      if (!Array.isArray(list)) {
        setAgents({});
        return;
      }
      const byName: Record<string, Agent> = {};
      for (const row of list) {
        if (row?.name) {
          byName[row.name] = {
            name: row.name,
            description: row.description ?? '',
          };
        }
      }
      setAgents(byName);
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to load agents';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedAssistant, setAgents]);

  useEffect(() => {
    load();
  }, [load]);

  return { agents, loading, error, refresh: load };
}
