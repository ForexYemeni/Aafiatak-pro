'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  HelpCircle,
  Phone,
  MessageCircle,
  FileText,
  Shield,
  Info,
  ChevronDown,
  Loader2,
  Sparkles,
  LifeBuoy,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/common/glass-card';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';

// ---- FAQ Data ----

const faqItems = [
  {
    id: 'faq-1',
    question: 'كيف أبدأ في استقبال الطلبات؟',
    answer: 'بعد التسجيل والتحقق من حسابك عبر رفع الهوية الوطنية ومزاولة المهنة، قم بتفعيل حالة التوفر من خلال زر التبديل في صفحة الملف الشخصي. عندما تكون متاحاً، سيتمكن النظام من تعيين طلبات لك.',
  },
  {
    id: 'faq-2',
    question: 'كيف يتم احتساب الأرباح؟',
    answer: 'يتم احتساب أرباحك بناءً على سعر الخدمة مطروحاً منه عمولة المنصة. قد تُضاف رسوم إضافية للخدمات الليلية أو خدمات الجمعة أو حالات الطوارئ.',
  },
  {
    id: 'faq-3',
    question: 'كيف أسحب أرباحي؟',
    answer: 'يمكنك طلب سحب أرباحك من صفحة الأرباح. سيتم تحويل المبلغ إلى حسابك البنكي أو محفظتك الإلكترونية خلال ٢-٥ أيام عمل.',
  },
  {
    id: 'faq-4',
    question: 'ماذا يحدث عند رفض طلب؟',
    answer: 'يمكنك رفض أي طلب غير مناسب، لكن معدل القبول يؤثر على ترتيبك في النظام. سيتم إعادة تعيين الطلب لممرض/ـة آخر.',
  },
  {
    id: 'faq-5',
    question: 'كيف أرفع مستوى تقييمي؟',
    answer: 'يمكنك تحسين تقييمك من خلال الالتزام بالمواعيد، تقديم خدمة عالية الجودة، والتواصل الجيد مع المستفيدين.',
  },
  {
    id: 'faq-6',
    question: 'كيف أتعامل مع حالات الطوارئ؟',
    answer: 'حالات الطوارئ لها أولوية قصوى. عند استلام إشعار طوارئ، يرجى القبول فوراً والتوجه إلى موقع المستفيد في أسرع وقت ممكن.',
  },
  {
    id: 'faq-7',
    question: 'لماذا يجب توثيق حسابي؟',
    answer: 'توثيق الحساب برفع الهوية الوطنية ومزاولة المهنة شرط أساسي لاستقبال الطلبات. هذا يضمن جودة الخدمة ويحمي المستفيدين والممرضين معاً.',
  },
  {
    id: 'faq-8',
    question: 'ما هي رسوم الخدمة الليلية؟',
    answer: 'تُضاف رسوم إضافية على الخدمات المقدمة في الفترة المسائية (من الساعة ١٠ مساءً إلى ٦ صباحاً). النسبة تحددها إدارة المنصة وقد تتغير.',
  },
];

interface SupportSettings {
  supportPhone: string;
  supportWhatsApp: string;
  supportPhones: string[];
  supportWhatsAppNumbers: string[];
}

// ---- Component ----

export default function NurseHelpPage() {
  const authFetch = useAuthFetch();
  const [supportSettings, setSupportSettings] = useState<SupportSettings | null>(null);
  const [isLoadingSupport, setIsLoadingSupport] = useState(true);

  useEffect(() => {
    const fetchSupport = async () => {
      try {
        const res = await authFetch('/api/settings/support');
        const data = await res.json();
        if (data.success && data.data) {
          setSupportSettings(data.data);
        }
      } catch {
        // Use defaults
      } finally {
        setIsLoadingSupport(false);
      }
    };
    void fetchSupport();
  }, [authFetch]);

  const phones = supportSettings?.supportPhones?.length
    ? supportSettings.supportPhones
    : supportSettings?.supportPhone
      ? [supportSettings.supportPhone]
      : ['+967123456789'];

  const whatsApps = supportSettings?.supportWhatsAppNumbers?.length
    ? supportSettings.supportWhatsAppNumbers
    : supportSettings?.supportWhatsApp
      ? [supportSettings.supportWhatsApp]
      : ['+967123456789'];

  return (
    <div className="space-y-5">
      <PageHeader title="المساعدة والدعم" description="الأسئلة الشائعة والتواصل مع الدعم" />

      {/* ══════════════ Help Hero Card ══════════════ */}
      <GlassCard variant="nurse" className="p-0 overflow-hidden">
        <div className="relative bg-gradient-to-bl from-nurse via-sky-500 to-teal-500 p-6 text-white">
          <div className="absolute -top-8 -left-8 w-28 h-28 rounded-full bg-white/8 blur-sm" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/6" />
          <div className="relative z-10 flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' as const }}
              className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 backdrop-blur-sm"
            >
              <LifeBuoy className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h2 className="text-lg font-black">كيف يمكننا مساعدتك؟</h2>
              <p className="text-sm opacity-80 mt-0.5">ابحث عن إجابات أو تواصل مع فريق الدعم</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ══════════════ FAQ Section ══════════════ */}
      <GlassCard variant="nurse" className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-nurse/10 flex items-center justify-center">
            <HelpCircle className="w-4 h-4 text-nurse" />
          </div>
          <h3 className="font-bold">الأسئلة الشائعة</h3>
        </div>
        <Accordion type="single" collapsible className="space-y-2">
          {faqItems.map((item, i) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              className="border border-border/50 rounded-2xl px-4 data-[state=open]:bg-nurse/5 data-[state=open]:border-nurse/20 transition-colors"
            >
              <AccordionTrigger className="text-sm text-right hover:no-underline py-3.5 font-semibold">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </GlassCard>

      {/* ══════════════ Contact Support ══════════════ */}
      <GlassCard variant="nurse" className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-nurse/10 flex items-center justify-center">
            <Phone className="w-4 h-4 text-nurse" />
          </div>
          <h3 className="font-bold">تواصل مع الدعم</h3>
        </div>
        <div className="space-y-3">
          {phones.map((phone, i) => (
            <motion.div key={`phone-${i}`} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-14 text-sm rounded-2xl border-border/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors"
                onClick={() => window.open(`tel:${phone.replace(/\s/g, '')}`)}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{i === 0 ? 'اتصل بنا' : `اتصل بنا ${i + 1}`}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{phone}</p>
                </div>
              </Button>
            </motion.div>
          ))}
          {whatsApps.map((wa, i) => (
            <motion.div key={`wa-${i}`} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-14 text-sm rounded-2xl border-border/50 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
                onClick={() => window.open(`https://wa.me/${wa.replace(/[^0-9]/g, '')}`, '_blank')}
              >
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{i === 0 ? 'واتساب' : `واتساب ${i + 1}`}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{wa}</p>
                </div>
              </Button>
            </motion.div>
          ))}
        </div>
      </GlassCard>

      {/* ══════════════ Legal Links ══════════════ */}
      <GlassCard variant="nurse" className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-nurse/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-nurse" />
          </div>
          <h3 className="font-bold">المستندات القانونية</h3>
        </div>
        <div className="space-y-2">
          <Link href="/nurse/help/terms" className="flex items-center justify-between w-full p-3.5 rounded-2xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
                <Shield className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold">شروط والأحكام</span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
          </Link>
          <Link href="/nurse/help/privacy" className="flex items-center justify-between w-full p-3.5 rounded-2xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold">سياسة الخصوصية</span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
          </Link>
        </div>
      </GlassCard>

      {/* ══════════════ App Info ══════════════ */}
      <GlassCard variant="nurse" className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-nurse/10 flex items-center justify-center">
            <Info className="w-4 h-4 text-nurse" />
          </div>
          <h3 className="font-bold">معلومات التطبيق</h3>
        </div>
        <div className="space-y-3 text-sm">
          {[
            { label: 'اسم التطبيق', value: 'عافيتك' },
            { label: 'الإصدار', value: '١.٠.١' },
            { label: 'نوع الحساب', value: 'ممرض/ـة' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-muted/20">
              <span className="text-muted-foreground font-medium">{item.label}</span>
              <span className="font-bold">{item.value}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
