'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  CreditCard,
  Tag,
  CheckCircle2,
  Loader2,
  Stethoscope,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GlassCard } from '@/components/common/glass-card';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { Currency, formatYemeniRial } from '@/components/common/currency';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import type { ApiResponse, Service, PaymentType, ServicePricing } from '@/types';

interface StepInfo {
  number: number;
  title: string;
  icon: React.ElementType;
}

const steps: StepInfo[] = [
  { number: 1, title: 'تفاصيل الخدمة', icon: Stethoscope },
  { number: 2, title: 'الموعد والوقت', icon: Calendar },
  { number: 3, title: 'العنوان', icon: MapPin },
  { number: 4, title: 'الدفع', icon: CreditCard },
  { number: 5, title: 'تأكيد الطلب', icon: CheckCircle2 },
];

const paymentMethods: { value: PaymentType; label: string; description: string }[] = [
  { value: 'cash', label: 'نقدي', description: 'الدفع عند وصول الممرض/ـة' },
  { value: 'mobile_wallet', label: 'محفظة إلكترونية', description: 'ون كاش / جوالي / سبأ كاش' },
  { value: 'bank_transfer', label: 'تحويل بنكي', description: 'تحويل مباشر للحساب البنكي' },
  { value: 'exchange_transfer', label: 'تحويل صراف', description: 'عبر مكاتب الصرافة' },
];

export default function ServiceRequestPage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = params.serviceId as string;
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [service, setService] = useState<Service | null>(null);
  const [isLoadingService, setIsLoadingService] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentType>('cash');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [isEmergency, setIsEmergency] = useState(false);
  const [pricing, setPricing] = useState<ServicePricing | null>(null);

  const fetchService = useCallback(async () => {
    if (!token || !serviceId) return;
    setIsLoadingService(true);
    try {
      const res = await fetch(`/api/beneficiary/services?search=&category=`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<Service[]> = await res.json();
      if (data.success && data.data) {
        const found = data.data.find((s) => s.id === serviceId);
        if (found) setService(found);
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoadingService(false);
    }
  }, [token, serviceId]);

  useEffect(() => {
    fetchService();
  }, [fetchService]);

  // Calculate pricing when relevant fields change
  useEffect(() => {
    if (!service) return;
    const basePrice = service.basePrice;
    const nightFee = 0;
    const fridayFee = 0;
    const emergencyFee = isEmergency ? basePrice * 0.5 : 0;
    const loyaltyDiscount = 0;
    const subtotal = basePrice + nightFee + fridayFee + emergencyFee;
    const discount = couponDiscount;
    const totalPrice = Math.max(0, subtotal - discount - loyaltyDiscount);
    const commission = totalPrice * 0.15;
    const nursePayout = totalPrice - commission;

    setPricing({
      basePrice,
      nightFee,
      fridayFee,
      emergencyFee,
      discount,
      loyaltyDiscount,
      couponDiscount: couponDiscount,
      totalPrice,
      commission,
      nursePayout,
    });
  }, [service, isEmergency, couponDiscount]);

  const validateCoupon = async () => {
    if (!token || !couponCode || !service) return;
    try {
      const res = await fetch('/api/beneficiary/coupons/validate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: couponCode, serviceId: service.id, orderAmount: service.basePrice }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCouponDiscount(data.data.discountAmount ?? 0);
        toast({ title: 'تم تطبيق الكوبون بنجاح' });
      } else {
        setCouponDiscount(0);
        toast({ title: 'كوبون غير صالح', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ في التحقق من الكوبون', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!token || !service || !pricing) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/beneficiary/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId: service.id,
          scheduledAt: scheduledDate && scheduledTime ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() : undefined,
          address: address || `${lat}, ${lng}`,
          lat: lat || 15.3694,
          lng: lng || 44.1910,
          notes: notes || undefined,
          isEmergency,
          paymentMethod,
          couponCode: couponCode || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'تم إنشاء الطلب بنجاح' });
        router.push('/beneficiary/orders');
      } else {
        toast({ title: data.message ?? 'فشل إنشاء الطلب', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'حدث خطأ في إرسال الطلب', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: return !!service;
      case 1: return true;
      case 2: return lat !== 0 && lng !== 0;
      case 3: return !!paymentMethod;
      case 4: return true;
      default: return false;
    }
  };

  if (isLoadingService) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-beneficiary animate-spin" />
          <p className="text-muted-foreground">جاري تحميل تفاصيل الخدمة...</p>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground">لم يتم العثور على الخدمة</p>
          <Button onClick={() => router.push('/beneficiary')}>العودة للرئيسية</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">طلب خدمة</h1>
          <p className="text-sm text-muted-foreground">{service.nameAr}</p>
        </div>
      </motion.div>

      {/* Step Progress */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          return (
            <div key={step.number} className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => index <= currentStep && setCurrentStep(index)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-beneficiary text-beneficiary-foreground'
                    : isCompleted
                    ? 'bg-beneficiary/10 text-beneficiary'
                    : 'glass text-muted-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{step.title}</span>
                <span className="sm:hidden">{step.number}</span>
              </button>
              {index < steps.length - 1 && (
                <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Step 1: Service Details */}
          {currentStep === 0 && (
            <GlassCard variant="beneficiary" className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-beneficiary/10 flex items-center justify-center">
                  <Stethoscope className="w-8 h-8 text-beneficiary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{service.nameAr}</h2>
                  <p className="text-sm text-muted-foreground">{service.descriptionAr}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass rounded-xl p-4 text-center">
                  <Currency amount={service.basePrice} className="text-lg text-beneficiary" />
                  <p className="text-xs text-muted-foreground mt-1">السعر الأساسي</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <p className="text-lg font-bold">{service.duration} دقيقة</p>
                  <p className="text-xs text-muted-foreground mt-1">المدة المتوقعة</p>
                </div>
              </div>
              {service.isEmergency && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm">هذه خدمة طوارئ - سيتم تطبيق رسوم إضافية</span>
                </div>
              )}
              <div className="space-y-3">
                <Label>ملاحظات إضافية</Label>
                <Textarea
                  placeholder="أضف أي ملاحظات للخدمة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  dir="rtl"
                />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl glass">
                <input
                  type="checkbox"
                  id="emergency-check"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-beneficiary text-beneficiary focus:ring-beneficiary"
                />
                <Label htmlFor="emergency-check" className="cursor-pointer">
                  طلب طوارئ (رسوم إضافية ٥٠٪)
                </Label>
              </div>
            </GlassCard>
          )}

          {/* Step 2: Date & Time */}
          {currentStep === 1 && (
            <GlassCard variant="beneficiary" className="space-y-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-beneficiary" />
                اختر الموعد والوقت
              </h2>
              <div className="space-y-2">
                <Label htmlFor="date">التاريخ</Label>
                <Input
                  id="date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">الوقت</Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                يمكنك ترك الموعد فارغاً للطلب الفوري
              </p>
            </GlassCard>
          )}

          {/* Step 3: Address */}
          {currentStep === 2 && (
            <GlassCard variant="beneficiary" className="space-y-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-beneficiary" />
                عنوان الخدمة
              </h2>
              <GpsLocationButton
                onLocationDetected={(loc) => {
                  setLat(loc.latitude);
                  setLng(loc.longitude);
                  if (loc.address && loc.address !== `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`) {
                    setAddress(loc.address);
                  } else if (!address) {
                    setAddress(`${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`);
                  }
                }}
                value={address}
                placeholder='اضغط "تحديد موقعي" لرفع موقعك الجغرافي'
                label="تحديد موقعي"
              />
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-1">
                  تفاصيل إضافية للعنوان
                  <span className="text-xs text-muted-foreground font-normal">(اختياري)</span>
                </Label>
                <Textarea
                  id="address"
                  placeholder="مثال: بجوار مستشفى الثورة، الطابق الثالث..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  dir="rtl"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  أضف أي تفاصيل تساعد الممرض/ـة في الوصول إليك
                </p>
              </div>
            </GlassCard>
          )}

          {/* Step 4: Payment */}
          {currentStep === 3 && (
            <GlassCard variant="beneficiary" className="space-y-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-beneficiary" />
                طريقة الدفع
              </h2>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(val) => setPaymentMethod(val as PaymentType)}
                className="space-y-3"
              >
                {paymentMethods.map((method) => (
                  <label
                    key={method.value}
                    className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                      paymentMethod === method.value
                        ? 'bg-beneficiary/10 border-2 border-beneficiary'
                        : 'glass border-2 border-transparent'
                    }`}
                  >
                    <RadioGroupItem value={method.value} id={method.value} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{method.label}</p>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>

              {/* Coupon */}
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-beneficiary" />
                  كوبون خصم (اختياري)
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="أدخل كود الكوبون"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    dir="ltr"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    className="border-beneficiary text-beneficiary shrink-0"
                    onClick={validateCoupon}
                    disabled={!couponCode}
                  >
                    تطبيق
                  </Button>
                </div>
                {couponDiscount > 0 && (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    خصم الكوبون: {formatYemeniRial(couponDiscount)}
                  </p>
                )}
              </div>
            </GlassCard>
          )}

          {/* Step 5: Summary */}
          {currentStep === 4 && pricing && (
            <GlassCard variant="beneficiary" className="space-y-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-beneficiary" />
                ملخص الطلب
              </h2>

              {/* Service Info */}
              <div className="glass rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">الخدمة</span>
                  <span className="font-medium text-sm">{service.nameAr}</span>
                </div>
                {scheduledDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">الموعد</span>
                    <span className="font-medium text-sm">{scheduledDate} {scheduledTime}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">العنوان</span>
                  <span className="font-medium text-sm max-w-[60%] text-left truncate">{address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">طريقة الدفع</span>
                  <span className="font-medium text-sm">{paymentMethods.find((m) => m.value === paymentMethod)?.label}</span>
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex justify-between">
                  <span className="text-sm">السعر الأساسي</span>
                  <Currency amount={pricing.basePrice} className="text-sm" />
                </div>
                {pricing.nightFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-orange-600">رسوم الخدمة الليلية</span>
                    <Currency amount={pricing.nightFee} className="text-sm text-orange-600" />
                  </div>
                )}
                {pricing.fridayFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-orange-600">رسوم خدمة الجمعة</span>
                    <Currency amount={pricing.fridayFee} className="text-sm text-orange-600" />
                  </div>
                )}
                {pricing.emergencyFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-red-600">رسوم الطوارئ</span>
                    <Currency amount={pricing.emergencyFee} className="text-sm text-red-600" />
                  </div>
                )}
                {pricing.couponDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-green-600">خصم الكوبون</span>
                    <Currency amount={-pricing.couponDiscount} className="text-sm text-green-600" />
                  </div>
                )}
                {pricing.loyaltyDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-green-600">خصم نقاط الولاء</span>
                    <Currency amount={-pricing.loyaltyDiscount} className="text-sm text-green-600" />
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-border">
                  <span className="font-bold text-lg">الإجمالي</span>
                  <Currency amount={pricing.totalPrice} className="text-lg text-beneficiary font-bold" />
                </div>
              </div>
            </GlassCard>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4 pt-4">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          السابق
        </Button>

        {currentStep < steps.length - 1 ? (
          <Button
            onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
            disabled={!canProceed()}
            className="bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground gap-2"
          >
            التالي
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canProceed()}
            className="bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground gap-2 min-w-[120px]"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                تأكيد الطلب
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
