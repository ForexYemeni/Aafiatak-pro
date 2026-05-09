'use client';

import { useState, useEffect } from 'react';
import { soundManager } from '@/lib/notifications/sound-manager';

export default function TestNotificationsPage() {
  const [permission, setPermission] = useState<string>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState<'nurse' | 'beneficiary'>('nurse');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
    // Check if subscribed
    navigator.serviceWorker?.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    }).catch(() => {});
  }, []);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const subscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      // Get VAPID key
      const res = await fetch('/api/push/vapid-key');
      const data = await res.json();
      if (!data.success || !data.data?.publicKey) {
        setResult('خطأ: لم يتم العثور على مفتاح VAPID');
        return;
      }

      const publicKey = data.data.publicKey;
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Send subscription to server
      const token = localStorage.getItem('token');
      const subJSON = subscription.toJSON();
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: subJSON.keys,
          platform: 'web',
          deviceId: 'test-device',
        }),
      });

      const saveData = await saveRes.json();
      if (saveData.success) {
        setIsSubscribed(true);
        setResult('تم الاشتراك بنجاح في الإشعارات!');
      } else {
        setResult('خطأ في تسجيل الاشتراك: ' + (saveData.message || ''));
      }
    } catch (error: any) {
      setResult('خطأ: ' + error.message);
    }
  };

  const testSound = (name: string) => {
    soundManager.forceUserInteracted();
    soundManager.play(name, { volume: 1.0, vibrate: true });
    setResult(`تم تشغيل صوت: ${name}`);
  };

  const testBrowserNotification = () => {
    if (permission !== 'granted') {
      setResult('يجب السماح بالإشعارات أولاً');
      return;
    }
    const n = new Notification('تنبيه تجريبي من عافيتك', {
      body: 'هذا إشعار تجريبي للتحقق من عمل الصوت',
      icon: '/icons/icon-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      silent: false,
      tag: 'test-' + Date.now(),
    });
    // Play sound too
    soundManager.forceUserInteracted();
    soundManager.playNotification();
    setResult('تم إرسال إشعار المتصفح مع الصوت');
    setTimeout(() => n.close(), 5000);
  };

  const sendPushToUser = async () => {
    if (!userId.trim()) {
      setResult('أدخل معرف المستخدم');
      return;
    }
    setSendingTo(userId);
    setResult('جاري الإرسال...');

    try {
      const res = await fetch('/api/notifications/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.trim(),
          userRole,
          title: 'تنبيه تجريبي من عافيتك',
          body: 'هذا إشعار تجريبي - إذا سمعت الصوت فالنظام يعمل بشكل صحيح!',
          type: 'system',
          priority: 'high',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(`تم الإرسال بنجاح! Push: ${data.data?.push?.sent || 0} مرسل، ${data.data?.push?.failed || 0} فاشل`);
      } else {
        setResult('خطأ: ' + (data.message || data.error || ''));
      }
    } catch (error: any) {
      setResult('خطأ في الاتصال: ' + error.message);
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🔔 اختبار التنبيهات الصوتية
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            هذه الصفحة لاختبار نظام التنبيهات الصوتية والتأكد من عمله بشكل صحيح
          </p>

          {/* Status */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className={`p-3 rounded-xl text-center ${permission === 'granted' ? 'bg-green-50 text-green-700' : permission === 'denied' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
              <div className="text-xs mb-1">إذن الإشعارات</div>
              <div className="font-bold">{permission === 'granted' ? 'مسموح ✅' : permission === 'denied' ? 'مرفوض ❌' : 'لم يُطلب ⚠️'}</div>
            </div>
            <div className={`p-3 rounded-xl text-center ${isSubscribed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <div className="text-xs mb-1">اشتراك Push</div>
              <div className="font-bold">{isSubscribed ? 'مشترك ✅' : 'غير مشترك ❌'}</div>
            </div>
          </div>

          {/* Permission & Subscribe */}
          <div className="flex gap-2 mb-6">
            {permission !== 'granted' && (
              <button
                onClick={requestPermission}
                className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-purple-700 transition"
              >
                السماح بالإشعارات
              </button>
            )}
            {!isSubscribed && permission === 'granted' && (
              <button
                onClick={subscribe}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 transition"
              >
                الاشتراك في Push
              </button>
            )}
          </div>

          {/* Sound Tests */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">🔊 اختبار الأصوات</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => testSound('notification')} className="bg-blue-50 text-blue-700 py-3 px-4 rounded-xl font-medium hover:bg-blue-100 transition border border-blue-200">
                🔔 إشعار عادي
              </button>
              <button onClick={() => testSound('emergency')} className="bg-red-50 text-red-700 py-3 px-4 rounded-xl font-medium hover:bg-red-100 transition border border-red-200">
                🚨 طوارئ
              </button>
              <button onClick={() => testSound('chat')} className="bg-green-50 text-green-700 py-3 px-4 rounded-xl font-medium hover:bg-green-100 transition border border-green-200">
                💬 رسالة
              </button>
              <button onClick={() => testSound('success')} className="bg-emerald-50 text-emerald-700 py-3 px-4 rounded-xl font-medium hover:bg-emerald-100 transition border border-emerald-200">
                ✅ نجاح
              </button>
              <button onClick={() => testSound('error')} className="bg-orange-50 text-orange-700 py-3 px-4 rounded-xl font-medium hover:bg-orange-100 transition border border-orange-200">
                ❌ خطأ
              </button>
              <button onClick={testBrowserNotification} className="bg-purple-50 text-purple-700 py-3 px-4 rounded-xl font-medium hover:bg-purple-100 transition border border-purple-200">
                🖥️ إشعار متصفح + صوت
              </button>
            </div>
          </div>

          {/* Push Test */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">📤 إرسال Push تجريبي</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">معرف المستخدم (User ID)</label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="أدخل معرف المستخدم"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">نوع المستخدم</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUserRole('nurse')}
                    className={`flex-1 py-2 rounded-xl font-medium transition ${userRole === 'nurse' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    ممرض
                  </button>
                  <button
                    onClick={() => setUserRole('beneficiary')}
                    className={`flex-1 py-2 rounded-xl font-medium transition ${userRole === 'beneficiary' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    مستفيد
                  </button>
                </div>
              </div>
              <button
                onClick={sendPushToUser}
                disabled={!!sendingTo}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {sendingTo ? 'جاري الإرسال...' : 'إرسال تنبيه تجريبي'}
              </button>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="bg-gray-50 border rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
              {result}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
