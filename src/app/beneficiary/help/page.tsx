'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  HelpCircle,
  MessageSquare,
  AlertTriangle,
  FileText,
  Shield,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/common/glass-card';
import { useToast } from '@/hooks/use-toast';
import { useAuthFetch } from '@/hooks/use-auth';

interface FAQItem {
  question: string;
  answer: string;
}

interface SectionData {
  icon: React.ElementType;
  title: string;
  content: string;
}

interface SupportSettings {
  supportPhone: string;
  supportEmail: string;
  supportWhatsApp: string;
  supportPhones: string[];
  supportWhatsAppNumbers: string[];
}

function ExpandableSection({ section }: { section: SectionData }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = section.icon;
  return (
    <GlassCard variant="beneficiary" className="space-y-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full"
      >
        <h3 className="font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-beneficiary" />
          {section.title}
        </h3>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
        >
          {section.content}
        </motion.div>
      )}
    </GlassCard>
  );
}

const faqItems: FAQItem[] = [
  {
    question: 'كيف يمكنني طلب خدمة؟',
    answer: 'يمكنك طلب خدمة من الصفحة الرئيسية عن طريق اختيار الخدمة المطلوبة ثم إدخال تفاصيل الموعد والعنوان وطريقة الدفع وتأكيد الطلب.',
  },
  {
    question: 'ما هي طرق الدفع المتاحة؟',
    answer: 'نوفر عدة طرق للدفع: نقدي عند الوصول، محفظة إلكترونية (ون كاش، جوالي، سبأ كاش)، تحويل بنكي، وتحويل عبر مكاتب الصرافة.',
  },
  {
    question: 'كيف تعمل خدمة الطوارئ؟',
    answer: 'عند طلب خدمة طوارئ، يتم إرسال أقرب ممرض/ـة متاح إلى موقعك فوراً. يرجى ملاحظة أن خدمة الطوارئ تتضمن رسوماً إضافية بنسبة ٥٠٪.',
  },
  {
    question: 'هل يمكنني إلغاء طلب؟',
    answer: 'نعم، يمكنك إلغاء الطلب إذا كانت حالته "قيد الانتظار". بعد تعيين ممرض/ـة، قد لا يكون الإلغاء متاحاً أو قد تتطلب رسوم إلغاء.',
  },
  {
    question: 'كيف تعمل نقاط الولاء؟',
    answer: 'تكتسب نقاطاً مع كل طلب مكتمل وتقييم. عندما تجمع عدداً كافياً من النقاط، يمكنك استبدالها بخصومات على الطلبات القادمة.',
  },
  {
    question: 'كيف يمكنني تتبع الممرض/ـة؟',
    answer: 'بعد قبول الطلب وتأكيد الممرض/ـة، سيظهر زر "تتبع" في تفاصيل الطلب. اضغط عليه لمتابعة موقع الممرض/ـة في الوقت الفعلي.',
  },
  {
    question: 'ما هي أوقات العمل؟',
    answer: 'خدماتنا متاحة على مدار الساعة، ٧ أيام في الأسبوع. الخدمات الليلية قد تتطلب رسوماً إضافية.',
  },
];

export default function HelpPage() {
  const { toast } = useToast();
  const authFetch = useAuthFetch();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [reportSubject, setReportSubject] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isSending, setIsSending] = useState(false);

  // ── Support Settings (Dynamic) ──────────────────────────
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
        // Failed to fetch support settings — will show empty state
      } finally {
        setIsLoadingSupport(false);
      }
    };
    void fetchSupport();
  }, [authFetch]);

  // Derive contact lists from API data
  const phones = supportSettings?.supportPhones?.length
    ? supportSettings.supportPhones
    : supportSettings?.supportPhone
      ? [supportSettings.supportPhone]
      : [];

  const whatsApps = supportSettings?.supportWhatsAppNumbers?.length
    ? supportSettings.supportWhatsAppNumbers
    : supportSettings?.supportWhatsApp
      ? [supportSettings.supportWhatsApp]
      : [];

  const supportEmail = supportSettings?.supportEmail || '';

  const hasAnyContactInfo = phones.length > 0 || whatsApps.length > 0 || supportEmail;

  const handleReport = async () => {
    if (!reportSubject || !reportDescription) {
      toast({ title: 'يرجى ملء جميع الحقول', variant: 'destructive' });
      return;
    }
    setIsSending(true);
    try {
      // Simulate sending
      await new Promise((r) => setTimeout(r, 1000));
      toast({ title: 'تم إرسال البلاغ بنجاح' });
      setReportSubject('');
      setReportDescription('');
    } catch {
      toast({ title: 'فشل إرسال البلاغ', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const sections = [
    {
      icon: FileText,
      title: 'الشروط والأحكام',
      content: `تحدد هذه الشروط والأحكام استخدام منصة عافيتك للرعاية الصحية المنزلية. باستخدامك للمنصة، فإنك توافق على هذه الشروط.\n\n١. تلتزم المنصة بتوفير ممرضين/ـات معتمدين ومرخصين.\n٢. المستفيد مسؤول عن تقديم معلومات صحيحة ودقيقة.\n٣. يمكن إلغاء الطلبات وفقاً لسياسة الإلغاء المحددة.\n٤. الأسعار قابلة للتغيير مع إشعار مسبق.\n٥. المنصة غير مسؤولة عن أي أضرار غير مباشرة ناتجة عن استخدام الخدمة.`,
    },
    {
      icon: Shield,
      title: 'سياسة الخصوصية',
      content: `نحرص على حماية خصوصيتك وبياناتك الشخصية.\n\n١. نجمع فقط البيانات الضرورية لتقديم الخدمة.\n٢. لا نشارك بياناتك الشخصية مع أطراف ثالثة بدون إذنك.\n٣. يتم تشفير جميع البيانات الحساسة.\n٤. يمكنك طلب حذف بياناتك في أي وقت.\n٥. نستخدم ملفات تعريف الارتباط لتحسين تجربة الاستخدام.`,
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold">المساعدة والدعم</h1>
        <p className="text-sm text-muted-foreground">الأسئلة الشائعة والتواصل مع الدعم</p>
      </motion.div>

      {/* FAQ */}
      <GlassCard variant="beneficiary" className="space-y-2">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <HelpCircle className="w-4 h-4 text-beneficiary" />
          الأسئلة الشائعة
        </h3>
        {faqItems.map((item, index) => (
          <div key={index} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
              className="flex items-center justify-between w-full p-4 text-right hover:bg-accent/50 transition-colors"
            >
              <span className="font-medium text-sm">{item.question}</span>
              {expandedFAQ === index ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </button>
            {expandedFAQ === index && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="px-4 pb-4"
              >
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {item.answer}
                </p>
              </motion.div>
            )}
          </div>
        ))}
      </GlassCard>

      {/* Contact Support */}
      <GlassCard variant="beneficiary" className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Phone className="w-4 h-4 text-beneficiary" />
          تواصل مع الدعم
        </h3>

        {isLoadingSupport ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-beneficiary" />
          </div>
        ) : !hasAnyContactInfo ? (
          <div className="text-center py-8 glass rounded-xl">
            <Phone className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد بيانات تواصل حالياً</p>
          </div>
        ) : (
          <div className="space-y-3">
            {phones.map((phone, i) => (
              <a
                key={`phone-${i}`}
                href={`tel:${phone.replace(/\s/g, '')}`}
                className="flex items-center gap-3 p-3 glass rounded-xl hover:bg-accent/50 transition-colors"
              >
                <Phone className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{i === 0 ? 'اتصل بنا' : `اتصل بنا ${i + 1}`}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{phone}</p>
                </div>
              </a>
            ))}
            {whatsApps.map((wa, i) => (
              <a
                key={`wa-${i}`}
                href={`https://wa.me/${wa.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 glass rounded-xl hover:bg-accent/50 transition-colors"
              >
                <MessageSquare className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{i === 0 ? 'واتساب' : `واتساب ${i + 1}`}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{wa}</p>
                </div>
              </a>
            ))}
            {supportEmail && (
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-center gap-3 p-3 glass rounded-xl hover:bg-accent/50 transition-colors"
              >
                <Mail className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">البريد الإلكتروني</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{supportEmail}</p>
                </div>
              </a>
            )}
          </div>
        )}
      </GlassCard>

      {/* Report a Problem */}
      <GlassCard variant="beneficiary" className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          الإبلاغ عن مشكلة
        </h3>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>الموضوع</Label>
            <Input
              placeholder="موضوع المشكلة"
              value={reportSubject}
              onChange={(e) => setReportSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>التفاصيل</Label>
            <Textarea
              placeholder="اشرح المشكلة بالتفصيل..."
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <Button
            onClick={handleReport}
            disabled={isSending || !reportSubject || !reportDescription}
            className="w-full bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground"
          >
            {isSending ? 'جاري الإرسال...' : 'إرسال البلاغ'}
          </Button>
        </div>
      </GlassCard>

      {/* Terms and Privacy */}
      {sections.map((section) => (
        <ExpandableSection key={section.title} section={section} />
      ))}
    </div>
  );
}
