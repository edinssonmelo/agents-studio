'use client';
// src/components/layout/StudioShell.tsx
// Three-panel Notion-like layout:
//   [Sidebar: nav + assistant selector] [Tree: agent list] [Inspector: tabs]

import { useStudioStore } from '@/lib/store';
import { Sidebar } from './Sidebar';
import { AgentTree } from '@/components/studio/AgentTree';
import { Inspector } from '@/components/studio/Inspector';

export function StudioShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useStudioStore((s) => s.sidebarOpen);
  const selectedAgent = useStudioStore((s) => s.selectedAgent);

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Panel 1: Sidebar */}
      {sidebarOpen && (
        <aside className="w-56 flex-shrink-0 border-r border-border flex flex-col bg-sidebar">
          <Sidebar />
        </aside>
      )}

      {/* Panel 2: Agent tree */}
      <div className="w-64 flex-shrink-0 border-r border-border flex flex-col bg-sidebar/50">
        <AgentTree />
      </div>

      {/* Panel 3: Inspector + main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selectedAgent ? (
          <Inspector />
        ) : (
          <div className="flex-1 overflow-y-auto">{children}</div>
        )}
      </main>
    </div>
  );
}
