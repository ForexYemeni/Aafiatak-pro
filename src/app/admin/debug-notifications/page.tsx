'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Shield,
  ShieldCheck,
  ShieldX,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Bug,
  BugOff,
  Speaker,
  Radio,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Circle,
  ClipboardList,
  Settings,
  Cog,
  Download,
  Activity,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { soundManagerV2 } from '@/lib/notifications/sound-manager-v2';
import { notificationLogger, type LogCategory, type LogEntry } from '@/lib/notifications/notification-logger';
import { voiceManager } from '@/lib/notifications/voice-manager';
import { showNotificationToast } from '@/components/common/notification-toast';
import { useAuthStore } from '@/lib/stores/auth-store';

// ============================================================================
// Types
// ============================================================================

interface SystemHealth {
  swStatus: 'registered' | 'active' | 'waiting' | 'none' | 'unsupported';
  notificationPermission: NotificationPermission | 'unsupported';
  pushSubscription: PushSubscription | null;
  socketConnected: boolean;
  audioContextState: AudioContextState | 'unavailable';
  userInteracted: boolean;
}

interface SoundManagerStatus {
  isEnabled: boolean;
  volume: number;
  hasUserInteracted: boolean;
  audioElementsLoaded: string[];
  audioContextState: AudioContextState | 'unavailable';
}

// ============================================================================
// Constants
// ============================================================================

const LOG_CATEGORIES: { value: LogCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'notification', label: 'الإشعارات' },
  { value: 'audio', label: 'الصوت' },
  { value: 'websocket', label: 'السوكت' },
  { value: 'service-worker', label: 'Service Worker' },
  { value: 'permission', label: 'الأذونات' },
];

const SOUND_TESTS = [
  { name: 'notification', label: 'صوت الإشعار', icon: BellRing, color: 'text-teal-600 bg-teal-50 hover:bg-teal-100 border-teal-200' },
  { name: 'emergency', label: 'صوت الطوارئ', icon: AlertTriangle, color: 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200' },
  { name: 'chat', label: 'صوت الدردشة', icon: Speaker, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-200' },
  { name: 'success', label: 'صوت النجاح', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
  { name: 'error', label: 'صوت الخطأ', icon: XCircle, color: 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200' },
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'granted':
    case 'active':
    case 'registered':
    case 'running':
      return 'default';
    case 'denied':
    case 'closed':
    case 'unsupported':
      return 'destructive';
    case 'default':
    case 'waiting':
    case 'suspended':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'granted':
    case 'active':
    case 'registered':
    case 'running':
      return <CheckCircle2 className="size-4 text-emerald-500" />;
    case 'denied':
    case 'closed':
    case 'unsupported':
    case 'none':
      return <XCircle className="size-4 text-red-500" />;
    case 'default':
    case 'waiting':
    case 'suspended':
      return <Circle className="size-4 text-amber-500" />;
    default:
      return <Circle className="size-4 text-gray-400" />;
  }
}

function getLevelColor(level: string): string {
  switch (level) {
    case 'error': return 'text-red-600 bg-red-50';
    case 'warn': return 'text-amber-600 bg-amber-50';
    case 'info': return 'text-teal-600 bg-teal-50';
    case 'debug': return 'text-gray-500 bg-gray-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'notification': return 'text-purple-600 bg-purple-50';
    case 'audio': return 'text-teal-600 bg-teal-50';
    case 'websocket': return 'text-blue-600 bg-blue-50';
    case 'service-worker': return 'text-orange-600 bg-orange-50';
    case 'permission': return 'text-amber-600 bg-amber-50';
    case 'hydration': return 'text-pink-600 bg-pink-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

// ============================================================================
// Main Component
// ============================================================================

export default function DebugNotificationsPage() {
  // ---- State ----
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    swStatus: 'none',
    notificationPermission: 'default',
    pushSubscription: null,
    socketConnected: false,
    audioContextState: 'unavailable',
    userInteracted: false,
  });

  const [soundStatus, setSoundStatus] = useState<SoundManagerStatus>({
    isEnabled: false,
    volume: 0,
    hasUserInteracted: false,
    audioElementsLoaded: [],
    audioContextState: 'unavailable',
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<LogCategory | 'all'>('all');
  const [debugMode, setDebugMode] = useState(false);
  const [pushInfo, setPushInfo] = useState<{ endpoint: string; p256dh: string; auth: string } | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const user = useAuthStore((s) => s.user);
  const logRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- System Health Check ----
  const checkSystemHealth = useCallback(async () => {
    const health: SystemHealth = {
      swStatus: 'none',
      notificationPermission: 'default',
      pushSubscription: null,
      socketConnected: false,
      audioContextState: 'unavailable',
      userInteracted: false,
    };

    // Service Worker Status
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          if (reg.active) {
            health.swStatus = 'active';
          } else if (reg.waiting) {
            health.swStatus = 'waiting';
          } else if (reg.installing) {
            health.swStatus = 'registered';
          } else {
            health.swStatus = 'registered';
          }

          // Push Subscription
          const sub = await reg.pushManager.getSubscription();
          health.pushSubscription = sub;
          if (sub) {
            const jsonSub = sub.toJSON();
            setPushInfo({
              endpoint: sub.endpoint,
              p256dh: jsonSub.keys?.p256dh || 'غير متوفر',
              auth: jsonSub.keys?.auth || 'غير متوفر',
            });
          } else {
            setPushInfo(null);
          }
        } else {
          health.swStatus = 'none';
          setPushInfo(null);
        }
      } catch {
        health.swStatus = 'unsupported';
      }
    } else {
      health.swStatus = 'unsupported';
    }

    // Notification Permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      health.notificationPermission = Notification.permission;
    } else {
      health.notificationPermission = 'unsupported';
    }

    // Socket Connection - check via custom event or window property
    try {
      // @ts-expect-error - checking for socket instance on window
      const socketInstance = window.__aafiatak_socket;
      health.socketConnected = socketInstance?.connected ?? false;
    } catch {
      health.socketConnected = false;
    }

    // Audio Context State
    try {
      const ctx = (soundManagerV2 as unknown as { audioContext?: AudioContext }).audioContext;
      if (ctx) {
        health.audioContextState = ctx.state;
      }
    } catch {
      health.audioContextState = 'unavailable';
    }

    // User Interaction
    health.userInteracted = soundManagerV2.hasUserInteracted();

    setSystemHealth(health);

    // Sound Manager Status
    setSoundStatus({
      isEnabled: soundManagerV2.isEnabled(),
      volume: soundManagerV2.getVolume(),
      hasUserInteracted: soundManagerV2.hasUserInteracted(),
      audioElementsLoaded: ['notification', 'emergency', 'chat', 'success', 'error'],
      audioContextState: health.audioContextState,
    });
  }, []);

  // ---- Log Refresh ----
  const refreshLogs = useCallback(() => {
    const exported = notificationLogger.exportAsObject();
    let entries = exported.entries;
    if (logFilter !== 'all') {
      entries = entries.filter((e) => e.category === logFilter);
    }
    // Last 50
    setLogs(entries.slice(-50).reverse());
  }, [logFilter]);

  // ---- Effects ----
  useEffect(() => {
    checkSystemHealth();
    refreshLogs();

    // Auto-refresh logs every 2 seconds
    logRefreshRef.current = setInterval(refreshLogs, 2000);

    // Auto-refresh health every 5 seconds
    const healthInterval = setInterval(checkSystemHealth, 5000);

    // Check debug mode
    try {
      const flag = localStorage.getItem('aafiatak-debug');
      setDebugMode(flag === 'true');
    } catch {
      setDebugMode(false);
    }

    return () => {
      if (logRefreshRef.current) clearInterval(logRefreshRef.current);
      clearInterval(healthInterval);
    };
  }, [checkSystemHealth, refreshLogs]);

  // ---- Test Handlers ----
  const testSound = (name: string) => {
    soundManagerV2.forceUserInteracted();
    soundManagerV2.play(name, { volume: 1.0, vibrate: true });
    checkSystemHealth();
  };

  const testToast = () => {
    showNotificationToast({
      title: 'إشعار تجريبي',
      description: 'هذا إشعار تجريبي للتحقق من نظام التنبيهات - عافيتك',
      type: 'system',
      priority: 'high',
    });
  };

  const testBrowserNotification = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const n = new Notification('تنبيه تجريبي من عافيتك 🏥', {
      body: 'هذا إشعار تجريبي للتحقق من عمل نظام الإشعارات',
      icon: '/icons/icon-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      silent: false,
      tag: 'debug-test-' + Date.now(),
    });
    soundManagerV2.forceUserInteracted();
    soundManagerV2.playNotification();
    setTimeout(() => n.close(), 5000);
  };

  const testPushNotification = async () => {
    if (!user?.id) return;
    setLoading((prev) => ({ ...prev, push: true }));
    try {
      const res = await fetch('/api/notifications/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userRole: user.role,
          title: 'تنبيه تجريبي من عافيتك',
          body: 'هذا إشعار تجريبي - إذا سمعت الصوت فالنظام يعمل بشكل صحيح!',
          type: 'system',
          priority: 'high',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotificationToast({
          title: 'تم إرسال Push',
          description: `مرسل: ${data.data?.push?.sent || 0} | فاشل: ${data.data?.push?.failed || 0}`,
          type: 'system',
          priority: 'medium',
        });
      }
    } catch (err) {
      showNotificationToast({
        title: 'خطأ في الإرسال',
        description: String(err),
        type: 'system',
        priority: 'high',
      });
    } finally {
      setLoading((prev) => ({ ...prev, push: false }));
    }
  };

  const testTTS = () => {
    voiceManager.init();
    voiceManager.speak('مرحباً، هذا اختبار لنظام النطق في تطبيق عافيتك', {
      rate: 1,
      pitch: 1,
      volume: 1,
      priority: 'high',
    });
  };

  // ---- Permission Handlers ----
  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    notificationLogger.logPermission(result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'dismissed');
    checkSystemHealth();
  };

  const subscribePush = async () => {
    setLoading((prev) => ({ ...prev, subscribe: true }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const res = await fetch('/api/push/vapid-key');
      const data = await res.json();
      if (!data.success || !data.data?.publicKey) return;

      const applicationServerKey = urlBase64ToUint8Array(data.data.publicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const token = useAuthStore.getState().token;
      const subJSON = subscription.toJSON();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: subJSON.keys,
          platform: 'web',
          deviceId: 'debug-page',
        }),
      });

      checkSystemHealth();
    } catch (err) {
      console.error('Push subscription failed:', err);
    } finally {
      setLoading((prev) => ({ ...prev, subscribe: false }));
    }
  };

  // ---- Service Worker Handlers ----
  const registerSW = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      checkSystemHealth();
    } catch (err) {
      console.error('SW registration failed:', err);
    }
  };

  const unregisterSW = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.unregister();
        checkSystemHealth();
      }
    } catch (err) {
      console.error('SW unregistration failed:', err);
    }
  };

  const skipWaiting = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        checkSystemHealth();
      }
    } catch (err) {
      console.error('Skip waiting failed:', err);
    }
  };

  const clearAllCaches = async () => {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      checkSystemHealth();
    } catch (err) {
      console.error('Clear caches failed:', err);
    }
  };

  // ---- Debug Mode ----
  const toggleDebugMode = (enabled: boolean) => {
    setDebugMode(enabled);
    if (enabled) {
      notificationLogger.enableDebug();
    } else {
      notificationLogger.disableDebug();
    }
  };

  const exportLogs = () => {
    const json = notificationLogger.exportAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aafiatak-debug-logs-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    notificationLogger.clear();
    refreshLogs();
  };

  // ---- Render ----
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-teal-500 to-purple-600 rounded-xl text-white">
                <Bug className="size-6" />
              </div>
              تشخيص نظام الإشعارات
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              صفحة تشخيص متقدمة لنظام الإشعارات والتنبيهات - عافيتك
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { checkSystemHealth(); refreshLogs(); }}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            تحديث
          </Button>
        </div>

        {/* ===== 1. System Health Status ===== */}
        <Card className="border-teal-200 bg-gradient-to-br from-teal-50/50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-teal-800">
              <Activity className="size-5" />
              حالة النظام
            </CardTitle>
            <CardDescription>الحالة الحالية لجميع مكونات نظام الإشعارات</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {/* SW Status */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                {getStatusIcon(systemHealth.swStatus)}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">Service Worker</div>
                  <Badge variant={getStatusBadgeVariant(systemHealth.swStatus)} className="text-xs">
                    {systemHealth.swStatus === 'active' ? 'نشط' :
                     systemHealth.swStatus === 'waiting' ? 'بانتظار التفعيل' :
                     systemHealth.swStatus === 'registered' ? 'مسجل' :
                     systemHealth.swStatus === 'none' ? 'غير مسجل' :
                     systemHealth.swStatus === 'unsupported' ? 'غير مدعوم' : systemHealth.swStatus}
                  </Badge>
                </div>
              </div>

              {/* Notification Permission */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                {getStatusIcon(systemHealth.notificationPermission)}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">إذن الإشعارات</div>
                  <Badge variant={getStatusBadgeVariant(systemHealth.notificationPermission)} className="text-xs">
                    {systemHealth.notificationPermission === 'granted' ? 'مسموح ✅' :
                     systemHealth.notificationPermission === 'denied' ? 'مرفوض ❌' :
                     systemHealth.notificationPermission === 'default' ? 'لم يُطلب ⚠️' :
                     'غير مدعوم'}
                  </Badge>
                </div>
              </div>

              {/* Push Subscription */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                {systemHealth.pushSubscription ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <XCircle className="size-4 text-red-500" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">اشتراك Push</div>
                  <Badge variant={systemHealth.pushSubscription ? 'default' : 'destructive'} className="text-xs">
                    {systemHealth.pushSubscription ? 'مشترك ✅' : 'غير مشترك ❌'}
                  </Badge>
                </div>
              </div>

              {/* Socket Connection */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                {systemHealth.socketConnected ? (
                  <Wifi className="size-4 text-emerald-500" />
                ) : (
                  <WifiOff className="size-4 text-red-500" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">اتصال السوكت</div>
                  <Badge variant={systemHealth.socketConnected ? 'default' : 'destructive'} className="text-xs">
                    {systemHealth.socketConnected ? 'متصل ✅' : 'غير متصل ❌'}
                  </Badge>
                </div>
              </div>

              {/* Audio Context State */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                {getStatusIcon(systemHealth.audioContextState)}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">Audio Context</div>
                  <Badge variant={getStatusBadgeVariant(systemHealth.audioContextState)} className="text-xs">
                    {systemHealth.audioContextState === 'running' ? 'يعمل' :
                     systemHealth.audioContextState === 'suspended' ? 'معلق' :
                     systemHealth.audioContextState === 'closed' ? 'مغلق' :
                     'غير متوفر'}
                  </Badge>
                </div>
              </div>

              {/* User Interaction */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                {systemHealth.userInteracted ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <Circle className="size-4 text-amber-500" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">تفاعل المستخدم</div>
                  <Badge variant={systemHealth.userInteracted ? 'default' : 'secondary'} className="text-xs">
                    {systemHealth.userInteracted ? 'تم التفاعل ✅' : 'لم يتفاعل ⚠️'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== 2. Test Buttons ===== */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Zap className="size-5" />
              اختبار التنبيهات
            </CardTitle>
            <CardDescription>اختبار مكونات نظام الإشعارات والتنبيهات بشكل فردي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sound Tests */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Volume2 className="size-4 text-purple-600" />
                اختبار الأصوات
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {SOUND_TESTS.map((sound) => (
                  <Button
                    key={sound.name}
                    variant="outline"
                    onClick={() => testSound(sound.name)}
                    className={`${sound.color} border font-medium h-auto py-3 flex flex-col gap-1`}
                  >
                    <sound.icon className="size-5" />
                    <span className="text-xs">{sound.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Other Tests */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Bell className="size-4 text-purple-600" />
                اختبار الإشعارات
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={testToast}
                  className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 gap-2 justify-start"
                >
                  <Bell className="size-4" />
                  اختبار إشعار Toast
                </Button>

                <Button
                  variant="outline"
                  onClick={testBrowserNotification}
                  disabled={systemHealth.notificationPermission !== 'granted'}
                  className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 gap-2 justify-start"
                >
                  <BellRing className="size-4" />
                  اختبار إشعار المتصفح
                </Button>

                <Button
                  variant="outline"
                  onClick={testPushNotification}
                  disabled={loading.push || !user?.id}
                  className="bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 gap-2 justify-start"
                >
                  {loading.push ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Radio className="size-4" />
                  )}
                  اختبار Push Notification
                </Button>

                <Button
                  variant="outline"
                  onClick={testTTS}
                  className="bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 gap-2 justify-start"
                >
                  <Speaker className="size-4" />
                  اختبار النطق الصوتي (TTS)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== 3. Sound Manager Status ===== */}
        <Card className="border-teal-200 bg-gradient-to-br from-teal-50/50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-teal-800">
              <Volume2 className="size-5" />
              حالة مدير الصوت
            </CardTitle>
            <CardDescription>معلومات تفصيلية عن حالة نظام الصوت Sound Manager V2</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Is Enabled */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2">
                  {soundStatus.isEnabled ? (
                    <Volume2 className="size-5 text-teal-600" />
                  ) : (
                    <VolumeX className="size-5 text-red-500" />
                  )}
                  <span className="text-sm font-medium">الصوت مفعّل</span>
                </div>
                <Switch
                  checked={soundStatus.isEnabled}
                  onCheckedChange={(checked) => {
                    soundManagerV2.setEnabled(checked);
                    checkSystemHealth();
                  }}
                />
              </div>

              {/* Volume */}
              <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="size-5 text-purple-600" />
                    <span className="text-sm font-medium">مستوى الصوت</span>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {Math.round(soundStatus.volume * 100)}%
                  </Badge>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(soundStatus.volume * 100)}
                  onChange={(e) => {
                    soundManagerV2.setVolume(Number(e.target.value) / 100);
                    checkSystemHealth();
                  }}
                  className="w-full mt-2 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  dir="ltr"
                />
              </div>

              {/* User Interacted */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                {soundStatus.hasUserInteracted ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="size-5 text-amber-500" />
                )}
                <div>
                  <div className="text-sm font-medium">تفاعل المستخدم مع الصوت</div>
                  <div className="text-xs text-gray-500">
                    {soundStatus.hasUserInteracted ? 'تم التفاعل - يمكن تشغيل الأصوات' : 'لم يتفاعل بعد - الأصوات قد لا تعمل'}
                  </div>
                </div>
              </div>

              {/* Audio Context State */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                {getStatusIcon(soundStatus.audioContextState)}
                <div>
                  <div className="text-sm font-medium">حالة Audio Context</div>
                  <Badge variant={getStatusBadgeVariant(soundStatus.audioContextState)} className="text-xs mt-1">
                    {soundStatus.audioContextState === 'running' ? 'يعمل ✅' :
                     soundStatus.audioContextState === 'suspended' ? 'معلق ⚠️' :
                     soundStatus.audioContextState === 'closed' ? 'مغلق ❌' :
                     'غير متوفر'}
                  </Badge>
                </div>
              </div>

              {/* Audio Elements Loaded */}
              <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm sm:col-span-2">
                <div className="text-sm font-medium mb-2">الملفات الصوتية المحملة</div>
                <div className="flex flex-wrap gap-2">
                  {soundStatus.audioElementsLoaded.map((name) => (
                    <Badge key={name} variant="secondary" className="text-xs gap-1">
                      <Volume2 className="size-3" />
                      {name}.mp3
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Force Interaction Button */}
            {!soundStatus.hasUserInteracted && (
              <Button
                onClick={() => {
                  soundManagerV2.forceUserInteracted();
                  checkSystemHealth();
                }}
                className="mt-4 w-full bg-gradient-to-l from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 gap-2"
              >
                <Zap className="size-4" />
                تفعيل الصوت يدوياً (Force Interaction)
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ===== 4. Notification Log Section ===== */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-purple-800">
                  <ClipboardList className="size-5" />
                  سجل الإشعارات
                </CardTitle>
                <CardDescription>آخر 50 سجل من نظام الإشعارات (تحديث تلقائي كل 2 ثانية)</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportLogs} className="gap-1">
                  <Download className="size-3.5" />
                  تصدير
                </Button>
                <Button variant="outline" size="sm" onClick={clearLogs} className="gap-1 text-red-600 hover:text-red-700">
                  <Trash2 className="size-3.5" />
                  مسح
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              {LOG_CATEGORIES.map((cat) => (
                <Button
                  key={cat.value}
                  variant={logFilter === cat.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLogFilter(cat.value)}
                  className={logFilter === cat.value ? 'bg-purple-600 hover:bg-purple-700' : ''}
                >
                  {cat.label}
                </Button>
              ))}
            </div>

            {/* Log Entries */}
            <ScrollArea className="h-96 rounded-xl border border-gray-200 bg-white">
              <div className="p-2 space-y-1">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <ClipboardList className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">لا توجد سجلات</p>
                  </div>
                ) : (
                  logs.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 text-xs font-mono border border-transparent hover:border-gray-100 transition-colors"
                    >
                      {/* Timestamp */}
                      <span className="text-gray-400 whitespace-nowrap shrink-0" dir="ltr">
                        {new Date(entry.timestamp).toLocaleTimeString('ar-SA', { hour12: false })}
                      </span>

                      {/* Level Badge */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 shrink-0 ${getLevelColor(entry.level)}`}
                      >
                        {entry.level.toUpperCase()}
                      </Badge>

                      {/* Category Badge */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 shrink-0 ${getCategoryColor(entry.category)}`}
                      >
                        {entry.category === 'notification' ? 'إشعار' :
                         entry.category === 'audio' ? 'صوت' :
                         entry.category === 'websocket' ? 'سوكت' :
                         entry.category === 'service-worker' ? 'SW' :
                         entry.category === 'permission' ? 'إذن' :
                         entry.category === 'hydration' ? 'hydration' : entry.category}
                      </Badge>

                      {/* Message */}
                      <span className="text-gray-700 truncate flex-1" title={entry.message}>
                        {entry.message}
                      </span>

                      {/* Data */}
                      {entry.data && Object.keys(entry.data).length > 0 && (
                        <span
                          className="text-gray-400 shrink-0 cursor-pointer hover:text-gray-600"
                          title={JSON.stringify(entry.data, null, 2)}
                          dir="ltr"
                        >
                          📋
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
              <span>إجمالي السجلات: {notificationLogger.getSize()}</span>
              <span>تحديث تلقائي كل 2 ثانية</span>
            </div>
          </CardContent>
        </Card>

        {/* ===== 5. Permission Management ===== */}
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Shield className="size-5" />
              إدارة الأذونات
            </CardTitle>
            <CardDescription>إدارة أذونات الإشعارات واشتراكات Push</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Permission */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                {systemHealth.notificationPermission === 'granted' ? (
                  <ShieldCheck className="size-6 text-emerald-500" />
                ) : systemHealth.notificationPermission === 'denied' ? (
                  <ShieldX className="size-6 text-red-500" />
                ) : (
                  <Shield className="size-6 text-amber-500" />
                )}
                <div>
                  <div className="text-sm font-medium">إذن الإشعارات الحالي</div>
                  <div className="text-xs text-gray-500">
                    {systemHealth.notificationPermission === 'granted' ? 'مسموح - يمكن إرسال إشعارات' :
                     systemHealth.notificationPermission === 'denied' ? 'مرفوض - لا يمكن إرسال إشعارات' :
                     'لم يتم الطلب بعد'}
                  </div>
                </div>
              </div>
              {systemHealth.notificationPermission !== 'granted' && (
                <Button
                  onClick={requestPermission}
                  disabled={systemHealth.notificationPermission === 'denied'}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 gap-1"
                >
                  <Shield className="size-3.5" />
                  طلب الإذن
                </Button>
              )}
            </div>

            {/* Push Subscription Info */}
            <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700">معلومات اشتراك Push</h4>
                {systemHealth.pushSubscription ? (
                  <Badge variant="default" className="bg-emerald-600 text-xs">مشترك</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">غير مشترك</Badge>
                )}
              </div>

              {pushInfo ? (
                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-gray-500">Endpoint:</span>
                    <div className="bg-gray-50 p-2 rounded-lg mt-1 break-all text-gray-700" dir="ltr">
                      {pushInfo.endpoint}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-500">p256dh:</span>
                      <div className="bg-gray-50 p-2 rounded-lg mt-1 break-all text-gray-700" dir="ltr">
                        {pushInfo.p256dh.slice(0, 30)}...
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">auth:</span>
                      <div className="bg-gray-50 p-2 rounded-lg mt-1 break-all text-gray-700" dir="ltr">
                        {pushInfo.auth.slice(0, 30)}...
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <Radio className="size-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">لا يوجد اشتراك Push</p>
                </div>
              )}

              {!systemHealth.pushSubscription && systemHealth.notificationPermission === 'granted' && (
                <Button
                  onClick={subscribePush}
                  disabled={loading.subscribe}
                  className="mt-3 w-full bg-gradient-to-l from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 gap-2"
                >
                  {loading.subscribe ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Radio className="size-4" />
                  )}
                  الاشتراك في Push
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ===== 6. Service Worker Controls ===== */}
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50/50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Cog className="size-5" />
              أدوات Service Worker
            </CardTitle>
            <CardDescription>إدارة وتحكم Service Worker وذاكرة التخزين المؤقت</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button
                variant="outline"
                onClick={registerSW}
                className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-2"
              >
                <CheckCircle2 className="size-4" />
                تسجيل SW
              </Button>
              <Button
                variant="outline"
                onClick={unregisterSW}
                className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 gap-2"
              >
                <XCircle className="size-4" />
                إلغاء تسجيل
              </Button>
              <Button
                variant="outline"
                onClick={skipWaiting}
                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 gap-2"
              >
                <Play className="size-4" />
                Skip Waiting
              </Button>
              <Button
                variant="outline"
                onClick={clearAllCaches}
                className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 gap-2"
              >
                <Trash2 className="size-4" />
                مسح الكاش
              </Button>
            </div>

            {/* SW Status Info */}
            <div className="mt-4 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">حالة Service Worker:</span>
                <Badge variant={getStatusBadgeVariant(systemHealth.swStatus)}>
                  {systemHealth.swStatus === 'active' ? 'نشط ويعمل' :
                   systemHealth.swStatus === 'waiting' ? 'بانتظار التفعيل (يحتاج Skip Waiting)' :
                   systemHealth.swStatus === 'registered' ? 'مسجل ولكن غير مفعل' :
                   systemHealth.swStatus === 'none' ? 'لم يتم التسجيل' :
                   'غير مدعوم في هذا المتصفح'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== 7. Debug Mode Toggle ===== */}
        <Card className="border-pink-200 bg-gradient-to-br from-pink-50/50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-pink-800">
              {debugMode ? <Bug className="size-5" /> : <BugOff className="size-5" />}
              وضع التصحيح
            </CardTitle>
            <CardDescription>تفعيل وضع التصحيح لعرض سجلات مفصلة في وحدة التحكم</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${debugMode ? 'bg-pink-100' : 'bg-gray-100'}`}>
                  {debugMode ? (
                    <Bug className="size-5 text-pink-600" />
                  ) : (
                    <BugOff className="size-5 text-gray-400" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium">
                    وضع التصحيح (Debug Mode)
                  </div>
                  <div className="text-xs text-gray-500">
                    {debugMode
                      ? 'مفعّل - يتم طباعة السجلات في وحدة التحكم'
                      : 'معطّل - السجلات تُحفظ فقط في الذاكرة'}
                  </div>
                </div>
              </div>
              <Switch
                checked={debugMode}
                onCheckedChange={toggleDebugMode}
              />
            </div>

            {debugMode && (
              <div className="mt-3 p-3 rounded-xl bg-pink-50 border border-pink-200 text-xs text-pink-700">
                <strong>ملاحظة:</strong> وضع التصحيح مفعّل. هذا يزيد من مخرجات وحدة التحكم.
                يمكنك أيضاً تفعيله من وحدة التحكم عبر:
                <code className="block mt-1 p-2 bg-white rounded-lg font-mono text-pink-800" dir="ltr">
                  localStorage.setItem('aafiatak-debug', 'true')
                </code>
              </div>
            )}

            <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600">
              <strong>مفتاح التصحيح:</strong>{' '}
              <code className="font-mono bg-white px-1 rounded" dir="ltr">aafiatak-debug</code>
              <span className="mx-1">|</span>
              <strong>الحالة الحالية:</strong>{' '}
              <Badge variant={debugMode ? 'default' : 'secondary'} className="text-[10px]">
                {debugMode ? 'مفعّل' : 'معطّل'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ===== User Info (for debugging) ===== */}
        <Card className="border-gray-200 bg-gray-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <Settings className="size-4" />
              <span>المستخدم: {user?.name || 'غير مسجل الدخول'}</span>
              <span>|</span>
              <span>الدور: {user?.role || '-'}</span>
              <span>|</span>
              <span>المعرف: {user?.id || '-'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
