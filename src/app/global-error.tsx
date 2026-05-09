'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Trash2, AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log the error for debugging
    console.error('[GlobalError]', error);
  }, [error]);

  const handleClearCache = () => {
    try {
      // Clear all app storage
      localStorage.removeItem('aafiatak-auth-storage');
      localStorage.removeItem('aafiatak-notification-storage');
      localStorage.removeItem('aafiatak-theme');
      localStorage.removeItem('aafiatak-device-id');
      
      // Clear service worker caches
      if ('caches' in window) {
        caches.keys().then((names) => {
          for (const name of names) {
            caches.delete(name);
          }
        });
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    } catch {
      // Ignore errors
    }

    // Reload the page
    window.location.reload();
  };

  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #e0e7ff 100%)',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {/* Error Icon */}
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: '0 10px 30px rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertTriangle style={{ width: '40px', height: '40px', color: 'white' }} />
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#1f2937',
                marginBottom: '12px',
              }}
            >
              حدث خطأ غير متوقع
            </h1>

            {/* Description */}
            <p
              style={{
                fontSize: '16px',
                color: '#6b7280',
                marginBottom: '32px',
                lineHeight: 1.6,
              }}
            >
              نعتذر عن هذا الخطأ. يمكنك محاولة إعادة التحميل أو مسح بيانات التطبيق المخزنة.
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => reset()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
              >
                <RefreshCw style={{ width: '18px', height: '18px' }} />
                إعادة المحاولة
              </button>

              <button
                onClick={handleClearCache}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  background: 'white',
                  color: '#6b7280',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, border-color 0.2s',
                }}
              >
                <Trash2 style={{ width: '18px', height: '18px' }} />
                مسح البيانات وإعادة التحميل
              </button>

              <button
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '8px',
                }}
              >
                {showDetails ? 'إخفاء التفاصيل' : 'عرض تفاصيل الخطأ'}
              </button>
            </div>

            {/* Error Details (collapsible) */}
            {showDetails && (
              <div
                style={{
                  marginTop: '24px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  textAlign: 'left',
                  direction: 'ltr',
                  overflow: 'auto',
                  maxHeight: '200px',
                }}
              >
                <code
                  style={{
                    fontSize: '12px',
                    color: '#ef4444',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {error?.message || 'Unknown error'}
                  {error?.digest && `\n\nDigest: ${error.digest}`}
                  {error?.stack && `\n\n${error.stack}`}
                </code>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
