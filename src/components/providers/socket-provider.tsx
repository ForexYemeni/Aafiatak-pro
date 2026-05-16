'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/stores/auth-store';

// ============================================================================
// Socket Provider (PERFORMANCE v2 — DEFERRED CONNECTION)
// ============================================================================
// PERFORMANCE FIXES:
// 1. Defers socket connection until 2 seconds after mount (non-blocking)
// 2. Only creates socket when authenticated AND hydrated
// 3. Skips connection if page is hidden (saves resources)
// 4. Uses lazy initialization pattern to avoid blocking first paint
// ============================================================================

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

export function useSocketContext(): SocketContextValue {
  return useContext(SocketContext);
}

const SOCKET_PORT = 3003;

// Track the currently active chat ID to avoid duplicate sounds
// when the user is already viewing the chat page
let _activeChatId: string | null = null;

/** Set the currently active chat ID (called from chat pages) */
export function setActiveChatId(chatId: string | null): void {
  _activeChatId = chatId;
}

/** Get the currently active chat ID */
export function getActiveChatId(): string | null {
  return _activeChatId;
}

// Module-level socket instance — persisted across re-renders
let _socketInstance: Socket | null = null;
let _socketToken: string | null = null;

export function SocketProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [isConnected, setIsConnected] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const mountedRef = useRef(false);

  // Defer socket creation until 2 seconds after mount
  // This prevents socket connection from blocking the initial page render
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    // If page is hidden, wait for it to become visible
    if (document.hidden) {
      const handler = () => {
        if (!document.hidden) {
          document.removeEventListener('visibilitychange', handler);
          setSocketReady(true);
        }
      };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    }

    // Defer socket connection to avoid blocking first paint
    const timer = setTimeout(() => setSocketReady(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Create/reuse socket instance
  const socket = useMemo<Socket | null>(() => {
    if (!socketReady || !hasHydrated || !isAuthenticated || !token) {
      return null;
    }

    // Reuse existing socket if token hasn't changed
    if (_socketInstance && _socketToken === token) {
      return _socketInstance;
    }

    // Disconnect old socket if token changed
    if (_socketInstance) {
      _socketInstance.disconnect();
      _socketInstance = null;
    }

    _socketToken = token;
    _socketInstance = io('/?XTransformPort=' + SOCKET_PORT, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    return _socketInstance;
  }, [socketReady, hasHydrated, isAuthenticated, token]);

  useEffect(() => {
    if (!socket) {
      setIsConnected(false);
      return;
    }

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}
