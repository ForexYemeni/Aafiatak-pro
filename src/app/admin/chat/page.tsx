'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Search, ChevronLeft, Plus, Users as UsersIcon, X, Loader2 } from 'lucide-react';
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
import { socketService } from '@/lib/socket-v2';
import { getRelativeTime, toArabicNum } from '@/components/common/date-formatter';
import { Button } from '@/components/ui/button';
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

interface SearchUser {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  roleLabel: string;
  subtitle: string;
}

// ---- Component ----

export default function AdminChatPage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const authFetch = useAuthFetch();

  // New chat dialog state
  const [showNewChat, setShowNewChat] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchChats = useCallback(async () => {
    try {
      const res = await authFetch('/api/chat?limit=100');
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

  // Listen for instant new message notifications via socket
  useEffect(() => {
    const unsub = socketService.onMessage(() => {
      fetchChats();
    });
    return unsub;
  }, [fetchChats]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Search users when query changes
  useEffect(() => {
    if (!userSearchQuery || userSearchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await authFetch(`/api/chat/users?q=${encodeURIComponent(userSearchQuery)}`);
        const data = await res.json();
        if (data.success && data.data) {
          setSearchResults(data.data as SearchUser[]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [userSearchQuery, authFetch]);

  // Start a new chat with a user
  const startChat = async (targetUser: SearchUser) => {
    setIsCreating(true);
    try {
      const res = await authFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          participantId: targetUser.id,
          participantRole: targetUser.role,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setShowNewChat(false);
        setUserSearchQuery('');
        setSearchResults([]);
        router.push(`/admin/chat/${data.data.id}`);
      }
    } catch {
      // handle error
    } finally {
      setIsCreating(false);
    }
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true;
    return chat.participantName?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Calculate total unread
  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

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
      <PageHeader
        title="المحادثات"
        description="محادثات الممرضين والمستفيدين والمدراء"
      />

      {/* Search + New Chat Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث في المحادثات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <Button
          onClick={() => setShowNewChat(true)}
          className="bg-admin hover:bg-admin/90 gap-1.5 shrink-0"
          size="default"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">محادثة جديدة</span>
        </Button>
      </div>

      {/* Unread Summary */}
      {totalUnread > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-admin/5 border border-admin/10">
          <MessageSquare className="w-4 h-4 text-admin" />
          <span className="text-sm text-admin font-medium">
            {toArabicNum(totalUnread)} رسالة غير مقروءة
          </span>
        </div>
      )}

      {/* New Chat Dialog */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <GlassCard variant="admin" className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <UsersIcon className="w-4 h-4" />
                  محادثة جديدة
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => {
                    setShowNewChat(false);
                    setUserSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالاسم (ممرض، مستفيد، مدير فرعي)..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pr-10"
                  autoFocus
                />
              </div>

              {/* Search Results */}
              {isSearching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-admin" />
                </div>
              )}

              {!isSearching && searchResults.length > 0 && (
                <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                  {searchResults.map((u) => (
                    <button
                      key={`${u.role}-${u.id}`}
                      onClick={() => startChat(u)}
                      disabled={isCreating}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-admin/5 transition-colors text-right"
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-admin/10 text-admin text-xs">
                          {u.name.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.roleLabel}
                          {u.phone ? ` • ${u.phone}` : ''}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {u.roleLabel}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              {!isSearching && userSearchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  لم يتم العثور على نتائج
                </p>
              )}

              {userSearchQuery.length < 2 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  أدخل حرفين على الأقل للبحث
                </p>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <PullToRefresh onRefresh={async () => { setIsLoading(true); await fetchChats(); }}>
        {filteredChats.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-10 h-10 text-muted-foreground" />}
            title="لا توجد محادثات"
            description="ستظهر المحادثات هنا عند تواصل الممرضين والمستفيدين، أو ابدأ محادثة جديدة"
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
                <Link href={`/admin/chat/${chat.id}`}>
                  <GlassCard variant="admin" className={`p-4 transition-all hover:shadow-md ${chat.unreadCount > 0 ? 'ring-1 ring-admin/20' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-admin/10 text-admin text-sm">
                          {chat.participantName?.slice(0, 2) || 'م'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate">
                              {chat.participantName || 'مستخدم'}
                            </p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {chat.participantRole === 'nurse' ? 'ممرض' : chat.participantRole === 'beneficiary' ? 'مستفيد' : chat.participantRole === 'subadmin' ? 'مدير فرعي' : chat.participantRole === 'admin' ? 'مدير' : chat.participantRole}
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
