'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { soundManager } from '@/lib/notifications/sound-manager';
import { markSoundPlayed } from '@/lib/notifications/sound-dedup';

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

  // ============================================================================
  // GLOBAL CHAT MESSAGE SOUND LISTENER
  // Plays chat sound for incoming messages from OTHER users
  // when the user is NOT actively viewing that specific chat.
  // If the user IS on the chat page, the useChat hook handles the sound.
  // ============================================================================
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: {
      message: { id: string; senderId: string };
      chatId: string;
    }) => {
      try {
        const currentUserId = useAuthStore.getState().user?.id;
        // Only play sound for messages from OTHER users (not our own)
        if (data.message.senderId === currentUserId) return;

        // If user is currently viewing THIS chat, don't play sound here
        // (the useChat hook on the chat page will handle it)
        if (_activeChatId === data.chatId) return;

        // Use dedup to prevent duplicate sounds
        const soundId = `chat-global-${data.message.id}`;
        if (markSoundPlayed(soundId)) return; // Already played

        // Play the chat notification sound
        soundManager.forceUserInteracted();
        soundManager.playChat();
      } catch {
        // Silently fail
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}
