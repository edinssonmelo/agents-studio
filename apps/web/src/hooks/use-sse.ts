// src/hooks/use-sse.ts
// Opens an SSE connection to /api/sse/events and dispatches events to the store.

'use client';

import { useEffect, useRef } from 'react';
import { getToken } from '@/lib/api-client';
import { useStudioStore } from '@/lib/store';
import type { RuntimeEvent } from '@/lib/store';

const SSE_EVENTS: RuntimeEvent['type'][] = [
  'agent.run.start',
  'agent.run.complete',
  'agent.run.error',
  'agent.reset',
  'agent.memory.append',
  'config.reloaded',
  'config.reload_failed',
  'config.applied',
  'config.prompt_updated',
];

export function useSse(assistantId: string) {
  const pushEvent = useStudioStore((s) => s.pushEvent);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const url = `/api/sse/events?token=${encodeURIComponent(token)}&assistant_id=${assistantId}`;
    const es = new EventSource(url);
    esRef.current = es;

    for (const eventType of SSE_EVENTS) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          pushEvent({ type: eventType, ts: payload.ts ?? new Date().toISOString(), payload });
        } catch {}
      });
    }

    es.addEventListener('connected', (e: MessageEvent) => {
      console.log('[SSE] Connected:', e.data);
    });

    es.onerror = () => {
      // EventSource auto-reconnects; just log
      console.warn('[SSE] Connection error, will retry...');
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [assistantId, pushEvent]);
}
