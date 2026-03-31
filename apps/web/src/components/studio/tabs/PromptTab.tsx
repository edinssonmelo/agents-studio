'use client';
// src/components/studio/tabs/PromptTab.tsx

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Save, GitCompare, Check } from 'lucide-react';
import { useStudioStore } from '@/lib/store';
import { configApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Monaco is heavy — load client-side only
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading editor…
    </div>
  ),
});

export function PromptTab() {
  const { selectedAgent } = useStudioStore();
  const [original, setOriginal] = useState('');
  const [content, setContent]   = useState('');
  const [filename, setFilename] = useState('');
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [saved, setSaved]       = useState(false);

  const isDirty = content !== original;

  useEffect(() => {
    if (!selectedAgent) return;
    setLoading(true);
    setSaved(false);
    setShowDiff(false);

    configApi
      .getPrompt(selectedAgent)
      .then((d) => {
        setOriginal(d.content);
        setContent(d.content);
        setFilename(d.filename);
      })
      .catch((err) => {
        // If 404, start with empty
        if (err?.statusCode === 404) {
          setOriginal('');
          setContent('');
          setFilename(`${selectedAgent}.txt`);
        } else {
          toast.error(err?.message ?? 'Failed to load prompt');
        }
      })
      .finally(() => setLoading(false));
  }, [selectedAgent]);

  async function handleSave() {
    if (!selectedAgent || !isDirty) return;
    setSaving(true);
    try {
      await configApi.updatePrompt(selectedAgent, content);
      setOriginal(content);
      setSaved(true);
      toast.success(`${filename} saved`);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      toast.error(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading prompt…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{filename}</span>
          {isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" title="Unsaved changes" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiff((d) => !d)}
            disabled={!isDirty}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition',
              showDiff
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              !isDirty && 'opacity-30 cursor-not-allowed',
            )}
          >
            <GitCompare className="w-3.5 h-3.5" />
            Diff
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                       bg-primary text-primary-foreground transition hover:opacity-90
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Diff view */}
      {showDiff && isDirty && (
        <DiffView original={original} modified={content} />
      )}

      {/* Editor */}
      {!showDiff && (
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="plaintext"
            value={content}
            onChange={(val) => setContent(val ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              theme: 'vs',
              renderLineHighlight: 'none',
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
            }}
          />
        </div>
      )}
    </div>
  );
}

// Simple line-diff renderer (no external diff lib needed for basic view)
function DiffView({ original, modified }: { original: string; modified: string }) {
  const origLines = original.split('\n');
  const modLines  = modified.split('\n');
  const maxLen    = Math.max(origLines.length, modLines.length);

  const rows: { type: 'added' | 'removed' | 'unchanged'; line: string; lineNo: number }[] = [];

  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i];
    const m = modLines[i];
    if (o === m) {
      rows.push({ type: 'unchanged', line: m ?? '', lineNo: i + 1 });
    } else {
      if (o !== undefined) rows.push({ type: 'removed', line: o, lineNo: i + 1 });
      if (m !== undefined) rows.push({ type: 'added',   line: m, lineNo: i + 1 });
    }
  }

  const changed = rows.filter((r) => r.type !== 'unchanged');

  return (
    <div className="border-b border-border bg-muted/20 overflow-y-auto max-h-64 flex-shrink-0">
      <div className="p-3 space-y-0.5 font-mono text-xs">
        {changed.length === 0 ? (
          <p className="text-muted-foreground px-2">No changes</p>
        ) : (
          changed.map((r, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-3 px-2 py-0.5 rounded',
                r.type === 'added'   && 'bg-green-500/10 text-green-700',
                r.type === 'removed' && 'bg-red-500/10 text-red-600 line-through opacity-70',
              )}
            >
              <span className="text-muted-foreground/40 w-6 text-right flex-shrink-0">{r.lineNo}</span>
              <span className="break-all">{r.type === 'added' ? '+ ' : '- '}{r.line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
