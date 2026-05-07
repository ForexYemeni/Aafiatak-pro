'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  ClipboardList,
  CreditCard,
  AlertTriangle,
  Settings,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Heart,
  Star,
  Tags,
  MessageSquare,
  ScrollText,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const adminNavItems: NavItem[] = [
  { label: 'لوحة التحكم', href: '/admin', icon: LayoutDashboard },
  { label: 'الخدمات', href: '/admin/services', icon: Heart },
  { label: 'الممرضون', href: '/admin/nurses', icon: Stethoscope },
  { label: 'المستفيدون', href: '/admin/beneficiaries', icon: Users },
  { label: 'الطلبات', href: '/admin/orders', icon: ClipboardList },
  { label: 'الطوارئ', href: '/admin/emergencies', icon: AlertTriangle, badge: 0 },
  { label: 'المدفوعات', href: '/admin/payments', icon: CreditCard },
  { label: 'الكوبونات', href: '/admin/coupons', icon: Tags },
  { label: 'التقييمات', href: '/admin/ratings', icon: Star },
  { label: 'الشكاوى', href: '/admin/complaints', icon: MessageSquare },
  { label: 'المديرون الفرعيون', href: '/admin/subadmins', icon: Shield },
  { label: 'سجل النشاط', href: '/admin/activity/page', icon: ScrollText },
  { label: 'الإعدادات', href: '/admin/settings', icon: Settings },
];

const nurseNavItems: NavItem[] = [
  { label: 'لوحة التحكم', href: '/nurse', icon: LayoutDashboard },
  { label: 'الطلبات المتاحة', href: '/nurse/requests', icon: ClipboardList },
  { label: 'طلباتي', href: '/nurse/my-requests', icon: Stethoscope },
  { label: 'الأرباح', href: '/nurse/earnings', icon: CreditCard },
  { label: 'الملف الشخصي', href: '/nurse/profile', icon: Users },
];

const beneficiaryNavItems: NavItem[] = [
  { label: 'الرئيسية', href: '/beneficiary', icon: LayoutDashboard },
  { label: 'الخدمات', href: '/beneficiary/services', icon: Stethoscope },
  { label: 'طلباتي', href: '/beneficiary/orders', icon: ClipboardList },
  { label: 'الطوارئ', href: '/beneficiary/emergency', icon: AlertTriangle },
  { label: 'نقاط الولاء', href: '/beneficiary/loyalty', icon: Heart },
  { label: 'الملف الشخصي', href: '/beneficiary/profile', icon: Users },
];

function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case 'admin':
    case 'subadmin':
      return adminNavItems;
    case 'nurse':
      return nurseNavItems;
    case 'beneficiary':
      return beneficiaryNavItems;
    default:
      return beneficiaryNavItems;
  }
}

function getRoleColor(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'subadmin':
      return 'text-admin bg-admin/10';
    case 'nurse':
      return 'text-nurse bg-nurse/10';
    case 'beneficiary':
      return 'text-beneficiary bg-beneficiary/10';
    default:
      return 'text-primary bg-primary/10';
  }
}

function getRoleActiveColor(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'subadmin':
      return 'bg-admin/15 text-admin border-admin/30';
    case 'nurse':
      return 'bg-nurse/15 text-nurse border-nurse/30';
    case 'beneficiary':
      return 'bg-beneficiary/15 text-beneficiary border-beneficiary/30';
    default:
      return 'bg-primary/15 text-primary border-primary/30';
  }
}

interface SidebarProps {
  role: UserRole;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ role, isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(role);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);

  const roleLabelMap: Record<UserRole, string> = {
    admin: 'مدير النظام',
    subadmin: 'مدير فرعي',
    nurse: 'ممرض/ـة',
    beneficiary: 'مستفيد/ـة',
  };

  return (
    <aside
      className={cn(
        'h-full glass-strong flex flex-col transition-all duration-300 border-l border-border',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo Section */}
      <div className="p-4 flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', getRoleColor(role))}>
          <Heart className="w-5 h-5" />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col"
          >
            <span className="font-bold text-lg leading-tight">عافيتك</span>
            <span className="text-xs text-muted-foreground">Aafiatak</span>
          </motion.div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="mr-auto w-8 h-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </Button>
      </div>

      <Separator />

      {/* Navigation Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: -4 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative',
                  isActive
                    ? getRoleActiveColor(role)
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-full bg-current"
                  />
                )}
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
                {!collapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="mr-auto bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User Info & Logout */}
      <div className="p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <Avatar className="w-9 h-9">
              <AvatarFallback className={cn('text-sm', getRoleColor(role))}>
                {user.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground">{roleLabelMap[role]}</p>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 text-muted-foreground hover:text-destructive',
            collapsed && 'justify-center px-2'
          )}
          onClick={logout}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm">تسجيل الخروج</span>}
        </Button>
      </div>
    </aside>
  );
}
