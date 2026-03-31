'use client';
// src/components/studio/tabs/MemoryTab.tsx

import { useState, useEffect } from 'react';
import { Loader2, Save, RotateCcw, Plus } from 'lucide-react';
import { useStudioStore } from '@/lib/store';
import { configApi, agentsApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type MemType = 'memory' | 'working';

export function MemoryTab() {
  const { selectedAgent, selectedAssistant } = useStudioStore();
  const [activeType, setActiveType] = useState<MemType>('memory');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appendText, setAppendText] = useState('');
  const [appending, setAppending] = useState(false);

  useEffect(() => {
    if (!selectedAgent) return;
    setLoading(true);
    configApi
      .getMemory(selectedAssistant, selectedAgent, activeType)
      .then((d) => setContent(d.content ?? ''))
      .catch((err) => toast.error(err?.message ?? 'Failed to load memory'))
      .finally(() => setLoading(false));
  }, [selectedAgent, selectedAssistant, activeType]);

  async function handleAppend() {
    if (!appendText.trim() || !selectedAgent) return;
    setAppending(true);
    try {
      await agentsApi.appendMemory(selectedAssistant, selectedAgent, appendText.trim());
      toast.success('Memory appended');
      setAppendText('');
      // Refresh view
      const d = await configApi.getMemory(selectedAssistant, selectedAgent, 'memory');
      setContent(d.content ?? '');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to append memory');
    } finally {
      setAppending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Type selector */}
      <div className="flex items-center gap-0 px-5 pt-4 pb-0 flex-shrink-0">
        {(['memory', 'working'] as MemType[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-t-md font-medium capitalize transition border',
              activeType === t
                ? 'bg-card border-border border-b-card text-foreground -mb-px z-10 relative'
                : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t}.md
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden border-t border-border">
        {loading ? (
          <div className="flex items-center justify-center flex-1 gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="flex-1 relative overflow-hidden">
            {content ? (
              <div className="h-full overflow-y-auto p-5">
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-foreground/90 break-words">
                  {content}
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center px-6">
                <div className="space-y-1.5">
                  <p className="text-sm text-muted-foreground">
                    {activeType === 'memory'
                      ? 'No persistent memory yet.'
                      : 'Working memory is empty (session cleared).'}
                  </p>
                  {activeType === 'memory' && (
                    <p className="text-xs text-muted-foreground/60">
                      Use the append form below to add notes.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Append form — only for memory.md */}
        {activeType === 'memory' && (
          <div className="border-t border-border p-4 flex-shrink-0 bg-muted/30 space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Append to memory.md
            </label>
            <div className="flex gap-2">
              <textarea
                value={appendText}
                onChange={(e) => setAppendText(e.target.value)}
                placeholder="## New note&#10;&#10;Write markdown here…"
                rows={3}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm
                           placeholder:text-muted-foreground/50 resize-none font-mono
                           focus:outline-none focus:ring-2 focus:ring-ring/40 transition"
              />
              <button
                onClick={handleAppend}
                disabled={appending || !appendText.trim()}
                className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg
                           bg-primary text-primary-foreground text-xs font-medium
                           disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
              >
                {appending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Append
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
