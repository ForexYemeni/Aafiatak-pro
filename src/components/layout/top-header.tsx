'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Bell, Search, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export function TopHeader({ onMenuToggle, role }: TopHeaderProps) {
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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
          <Button variant="ghost" size="icon" className="w-9 h-9">
            <Search className="w-4 h-4" />
          </Button>

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
          <Button variant="ghost" size="icon" className="w-9 h-9 relative">
            <Bell className="w-4 h-4" />
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center text-[10px]"
            >
              ٣
            </Badge>
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
                  <p className="text-xs text-muted-foreground">{user?.phone ?? ''}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>الملف الشخصي</DropdownMenuItem>
              <DropdownMenuItem>الإعدادات</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={logout}
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
