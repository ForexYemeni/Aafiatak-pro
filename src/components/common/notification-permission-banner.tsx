'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * Notification Permission Banner
 * Shows a prominent banner asking the user to enable notifications.
 * Disappears after permission is granted or user dismisses it.
 * Persists dismissal in localStorage so it doesn't reappear every session.
 */
export function NotificationPermissionBanner() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showBanner, setShowBanner] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  // FIX: Use state for isDenied to avoid accessing Notification.permission during render
  // which causes hydration mismatch (server: false, client: true when denied)
  const [isDenied, setIsDenied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsDenied(Notification.permission === 'denied');
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;

    // Check if user already dismissed the banner
    const dismissed = localStorage.getItem('aafiatak-notif-banner-dismissed');
    if (dismissed) return;

    // Show banner if permission is not granted
    if (Notification.permission === 'default' || Notification.permission === 'denied') {
      // Delay showing to avoid appearing on first load
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setShowBanner(false);
          setIsDenied(false);
          // Trigger a test notification to confirm it works
          setTimeout(() => {
            new Notification('عافيتك - تم تفعيل الإشعارات ✓', {
              body: 'ستصلك الإشعارات الآن حتى عندما يكون التطبيق مغلقاً',
              icon: '/icons/icon-192x192.png',
              dir: 'rtl',
              lang: 'ar',
            });
          }, 500);
        }
      } else if (Notification.permission === 'denied') {
        // Permission denied — guide user to browser settings
        // Can't re-request permission programmatically, must guide manually
        alert('تم حظر الإشعارات مسبقاً. يرجى تفعيلها من إعدادات المتصفح:\n\n1. انقر على أيقونة القفل بجانب عنوان الموقع\n2. ابحث عن "الإشعارات"\n3. غيّر الإعداد إلى "السماح"');
      }
    } catch (err) {
      console.error('[NOTIF-BANNER] Error requesting permission:', err);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('aafiatak-notif-banner-dismissed', 'true');
  };

  // All hooks are above this line — early returns are safe here
  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-slide-down">
      <div className="bg-gradient-to-l from-blue-600 to-blue-700 text-white px-4 py-3 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              {isDenied ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5 animate-bell-ring" />}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm">
                {isDenied ? 'الإشعارات محظورة' : 'فعّل الإشعارات الفورية'}
              </p>
              <p className="text-xs text-white/80 truncate">
                {isDenied
                  ? 'لن تصل الإشعارات. يرجى تفعيلها من إعدادات المتصفح'
                  : 'لتصلك إشعارات الطلبات والتنبيهات حتى عند إغلاق التطبيق'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleEnable}
              disabled={isRequesting}
              className="px-4 py-1.5 bg-white text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {isRequesting ? 'جاري التفعيل...' : isDenied ? 'كيف أفعلها؟' : 'تفعيل'}
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
