'use client';

  import { useRef, type ReactNode } from 'react';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { ThemeProvider } from './theme-provider';
  import { SocketProvider } from './socket-provider';

  function makeQueryClient() {
    return new QueryClient({
      defaultOptions: {
        queries: {
          // Data stays fresh for 10 minutes before a background refetch (was 5min)
          staleTime: 10 * 60 * 1000,
          // Keep unused data in cache for 30 minutes (was 10min)
          // PWA: reduces redundant fetches after tab switch
          gcTime: 30 * 60 * 1000,
          // Never retry on 4xx errors (auth/not-found); retry once on network/5xx (was 2)
          retry: (failureCount, error: any) => {
            if (error?.status >= 400 && error?.status < 500) return false;
            return failureCount < 1;
          },
          // Faster retry: 500ms initial delay instead of 1s
          retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2000),
          // Don't refetch when the tab regains focus (reduces noise)
          refetchOnWindowFocus: false,
          // Refetch when network reconnects — important for PWA offline → online
          refetchOnReconnect: true,
          // Use cached data when offline instead of failing immediately
          networkMode: 'offlineFirst',
        },
        mutations: {
          // Surface mutation errors to the nearest error boundary
          throwOnError: false,
          networkMode: 'offlineFirst',
        },
      },
    });
  }

  export function AppProvider({ children }: { children: ReactNode }) {
    // Use ref so the QueryClient is created once per component instance,
    // not shared across server-render requests.
    const queryClientRef = useRef<QueryClient | null>(null);
    if (!queryClientRef.current) {
      queryClientRef.current = makeQueryClient();
    }

    return (
      <QueryClientProvider client={queryClientRef.current}>
        <ThemeProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }
  