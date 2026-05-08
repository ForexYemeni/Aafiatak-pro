'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Search,
  Clock,
  Loader2,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GlassCard } from '@/components/common/glass-card';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/common/loading-skeleton';
import { SearchInput } from '@/components/common/search-input';
import { useAuthFetch } from '@/hooks/use-auth';

interface ChatConversation {
  id: string;
  participantName: string;
  participantRole: string;
  participantPhone: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export default function ChatPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchChats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/chat');
      const data = await res.json();
      if (data.success && data.data) {
        setChats(Array.isArray(data.data) ? data.data : []);
      }
    } catch {
      setChats([]);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const filteredChats = chats.filter((chat) =>
    chat.participantName.includes(searchQuery) || chat.lastMessage.includes(searchQuery)
  );

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'الآن';
    if (hours < 24) return `منذ ${hours} س`;
    if (days < 7) return `منذ ${days} ي`;
    return d.toLocaleDateString('ar-YE', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold">المحادثات</h1>
        <p className="text-sm text-muted-foreground">محادثاتك مع الممرضين/ـات</p>
      </motion.div>

      <SearchInput
        placeholder="ابحث في المحادثات..."
        onChange={setSearchQuery}
        className="w-full"
      />

      {isLoading ? (
        <ListSkeleton items={5} />
      ) : filteredChats.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="w-10 h-10 text-muted-foreground" />}
          title="لا توجد محادثات"
          description="ستظهر هنا محادثاتك مع الممرضين/ـات بعد تعيين ممرض لطلبك"
        />
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto custom-scrollbar">
          {filteredChats.map((chat, index) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <GlassCard
                variant="beneficiary"
                className="py-3 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/beneficiary/chat/${chat.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-beneficiary/10 text-beneficiary">
                        {chat.participantName.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {chat.unreadCount > 0 && (
                      <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                        {chat.unreadCount > 9 ? '٩+' : chat.unreadCount}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm truncate">{chat.participantName}</h3>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTime(chat.lastMessageTime)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {chat.lastMessage || 'لا توجد رسائل بعد'}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
