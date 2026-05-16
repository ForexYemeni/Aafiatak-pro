'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, ImageIcon, ArrowRight, CheckCheck, Check, Clock,
  Loader2, Phone, MessageCircle, RefreshCw, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/common/empty-state';
import { useAuthFetch, invalidateAuthFetchCache } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatTimeOnly } from '@/components/common/date-formatter';
import { setActiveChatId } from '@/components/providers/socket-provider';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderRole: string;
  content: string;
  type: string;
  imageUrl: string | null;
  readBy: string[];
  createdAt: string;
  isPending?: boolean;
  isFailed?: boolean;
}

interface ChatInfo {
  id: string;
  participantName: string;
  participantPhone: string | null;
  participantRole?: string;
}

const quickReplies = [
  { id: 'qr-1', labelAr: 'في الطريق', value: 'أنا في الطريق إليكم' },
  { id: 'qr-2', labelAr: 'وصلت', value: 'لقد وصلت إلى الموقع' },
  { id: 'qr-3', labelAr: 'سأتأخر', value: 'سأتأخر قليلاً' },
  { id: 'qr-4', labelAr: 'شكراً', value: 'شكراً لك' },
];

export default function NurseChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [chatId, setChatId] = useState<string>('');
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    params.then((p) => setChatId(p.id));
  }, [params]);

  useEffect(() => {
    if (chatId) {
      setActiveChatId(chatId);
      return () => setActiveChatId(null);
    }
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    authFetch('/api/chat')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          const found = data.data.find((c: any) => c.id === chatId);
          if (found) setChatInfo({ id: found.id, participantName: found.participantName || 'مستفيد', participantPhone: found.participantPhone || null, participantRole: found.participantRole || 'unknown' });
        }
      })
      .catch(() => {});
  }, [chatId, authFetch]);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      invalidateAuthFetchCache(`/api/chat/${chatId}/messages`);
      const res = await authFetch(`/api/chat/${chatId}/messages?limit=100`);
      const data = await res.json();
      if (data.success && data.data) {
        const msgs: ChatMessage[] = data.data.messages || data.data;
        if (Array.isArray(msgs)) {
          setMessages((prev) => {
            const serverIds = new Set(msgs.map((m) => m.id));
            const stillPending = prev.filter((m) => (m.isPending || m.isFailed) && !serverIds.has(m.id));
            const confirmedNotInServer = prev.filter((m) => !m.isPending && !m.isFailed && !serverIds.has(m.id));
            return [...msgs, ...confirmedNotInServer, ...stillPending];
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

  // Read notification marking
  useEffect(() => {
    if (!chatId) return;
    authFetch('/api/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({ type: 'chat', chatId }),
    }).catch(() => {});
  }, [chatId, authFetch]);

  // Polling — smart merge preserving optimistic + recently confirmed messages
  useEffect(() => {
    if (!chatId) return;
    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/chat/${chatId}/messages?limit=100`);
        const data = await res.json();
        if (data.success && data.data) {
          const msgs: ChatMessage[] = data.data.messages || data.data;
          if (Array.isArray(msgs)) {
            setMessages((prev) => {
              const serverIds = new Set(msgs.map((m) => m.id));
              const stillPending = prev.filter((m) => (m.isPending || m.isFailed) && !serverIds.has(m.id));
              // Also keep confirmed messages not yet in server response (cache timing)
              const confirmedNotInServer = prev.filter((m) => !m.isPending && !m.isFailed && !serverIds.has(m.id));
              return [...msgs, ...confirmedNotInServer, ...stillPending];
            });
          }
        }
      } catch {
        // silently handle
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [chatId, authFetch]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const doSend = async (content: string) => {
    if (!content.trim() || !chatId) return;
    setSendError(null);

    // Optimistic: add immediately with a temp ID
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const optimistic: ChatMessage = {
      id: tempId,
      chatId,
      senderId: user?.id || (user as any)?._id || '',
      senderRole: user?.role || 'nurse',
      content: content.trim(),
      type: 'text',
      imageUrl: null,
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
        // Invalidate cache so next poll gets fresh data including this message
        invalidateAuthFetchCache(`/api/chat/${chatId}/messages`);
        invalidateAuthFetchCache('/api/chat');
        // Replace optimistic message with real one from server
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          { ...data.data } as ChatMessage,
        ]);
      } else {
        // Mark as failed
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, isPending: false, isFailed: true } : m));
        setSendError('فشل إرسال الرسالة — اضغط لإعادة المحاولة');
      }
    } catch {
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, isPending: false, isFailed: true } : m));
      setSendError('تعذّر الاتصال — اضغط لإعادة المحاولة');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    await doSend(content);
    setIsSending(false);
  };

  const handleRetry = async (failedMsg: ChatMessage) => {
    // Remove the failed message and resend
    setMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));
    await doSend(failedMsg.content);
  };

  const handleQuickReply = async (value: string) => {
    if (isSending) return;
    setIsSending(true);
    await doSend(value);
    setIsSending(false);
  };

  const isMyMessage = (msg: ChatMessage): boolean =>
    msg.senderId === user?.id || msg.senderId === (user as any)?._id;

  if (!chatId && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <MessageCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">لم يتم العثور على المحادثة</p>
        <Link href="/nurse/chat"><Button variant="outline">العودة للمحادثات</Button></Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -m-4 md:-m-6">
      {/* Chat Header */}
      <div className="glass-strong border-b border-border p-3 flex items-center gap-3">
        <Link href="/nurse/chat">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-nurse/10 text-nurse flex items-center justify-center text-sm font-semibold">
            {chatInfo?.participantName?.slice(0, 2) || 'م'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{chatInfo?.participantName || 'مستفيد'}</p>
            <p className="text-[10px] text-muted-foreground">
              {chatInfo?.participantRole === 'nurse' ? 'ممرض/ـة' :
               chatInfo?.participantRole === 'beneficiary' ? 'مستفيد/ـة' :
               chatInfo?.participantRole === 'admin' ? 'دعم فني' :
               chatInfo?.participantRole === 'subadmin' ? 'مدير فرعي' : 'محادثة نشطة'}
            </p>
          </div>
          {chatInfo?.participantPhone && (
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => window.open(`tel:${chatInfo.participantPhone}`)}>
              <Phone className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-nurse animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState icon={<Send className="w-10 h-10 text-muted-foreground" />} title="ابدأ المحادثة" description="أرسل رسالة لبدء المحادثة" />
        ) : (
          <>
            {messages.map((msg) => {
              const mine = isMyMessage(msg);
              const isRead = msg.readBy && msg.readBy.length > 1;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: msg.isPending ? 0.75 : 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${mine ? 'justify-start' : 'justify-end'}`}
                >
                  <div className="flex flex-col gap-1 max-w-[80%]">
                    <div
                      className={`rounded-2xl px-4 py-2.5 ${
                        msg.isFailed
                          ? 'bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-br-md'
                          : mine
                            ? 'bg-nurse text-nurse-foreground rounded-br-md'
                            : 'glass rounded-bl-md'
                      }`}
                    >
                      {msg.imageUrl && (
                        <div className="mb-2">
                          <img src={msg.imageUrl} alt="صورة" className="max-w-full rounded-xl max-h-60 object-cover" />
                        </div>
                      )}
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[10px] opacity-70">
                          {msg.isPending ? 'جاري الإرسال...' : formatTimeOnly(new Date(msg.createdAt))}
                        </span>
                        {mine && !msg.isPending && !msg.isFailed && (
                          isRead
                            ? <CheckCheck className="w-3.5 h-3.5 opacity-70" />
                            : <Check className="w-3.5 h-3.5 opacity-70" />
                        )}
                        {msg.isPending && <Clock className="w-3 h-3 opacity-60" />}
                        {msg.isFailed && <AlertCircle className="w-3 h-3 text-red-500" />}
                      </div>
                    </div>
                    {/* Retry button for failed messages */}
                    {msg.isFailed && mine && (
                      <button
                        onClick={() => handleRetry(msg)}
                        className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-700 transition-colors self-start"
                      >
                        <RefreshCw className="w-3 h-3" /> إعادة المحاولة
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
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
      {messages.length > 0 && (
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-none">
          {quickReplies.map((qr) => (
            <button
              key={qr.id}
              onClick={() => handleQuickReply(qr.value)}
              disabled={isSending}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs border border-nurse/30 text-nurse hover:bg-nurse/10 transition-colors disabled:opacity-50"
            >
              {qr.labelAr}
            </button>
          ))}
        </div>
      )}

      {/* Message Input */}
      <div className="glass-strong border-t border-border p-3 safe-bottom">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0" disabled>
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          </Button>
          <div className="flex-1">
            <Input
              placeholder="اكتب رسالة..."
              value={newMessage}
              onChange={(e) => { setNewMessage(e.target.value); setSendError(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
              }}
              className="rounded-2xl"
              dir="rtl"
            />
          </div>
          <Button
            size="icon"
            className="shrink-0 bg-nurse hover:bg-nurse/90 rounded-full w-10 h-10"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
