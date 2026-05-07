'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Send,
  Image as ImageIcon,
  Phone,
  MapPin,
  Loader2,
  CheckCheck,
  Check,
  Clock,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/common/glass-card';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSocket } from '@/hooks/use-socket';
import { useToast } from '@/hooks/use-toast';
import type { ApiResponse, Message } from '@/types';

interface ChatInfo {
  id: string;
  participantName: string;
  participantRole: string;
  participantAvatar: string | null;
  participantPhone: string | null;
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
  const chatId = params.id as string;
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();

  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isConnected, service } = useSocket();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchChatInfo = useCallback(async () => {
    if (!token || !chatId) return;
    try {
      const res = await fetch(`/api/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<ChatInfo[]> = await res.json();
      if (data.success && data.data) {
        const found = data.data.find((c: ChatInfo) => c.id === chatId);
        if (found) setChatInfo(found);
      }
    } catch {
      // Error handled silently
    }
  }, [token, chatId]);

  const fetchMessages = useCallback(async () => {
    if (!token || !chatId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<Message[]> = await res.json();
      if (data.success && data.data) {
        setMessages(data.data);
      }
    } catch {
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, chatId]);

  useEffect(() => {
    fetchChatInfo();
    fetchMessages();
  }, [fetchChatInfo, fetchMessages]);

  // Socket listeners for real-time messages
  useEffect(() => {
    if (!service || !chatId) return;

    service.joinChat(chatId);

    const unsubMessage = service.onMessage((event) => {
      if (event.chatId === chatId) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === event.message.id);
          if (exists) return prev;
          return [...prev, event.message];
        });
      }
    });

    const unsubTyping = service.onTyping((event) => {
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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !token || !chatId) return;
    const messageContent = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const res = await fetch(`/api/chat/${chatId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: messageContent,
          type: 'text',
        }),
      });
      const data: ApiResponse<Message> = await res.json();
      if (data.success && data.data) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data.data.id);
          if (exists) return prev;
          return [...prev, data.data];
        });
      }
    } catch {
      toast({ title: 'فشل إرسال الرسالة', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
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

  const isMyMessage = (msg: Message) => msg.senderId === user?.id;

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
          <h3 className="font-semibold text-sm truncate">
            {chatInfo?.participantName ?? 'الممرض/ـة'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {isTyping ? 'يكتب...' : 'متصل'}
          </p>
        </div>
        {chatInfo?.participantPhone && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(`tel:${chatInfo.participantPhone}`)}
          >
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
          messages.map((msg, index) => {
            const isMine = isMyMessage(msg);
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.01 }}
                className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    isMine
                      ? 'bg-beneficiary text-beneficiary-foreground rounded-bl-md'
                      : 'glass rounded-br-md'
                  }`}
                >
                  {msg.type === 'image' && msg.imageUrl && (
                    <div className="mb-2">
                      <img
                        src={msg.imageUrl}
                        alt="صورة"
                        className="rounded-xl max-w-full max-h-48 object-cover"
                      />
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <div className={`flex items-center gap-1 mt-1 ${
                    isMine ? 'text-beneficiary-foreground/60' : 'text-muted-foreground'
                  }`}>
                    <span className="text-[10px]">{formatMessageTime(msg.createdAt)}</span>
                    {isMine && (
                      msg.readBy && msg.readBy.length > 1 ? (
                        <CheckCheck className="w-3 h-3" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end"
          >
            <div className="glass rounded-2xl rounded-br-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => {
                  setNewMessage(reply);
                }}
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
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-10 w-10"
          onClick={() => {
            // Image upload placeholder
            toast({ title: 'قريباً - إرسال الصور' });
          }}
        >
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
        </Button>

        <div className="flex-1">
          <Input
            placeholder="اكتب رسالة..."
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="h-10 rounded-2xl"
            dir="rtl"
          />
        </div>

        <Button
          onClick={sendMessage}
          disabled={!newMessage.trim() || isSending}
          className="shrink-0 w-10 h-10 rounded-full bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground p-0"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
