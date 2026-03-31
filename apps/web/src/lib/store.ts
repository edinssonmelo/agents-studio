// src/lib/store.ts
// Zustand store — selected assistant, agent, runtime events, etc.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AssistantId, Agent, AuditLog, RunResult } from './api-client';

export interface RuntimeEvent {
  id: string;
  type:
    | 'agent.run.start'
    | 'agent.run.complete'
    | 'agent.run.error'
    | 'agent.reset'
    | 'agent.memory.append'
    | 'config.reloaded'
    | 'config.reload_failed'
    | 'config.applied'
    | 'config.prompt_updated';
  ts: string;
  payload: Record<string, unknown>;
}

interface StudioState {
  // Auth
  currentUser: AssistantId | null;
  setCurrentUser: (user: AssistantId | null) => void;

  // Navigation
  selectedAssistant: AssistantId;
  setSelectedAssistant: (a: AssistantId) => void;
  selectedAgent: string | null;
  setSelectedAgent: (name: string | null) => void;
  inspectorTab: string;
  setInspectorTab: (tab: string) => void;

  // Agents data
  agents: Record<string, Agent>;
  setAgents: (agents: Record<string, Agent>) => void;

  // Runtime events timeline
  events: RuntimeEvent[];
  pushEvent: (event: Omit<RuntimeEvent, 'id'>) => void;
  clearEvents: () => void;

  // Last run result
  lastRunResult: RunResult | null;
  setLastRunResult: (r: RunResult | null) => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),

      selectedAssistant: 'me',
      setSelectedAssistant: (a) => set({ selectedAssistant: a, selectedAgent: null }),
      selectedAgent: null,
      setSelectedAgent: (name) => set({ selectedAgent: name }),
      inspectorTab: 'overview',
      setInspectorTab: (tab) => set({ inspectorTab: tab }),

      agents: {},
      setAgents: (agents) => set({ agents }),

      events: [],
      pushEvent: (event) =>
        set((s) => ({
          events: [
            { ...event, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
            ...s.events.slice(0, 199), // keep last 200
          ],
        })),
      clearEvents: () => set({ events: [] }),

      lastRunResult: null,
      setLastRunResult: (r) => set({ lastRunResult: r }),

      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: 'agents-studio',
      partialize: (s) => ({
        selectedAssistant: s.selectedAssistant,
        selectedAgent: s.selectedAgent,
        sidebarOpen: s.sidebarOpen,
        currentUser: s.currentUser,
      }),
    },
  ),
);
