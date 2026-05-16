'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { socketService as socketServiceV2, type ConnectionState } from '@/lib/socket-v2';
import { useAuthStore } from '@/lib/stores/auth-store';

// ============================================================================
// Socket Provider (UNIFIED — uses socket-v2 singleton)
// ============================================================================
// UNIFICATION FIX:
// Previously, this provider created its OWN socket connection (3rd duplicate!).
// Now it delegates to the socket-v2 singleton which is also used by
// the PWA provider's SocketConnector. This eliminates the triple-connection
// bug and ensures all event listeners share one connection.
// ============================================================================

interface SocketContextValue {
  /** Whether the unified socket is connected */
  isConnected: boolean;
  /** Current connection state */
  connectionState: ConnectionState;
}

const SocketContext = createContext<SocketContextValue>({
  isConnected: false,
  connectionState: 'disconnected',
});

export function useSocketContext(): SocketContextValue {
  return useContext(SocketContext);
}

// Track the currently active chat ID to avoid duplicate sounds
let _activeChatId: string | null = null;

/** Set the currently active chat ID (called from chat pages) */
export function setActiveChatId(chatId: string | null): void {
  _activeChatId = chatId;
}

/** Get the currently active chat ID */
export function getActiveChatId(): string | null {
  return _activeChatId;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [isConnected, setIsConnected] = useState(socketServiceV2.isConnected);
  const [connectionState, setConnectionState] = useState<ConnectionState>(socketServiceV2.connectionState);

  // Subscribe to connection state changes from the unified socket-v2
  useEffect(() => {
    const unsubState = socketServiceV2.onConnectionStateChange((state) => {
      setConnectionState(state);
      setIsConnected(state === 'connected');
    });

    // Set initial state
    setIsConnected(socketServiceV2.isConnected);
    setConnectionState(socketServiceV2.connectionState);

    return unsubState;
  }, []);

  // Note: Socket connection is managed by SocketConnector in pwa-provider.tsx
  // which calls socketServiceV2.connect(token). We just read the state here.

  const value = useMemo(() => ({ isConnected, connectionState }), [isConnected, connectionState]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}
