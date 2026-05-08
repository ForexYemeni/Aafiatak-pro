'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun, Bell, Search, Menu, X, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useAuthFetch } from '@/hooks/use-auth';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';

interface TopHeaderProps {
  onMenuToggle: () => void;
  role: UserRole;
}

const roleTitleMap: Record<UserRole, string> = {
  admin: 'لوحة تحكم المدير',
  subadmin: 'لوحة تحكم المدير الفرعي',
  nurse: 'لوحة الممرض/ـة',
  beneficiary: 'الرئيسية',
};

function getRoleColor(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'subadmin':
      return 'text-admin';
    case 'nurse':
      return 'text-nurse';
    case 'beneficiary':
      return 'text-beneficiary';
    default:
      return 'text-primary';
  }
}

function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'subadmin':
      return '/admin';
    case 'nurse':
      return '/nurse';
    case 'beneficiary':
      return '/beneficiary';
    default:
      return '/';
  }
}

function getProfilePath(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin/settings';
    case 'subadmin':
      return '/admin/subadmin-settings';
    case 'nurse':
      return '/nurse/profile';
    case 'beneficiary':
      return '/beneficiary/profile';
    default:
      return '/';
  }
}

function getSettingsPath(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin/settings';
    case 'subadmin':
      return '/admin/subadmin-settings';
    case 'nurse':
      return '/nurse/profile';
    case 'beneficiary':
      return '/beneficiary/profile';
    default:
      return '/';
  }
}

function getNotificationsPath(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'subadmin':
      return '/admin/settings'; // Admin doesn't have separate notifications page yet
    case 'nurse':
      return '/nurse/notifications';
    case 'beneficiary':
      return '/beneficiary/notifications';
    default:
      return '/';
  }
}

export function TopHeader({ onMenuToggle, role }: TopHeaderProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const authFetch = useAuthFetch();

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Notification count
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await authFetch('/api/notifications?limit=1&unreadOnly=true');
      const json = await res.json();
      if (json.success && json.data) {
        const count = json.data.unreadCount ?? json.data.total ?? 0;
        setUnreadCount(count);
      }
    } catch {
      // Ignore errors
    }
  }, [authFetch]);

  useEffect(() => {
    fetchUnreadCount();
    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Refresh notification count when window gets focus (e.g. returning from chat)
  useEffect(() => {
    window.addEventListener('focus', fetchUnreadCount);
    return () => window.removeEventListener('focus', fetchUnreadCount);
  }, [fetchUnreadCount]);

  // Listen for custom event to refresh notification count (e.g. after mark all as read)
  useEffect(() => {
    const handleRefresh = () => {
      fetchUnreadCount();
    };
    window.addEventListener('notifications-changed', handleRefresh);
    return () => window.removeEventListener('notifications-changed', handleRefresh);
  }, [fetchUnreadCount]);

  // Focus search input when shown
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Navigate based on role
    switch (role) {
      case 'admin':
      case 'subadmin':
        // Search could go to nurses or beneficiaries
        router.push(`/admin/nurses?search=${encodeURIComponent(searchQuery)}`);
        break;
      case 'nurse':
        router.push(`/nurse/requests`);
        break;
      case 'beneficiary':
        router.push(`/beneficiary/orders`);
        break;
    }
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleLogout = () => {
    // logout() already handles state clearing, cookie clearing, and navigation
    logout();
  };

  const roleLabel: Record<UserRole, string> = {
    admin: 'مدير النظام',
    subadmin: 'مدير فرعي',
    nurse: 'ممرض/ـة',
    beneficiary: 'مستفيد/ـة',
  };

  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-border safe-top">
      <div className="flex items-center justify-between h-16 px-4 gap-3">
        {/* Menu Button (mobile) + Page Title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuToggle}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className={cn('font-bold text-lg hidden sm:block', getRoleColor(role))}>
            {roleTitleMap[role]}
          </h1>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          {showSearch ? (
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث..."
                className="w-40 sm:w-56 h-9 text-sm"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9"
                onClick={() => { setShowSearch(false); setSearchQuery(''); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </form>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9"
              onClick={() => setShowSearch(true)}
            >
              <Search className="w-4 h-4" />
            </Button>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="w-9 h-9"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* Notifications Bell */}
          <Button
            variant="ghost"
            size="icon"
            className="w-9 h-9 relative"
            onClick={() => router.push(getNotificationsPath(role))}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 min-w-[16px] h-4 p-0 flex items-center justify-center text-[10px]"
              >
                {unreadCount > 9 ? '٩+' : unreadCount}
              </Badge>
            )}
          </Button>

          {/* User Avatar Dropdown */}
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className={cn('text-xs', getRoleColor(role))}>
                    {user?.name?.slice(0, 2) ?? 'عف'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.name ?? 'مستخدم'}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel[role]}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(getProfilePath(role))}>
                <User className="w-4 h-4 ml-2" />
                الملف الشخصي
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(getSettingsPath(role))}>
                <Settings className="w-4 h-4 ml-2" />
                الإعدادات
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
