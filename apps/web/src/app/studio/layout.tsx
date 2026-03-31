'use client';
// src/app/studio/layout.tsx

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api-client';
import { useStudioStore } from '@/lib/store';
import { useSse } from '@/hooks/use-sse';
import { StudioShell } from '@/components/layout/StudioShell';

function SseInit() {
  const assistant = useStudioStore((s) => s.selectedAssistant);
  useSse(assistant);
  return null;
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUser = useStudioStore((s) => s.currentUser);

  useEffect(() => {
    if (!getToken() || !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, router]);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <SseInit />
      <StudioShell>{children}</StudioShell>
    </>
  );
}
