'use client';
// src/components/layout/Sidebar.tsx

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bot, Settings, Activity, FileCode2,
  LogOut, PanelLeftClose,
} from 'lucide-react';
import { useStudioStore } from '@/lib/store';
import { clearToken } from '@/lib/api-client';
import type { AssistantId } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const ASSISTANT_LABELS: Record<AssistantId, { label: string; color: string }> = {
  me:   { label: 'Me',   color: 'bg-blue-500' },
  wife: { label: 'Wife', color: 'bg-purple-500' },
};

const NAV_ITEMS = [
  { href: '/studio',         icon: Bot,         label: 'Agents'       },
  { href: '/studio/config',  icon: FileCode2,   label: 'Config Editor'},
  { href: '/studio/timeline',icon: Activity,    label: 'Timeline'     },
];

export function Sidebar() {
  const router    = useRouter();
  const pathname  = usePathname();
  const { currentUser, setCurrentUser, selectedAssistant, setSelectedAssistant, toggleSidebar } =
    useStudioStore();

  function logout() {
    clearToken();
    setCurrentUser(null);
    router.replace('/login');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-12 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Bot className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold truncate">Agents Studio</span>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-sidebar-item text-muted-foreground hover:text-foreground transition"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Assistant selector */}
      <div className="px-2 py-3 border-b border-sidebar-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
          Assistant
        </p>
        {(['me', 'wife'] as AssistantId[]).map((a) => {
          const info   = ASSISTANT_LABELS[a];
          const active = selectedAssistant === a;
          return (
            <button
              key={a}
              onClick={() => setSelectedAssistant(a)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition',
                active
                  ? 'bg-sidebar-item font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-item/60 hover:text-foreground',
              )}
            >
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', info.color)} />
              {info.label}
              {a === currentUser && (
                <span className="ml-auto text-[10px] text-muted-foreground">you</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          // "Agents" is active for /studio and /studio/* but NOT sub-routes
          const active =
            href === '/studio'
              ? pathname === '/studio' || (pathname.startsWith('/studio') &&
                  !pathname.startsWith('/studio/config') &&
                  !pathname.startsWith('/studio/timeline'))
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition',
                active
                  ? 'bg-sidebar-item text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-sidebar-item/60 hover:text-foreground',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-0.5">
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', ASSISTANT_LABELS[currentUser ?? 'me'].color)} />
          <span className="truncate text-xs">{ASSISTANT_LABELS[currentUser ?? 'me'].label}</span>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm
                     text-muted-foreground hover:text-foreground hover:bg-sidebar-item transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
