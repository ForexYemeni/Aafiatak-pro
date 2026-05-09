'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  ImageIcon,
  ArrowRight,
  CheckCheck,
  Check,
  Clock,
  Paperclip,
  Loader2,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassCard } from '@/components/common/glass-card';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatTimeOnly, toArabicNum } from '@/components/common/date-formatter';
import { setActiveChatId } from '@/components/providers/socket-provider';
import Link from 'next/link';

// ---- Types ----

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
}

interface ChatInfo {
  id: string;
  participantName: string;
  participantPhone: string | null;
  participantRole?: string;
}

// ---- Quick Reply Suggestions ----

const quickReplies = [
  { id: 'qr-1', labelAr: 'في الطريق', value: 'أنا في الطريق إليكم' },
  { id: 'qr-2', labelAr: 'وصلت', value: 'لقد وصلت إلى الموقع' },
  { id: 'qr-3', labelAr: 'سأتأخر', value: 'سأتأخر قليلاً' },
  { id: 'qr-4', labelAr: 'شكراً', value: 'شكراً لك' },
];

// ---- Component ----

export default function NurseChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [chatId, setChatId] = useState<string>('');
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);

  // Resolve params
  useEffect(() => {
    params.then((p) => setChatId(p.id));
  }, [params]);

  // Set active chat ID for global sound dedup
  useEffect(() => {
    if (chatId) {
      setActiveChatId(chatId);
      return () => setActiveChatId(null);
    }
  }, [chatId]);

  // Fetch chat info
  useEffect(() => {
    if (!chatId) return;
    const fetchChatInfo = async () => {
      try {
        const res = await authFetch('/api/chat');
        const data = await res.json();
        if (data.success && data.data) {
          const found = data.data.find((c: any) => c.id === chatId);
          if (found) {
            setChatInfo({
              id: found.id,
              participantName: found.participantName || 'مستفيد',
              participantPhone: found.participantPhone || null,
              participantRole: found.participantRole || 'unknown',
            });
          }
        }
      } catch {
        // silently handle
      }
    };
    fetchChatInfo();
  }, [chatId, authFetch]);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const res = await authFetch(`/api/chat/${chatId}/messages?limit=100`);
      const data = await res.json();
      if (data.success && data.data) {
        // API returns { messages: [...], total, page, pages }
        const msgs = data.data.messages || data.data;
        setMessages(Array.isArray(msgs) ? msgs : []);
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

  // Mark chat-related notifications as read when opening a chat
  useEffect(() => {
    if (!chatId) return;
    const markNotificationsRead = async () => {
      try {
        await authFetch('/api/notifications/read-all', {
          method: 'POST',
          body: JSON.stringify({ type: 'chat', chatId }),
        });
      } catch {
        // silently handle
      }
    };
    markNotificationsRead();
  }, [chatId, authFetch]);

  // Polling for new messages every 3 seconds
  useEffect(() => {
    if (!chatId) return;
    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/chat/${chatId}/messages?limit=100`);
        const data = await res.json();
        if (data.success && data.data) {
          const msgs = data.data.messages || data.data;
          if (Array.isArray(msgs)) {
            setMessages(prev => {
              // Only update if there are new messages
              if (msgs.length !== prev.length) return msgs;
              // Check if last message is different
              if (msgs.length > 0 && prev.length > 0 && msgs[msgs.length - 1].id !== prev[prev.length - 1].id) {
                return msgs;
              }
              return prev;
            });
          }
        }
      } catch {
        // silently handle
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [chatId, authFetch]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending || !chatId) return;
    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const res = await authFetch(`/api/chat/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, type: 'text' }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data.data.id);
          if (exists) return prev;
          return [...prev, data.data as ChatMessage];
        });
      }
    } catch {
      setNewMessage(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickReply = async (value: string) => {
    if (isSending || !chatId) return;
    setNewMessage('');
    setIsSending(true);
    try {
      const res = await authFetch(`/api/chat/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: value, type: 'text' }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data.data.id);
          if (exists) return prev;
          return [...prev, data.data as ChatMessage];
        });
      }
    } catch {
      // silently handle
    } finally {
      setIsSending(false);
    }
  };

  const isMyMessage = (msg: ChatMessage): boolean => {
    return msg.senderId === user?.id || msg.senderId === user?._id;
  };

  if (!chatId && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <MessageCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">لم يتم العثور على المحادثة</p>
        <Link href="/nurse/chat">
          <Button variant="outline">العودة للمحادثات</Button>
        </Link>
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
              {chatInfo?.participantRole === 'nurse' ? 'ممرض/ـة' : chatInfo?.participantRole === 'beneficiary' ? 'مستفيد/ـة' : chatInfo?.participantRole === 'admin' ? 'دعم فني' : chatInfo?.participantRole === 'subadmin' ? 'مدير فرعي' : 'محادثة نشطة'}
            </p>
          </div>
          {chatInfo?.participantPhone && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => window.open(`tel:${chatInfo.participantPhone}`)}
            >
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
          <EmptyState
            icon={<Send className="w-10 h-10 text-muted-foreground" />}
            title="ابدأ المحادثة"
            description="أرسل رسالة لبدء المحادثة"
          />
        ) : (
          <>
            {messages.map((msg, index) => {
              const mine = isMyMessage(msg);
              const isRead = msg.readBy && msg.readBy.length > 1;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`flex ${mine ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      mine
                        ? 'bg-nurse text-nurse-foreground rounded-br-md'
                        : 'glass rounded-bl-md'
                    }`}
                  >
                    {/* Image */}
                    {msg.imageUrl && (
                      <div className="mb-2">
                        <img
                          src={msg.imageUrl}
                          alt="صورة"
                          className="max-w-full rounded-xl max-h-60 object-cover"
                        />
                      </div>
                    )}

                    {/* Text */}
                    <p className="text-sm leading-relaxed">{msg.content}</p>

                    {/* Time & Read Receipt */}
                    <div className={`flex items-center gap-1 mt-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] opacity-70">
                        {formatTimeOnly(new Date(msg.createdAt))}
                      </span>
                      {mine && (
                        isRead ? (
                          <CheckCheck className="w-3.5 h-3.5 opacity-70" />
                        ) : (
                          <Check className="w-3.5 h-3.5 opacity-70" />
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Quick Replies */}
      {messages.length > 0 && (
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-none">
          {quickReplies.map((qr) => (
            <button
              key={qr.id}
              onClick={() => handleQuickReply(qr.value)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs border border-nurse/30 text-nurse hover:bg-nurse/10 transition-colors"
            >
              {qr.labelAr}
            </button>
          ))}
        </div>
      )}

      {/* Message Input */}
      <div className="glass-strong border-t border-border p-3 safe-bottom">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => {
              // Image upload - coming soon
            }}
          >
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          </Button>
          <div className="flex-1">
            <Input
              placeholder="اكتب رسالة..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
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
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
