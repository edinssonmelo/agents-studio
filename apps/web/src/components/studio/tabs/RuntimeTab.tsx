'use client';
// src/components/studio/tabs/RuntimeTab.tsx

import { useState } from 'react';
import { Send, Loader2, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { useStudioStore } from '@/lib/store';
import { agentsApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn, formatRelative, formatDuration } from '@/lib/utils';

export function RuntimeTab() {
  const { selectedAgent, selectedAssistant, lastRunResult, setLastRunResult, events } =
    useStudioStore();

  const [task, setTask] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);

  const agentEvents = events
    .filter(
      (e) =>
        (e.payload.agentHint === selectedAgent || e.payload.agentName === selectedAgent) &&
        (e.type === 'agent.run.start' ||
          e.type === 'agent.run.complete' ||
          e.type === 'agent.run.error'),
    )
    .slice(0, 20);

  async function handleRun() {
    if (!task.trim() || !selectedAgent) return;
    setLoading(true);
    setLastRunResult(null);
    try {
      const result = await agentsApi.run({
        task: task.trim(),
        assistantId: selectedAssistant,
        agentHint: selectedAgent,
        context: context.trim() || undefined,
      });
      setLastRunResult(result);
    } catch (err: any) {
      toast.error(err?.message ?? 'Run failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Input area */}
      <div className="p-5 border-b border-border space-y-3 flex-shrink-0">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Task</label>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder={`Send a task to ${selectedAgent}…`}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun();
            }}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm
                       placeholder:text-muted-foreground/50 resize-none
                       focus:outline-none focus:ring-2 focus:ring-ring/40 transition font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Context <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Additional context…"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm
                       placeholder:text-muted-foreground/50 resize-none
                       focus:outline-none focus:ring-2 focus:ring-ring/40 transition font-mono"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">⌘↩ to run</p>
          <button
            onClick={handleRun}
            disabled={loading || !task.trim()}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground
                       text-sm font-medium transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {loading ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>

      {/* Response */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {loading && (
          <div className="p-5 flex items-center gap-3 text-sm text-muted-foreground animate-in">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            <span>Agent is processing your task…</span>
          </div>
        )}

        {lastRunResult && !loading && (
          <div className="p-5 space-y-3 animate-in">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span>Handled by <span className="font-mono font-medium text-foreground">{lastRunResult.agent}</span></span>
              {lastRunResult.fallback && (
                <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 text-[10px]">
                  fallback
                </span>
              )}
              {lastRunResult.routing_path?.length > 0 && (
                <span className="ml-auto font-mono">{lastRunResult.routing_path.join(' → ')}</span>
              )}
            </div>
            <div className="rounded-lg bg-muted/60 p-4">
              <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans break-words">
                {lastRunResult.response}
              </pre>
            </div>
          </div>
        )}

        {/* Recent events for this agent */}
        {agentEvents.length > 0 && (
          <div className="p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Recent Events
            </h3>
            <div className="space-y-2">
              {agentEvents.map((evt) => (
                <EventRow key={evt.id} event={evt} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: any }) {
  const isError = event.type === 'agent.run.error';
  const isComplete = event.type === 'agent.run.complete';
  const isStart = event.type === 'agent.run.start';

  return (
    <div className="flex items-start gap-2.5 text-xs">
      <span className="mt-0.5 flex-shrink-0">
        {isError ? (
          <XCircle className="w-3.5 h-3.5 text-destructive" />
        ) : isComplete ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Zap className="w-3.5 h-3.5 text-blue-500" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-medium">{event.type.replace('agent.', '')}</span>
        {event.payload.durationMs && (
          <span className="text-muted-foreground ml-1.5">
            {formatDuration(event.payload.durationMs as number)}
          </span>
        )}
        {event.payload.error && (
          <p className="text-destructive mt-0.5 truncate">{event.payload.error as string}</p>
        )}
      </div>
      <span className="text-muted-foreground/60 flex-shrink-0">{formatRelative(event.ts)}</span>
    </div>
  );
}
