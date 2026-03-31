'use client';
// src/app/login/page.tsx

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api-client';
import { useStudioStore } from '@/lib/store';
import { toast } from 'sonner';
import { Bot, Eye, EyeOff } from 'lucide-react';
import type { AssistantId } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const setCurrentUser = useStudioStore((s) => s.setCurrentUser);
  const setSelectedAssistant = useStudioStore((s) => s.setSelectedAssistant);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await authApi.login(username.trim(), password);
      setCurrentUser(user as AssistantId);
      setSelectedAssistant(user as AssistantId);
      router.replace('/studio');
    } catch (err: any) {
      toast.error(err?.message ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-in">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">Agents Studio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Sign in to your workspace</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="me or wife"
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm
                         placeholder:text-muted-foreground/60
                         focus:outline-none focus:ring-2 focus:ring-ring/50 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-card text-foreground text-sm
                           focus:outline-none focus:ring-2 focus:ring-ring/50 transition"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full mt-2 py-2 px-4 rounded-lg bg-primary text-primary-foreground
                       text-sm font-medium transition hover:opacity-90 active:opacity-80
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Access restricted to workspace members
        </p>
      </div>
    </div>
  );
}
