'use client';

// ============================================================================
// عافيتك - صفحة إنشاء طلب خدمة خاصة للمستفيد
// ============================================================================
// يتيح للمستفيد إنشاء طلب خدمة مخصص بتفاصيل متعددة الأسطر لكل خدمة
// يستخدم نظام الموقع الحالي (GPS) الموجود في التطبيق
// ============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight, Loader2, MapPin, Calendar, Clock, Tag, FileText,
  Plus, X, AlertCircle, CheckCircle2, Send, Stethoscope,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { useAuthFetch } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { LocationData } from '@/hooks/use-geolocation';

export default function NewSpecialRequestPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();

  const [serviceName, setServiceName] = useState('');
  const [requestedServices, setRequestedServices] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [servicesEnabled, setServicesEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/settings/services-status')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setServicesEnabled(json.data.servicesEnabled !== false);
        }
      })
      .catch(() => {});
  }, []);

  const handleLocationDetected = (loc: LocationData) => {
    if (loc.latitude) setLat(loc.latitude);
    if (loc.longitude) setLng(loc.longitude);
    if (loc.address) setAddress(loc.address);
  };

  const addServiceLine = () => {
    setRequestedServices([...requestedServices, '']);
  };

  const removeServiceLine = (idx: number) => {
    if (requestedServices.length === 1) return;
    setRequestedServices(requestedServices.filter((_, i) => i !== idx));
  };

  const updateServiceLine = (idx: number, value: string) => {
    const updated = [...requestedServices];
    updated[idx] = value;
    setRequestedServices(updated);
  };

  const validateForm = (): boolean => {
    if (!serviceName.trim() || serviceName.trim().length < 2) {
      toast.error('يرجى إدخال اسم الخدمة الرئيسية');
      return false;
    }
    const cleanServices = requestedServices.map(s => s.trim()).filter(Boolean);
    if (cleanServices.length === 0) {
      toast.error('يجب إدخال خدمة واحدة على الأقل');
      return false;
    }
    if (!address.trim()) {
      toast.error('يرجى تحديد الموقع');
      return false;
    }
    if (lat === 0 || lng === 0) {
      toast.error('يرجى تحديد الموقع عبر زر "تحديد موقعي"');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!servicesEnabled) {
      toast.error('الخدمات غير متاحة حالياً');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanServices = requestedServices.map(s => s.trim()).filter(Boolean);
      const res = await authFetch('/api/beneficiary/special-requests', {
        method: 'POST',
        body: JSON.stringify({
          serviceName: serviceName.trim(),
          requestedServices: cleanServices,
          notes: notes.trim() || undefined,
          address: address.trim(),
          lat,
          lng,
          scheduledDate: scheduledDate || undefined,
          scheduledTime: scheduledTime || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم إنشاء طلبك بنجاح');
        const newId = json.data?._id || json.data?.id;
        if (newId) {
          router.push(`/beneficiary/special-requests/${newId}`);
        } else {
          router.push('/beneficiary/special-requests');
        }
      } else {
        toast.error(json.message ?? 'فشل إنشاء الطلب');
      }
    } catch {
      toast.error('حدث خطأ أثناء إنشاء الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!servicesEnabled) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <PageHeader title="طلب خدمة خاصة جديدة" />
        </div>
        <GlassCard variant="beneficiary" className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-rose-500 mb-3" />
          <p className="font-bold text-rose-700 mb-1">الخدمات غير متاحة حالياً</p>
          <p className="text-sm text-muted-foreground">لا يمكن إنشاء طلبات جديدة في الوقت الحالي. يرجى المحاولة لاحقاً.</p>
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pb-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <PageHeader
          title="طلب خدمة خاصة"
          description="اشرح لنا الخدمة التي تحتاجها وسيتواصل معك فريق الإدارة عبر المحادثة"
        />
      </div>

      {/* Service name */}
      <GlassCard variant="beneficiary">
        <GlassCardHeader className="pb-2">
          <GlassCardTitle className="text-base flex items-center gap-2">
            <Tag className="w-4 h-4 text-beneficiary" />
            اسم الخدمة الرئيسية
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-2">
          <Input
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="مثال: ممرض خاص، رعاية منزلية، علاج طبيعي..."
            maxLength={100}
          />
          <p className="text-xs text-muted-foreground">
            اختر اسماً موجزاً يصف الخدمة بشكل عام
          </p>
        </GlassCardContent>
      </GlassCard>

      {/* Requested services */}
      <GlassCard variant="beneficiary">
        <GlassCardHeader className="pb-2">
          <GlassCardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-beneficiary" />
            الخدمات المطلوبة
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            اكتب كل خدمة في سطر مستقل - يمكنك إضافة عدة خدمات
          </p>
          {requestedServices.map((service, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1">
                <Textarea
                  value={service}
                  onChange={(e) => updateServiceLine(idx, e.target.value)}
                  placeholder={`الخدمة ${idx + 1}: مثال - ممرض مقيم 24 ساعة لرعاية والد المسن...`}
                  rows={2}
                  maxLength={500}
                />
              </div>
              {requestedServices.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeServiceLine(idx)}
                  className="shrink-0 text-rose-500 hover:bg-rose-50"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addServiceLine}
            className="gap-2 w-full border-dashed"
          >
            <Plus className="w-4 h-4" />
            إضافة خدمة أخرى
          </Button>
        </GlassCardContent>
      </GlassCard>

      {/* Notes */}
      <GlassCard variant="beneficiary">
        <GlassCardHeader className="pb-2">
          <GlassCardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-beneficiary" />
            ملاحظات إضافية (اختياري)
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أي تفاصيل إضافية تساعد الإدارة في فهم احتياجاتك..."
            rows={3}
            maxLength={2000}
          />
        </GlassCardContent>
      </GlassCard>

      {/* Location */}
      <GlassCard variant="beneficiary">
        <GlassCardHeader className="pb-2">
          <GlassCardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-beneficiary" />
            الموقع
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-3">
          <GpsLocationButton
            onLocationDetected={handleLocationDetected}
            value={address}
            label="تحديد موقعي"
          />
          {lat !== 0 && lng !== 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>تم تحديد الموقع بنجاح</span>
            </div>
          )}
          <div>
            <Label htmlFor="address" className="text-xs">العنوان التفصيلي</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="مثال: بجوار مستشفى الثورة، الطابق الثالث..."
              rows={2}
            />
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Schedule */}
      <GlassCard variant="beneficiary">
        <GlassCardHeader className="pb-2">
          <GlassCardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-beneficiary" />
            الموعد المقترح (اختياري)
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="scheduledDate" className="text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" /> التاريخ
            </Label>
            <Input
              id="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <Label htmlFor="scheduledTime" className="text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" /> الوقت
            </Label>
            <Input
              id="scheduledTime"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              dir="ltr"
            />
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Submit button */}
      <div className="sticky bottom-4 z-10">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full gap-2 bg-beneficiary hover:bg-beneficiary/90 shadow-lg h-12 text-base"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري الإرسال...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              إرسال الطلب
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
