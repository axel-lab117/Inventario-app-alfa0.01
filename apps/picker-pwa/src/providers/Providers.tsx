'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useMemo, ReactNode } from 'react';
import { ToastProvider } from '@repo/ui/components';
import { useAuthStore } from '@/lib/auth-store';
import { api, setAuthToken, setTenantId } from '@/lib/api';

export function Providers({ children }: { children: ReactNode }) {
  const { token, tenantId, user } = useAuthStore();

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2,
            gcTime: 1000 * 60 * 10,
            retry: (count, error) => {
              if (error instanceof Error && 'status' in error) {
                const status = (error as any).status;
                if (status >= 400 && status < 500) return false;
              }
              return count < 2;
            },
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 1,
          },
        },
      }),
    []
  );

  useEffect(() => {
    if (token) {
      setAuthToken(token);
    } else {
      setAuthToken(null);
    }
  }, [token]);

  useEffect(() => {
    if (tenantId) {
      setTenantId(tenantId);
    } else if (user?.tenantId) {
      setTenantId(user.tenantId);
    } else {
      setTenantId(null);
    }
  }, [tenantId, user?.tenantId]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

import { useEffect } from 'react';