'use client';

import {
  createContext,
  useContext,
  useEffect,
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

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

const SOCKET_PORT = 3003;

export function SocketProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);

  // Create socket lazily via useMemo - it's derived from auth state
  const socket = useMemo<Socket | null>(() => {
    if (!isAuthenticated || !token) return null;

    const newSocket = io('/?XTransformPort=' + SOCKET_PORT, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    return newSocket;
  }, [isAuthenticated, token]);

  // Track connection state via ref (no setState in effect)
  const isConnected = socket !== null && socket.connected;

  // Sync socket event listeners
  useEffect(() => {
    if (!socket) return;

    return () => {
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
