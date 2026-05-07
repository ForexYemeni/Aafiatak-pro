'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Search, ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GlassCard } from '@/components/common/glass-card';
import { EmptyState } from '@/components/common/empty-state';
import { PullToRefresh } from '@/components/common/pull-to-refresh';
import { ListSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getRelativeTime, toArabicNum } from '@/components/common/date-formatter';
import Link from 'next/link';

// ---- Types ----

interface ChatItem {
  id: string;
  participants: Array<{
    userId: string;
    role: string;
    joinedAt: string;
  }>;
  lastMessageContent: string | null;
  lastMessageSender: string | null;
  lastMessageAt: string | null;
  unreadCount: Record<string, number>;
  isActive: boolean;
}

// ---- Component ----

export default function NurseChatPage() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);

  const fetchChats = useCallback(async () => {
    try {
      const res = await authFetch('/api/chat?limit=50');
      const data = await res.json();
      if (data.success && data.data) {
        setChats(data.data as ChatItem[]);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const getOtherParticipant = (chat: ChatItem) => {
    return chat.participants.find((p) => p.userId !== user?.id);
  };

  const getUnreadCount = (chat: ChatItem): number => {
    if (!user?.id) return 0;
    return chat.unreadCount[user.id] ?? 0;
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true;
    const other = getOtherParticipant(chat);
    return other?.userId?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="المحادثات" />
        <ListSkeleton items={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="المحادثات" description="تواصل مع المستفيدين" />

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="بحث في المحادثات..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10"
        />
      </div>

      <PullToRefresh onRefresh={async () => { setIsLoading(true); await fetchChats(); }}>
        {filteredChats.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-10 h-10 text-muted-foreground" />}
            title="لا توجد محادثات"
            description="ستظهر المحادثات هنا عند التواصل مع المستفيدين"
          />
        ) : (
          <div className="space-y-2">
            {filteredChats.map((chat, index) => {
              const other = getOtherParticipant(chat);
              const unread = getUnreadCount(chat);

              return (
                <motion.div
                  key={chat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link href={`/nurse/chat/${chat.id}`}>
                    <GlassCard variant="nurse" className={`p-4 transition-all hover:shadow-md ${unread > 0 ? 'ring-1 ring-nurse/20' : ''}`}>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-nurse/10 text-nurse text-sm">
                            مستفيد
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm truncate">
                              مستفيد
                            </p>
                            {chat.lastMessageAt && (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {getRelativeTime(new Date(chat.lastMessageAt))}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {chat.lastMessageContent ?? 'لا توجد رسائل'}
                            </p>
                            {unread > 0 && (
                              <Badge
                                variant="destructive"
                                className="h-5 min-w-[20px] text-[10px] flex items-center justify-center shrink-0"
                              >
                                {toArabicNum(unread)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </GlassCard>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
