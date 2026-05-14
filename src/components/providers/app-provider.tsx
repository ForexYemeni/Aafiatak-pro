'use client';

  import { useRef, type ReactNode } from 'react';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { ThemeProvider } from './theme-provider';
  import { SocketProvider } from './socket-provider';

  function makeQueryClient() {
    return new QueryClient({
      defaultOptions: {
        queries: {
          // Data stays fresh for 5 minutes before a background refetch
          staleTime: 5 * 60 * 1000,
          // Keep unused data in cache for 10 minutes (PWA: reduces redundant fetches after tab switch)
          gcTime: 10 * 60 * 1000,
          // Never retry on 4xx errors (auth/not-found); retry twice on network/5xx
          retry: (failureCount, error: any) => {
            if (error?.status >= 400 && error?.status < 500) return false;
            return failureCount < 2;
          },
          // Retry with exponential backoff (1s, 2s) to avoid hammering a slow API
          retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
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
  