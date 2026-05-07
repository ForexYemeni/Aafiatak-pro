'use client';

import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/common/glass-card';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';

export default function TermsPage() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await fetch('/api/settings/legal');
        const data = await res.json();
        if (data.success && data.data?.termsAndConditionsAr) {
          setContent(data.data.termsAndConditionsAr);
        } else {
          setContent('لم يتم إضافة شروط وأحكام بعد. يرجى العودة لاحقاً.');
        }
      } catch {
        setContent('حدث خطأ في تحميل الشروط والأحكام.');
      } finally {
        setIsLoading(false);
      }
    };
    void fetchTerms();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="شروط والأحكام" />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="شروط والأحكام" />
      <GlassCard variant="nurse" className="p-6">
        {content.includes('<') ? (
          <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
        )}
      </GlassCard>
    </div>
  );
}
