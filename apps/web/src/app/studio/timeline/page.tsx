'use client';
// src/app/studio/timeline/page.tsx
// Global realtime timeline of all agent_core events since page load.

import { useState } from 'react';
import {
  Zap, CheckCircle2, XCircle, RotateCcw, BookOpen,
  Settings2, Trash2, Filter, Activity,
} from 'lucide-react';
import { useStudioStore, type RuntimeEvent } from '@/lib/store';
import { cn, formatRelative, formatDuration } from '@/lib/utils';

// ── Event metadata ────────────────────────────────────────────────────────

const EVENT_META: Record<
  RuntimeEvent['type'],
  { icon: React.ElementType; color: string; label: string }
> = {
  'agent.run.start':      { icon: Zap,          color: 'text-blue-500',    label: 'Run started'     },
  'agent.run.complete':   { icon: CheckCircle2,  color: 'text-green-500',   label: 'Run complete'    },
  'agent.run.error':      { icon: XCircle,       color: 'text-destructive', label: 'Run error'       },
  'agent.reset':          { icon: RotateCcw,     color: 'text-orange-500',  label: 'Session reset'   },
  'agent.memory.append':  { icon: BookOpen,      color: 'text-purple-500',  label: 'Memory appended' },
  'config.reloaded':      { icon: Settings2,     color: 'text-green-500',   label: 'Config reloaded' },
  'config.reload_failed': { icon: XCircle,       color: 'text-destructive', label: 'Reload failed'   },
  'config.applied':       { icon: CheckCircle2,  color: 'text-green-500',   label: 'Config applied'  },
  'config.prompt_updated':{ icon: Settings2,     color: 'text-blue-500',    label: 'Prompt updated'  },
};

const FILTER_GROUPS = [
  { id: 'all',    label: 'All' },
  { id: 'runs',   label: 'Runs',   types: ['agent.run.start', 'agent.run.complete', 'agent.run.error'] },
  { id: 'memory', label: 'Memory', types: ['agent.memory.append', 'agent.reset'] },
  { id: 'config', label: 'Config', types: ['config.reloaded', 'config.reload_failed', 'config.applied', 'config.prompt_updated'] },
];

// ── Component ─────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { events, clearEvents, selectedAssistant } = useStudioStore();
  const [filter, setFilter]       = useState('all');
  const [agentFilter, setAgentFilter] = useState('');

  const activeGroup = FILTER_GROUPS.find((g) => g.id === filter);
  const visibleEvents = events.filter((evt) => {
    // Group filter
    if (activeGroup?.types && !activeGroup.types.includes(evt.type)) return false;
    // Agent search
    if (agentFilter) {
      const agent = (evt.payload.agentName ?? evt.payload.agentHint ?? '') as string;
      if (!agent.toLowerCase().includes(agentFilter.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h1 className="text-sm font-semibold">Timeline</h1>
          {events.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {visibleEvents.length}/{events.length} events
            </span>
          )}
        </div>
        {events.length > 0 && (
          <button
            onClick={clearEvents}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs
                       text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border flex-shrink-0">
        {/* Group pills */}
        <div className="flex items-center gap-1">
          {FILTER_GROUPS.map((g) => (
            <button
              key={g.id}
              onClick={() => setFilter(g.id)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition',
                filter === g.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Agent search */}
        <div className="relative flex items-center">
          <Filter className="w-3 h-3 absolute left-2.5 text-muted-foreground/60 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter by agent…"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="pl-7 pr-3 py-1 text-xs rounded-md border border-border bg-background
                       focus:outline-none focus:ring-1 focus:ring-ring/50 w-40 transition"
          />
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {visibleEvents.length === 0 ? (
          <EmptyState hasEvents={events.length > 0} />
        ) : (
          <div className="divide-y divide-border/60">
            {visibleEvents.map((evt) => (
              <EventRow key={evt.id} event={evt} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasEvents }: { hasEvents: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-16">
      <Activity className="w-8 h-8 text-muted-foreground/30" />
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {hasEvents ? 'No events match this filter' : 'No events yet'}
        </p>
        <p className="text-xs text-muted-foreground/60">
          {hasEvents
            ? 'Try changing the filter above'
            : 'Events appear here in real time as agents run'}
        </p>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: RuntimeEvent }) {
  const meta = EVENT_META[event.type] ?? {
    icon: Zap,
    color: 'text-muted-foreground',
    label: event.type,
  };
  const Icon = meta.icon;

  const agentName = (event.payload.agentName ?? event.payload.agentHint) as string | undefined;
  const assistantId = event.payload.assistantId as string | undefined;
  const durationMs = event.payload.durationMs as number | undefined;
  const errorMsg = event.payload.error as string | undefined;
  const contentLength = event.payload.contentLength as number | undefined;

  return (
    <div className="flex items-start gap-4 px-6 py-3 hover:bg-muted/30 transition group animate-in">
      {/* Timeline dot + icon */}
      <div className="flex flex-col items-center mt-0.5 flex-shrink-0">
        <span className={cn('flex-shrink-0', meta.color)}>
          <Icon className="w-4 h-4" />
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{meta.label}</span>
          {agentName && (
            <span className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-muted-foreground">
              {agentName}
            </span>
          )}
          {assistantId && (
            <span className="text-xs text-muted-foreground/60">{assistantId}</span>
          )}
          {durationMs !== undefined && (
            <span className="text-xs text-muted-foreground ml-auto tabular-nums">
              {formatDuration(durationMs)}
            </span>
          )}
        </div>

        {errorMsg && (
          <p className="text-xs text-destructive truncate">{errorMsg}</p>
        )}
        {contentLength && (
          <p className="text-xs text-muted-foreground">{contentLength} chars appended</p>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-xs text-muted-foreground/50 flex-shrink-0 tabular-nums">
        {formatRelative(event.ts)}
      </span>
    </div>
  );
}
