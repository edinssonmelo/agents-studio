'use client';
// src/components/studio/tabs/ActionsTab.tsx

import { useState, useEffect } from 'react';
import {
  RotateCcw, Loader2, Trash2, CheckCircle2, XCircle,
  Clock, RefreshCw,
} from 'lucide-react';
import { useStudioStore } from '@/lib/store';
import { agentsApi, auditApi, type AuditLog } from '@/lib/api-client';
import { toast } from 'sonner';
import { formatRelative, formatDuration } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function ActionsTab() {
  const { selectedAgent, selectedAssistant } = useStudioStore();
  const [resetting, setResetting] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (!selectedAgent) return;
    loadLogs();
  }, [selectedAgent, selectedAssistant]);

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const data = await auditApi.getLogs({
        assistantId: selectedAssistant,
        agentName: selectedAgent ?? undefined,
        limit: 30,
      });
      setLogs(data);
    } catch {
      // Non-critical
    } finally {
      setLoadingLogs(false);
    }
  }

  async function handleReset() {
    if (!selectedAgent) return;
    const confirmed = window.confirm(
      `Reset working memory for "${selectedAgent}"? This deletes working.md but keeps memory.md.`,
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      await agentsApi.resetSession(selectedAssistant, selectedAgent);
      toast.success(`Session reset for ${selectedAgent}`);
      loadLogs();
    } catch (err: any) {
      toast.error(err?.message ?? 'Reset failed');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="p-5 space-y-6 animate-in">
      {/* Quick actions */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 gap-2">
          <ActionCard
            icon={<RotateCcw className="w-4 h-4" />}
            title="Reset Session"
            description={`Clears working.md for ${selectedAgent}. Permanent memory is preserved.`}
            danger
            loading={resetting}
            onClick={handleReset}
            label={resetting ? 'Resetting…' : 'Reset'}
          />
        </div>
      </section>

      {/* Audit log */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Audit Log
          </h3>
          <button
            onClick={loadLogs}
            disabled={loadingLogs}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loadingLogs && 'animate-spin')} />
          </button>
        </div>

        {loadingLogs && logs.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading logs…
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No activity yet for this agent.</p>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ActionCard({
  icon, title, description, danger = false, loading, onClick, label,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  danger?: boolean;
  loading: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 rounded-lg border',
        danger ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-card',
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5', danger ? 'text-destructive' : 'text-muted-foreground')}>
          {icon}
        </span>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      <button
        onClick={onClick}
        disabled={loading}
        className={cn(
          'ml-4 flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition',
          danger
            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-40'
            : 'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40',
          'disabled:cursor-not-allowed',
        )}
      >
        {loading && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}
        {label}
      </button>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  run_agent:     'Run',
  reset_session: 'Reset',
  append_memory: 'Append memory',
  edit_config:   'Edit config',
  apply_config:  'Apply config',
};

function LogRow({ log }: { log: AuditLog }) {
  const isError = log.result === 'error';
  return (
    <div className="flex items-start gap-2.5 py-1.5 text-xs">
      <span className="mt-0.5 flex-shrink-0">
        {isError ? (
          <XCircle className="w-3.5 h-3.5 text-destructive" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-medium">{ACTION_LABELS[log.action] ?? log.action}</span>
        {log.durationMs && (
          <span className="text-muted-foreground ml-1.5">{formatDuration(log.durationMs)}</span>
        )}
        {isError && log.errorMsg && (
          <p className="text-destructive truncate mt-0.5">{log.errorMsg}</p>
        )}
      </div>
      <div className="flex items-center gap-1 text-muted-foreground/60 flex-shrink-0">
        <Clock className="w-3 h-3" />
        {formatRelative(log.createdAt)}
      </div>
    </div>
  );
}
