'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  UserCog,
  UserCircle,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UserRole, SubAdminPermission } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  permission?: SubAdminPermission;
  alwaysVisibleToSubadmin?: boolean;
  adminOnly?: boolean;
  group?: string;
}

const adminNavItems: NavItem[] = [
  { label: 'لوحة التحكم', href: '/admin', icon: LayoutDashboard, alwaysVisibleToSubadmin: true, group: 'overview' },
  { label: 'الخدمات', href: '/admin/services', icon: Heart, permission: 'manage_services', group: 'management' },
  { label: 'الممرضون', href: '/admin/nurses', icon: Stethoscope, permission: 'manage_nurses', group: 'management' },
  { label: 'المستفيدون', href: '/admin/beneficiaries', icon: Users, permission: 'manage_beneficiaries', group: 'management' },
  { label: 'الطلبات', href: '/admin/orders', icon: ClipboardList, permission: 'manage_orders', group: 'operations' },
  { label: 'الطوارئ', href: '/admin/emergencies', icon: AlertTriangle, permission: 'manage_emergencies', badge: 0, group: 'operations' },
  { label: 'التكليفات', href: '/admin/deployments', icon: Briefcase, permission: 'manage_orders', group: 'operations' },
  { label: 'المدفوعات', href: '/admin/payments', icon: CreditCard, permission: 'manage_payments', group: 'finance' },
  { label: 'الكوبونات', href: '/admin/coupons', icon: Tags, permission: 'manage_payments', group: 'finance' },
  { label: 'التقييمات', href: '/admin/ratings', icon: Star, permission: 'view_reports', group: 'reports' },
  { label: 'الشكاوى', href: '/admin/complaints', icon: MessageSquare, permission: 'manage_chat', group: 'reports' },
  { label: 'المحادثات', href: '/admin/chat', icon: MessageSquare, permission: 'manage_chat', group: 'reports' },
  { label: 'المديرون الفرعيون', href: '/admin/subadmins', icon: Shield, adminOnly: true, group: 'system' },
  { label: 'سجل النشاط', href: '/admin/activity/page', icon: ScrollText, permission: 'view_reports', group: 'system' },
  { label: 'الملف الشخصي', href: '/admin/subadmin-settings', icon: UserCircle, alwaysVisibleToSubadmin: true, group: 'system' },
  { label: 'الإعدادات', href: '/admin/settings', icon: Settings, adminOnly: true, group: 'system' },
];

const nurseNavItems: NavItem[] = [
  { label: 'لوحة التحكم', href: '/nurse', icon: LayoutDashboard, group: 'overview' },
  { label: 'الطلبات المتاحة', href: '/nurse/requests', icon: ClipboardList, group: 'work' },
  { label: 'طلباتي', href: '/nurse/my-requests', icon: Stethoscope, group: 'work' },
  { label: 'التكليفات', href: '/nurse/deployments', icon: Briefcase, group: 'work' },
  { label: 'التقييمات', href: '/nurse/ratings', icon: Star, group: 'work' },
  { label: 'المحادثات', href: '/nurse/chat', icon: MessageSquare, group: 'communication' },
  { label: 'الأرباح', href: '/nurse/earnings', icon: CreditCard, group: 'finance' },
  { label: 'الملف الشخصي', href: '/nurse/profile', icon: Users, group: 'account' },
];

const beneficiaryNavItems: NavItem[] = [
  { label: 'الرئيسية', href: '/beneficiary', icon: LayoutDashboard, group: 'overview' },
  { label: 'الخدمات', href: '/beneficiary', icon: Stethoscope, group: 'services' },
  { label: 'طلباتي', href: '/beneficiary/orders', icon: ClipboardList, group: 'services' },
  { label: 'المحادثات', href: '/beneficiary/chat', icon: MessageSquare, group: 'communication' },
  { label: 'الطوارئ', href: '/beneficiary/emergency', icon: AlertTriangle, group: 'services' },
  { label: 'نقاط الولاء', href: '/beneficiary/loyalty', icon: Heart, group: 'account' },
  { label: 'الملف الشخصي', href: '/beneficiary/profile', icon: Users, group: 'account' },
];

const groupLabels: Record<string, string> = {
  overview: 'عام',
  management: 'إدارة',
  operations: 'العمليات',
  finance: 'المالية',
  reports: 'التقارير',
  system: 'النظام',
  work: 'العمل',
  communication: 'التواصل',
  services: 'الخدمات',
  account: 'الحساب',
};

function getNavItems(role: UserRole, permissions?: SubAdminPermission[]): NavItem[] {
  switch (role) {
    case 'admin':
      return adminNavItems;
    case 'subadmin': {
      const nonAdminOnlyItems = adminNavItems.filter(item => !item.adminOnly);
      if (!permissions || permissions.length === 0) {
        return nonAdminOnlyItems.filter(item => item.alwaysVisibleToSubadmin);
      }
      return nonAdminOnlyItems.filter(item =>
        item.alwaysVisibleToSubadmin || (item.permission && permissions.includes(item.permission))
      );
    }
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
      return 'bg-admin/12 text-admin';
    case 'nurse':
      return 'bg-nurse/12 text-nurse';
    case 'beneficiary':
      return 'bg-beneficiary/12 text-beneficiary';
    default:
      return 'bg-primary/12 text-primary';
  }
}

function getRoleAccentBar(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'subadmin':
      return 'bg-admin';
    case 'nurse':
      return 'bg-nurse';
    case 'beneficiary':
      return 'bg-beneficiary';
    default:
      return 'bg-primary';
  }
}

interface SidebarProps {
  role: UserRole;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ role, isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);

  const subadminPermissions = (user as any)?.permissions as SubAdminPermission[] | undefined;
  const navItems = useMemo(() => getNavItems(role, subadminPermissions), [role, subadminPermissions]);

  const roleLabelMap: Record<UserRole, string> = {
    admin: 'مدير النظام',
    subadmin: 'مدير فرعي',
    nurse: 'ممرض/ـة',
    beneficiary: 'مستفيد/ـة',
  };

  // Group items
  const groupedItems = useMemo(() => {
    const groups: Record<string, NavItem[]> = {};
    for (const item of navItems) {
      const g = item.group ?? 'other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return groups;
  }, [navItems]);

  return (
    <aside
      className={cn(
        'h-full flex flex-col transition-all duration-300 border-l border-border/70 relative',
        'bg-card/95 backdrop-blur-2xl',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Role accent gradient strip on the right border */}
      <div className={cn('absolute top-0 right-0 bottom-0 w-[3px] rounded-full', getRoleAccentBar(role))} style={{ opacity: 0.6 }} />

      {/* Logo Section */}
      <div className={cn(
        'flex items-center gap-3 p-4 border-b border-border/60',
        collapsed ? 'justify-center px-2' : '',
        'bg-gradient-to-b from-muted/50 to-transparent'
      )}>
        <div className={cn(
          'rounded-xl flex items-center justify-center shrink-0 shadow-md transition-all duration-300',
          getRoleColor(role),
          collapsed ? 'w-9 h-9' : 'w-10 h-10'
        )}>
          <Heart className={cn('transition-all', collapsed ? 'w-4.5 h-4.5' : 'w-5 h-5')} />
        </div>
        {!collapsed && (
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-black text-base leading-tight tracking-tight">عافيتك</span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">Aafiatak Pro</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn('w-7 h-7 rounded-lg shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60', collapsed && 'mt-0')}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronLeft className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Navigation Items - Grouped */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar py-3 px-2 space-y-0.5">
        {Object.entries(groupedItems).map(([groupKey, items], groupIndex) => (
          <div key={groupKey}>
            {/* Group label (only when not collapsed) */}
            {!collapsed && groupIndex > 0 && (
              <div className="px-3 pt-4 pb-1">
                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  {groupLabels[groupKey] ?? groupKey}
                </span>
              </div>
            )}
            {collapsed && groupIndex > 0 && (
              <div className="my-2 mx-3 h-px bg-border/60" />
            )}

            {items.map((item) => {
              const isExact = item.href === '/admin' || item.href === '/nurse' || item.href === '/beneficiary';
              const isActive = isExact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href} prefetch={true}>
                  <div
                    className={cn(
                      'relative flex items-center gap-3 rounded-xl transition-all duration-150 group cursor-pointer',
                      collapsed ? 'px-0 py-2.5 justify-center mx-1' : 'px-3 py-2.5 mx-0',
                      isActive
                        ? cn(getRoleActiveColor(role), 'shadow-sm')
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active right-side accent bar */}
                    {isActive && (
                      <div
                        className={cn(
                          'absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-l-full shadow-sm',
                          getRoleAccentBar(role)
                        )}
                      />
                    )}

                    <div className={cn(
                      'shrink-0 transition-all duration-150 rounded-lg flex items-center justify-center',
                      collapsed ? 'w-9 h-9' : 'w-8 h-8',
                      isActive
                        ? cn(role === 'admin' || role === 'subadmin' ? 'bg-admin/20 text-admin' : role === 'nurse' ? 'bg-nurse/20 text-nurse' : 'bg-beneficiary/20 text-beneficiary')
                        : 'group-hover:bg-muted/70'
                    )}>
                      <Icon
                        className={cn(
                          'transition-all duration-150',
                          collapsed ? 'w-[18px] h-[18px]' : 'w-[16px] h-[16px]',
                          isActive ? '' : 'group-hover:scale-110'
                        )}
                      />
                    </div>
                    {!collapsed && (
                      <span className={cn('text-[13px] flex-1 truncate transition-all leading-tight', isActive ? 'font-bold' : 'font-medium')}>{item.label}</span>
                    )}
                    {!collapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none min-w-[18px] text-center">
                        {item.badge}
                      </span>
                    )}
                    {collapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full ring-2 ring-background" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-border/60 p-3 space-y-1 bg-gradient-to-t from-muted/20 to-transparent">
        {!collapsed && user && (
          <div className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1',
            'bg-muted/60 border border-border/40'
          )}>
            <Avatar className="w-8 h-8 shrink-0 ring-2 ring-border/60">
              <AvatarFallback className={cn('text-xs font-bold', getRoleColor(role))}>
                {user.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-muted-foreground font-medium">{roleLabelMap[role]}</p>
            </div>
          </div>
        )}
        {collapsed && user && (
          <div className="flex justify-center mb-1">
            <Avatar className="w-8 h-8 ring-2 ring-border/60">
              <AvatarFallback className={cn('text-xs font-bold', getRoleColor(role))}>
                {user.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        <Button
          variant="ghost"
          className={cn(
            'w-full text-muted-foreground hover:text-destructive hover:bg-destructive/8 rounded-xl transition-all duration-150',
            collapsed ? 'justify-center px-0 h-10' : 'justify-start gap-3 h-10'
          )}
          onClick={logout}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm">تسجيل الخروج</span>}
        </Button>
      </div>
    </aside>
  );
}
