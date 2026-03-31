'use client';
// src/components/studio/Inspector.tsx

import { useStudioStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { OverviewTab } from './tabs/OverviewTab';
import { RuntimeTab } from './tabs/RuntimeTab';
import { MemoryTab } from './tabs/MemoryTab';
import { PromptTab } from './tabs/PromptTab';
import { ActionsTab } from './tabs/ActionsTab';
import { X } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'runtime',  label: 'Runtime' },
  { id: 'memory',   label: 'Memory' },
  { id: 'prompt',   label: 'Prompt' },
  { id: 'actions',  label: 'Actions' },
];

export function Inspector() {
  const { selectedAgent, setSelectedAgent, inspectorTab, setInspectorTab } = useStudioStore();

  if (!selectedAgent) return null;

  return (
    <div className="flex flex-col h-full animate-in">
      {/* Inspector header */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{selectedAgent}</span>
          <span className="text-xs text-muted-foreground">agent</span>
        </div>
        <button
          onClick={() => setSelectedAgent(null)}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 px-5 border-b border-border flex-shrink-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setInspectorTab(tab.id)}
            className={cn(
              'px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition',
              inspectorTab === tab.id
                ? 'border-foreground text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {inspectorTab === 'overview' && <OverviewTab />}
        {inspectorTab === 'runtime'  && <RuntimeTab />}
        {inspectorTab === 'memory'   && <MemoryTab />}
        {inspectorTab === 'prompt'   && <PromptTab />}
        {inspectorTab === 'actions'  && <ActionsTab />}
      </div>
    </div>
  );
}
