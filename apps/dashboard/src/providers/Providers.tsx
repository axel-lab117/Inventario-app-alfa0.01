'use client';

import { QueryProvider } from '@/providers/QueryProvider';
import { ToastProvider } from '@repo/ui/components';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ToastProvider>{children}</ToastProvider>
    </QueryProvider>
  );
}