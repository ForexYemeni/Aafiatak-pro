'use client';

import { useState, useEffect } from 'react';
import { GlassCard } from '@/components/common/glass-card';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';

export default function PrivacyPage() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPrivacy = async () => {
      try {
        const res = await fetch('/api/settings/legal');
        const data = await res.json();
        if (data.success && data.data?.privacyPolicyAr) {
          setContent(data.data.privacyPolicyAr);
        } else {
          setContent('لم يتم إضافة سياسة خصوصية بعد. يرجى العودة لاحقاً.');
        }
      } catch {
        setContent('حدث خطأ في تحميل سياسة الخصوصية.');
      } finally {
        setIsLoading(false);
      }
    };
    void fetchPrivacy();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="سياسة الخصوصية" />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="سياسة الخصوصية" />
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
