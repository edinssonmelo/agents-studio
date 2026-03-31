'use client';
// src/app/studio/config/page.tsx
// Edit assistants.yaml with Monaco, validate YAML, diff, apply + reload.

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Loader2, Save, RefreshCw, Check, AlertTriangle, TerminalSquare,
} from 'lucide-react';
import { configApi } from '@/lib/api-client';
import { useStudioStore } from '@/lib/store';
import { toast } from 'sonner';
import * as yaml from 'js-yaml';
import { cn } from '@/lib/utils';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center flex-1 gap-2 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading editor…
    </div>
  ),
});

export default function ConfigPage() {
  const { events } = useStudioStore();
  const [original, setOriginal] = useState('');
  const [content, setContent]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{ applied: boolean } | null>(null);

  const isDirty = content !== original;

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const d = await configApi.getYaml();
      setOriginal(d.content);
      setContent(d.content);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load assistants.yaml');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(val: string | undefined) {
    const v = val ?? '';
    setContent(v);
    try {
      yaml.load(v);
      setYamlError(null);
    } catch (e: any) {
      setYamlError(e.message);
    }
  }

  async function handleSave() {
    if (!isDirty || yamlError) return;
    setSaving(true);
    setApplyResult(null);
    try {
      const result = await configApi.updateYaml(content);
      setOriginal(content);
      setApplyResult(result);
      if (result.applied) {
        toast.success('Config saved and reloaded ✓');
      } else {
        toast.warning('Config saved — reload failed. Restart agent_core manually.');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // Config events from SSE
  const configEvents = events
    .filter((e) => e.type.startsWith('config.'))
    .slice(0, 10);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">Config Editor</h1>
          <span className="text-xs font-mono text-muted-foreground">assistants.yaml</span>
          {isDirty && (
            <span className="flex items-center gap-1 text-xs text-orange-500">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              Unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isDirty || !!yamlError}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground
                       text-sm font-medium transition hover:opacity-90
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Applying…' : 'Save & Apply'}
          </button>
        </div>
      </div>

      {/* YAML error banner */}
      {yamlError && (
        <div className="flex items-start gap-2 px-5 py-2.5 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span className="font-mono">{yamlError}</span>
        </div>
      )}

      {/* Apply result */}
      {applyResult && (
        <div
          className={cn(
            'flex items-center gap-2 px-5 py-2 text-xs border-b',
            applyResult.applied
              ? 'bg-green-500/10 border-green-500/20 text-green-700'
              : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700',
          )}
        >
          {applyResult.applied ? (
            <><Check className="w-3.5 h-3.5" /> Config reloaded in agent_core — no restart needed.</>
          ) : (
            <><AlertTriangle className="w-3.5 h-3.5" /> File saved. Reload failed — restart agent_core manually.</>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <Editor
              height="100%"
              defaultLanguage="yaml"
              value={content}
              onChange={handleChange}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                wordWrap: 'off',
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                theme: 'vs',
                renderLineHighlight: 'gutter',
              }}
            />
          )}
        </div>

        {/* Right panel: event log */}
        <div className="w-72 border-l border-border flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <TerminalSquare className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Config Events
              </h3>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {configEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No events yet. Edit and apply the config.
              </p>
            ) : (
              configEvents.map((evt) => (
                <div key={evt.id} className="text-xs">
                  <span
                    className={cn(
                      'font-mono',
                      evt.type.includes('fail') || evt.type.includes('error')
                        ? 'text-destructive'
                        : 'text-green-600',
                    )}
                  >
                    {evt.type.replace('config.', '')}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    {new Date(evt.ts).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
