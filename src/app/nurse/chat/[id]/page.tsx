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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassCard } from '@/components/common/glass-card';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useChat } from '@/hooks/use-socket';
import { formatTimeOnly, toArabicNum } from '@/components/common/date-formatter';
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
  deliveredTo: string[];
  createdAt: string;
  quickReplies: Array<{
    id: string;
    labelAr: string;
    value: string;
  }> | null;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [otherName, setOtherName] = useState('مستفيد');
  const [otherOnline, setOtherOnline] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);

  // Socket chat hook
  const { sendMessage, startTyping, stopTyping, isTyping: otherTyping } = useChat(chatId);

  // Resolve params
  useEffect(() => {
    params.then((p) => setChatId(p.id));
  }, [params]);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const res = await authFetch(`/api/chat/${chatId}/messages?limit=100`);
      const data = await res.json();
      if (data.success && data.data) {
        setMessages((data.data as ChatMessage[]).reverse());
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, chatId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    stopTyping();

    try {
      const res = await authFetch(`/api/chat/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, type: 'text' }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setMessages((prev) => [...prev, data.data as ChatMessage]);
      }
    } catch {
      // silently handle - re-add message to input
      setNewMessage(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickReply = async (value: string) => {
    setNewMessage('');
    setIsSending(true);
    try {
      const res = await authFetch(`/api/chat/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: value, type: 'text' }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setMessages((prev) => [...prev, data.data as ChatMessage]);
      }
    } catch {
      // silently handle
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (value.length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const uploadRes = await authFetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.data?.url) {
          const msgRes = await authFetch(`/api/chat/${chatId}/messages`, {
            method: 'POST',
            body: JSON.stringify({
              content: '📷 صورة',
              type: 'image',
              imageUrl: uploadData.data.url,
            }),
          });
          const msgData = await msgRes.json();
          if (msgData.success && msgData.data) {
            setMessages((prev) => [...prev, msgData.data as ChatMessage]);
          }
        }
      } catch {
        // silently handle
      }
    };
    input.click();
  };

  const isMyMessage = (msg: ChatMessage): boolean => {
    return msg.senderId === user?.id;
  };

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
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-nurse/10 text-nurse flex items-center justify-center text-sm font-semibold">
              {otherName.slice(0, 2)}
            </div>
            {otherOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
            )}
          </div>
          <div>
            <p className="font-semibold text-sm">{otherName}</p>
            <p className="text-[10px] text-muted-foreground">
              {otherTyping ? 'يكتب...' : otherOnline ? 'متصل الآن' : 'غير متصل'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-nurse/30 border-t-nurse rounded-full animate-spin" />
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
              const isRead = msg.readBy.length > 1;

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

      {/* Typing Indicator */}
      <AnimatePresence>
        {otherTyping && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-1"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>يكتب...</span>
            </div>
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
            onClick={handleImageUpload}
          >
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          </Button>
          <div className="flex-1 relative">
            <Input
              placeholder="اكتب رسالة..."
              value={newMessage}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="pr-4 pl-12 rounded-full"
            />
          </div>
          <Button
            size="icon"
            className="shrink-0 bg-nurse hover:bg-nurse/90 rounded-full w-10 h-10"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
