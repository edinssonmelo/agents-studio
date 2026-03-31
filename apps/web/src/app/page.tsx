// src/app/page.tsx
import { redirect } from 'next/navigation';

// Root always redirects; auth check happens client-side in the studio layout
export default function RootPage() {
  redirect('/studio');
}
