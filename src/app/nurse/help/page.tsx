'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  HelpCircle,
  Phone,
  MessageCircle,
  FileText,
  Shield,
  Info,
  ChevronDown,
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

// ---- FAQ Data ----

const faqItems = [
  {
    id: 'faq-1',
    question: 'كيف أبدأ في استقبال الطلبات؟',
    answer: 'بعد التسجيل والتحقق من حسابك، قم بتفعيل حالة التوفر من خلال زر التبديل في صفحة الملف الشخصي. عندما تكون متاحاً، سيتمكن النظام من تعيين طلبات لك.',
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
    answer: 'يمكنك تحسين تقييمك من خلال الالتزام بالمواعيد، تقديم خدمة عالية الجودة، والتواصل الجيد مع المستفيدين. الرد السريع على الطلبات أيضاً يساهم في تحسين تقييمك.',
  },
  {
    id: 'faq-6',
    question: 'كيف أتعامل مع حالات الطوارئ؟',
    answer: 'حالات الطوارئ لها أولوية قصوى. عند استلام إشعار طوارئ، يرجى القبول فوراً والتوجه إلى موقع المستفيد في أسرع وقت ممكن.',
  },
  {
    id: 'faq-7',
    question: 'هل يمكنني تحديث تخصصاتي؟',
    answer: 'نعم، يمكنك تحديث تخصصاتك والخدمات المتاحة لك من خلال صفحة الملف الشخصي. قد يتطلب إضافة تخصصات جديدة تقديم مستندات إضافية.',
  },
  {
    id: 'faq-8',
    question: 'ما هي رسوم الخدمة الليلية؟',
    answer: 'تُضاف رسوم إضافية على الخدمات المقدمة في الفترة المسائية (من الساعة ١٠ مساءً إلى ٦ صباحاً). النسبة تحددها إدارة المنصة وقد تتغير.',
  },
];

// ---- Component ----

export default function NurseHelpPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="المساعدة والدعم" description="الأسئلة الشائعة والتواصل مع الدعم" />

      {/* FAQ Section */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-nurse" />
          <h3 className="font-semibold">الأسئلة الشائعة</h3>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {faqItems.map((item) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              className="border border-border/50 rounded-xl px-4 data-[state=open]:bg-nurse/5"
            >
              <AccordionTrigger className="text-sm text-right hover:no-underline py-3">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </GlassCard>

      {/* Contact Support */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Phone className="w-5 h-5 text-nurse" />
          <h3 className="font-semibold">تواصل مع الدعم</h3>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 text-sm"
            onClick={() => window.open('tel:+967123456789')}
          >
            <Phone className="w-5 h-5 text-green-600" />
            <div className="text-right">
              <p className="font-medium">اتصل بنا</p>
              <p className="text-xs text-muted-foreground">+٩٦٧ ١٢٣٤٥٦٧٨٩</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 text-sm"
            onClick={() => window.open('https://wa.me/967123456789', '_blank')}
          >
            <MessageCircle className="w-5 h-5 text-green-600" />
            <div className="text-right">
              <p className="font-medium">واتساب</p>
              <p className="text-xs text-muted-foreground">راسلنا عبر واتساب</p>
            </div>
          </Button>
        </div>
      </GlassCard>

      {/* Legal Links */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-nurse" />
          <h3 className="font-semibold">المستندات القانونية</h3>
        </div>

        <div className="space-y-2">
          <button className="flex items-center justify-between w-full p-3 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">شروط والأحكام</span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
          </button>

          <button className="flex items-center justify-between w-full p-3 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">سياسة الخصوصية</span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
          </button>
        </div>
      </GlassCard>

      {/* App Info */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-nurse" />
          <h3 className="font-semibold">معلومات التطبيق</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">اسم التطبيق</span>
            <span className="font-medium">عافيتك</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">الإصدار</span>
            <span className="font-medium">١.٠.٠</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">نوع الحساب</span>
            <span className="font-medium">ممرض/ـة</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
