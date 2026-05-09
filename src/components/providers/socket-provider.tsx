'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/stores/auth-store';

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

export function SocketProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [isConnected, setIsConnected] = useState(false);

  const socket = useMemo<Socket | null>(() => {
    // Don't create socket until hydration is complete
    if (!hasHydrated || !isAuthenticated || !token) return null;

    const newSocket = io('/?XTransformPort=' + SOCKET_PORT, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    return newSocket;
  }, [hasHydrated, isAuthenticated, token]);

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
      socket.disconnect();
    };
  }, [socket]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}
