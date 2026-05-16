'use client';

  import { useRef, type ReactNode } from 'react';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { ThemeProvider } from './theme-provider';
  import { SocketProvider } from './socket-provider';
  import { RealtimeSyncProvider } from './realtime-sync-provider';
  import { RoutePrefetcher } from './route-prefetcher';
  import { StoreHydrationManager } from './store-hydration-manager';

  function makeQueryClient() {
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 10 * 60 * 1000,
          gcTime: 30 * 60 * 1000,
          retry: (failureCount, error: any) => {
            if (error?.status >= 400 && error?.status < 500) return false;
            return failureCount < 1;
          },
          retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2000),
          refetchOnWindowFocus: false,
          refetchOnReconnect: true,
          networkMode: 'offlineFirst',
        },
        mutations: {
          throwOnError: false,
          networkMode: 'offlineFirst',
        },
      },
    });
  }

  export function AppProvider({ children }: { children: ReactNode }) {
    const queryClientRef = useRef<QueryClient | null>(null);
    if (!queryClientRef.current) {
      queryClientRef.current = makeQueryClient();
    }

    return (
      <QueryClientProvider client={queryClientRef.current}>
        <ThemeProvider>
          <SocketProvider>
            <RealtimeSyncProvider>
              <RoutePrefetcher />
              <StoreHydrationManager />
              {children}
            </RealtimeSyncProvider>
          </SocketProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }
