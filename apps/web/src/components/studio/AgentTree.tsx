'use client';
// src/components/studio/AgentTree.tsx

import { useEffect } from 'react';
import {
  RefreshCw, ChevronRight, Cpu, Zap,
  PanelLeftOpen,
} from 'lucide-react';
import { useStudioStore } from '@/lib/store';
import { useAgents } from '@/hooks/use-agents';
import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/api-client';

export function AgentTree() {
  const {
    selectedAssistant,
    selectedAgent,
    setSelectedAgent,
    sidebarOpen,
    toggleSidebar,
    events,
  } = useStudioStore();

  const { agents, loading, error, refresh } = useAgents();

  // Determine which agents are "active" based on recent events
  const runningAgents = new Set(
    events
      .filter((e) => e.type === 'agent.run.start' &&
        !events.find((e2) => e2.type === 'agent.run.complete' &&
          (e2.payload.agentName === e.payload.agentHint) &&
          e2.ts > e.ts))
      .map((e) => e.payload.agentHint as string)
      .filter(Boolean),
  );

  const agentEntries = Object.entries(agents);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-12 border-b border-border flex-shrink-0">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition mr-1"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          {selectedAssistant === 'me' ? 'My Agents' : "Wife's Agents"}
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading && agentEntries.length === 0 && (
          <div className="px-4 py-8 flex flex-col items-center gap-2 text-center">
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-xs text-muted-foreground">Loading agents…</p>
          </div>
        )}

        {error && (
          <div className="mx-3 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive leading-relaxed">{error}</p>
            <button
              onClick={refresh}
              className="mt-2 text-xs text-destructive/80 hover:text-destructive underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && agentEntries.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Cpu className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No agents configured</p>
          </div>
        )}

        {agentEntries.length > 0 && (
          <div>
            {/* Assistant root node */}
            <div className="flex items-center gap-1.5 px-3 py-1 mb-1">
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {selectedAssistant}
              </span>
              <span className="text-xs text-muted-foreground/60 ml-auto">
                {agentEntries.length}
              </span>
            </div>

            {/* Agent nodes */}
            <div className="space-y-0.5 px-2">
              {agentEntries.map(([name, agent]) => (
                <AgentNode
                  key={name}
                  name={name}
                  agent={agent}
                  selected={selectedAgent === name}
                  running={runningAgents.has(name)}
                  onClick={() => setSelectedAgent(selectedAgent === name ? null : name)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentNode({
  name, agent, selected, running, onClick,
}: {
  name: string;
  agent: Agent;
  selected: boolean;
  running: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md text-left transition group',
        selected
          ? 'bg-accent text-foreground'
          : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground',
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          'status-dot mt-1 flex-shrink-0',
          running ? 'running' : selected ? 'healthy' : 'idle',
        )}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{name}</span>
          {running && <Zap className="w-3 h-3 text-blue-500 flex-shrink-0" />}
        </div>
        {agent.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5 leading-snug">
            {agent.description}
          </p>
        )}
        {agent.model && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">
            {agent.model}
          </p>
        )}
      </div>
    </button>
  );
}
