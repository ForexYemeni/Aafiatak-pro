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
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getRelativeTime, toArabicNum } from '@/components/common/date-formatter';
import Link from 'next/link';

// ---- Types matching the API response ----

interface ChatItem {
  id: string;
  participantName: string;
  participantRole: string;
  participantPhone: string | null;
  participantAvatar: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  requestId: string | null;
}

// ---- Component ----

export default function NurseChatPage() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const authFetch = useAuthFetch();

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

  useRealtimeRefresh({ entities: ['chat'], onRefresh: fetchChats });

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true;
    return chat.participantName?.toLowerCase().includes(searchQuery.toLowerCase());
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
      <PageHeader title="المحادثات" description="تواصل مع المستفيدين والدعم الفني" />

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
            {filteredChats.map((chat, index) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/nurse/chat/${chat.id}`}>
                  <GlassCard variant="nurse" className={`p-4 transition-all hover:shadow-md ${chat.unreadCount > 0 ? 'ring-1 ring-nurse/20' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-nurse/10 text-nurse text-sm">
                          {chat.participantName?.slice(0, 2) || 'م'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate">
                              {chat.participantName || 'مستفيد'}
                            </p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {chat.participantRole === 'nurse' ? 'ممرض' : chat.participantRole === 'beneficiary' ? 'مستفيد' : chat.participantRole === 'admin' ? 'دعم فني' : chat.participantRole === 'subadmin' ? 'مدير فرعي' : chat.participantRole}
                            </Badge>
                          </div>
                          {chat.lastMessageTime && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {getRelativeTime(new Date(chat.lastMessageTime))}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {chat.lastMessage || 'لا توجد رسائل'}
                          </p>
                          {chat.unreadCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="h-5 min-w-[20px] text-[10px] flex items-center justify-center shrink-0"
                            >
                              {toArabicNum(chat.unreadCount)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
