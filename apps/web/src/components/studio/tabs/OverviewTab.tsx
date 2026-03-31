'use client';
// src/components/studio/tabs/OverviewTab.tsx

import { useStudioStore } from '@/lib/store';

export function OverviewTab() {
  const { selectedAgent, agents, selectedAssistant, events } = useStudioStore();
  const agent = agents[selectedAgent ?? ''];

  const agentEvents = events.filter(
    (e) =>
      (e.payload.agentName === selectedAgent || e.payload.agentHint === selectedAgent) &&
      e.payload.assistantId === selectedAssistant,
  );

  const lastRun = agentEvents.find((e) => e.type === 'agent.run.complete');
  const totalRuns = agentEvents.filter((e) => e.type === 'agent.run.complete').length;
  const totalErrors = agentEvents.filter((e) => e.type === 'agent.run.error').length;

  if (!agent) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Agent not found. Refresh the tree.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl animate-in">
      {/* Description */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Description
        </h3>
        <p className="text-sm leading-relaxed">
          {agent.description || <span className="text-muted-foreground italic">No description</span>}
        </p>
      </section>

      {/* Properties grid */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Configuration
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Property label="Model" value={agent.model ?? '—'} mono />
          <Property label="Max output" value={agent.max_output ? `${agent.max_output} tokens` : '—'} />
          <Property label="Prompt file" value={agent.prompt_file ?? '—'} mono />
          <Property label="Assistant" value={selectedAssistant} />
        </div>
      </section>

      {/* Keywords */}
      {agent.keywords && agent.keywords.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Keywords
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {agent.keywords.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 rounded-md bg-muted text-xs text-muted-foreground font-mono"
              >
                {kw}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Runtime stats */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Session Stats
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Runs" value={totalRuns} />
          <Stat label="Errors" value={totalErrors} colorClass={totalErrors > 0 ? 'text-destructive' : undefined} />
          <Stat
            label="Last run"
            value={lastRun ? new Date(lastRun.ts).toLocaleTimeString() : '—'}
          />
        </div>
      </section>
    </div>
  );
}

function Property({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function Stat({ label, value, colorClass }: { label: string; value: string | number; colorClass?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2.5">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${colorClass ?? ''}`}>{value}</p>
    </div>
  );
}
