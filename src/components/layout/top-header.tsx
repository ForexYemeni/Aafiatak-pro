'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun, Search, Menu, X, User, Settings, Bell } from 'lucide-react';
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
import { useAuthStore } from '@/lib/stores/auth-store';
import dynamic from 'next/dynamic';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';

// Lazy-load NotificationBell — it fetches notifications on mount and polls,
// so we don't need it in the initial render payload
const NotificationBell = dynamic(
  () => import('@/components/common/notification-bell').then(mod => ({ default: mod.NotificationBell })),
  { ssr: false, loading: () => <Button variant="ghost" size="icon" className="w-9 h-9"><Bell className="w-4 h-4" /></Button> }
);

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



export function TopHeader({ onMenuToggle, role }: TopHeaderProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

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
        router.push(`/admin/orders?search=${encodeURIComponent(searchQuery)}`);
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

  function getRoleBadgeStyle(role: UserRole): string {
    switch (role) {
      case 'admin':
      case 'subadmin':
        return 'bg-admin/15 text-admin border border-admin/25';
      case 'nurse':
        return 'bg-nurse/15 text-nurse border border-nurse/25';
      case 'beneficiary':
        return 'bg-beneficiary/15 text-beneficiary border border-beneficiary/25';
      default:
        return 'bg-primary/15 text-primary border border-primary/25';
    }
  }

  function getRoleHeaderAccent(role: UserRole): string {
    switch (role) {
      case 'admin':
      case 'subadmin':
        return 'from-admin/8 via-transparent to-transparent';
      case 'nurse':
        return 'from-nurse/8 via-transparent to-transparent';
      case 'beneficiary':
        return 'from-beneficiary/8 via-transparent to-transparent';
      default:
        return 'from-primary/8 via-transparent to-transparent';
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border safe-top">
      {/* Role accent strip at very top */}
      <div className={cn('h-0.5 w-full bg-gradient-to-l', getRoleHeaderAccent(role))} />
      <div className="flex items-center justify-between h-14 px-4 gap-3">
        {/* Menu Button (mobile) + Page Title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden w-9 h-9 rounded-xl"
            onClick={onMenuToggle}
          >
            <Menu className="w-4.5 h-4.5" />
          </Button>
          <div className="hidden sm:flex items-center gap-2.5">
            <h1 className={cn('font-bold text-base', getRoleColor(role))}>
              {roleTitleMap[role]}
            </h1>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', getRoleBadgeStyle(role))}>
              {user?.name?.split(' ')[0] ?? ''}
            </span>
          </div>
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
          <NotificationBell />

          {/* User Avatar Dropdown */}
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={cn('relative h-9 w-9 rounded-xl p-0 ring-2 ring-offset-1 ring-offset-background transition-all hover:scale-105', role === 'admin' || role === 'subadmin' ? 'ring-admin/30 hover:ring-admin/50' : role === 'nurse' ? 'ring-nurse/30 hover:ring-nurse/50' : 'ring-beneficiary/30 hover:ring-beneficiary/50')}>
                <Avatar className="h-9 w-9 rounded-xl">
                  <AvatarFallback className={cn('text-xs font-bold rounded-xl', role === 'admin' || role === 'subadmin' ? 'bg-admin/15 text-admin' : role === 'nurse' ? 'bg-nurse/15 text-nurse' : 'bg-beneficiary/15 text-beneficiary')}>
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
