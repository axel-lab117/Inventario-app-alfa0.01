'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useMemo, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuthStore } from './auth-store';
import { api, setAuthToken, setTenantId } from './api';

const QueryClientContext = createContext<QueryClient | null>(null);

export function useQueryClient(): QueryClient {
  const client = useContext(QueryClientContext);
  if (!client) throw new Error('useQueryClient must be used within QueryProvider');
  return client;
}

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
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
            onError: (error) => {
              console.error('Mutation error:', error);
            },
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
    <QueryClientContext.Provider value={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </QueryClientContext.Provider>
  );
}