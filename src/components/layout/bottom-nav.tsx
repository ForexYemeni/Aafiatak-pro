'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Home,
  ClipboardList,
  Stethoscope,
  AlertTriangle,
  User,
  MoreHorizontal,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface BottomNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const adminBottomItems: BottomNavItem[] = [
  { label: 'الرئيسية', href: '/admin', icon: Home },
  { label: 'الممرضون', href: '/admin/nurses', icon: Stethoscope },
  { label: 'الطلبات', href: '/admin/orders', icon: ClipboardList },
  { label: 'الطوارئ', href: '/admin/emergencies', icon: AlertTriangle },
  { label: 'المزيد', href: '/admin/settings', icon: MoreHorizontal },
];

const subadminBottomItems: BottomNavItem[] = [
  { label: 'الرئيسية', href: '/admin', icon: Home },
  { label: 'الممرضون', href: '/admin/nurses', icon: Stethoscope },
  { label: 'الطلبات', href: '/admin/orders', icon: ClipboardList },
  { label: 'الطوارئ', href: '/admin/emergencies', icon: AlertTriangle },
  { label: 'المزيد', href: '/admin/subadmin-settings', icon: MoreHorizontal },
];

const nurseBottomItems: BottomNavItem[] = [
  { label: 'المهام', href: '/nurse', icon: ClipboardList },
  { label: 'المحادثة', href: '/nurse/chat', icon: MessageCircle },
  { label: 'الأرباح', href: '/nurse/earnings', icon: Home },
  { label: 'الإشعارات', href: '/nurse/notifications', icon: AlertTriangle },
  { label: 'المزيد', href: '/nurse/profile', icon: MoreHorizontal },
];

const beneficiaryBottomItems: BottomNavItem[] = [
  { label: 'الرئيسية', href: '/beneficiary', icon: Home },
  { label: 'طلباتي', href: '/beneficiary/orders', icon: ClipboardList },
  { label: 'المحادثة', href: '/beneficiary/chat', icon: MessageCircle },
  { label: 'الطوارئ', href: '/beneficiary/emergency', icon: AlertTriangle },
  { label: 'الملف', href: '/beneficiary/profile', icon: User },
];

function getBottomItems(role: UserRole): BottomNavItem[] {
  switch (role) {
    case 'admin':
      return adminBottomItems;
    case 'subadmin':
      return subadminBottomItems;
    case 'nurse':
      return nurseBottomItems;
    case 'beneficiary':
      return beneficiaryBottomItems;
    default:
      return beneficiaryBottomItems;
  }
}

function getActiveColor(role: UserRole): string {
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

interface BottomNavProps {
  role: UserRole;
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const items = getBottomItems(role);
  const activeColor = getActiveColor(role);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass-strong border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full touch-target"
            >
              <div className="relative">
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute -inset-2 rounded-xl bg-current/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon
                  className={cn(
                    'w-5 h-5 relative z-10 transition-colors',
                    isActive ? activeColor : 'text-muted-foreground'
                  )}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center rounded-full z-20">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] transition-colors',
                  isActive ? activeColor : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
