'use client';
// src/app/studio/page.tsx

import { useStudioStore } from '@/lib/store';
import { Bot, ArrowLeft } from 'lucide-react';

export default function StudioPage() {
  const selectedAgent = useStudioStore((s) => s.selectedAgent);

  if (selectedAgent) {
    // Inspector is rendered in the shell sidebar; this area shows a welcome prompt
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-in">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground flex items-center gap-2 justify-center">
            <ArrowLeft className="w-4 h-4" />
            Select a tab in the inspector to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-in">
      <div className="max-w-xs space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <Bot className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-medium">No agent selected</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Choose an agent from the sidebar to inspect its configuration, memory, and run tests.
          </p>
        </div>
      </div>
    </div>
  );
}
