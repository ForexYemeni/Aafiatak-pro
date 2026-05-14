'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ClipboardList,
  Stethoscope,
  AlertTriangle,
  User,
  MoreHorizontal,
  MessageCircle,
  Wallet,
  Bell,
  Heart,
  Star,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface BottomNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  isEmergency?: boolean;
}

const adminBottomItems: BottomNavItem[] = [
  { label: 'الرئيسية', href: '/admin', icon: Home },
  { label: 'الطلبات', href: '/admin/orders', icon: ClipboardList },
  { label: 'التكليفات', href: '/admin/deployments', icon: Briefcase },
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
  { label: 'التكليفات', href: '/nurse/deployments', icon: Briefcase },
  { label: 'الأرباح', href: '/nurse/earnings', icon: Wallet },
  { label: 'الإشعارات', href: '/nurse/notifications', icon: Bell },
  { label: 'المزيد', href: '/nurse/profile', icon: MoreHorizontal },
];

const beneficiaryBottomItems: BottomNavItem[] = [
  { label: 'الرئيسية', href: '/beneficiary', icon: Home },
  { label: 'طلباتي', href: '/beneficiary/orders', icon: ClipboardList },
  { label: 'طوارئ', href: '/beneficiary/emergency', icon: AlertTriangle, isEmergency: true },
  { label: 'المحادثة', href: '/beneficiary/chat', icon: MessageCircle },
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

function getActivePillColor(role: UserRole): string {
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

interface BottomNavProps {
  role: UserRole;
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const items = getBottomItems(role);
  const activeColor = getActiveColor(role);
  const activePillColor = getActivePillColor(role);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 safe-bottom" style={{ willChange: 'transform' }}>
      {/* Blur backdrop */}
      <div className="absolute inset-0 glass-strong border-t border-border" />

      <div className="relative flex items-end justify-around h-[68px] px-1">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/beneficiary' && item.href !== '/admin' && item.href !== '/nurse' && pathname.startsWith(item.href + '/'));
          const isExactActive = pathname === item.href;
          const finalActive = item.href === '/beneficiary' || item.href === '/admin' || item.href === '/nurse'
            ? isExactActive
            : isActive;
          const Icon = item.icon;

          if (item.isEmergency) {
            const isEmergencyActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className="relative flex flex-col items-center justify-end pb-2 -mt-5 w-16"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div
                  className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-90',
                    isEmergencyActive
                      ? 'bg-red-600 shadow-red-500/40 shadow-xl scale-105'
                      : 'bg-red-500 shadow-red-400/30 hover:bg-red-600'
                  )}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className={cn(
                  'text-[10px] font-medium mt-1 transition-colors duration-200',
                  isEmergencyActive ? 'text-red-500' : 'text-muted-foreground'
                )}>
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full touch-target group"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {/* Active pill indicator at top */}
              <div
                className={cn(
                  'absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-b-full transition-all duration-300',
                  finalActive ? cn('w-8', activePillColor) : 'w-0 bg-transparent'
                )}
              />

              {/* Icon with background */}
              <div className="relative">
                <div
                  className={cn(
                    'absolute -inset-2 rounded-xl transition-all duration-200',
                    finalActive ? 'opacity-100' : 'opacity-0 group-active:opacity-100'
                  )}
                  style={{
                    background: finalActive ? 'currentColor' : undefined,
                    opacity: finalActive ? 0.12 : 0,
                  }}
                />
                <Icon
                  className={cn(
                    'w-5 h-5 relative z-10 transition-all duration-200',
                    finalActive ? cn(activeColor, 'scale-110') : 'text-muted-foreground group-active:scale-95'
                  )}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center rounded-full z-20 font-bold">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  'text-[10px] font-medium transition-all duration-200',
                  finalActive ? cn(activeColor, 'font-semibold') : 'text-muted-foreground'
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
