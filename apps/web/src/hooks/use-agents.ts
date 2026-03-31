// src/hooks/use-agents.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { agentsApi, type AssistantId, type Agent } from '@/lib/api-client';
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
      // agent_core returns: { assistants: { me: { agents: { design: {...} } } } }
      const assistantData = data?.assistants?.[selectedAssistant];
      setAgents(assistantData?.agents ?? {});
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
