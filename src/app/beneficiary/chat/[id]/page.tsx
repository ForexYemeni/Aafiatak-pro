'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Send, Image as ImageIcon, Phone, Loader2,
  CheckCheck, Check, Clock, MessageCircle, RefreshCw, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useAuthFetch } from '@/hooks/use-auth';
import { useSocket } from '@/hooks/use-socket';
import { setActiveChatId } from '@/components/providers/socket-provider';
import { toast } from 'sonner';

interface ChatInfo {
  id: string;
  participantName: string;
  participantRole: string;
  participantPhone: string | null;
  participantAvatar: string | null;
}

interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderRole: string;
  content: string;
  type: string;
  imageUrl?: string;
  readBy: string[];
  createdAt: string;
  isPending?: boolean;
  isFailed?: boolean;
}

const quickReplies = [
  'مرحباً، أنا في انتظارك',
  'كم دقيقة للوصول؟',
  'شكراً لك',
  'هل تحتاج إلى معلومات إضافية؟',
];

export default function ChatDetailPage() {
  const router = useRouter();
  const params = useParams();
  const chatParam = params.id as string;
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);

  const [chatId, setChatId] = useState<string | null>(null);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isConnected, service } = useSocket();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (chatId) {
      setActiveChatId(chatId);
      return () => setActiveChatId(null);
    }
  }, [chatId]);

  // Resolve chat ID from param
  useEffect(() => {
    const resolveChat = async () => {
      setIsLoading(true);
      try {
        const chatListRes = await authFetch('/api/chat');
        const chatListData = await chatListRes.json();

        if (chatListData.success && chatListData.data) {
          const existingChat = chatListData.data.find((c: ChatInfo) => c.id === chatParam);
          if (existingChat) {
            setChatId(chatParam);
            setChatInfo(existingChat);
            return;
          }

          const createRes = await authFetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ participantId: chatParam, participantRole: 'nurse' }),
          });
          const createData = await createRes.json();
          if (createData.success && createData.data) {
            setChatId(createData.data.id);
            setChatInfo(createData.data);
          }
        }
      } catch (err) {
        console.error('Error resolving chat:', err);
      } finally {
        setIsLoading(false);
      }
    };
    resolveChat();
  }, [chatParam, authFetch]);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const res = await authFetch(`/api/chat/${chatId}/messages?limit=50`);
      const data = await res.json();
      if (data.success && data.data) {
        const msgs: ChatMessage[] = data.data.messages || data.data;
        if (Array.isArray(msgs)) {
          setMessages((prev) => {
            const serverIds = new Set(msgs.map((m) => m.id));
            const stillPending = prev.filter((m) => (m.isPending || m.isFailed) && !serverIds.has(m.id));
            return [...msgs, ...stillPending];
          });
        }
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, chatId]);

  useEffect(() => {
    if (chatId) fetchMessages();
  }, [chatId, fetchMessages]);

  // Mark notifications read
  useEffect(() => {
    if (!chatId) return;
    authFetch('/api/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({ type: 'chat', chatId }),
    }).catch(() => {});
  }, [chatId, authFetch]);

  // Polling — smart merge preserving optimistic messages
  useEffect(() => {
    if (!chatId) return;
    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/chat/${chatId}/messages?limit=50`);
        const data = await res.json();
        if (data.success && data.data) {
          const msgs: ChatMessage[] = data.data.messages || data.data;
          if (Array.isArray(msgs)) {
            setMessages((prev) => {
              const serverIds = new Set(msgs.map((m) => m.id));
              const stillPending = prev.filter((m) => (m.isPending || m.isFailed) && !serverIds.has(m.id));
              return [...msgs, ...stillPending];
            });
          }
        }
      } catch {
        // silently handle
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [chatId, authFetch]);

  // Socket listeners for real-time messages
  useEffect(() => {
    if (!service || !chatId) return;
    service.joinChat(chatId);

    const unsubMessage = service.onMessage((event: any) => {
      if (event.chatId === chatId) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === event.message?.id);
          if (exists) return prev;
          return [...prev, event.message];
        });
      }
    });

    const unsubTyping = service.onTyping((event: any) => {
      if (event.chatId === chatId && event.userId !== user?.id) {
        setIsTyping(event.isTyping);
        if (event.isTyping) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
        }
      }
    });

    return () => {
      service.leaveChat(chatId);
      unsubMessage();
      unsubTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [service, chatId, user?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const doSend = async (content: string) => {
    if (!content.trim() || !chatId) return;
    setSendError(null);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const optimistic: ChatMessage = {
      id: tempId,
      chatId,
      senderId: user?.id || (user as any)?._id || '',
      senderRole: user?.role || 'beneficiary',
      content: content.trim(),
      type: 'text',
      readBy: [user?.id || (user as any)?._id || ''],
      createdAt: new Date().toISOString(),
      isPending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await authFetch(`/api/chat/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: content.trim(), type: 'text' }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          { ...data.data } as ChatMessage,
        ]);
      } else {
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, isPending: false, isFailed: true } : m));
        setSendError('فشل إرسال الرسالة');
      }
    } catch {
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, isPending: false, isFailed: true } : m));
      setSendError('تعذّر الاتصال — اضغط لإعادة المحاولة');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    await doSend(content);
    setIsSending(false);
  };

  const handleRetry = async (failedMsg: ChatMessage) => {
    setMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));
    await doSend(failedMsg.content);
  };

  const handleTyping = () => {
    if (service && chatId) {
      service.startTyping(chatId);
      setTimeout(() => service.stopTyping(chatId), 2000);
    }
  };

  const formatMessageTime = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });
  };

  const isMyMessage = (msg: ChatMessage) =>
    msg.senderId === user?.id || msg.senderId === (user as any)?._id;

  if (!chatId && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <MessageCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">لم يتم العثور على المحادثة</p>
        <Button onClick={() => router.back()}>العودة</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -m-4 md:-m-6">
      {/* Chat Header */}
      <div className="glass-strong border-b border-border p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-beneficiary/10 text-beneficiary">
            {chatInfo?.participantName?.slice(0, 2) ?? 'ـ'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{chatInfo?.participantName ?? 'الممرض/ـة'}</h3>
          <p className="text-xs text-muted-foreground">
            {isTyping ? 'يكتب...' : isConnected ? 'متصل' : 'غير متصل'}
          </p>
        </div>
        {chatInfo?.participantPhone && (
          <Button variant="ghost" size="icon" onClick={() => window.open(`tel:${chatInfo.participantPhone}`)}>
            <Phone className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-beneficiary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">ابدأ المحادثة</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = isMyMessage(msg);
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: msg.isPending ? 0.75 : 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex flex-col gap-1 ${isMine ? 'items-start' : 'items-end'}`}
              >
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.isFailed
                    ? 'bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-bl-md'
                    : isMine
                      ? 'bg-beneficiary text-beneficiary-foreground rounded-bl-md'
                      : 'glass rounded-br-md'
                }`}>
                  {msg.type === 'image' && msg.imageUrl && (
                    <div className="mb-2">
                      <img src={msg.imageUrl} alt="صورة" className="rounded-xl max-w-full max-h-48 object-cover" />
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isMine ? 'text-beneficiary-foreground/60' : 'text-muted-foreground'}`}>
                    <span className="text-[10px]">
                      {msg.isPending ? 'جاري الإرسال...' : formatMessageTime(msg.createdAt)}
                    </span>
                    {isMine && !msg.isPending && !msg.isFailed && (
                      msg.readBy && msg.readBy.length > 1
                        ? <CheckCheck className="w-3 h-3" />
                        : <Check className="w-3 h-3" />
                    )}
                    {msg.isPending && <Clock className="w-3 h-3" />}
                    {msg.isFailed && <AlertCircle className="w-3 h-3 text-red-500" />}
                  </div>
                </div>
                {msg.isFailed && isMine && (
                  <button
                    onClick={() => handleRetry(msg)}
                    className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-700 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> إعادة المحاولة
                  </button>
                )}
              </motion.div>
            );
          })
        )}

        {isTyping && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
            <div className="glass rounded-2xl rounded-br-md px-4 py-3">
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <div key={delay} className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send Error Banner */}
      <AnimatePresence>
        {sendError && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-4 mb-1 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {sendError}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Replies */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => setNewMessage(reply)}
                className="px-3 py-1.5 rounded-full glass text-xs font-medium whitespace-nowrap hover:bg-beneficiary/10 transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="glass-strong border-t border-border p-3 flex items-end gap-2 safe-bottom">
        <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10" onClick={() => toast.info('قريباً - إرسال الصور')}>
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
        </Button>
        <div className="flex-1">
          <Input
            placeholder="اكتب رسالة..."
            value={newMessage}
            onChange={(e) => { setNewMessage(e.target.value); handleTyping(); setSendError(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            className="h-10 rounded-2xl"
            dir="rtl"
          />
        </div>
        <Button
          onClick={sendMessage}
          disabled={!newMessage.trim() || isSending}
          size="icon"
          className="shrink-0 h-10 w-10 rounded-full bg-beneficiary hover:bg-beneficiary/90"
        >
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
