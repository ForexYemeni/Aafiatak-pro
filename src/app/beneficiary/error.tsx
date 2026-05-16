'use client';

  import { useEffect } from 'react';
  import { RefreshCw, Home, AlertTriangle } from 'lucide-react';

  export default function BeneficiaryError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useEffect(() => {
      // Send error to server-side log (avoids console.error in production)
      fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          digest: error.digest,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          component: 'BeneficiaryError',
          url: typeof window !== 'undefined' ? window.location.href : '',
        }),
      }).catch(() => { /* ignore — we never want the error reporter to crash the UI */ });
    }, [error]);

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6" dir="rtl">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">حدث خطأ في حسابك</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            {typeof error.message === 'string' ? error.message : 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة المحاولة
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors"
            >
              <Home className="w-4 h-4" />
              الصفحة الرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }
  