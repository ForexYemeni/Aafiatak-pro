'use client';

import { useEffect } from 'react';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RootError]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6" dir="rtl">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">حدث خطأ غير متوقع</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          {typeof error.message === 'string' ? error.message : 'يرجى المحاولة مرة أخرى أو العودة للصفحة الرئيسية.'}
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
