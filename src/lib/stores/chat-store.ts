// ============================================================================
// عافيتك Chat Store - Zustand Store for Chat Management
// ============================================================================

import { create } from 'zustand';
import type { Chat, Message } from '@/types';

// ---- Types ----

interface ChatState {
  // Chat list
  chats: Chat[];

  // Active chat
  activeChatId: string | null;

  // Messages per chat
  messages: Record<string, Message[]>;

  // Typing users per chat
  typingUsers: Record<string, string[]>;

  // Unread counts per chat
  unreadCounts: Record<string, number>;

  // Loading states
  isLoadingChats: boolean;
  isLoadingMessages: boolean;

  // Error state
  error: string | null;

  // Actions
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  removeChat: (chatId: string) => void;
  setActiveChat: (chatId: string | null) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  removeMessage: (chatId: string, messageId: string) => void;
  setTyping: (chatId: string, userId: string, isTyping: boolean) => void;
  clearTyping: (chatId: string) => void;
  incrementUnread: (chatId: string) => void;
  resetUnread: (chatId: string) => void;
  markMessagesAsRead: (chatId: string, userId: string) => void;
  setLoadingChats: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// ---- Initial State ----

const initialState = {
  chats: [],
  activeChatId: null as string | null,
  messages: {} as Record<string, Message[]>,
  typingUsers: {} as Record<string, string[]>,
  unreadCounts: {} as Record<string, number>,
  isLoadingChats: false,
  isLoadingMessages: false,
  error: null as string | null,
};

// ---- Chat Store ----

export const useChatStore = create<ChatState>()(
  (set, get) => ({
    ...initialState,

    // ---- Chat List Actions ----

    setChats: (chats: Chat[]) => {
      set({ chats });
    },

    addChat: (chat: Chat) => {
      set((state) => ({
        chats: [chat, ...state.chats],
      }));
    },

    removeChat: (chatId: string) => {
      set((state) => {
        const newMessages = { ...state.messages };
        delete newMessages[chatId];

        const newTyping = { ...state.typingUsers };
        delete newTyping[chatId];

        const newUnread = { ...state.unreadCounts };
        delete newUnread[chatId];

        return {
          chats: state.chats.filter((c) => c.id !== chatId),
          messages: newMessages,
          typingUsers: newTyping,
          unreadCounts: newUnread,
          activeChatId: state.activeChatId === chatId ? null : state.activeChatId,
        };
      });
    },

    // ---- Active Chat Actions ----

    setActiveChat: (chatId: string | null) => {
      set({ activeChatId: chatId });
    },

    // ---- Message Actions ----

    setMessages: (chatId: string, messages: Message[]) => {
      set((state) => ({
        messages: { ...state.messages, [chatId]: messages },
      }));
    },

    addMessage: (chatId: string, message: Message) => {
      set((state) => {
        const existingMessages = state.messages[chatId] ?? [];
        // Avoid duplicate messages
        const exists = existingMessages.some((m) => m.id === message.id);
        if (exists) return state;

        return {
          messages: {
            ...state.messages,
            [chatId]: [...existingMessages, message],
          },
          // Update chat's last message
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? { ...chat, lastMessage: message, updatedAt: new Date() }
              : chat
          ),
        };
      });
    },

    updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => {
      set((state) => {
        const chatMessages = state.messages[chatId];
        if (!chatMessages) return state;

        return {
          messages: {
            ...state.messages,
            [chatId]: chatMessages.map((m) =>
              m.id === messageId ? { ...m, ...updates } : m
            ),
          },
        };
      });
    },

    removeMessage: (chatId: string, messageId: string) => {
      set((state) => {
        const chatMessages = state.messages[chatId];
        if (!chatMessages) return state;

        return {
          messages: {
            ...state.messages,
            [chatId]: chatMessages.filter((m) => m.id !== messageId),
          },
        };
      });
    },

    // ---- Typing Actions ----

    setTyping: (chatId: string, userId: string, isTyping: boolean) => {
      set((state) => {
        const currentTyping = state.typingUsers[chatId] ?? [];

        if (isTyping) {
          if (currentTyping.includes(userId)) return state;
          return {
            typingUsers: {
              ...state.typingUsers,
              [chatId]: [...currentTyping, userId],
            },
          };
        }

        return {
          typingUsers: {
            ...state.typingUsers,
            [chatId]: currentTyping.filter((id) => id !== userId),
          },
        };
      });
    },

    clearTyping: (chatId: string) => {
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [chatId]: [],
        },
      }));
    },

    // ---- Unread Actions ----

    incrementUnread: (chatId: string) => {
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [chatId]: (state.unreadCounts[chatId] ?? 0) + 1,
        },
      }));
    },

    resetUnread: (chatId: string) => {
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [chatId]: 0,
        },
      }));
    },

    // ---- Read Receipts ----

    markMessagesAsRead: (chatId: string, userId: string) => {
      set((state) => {
        const chatMessages = state.messages[chatId];
        if (!chatMessages) return state;

        return {
          messages: {
            ...state.messages,
            [chatId]: chatMessages.map((m) => {
              if (m.readBy.includes(userId)) return m;
              return { ...m, readBy: [...m.readBy, userId] };
            }),
          },
          unreadCounts: {
            ...state.unreadCounts,
            [chatId]: 0,
          },
        };
      });
    },

    // ---- Loading Actions ----

    setLoadingChats: (loading: boolean) => {
      set({ isLoadingChats: loading });
    },

    setLoadingMessages: (loading: boolean) => {
      set({ isLoadingMessages: loading });
    },

    // ---- Error Actions ----

    setError: (error: string | null) => {
      set({ error });
    },

    clearError: () => {
      set({ error: null });
    },

    // ---- Reset ----

    reset: () => {
      set(initialState);
    },

    // ---- Derived Getters ----

    getActiveChatMessages: () => {
      const state = get();
      if (!state.activeChatId) return [];
      return state.messages[state.activeChatId] ?? [];
    },

    getActiveChatTypingUsers: () => {
      const state = get();
      if (!state.activeChatId) return [];
      return state.typingUsers[state.activeChatId] ?? [];
    },

    getTotalUnreadCount: () => {
      const state = get();
      return Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0);
    },
  })
);
