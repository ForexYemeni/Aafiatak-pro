'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Smartphone,
  Building2,
  HandCoins,
  Copy,
  Check,
  Upload,
  Image as ImageIcon,
  X,
  Heart,
  Baby,
  Activity,
  Brain,
  Pill,
  Syringe,
  Ambulance,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GlassCard } from '@/components/common/glass-card';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { Currency, formatYemeniRial } from '@/components/common/currency';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { toArabicNum } from '@/components/common/date-formatter';
import type { ApiResponse, Service, ServicePricing } from '@/types';

interface StepInfo {
  number: number;
  title: string;
  icon: React.ElementType;
}

const steps: StepInfo[] = [
  { number: 1, title: 'تفاصيل الخدمات', icon: Stethoscope },
  { number: 2, title: 'الموعد والوقت', icon: Calendar },
  { number: 3, title: 'العنوان', icon: MapPin },
  { number: 4, title: 'الدفع', icon: CreditCard },
  { number: 5, title: 'تأكيد الطلب', icon: CheckCircle2 },
];

const stepVariants = {
  active: { scale: 1, transition: { ease: 'easeOut' as const } },
  completed: { scale: 1, transition: { ease: 'easeOut' as const } },
  inactive: { scale: 0.95, transition: { ease: 'easeOut' as const } },
} as const;

const lineVariants = {
  active: { scaleX: 1, transition: { duration: 0.4, ease: 'easeOut' as const } },
  inactive: { scaleX: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
} as const;

const serviceIconMap: Record<string, React.ElementType> = {
  Stethoscope, Heart, Activity, Baby, Syringe, Pill, Ambulance, Brain,
};

const categoryIconBg: Record<string, string> = {
  medical: 'bg-blue-100 dark:bg-blue-900/30',
  nursing: 'bg-rose-100 dark:bg-rose-900/30',
  physiotherapy: 'bg-emerald-100 dark:bg-emerald-900/30',
  elderly_care: 'bg-amber-100 dark:bg-amber-900/30',
  pediatric: 'bg-violet-100 dark:bg-violet-900/30',
  post_surgery: 'bg-orange-100 dark:bg-orange-900/30',
  lab: 'bg-cyan-100 dark:bg-cyan-900/30',
  emergency: 'bg-red-100 dark:bg-red-900/30',
};

const categoryIconColor: Record<string, string> = {
  medical: 'text-blue-600 dark:text-blue-400',
  nursing: 'text-rose-600 dark:text-rose-400',
  physiotherapy: 'text-emerald-600 dark:text-emerald-400',
  elderly_care: 'text-amber-600 dark:text-amber-400',
  pediatric: 'text-violet-600 dark:text-violet-400',
  post_surgery: 'text-orange-600 dark:text-orange-400',
  lab: 'text-cyan-600 dark:text-cyan-400',
  emergency: 'text-red-600 dark:text-red-400',
};

interface PaymentMethodItem {
  id: string;
  nameAr: string;
  nameEn: string;
  type: string;
  walletType: string | null;
  exchangeType: string | null;
  customProviderName: string;
  icon: string;
  isActive: boolean;
  instructions: string;
  accountName: string;
  accountNumber: string;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors" title="نسخ">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
}

function MultiServiceRequestPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids') || '';
  const serviceIds = idsParam.split(',').filter(Boolean);
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [allServices, setAllServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [notes, setNotes] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [isEmergency, setIsEmergency] = useState(false);

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [emergencyFee, setEmergencyFee] = useState(5000);
  const [supportWhatsApp, setSupportWhatsApp] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);

  // Pricing settings
  const [commissionRate, setCommissionRate] = useState(15);
  const [nightFeeEnabled, setNightFeeEnabled] = useState(false);
  const [nightFeePercent, setNightFeePercent] = useState(0);
  const [nightStartHour, setNightStartHour] = useState(22);
  const [nightEndHour, setNightEndHour] = useState(6);
  const [fridayFeeEnabled, setFridayFeeEnabled] = useState(false);
  const [fridayFeePercent, setFridayFeePercent] = useState(0);

  // Loyalty
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyRedemptionRate, setLoyaltyRedemptionRate] = useState(0);
  const [loyaltyRedemptionThreshold, setLoyaltyRedemptionThreshold] = useState(100);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  const selectedPaymentMethod = paymentMethods.find(pm => pm.id === selectedPaymentMethodId);
  const isCashPayment = selectedPaymentMethod?.type === 'cash';

  // Calculate total pricing
  const totalBasePrice = selectedServices.reduce((sum, s) => sum + s.basePrice, 0);
  const loyaltyDiscount = (useLoyaltyPoints && loyaltyRedemptionRate > 0 && loyaltyPoints >= loyaltyRedemptionThreshold)
    ? Math.round(loyaltyPoints / loyaltyRedemptionRate) : 0;

  // Calculate night/friday fee for combined total
  let totalNightFee = 0;
  if (nightFeeEnabled && scheduledTime) {
    const hour = parseInt(scheduledTime.split(':')[0]);
    const isNight = nightStartHour > nightEndHour
      ? (hour >= nightStartHour || hour < nightEndHour)
      : (hour >= nightStartHour && hour < nightEndHour);
    if (isNight) {
      totalNightFee = Math.round(totalBasePrice * (nightFeePercent / 100));
    }
  }

  let totalFridayFee = 0;
  if (fridayFeeEnabled && scheduledDate) {
    const dayOfWeek = new Date(scheduledDate).getDay();
    if (dayOfWeek === 5) {
      totalFridayFee = Math.round(totalBasePrice * (fridayFeePercent / 100));
    }
  }

  const totalEmergencyFee = isEmergency ? emergencyFee : 0;
  const grandTotal = Math.max(0, totalBasePrice + totalNightFee + totalFridayFee + totalEmergencyFee - couponDiscount - loyaltyDiscount);

  const fetchServices = useCallback(async () => {
    if (!token || serviceIds.length === 0) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/beneficiary/services?search=&category=`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<Service[]> = await res.json();
      if (data.success && data.data) {
        setAllServices(data.data);
        const found = data.data.filter((s) => serviceIds.includes(s.id));
        setSelectedServices(found);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/methods');
      const data = await res.json();
      if (data.success && data.data) {
        const methods = Array.isArray(data.data) ? data.data : [];
        setPaymentMethods(methods);
        const cashMethod = methods.find((m: PaymentMethodItem) => m.type === 'cash');
        if (cashMethod) setSelectedPaymentMethodId(cashMethod.id);
      }
    } catch { /* silent */ }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const [pricingRes, supportRes] = await Promise.all([
        fetch('/api/settings/pricing'),
        fetch('/api/settings/support'),
      ]);
      const pricingData = await pricingRes.json();
      if (pricingData.success && pricingData.data) {
        setEmergencyFee(pricingData.data.emergencyFee || 5000);
        setCommissionRate(pricingData.data.commissionRate || 15);
        setNightFeeEnabled(pricingData.data.nightFeeEnabled ?? false);
        setNightFeePercent(pricingData.data.nightFeePercent || 0);
        setNightStartHour(pricingData.data.nightStartHour || 22);
        setNightEndHour(pricingData.data.nightEndHour || 6);
        setFridayFeeEnabled(pricingData.data.fridayFeeEnabled ?? false);
        setFridayFeePercent(pricingData.data.fridayFeePercent || 0);
        setLoyaltyRedemptionRate(pricingData.data.loyaltyRedemptionRate || 0);
        setLoyaltyRedemptionThreshold(pricingData.data.loyaltyRedemptionThreshold || 100);
      }
      const supportData = await supportRes.json();
      if (supportData.success && supportData.data) {
        const wa = supportData.data.supportWhatsAppNumbers?.[0] || supportData.data.supportWhatsApp || '';
        setSupportWhatsApp(wa);
      }
    } catch { /* silent */ }
  }, []);

  const fetchLoyalty = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/beneficiary/loyalty', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setLoyaltyPoints(data.data.loyaltyPoints || 0);
      }
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    fetchServices();
    fetchPaymentMethods();
    fetchSettings();
    fetchLoyalty();
  }, [fetchServices, fetchPaymentMethods, fetchSettings, fetchLoyalty]);

  const validateCoupon = async () => {
    if (!token || !couponCode || selectedServices.length === 0) return;
    try {
      const res = await fetch('/api/beneficiary/coupons/validate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: couponCode, serviceId: selectedServices[0].id, orderAmount: totalBasePrice }),
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

  const handlePaymentProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPaymentProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeService = (serviceId: string) => {
    setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
    if (selectedServices.length <= 1) {
      router.push('/beneficiary');
    }
  };

  const handleSubmit = async () => {
    if (!token || selectedServices.length === 0 || !selectedPaymentMethod) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/beneficiary/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceIds: selectedServices.map(s => s.id),
          scheduledAt: scheduledDate && scheduledTime ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() : undefined,
          address: address || `${lat}, ${lng}`,
          lat: lat || 15.3694,
          lng: lng || 44.1910,
          notes: notes || undefined,
          isEmergency,
          paymentMethod: selectedPaymentMethod.type,
          paymentMethodId: selectedPaymentMethodId,
          couponCode: couponCode || undefined,
          hasPaymentProof: !isCashPayment && !!paymentProofFile,
          paymentProofData: !isCashPayment && paymentProofPreview ? paymentProofPreview : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (!isCashPayment) {
          const orderId = data.data?.id || '';
          const serviceNames = selectedServices.map(s => s.nameAr).join('، ');
          const msg = [
            '🏥 *عافيتك - طلب خدمات متعددة*',
            '━━━━━━━━━━━━━━━━━━',
            `📋 *رقم الطلب:* \`#${orderId.slice(-6).toUpperCase()}\``,
            `🩺 *الخدمات:* ${serviceNames}`,
            `💰 *المبلغ الإجمالي:* ${formatYemeniRial(grandTotal)}`,
            `👤 *المستفيد:* ${useAuthStore.getState().user?.name || 'غير محدد'}`,
            `📱 *رقم المستفيد:* ${useAuthStore.getState().user?.phone || 'غير محدد'}`,
            '━━━━━━━━━━━━━━━━━━',
            '📎 إثبات الدفع مرفق',
          ].join('\n');
          const waUrl = `https://wa.me/${supportWhatsApp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
          window.open(waUrl, '_blank');
        }

        toast({ title: isCashPayment ? 'تم إنشاء الطلبات بنجاح' : 'تم إنشاء الطلبات - يرجى إرسال إثبات الدفع عبر الواتساب' });
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
      case 0: return selectedServices.length > 0;
      case 1: return true;
      case 2: return lat !== 0 && lng !== 0;
      case 3: return !!selectedPaymentMethodId;
      case 4: return true;
      default: return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-beneficiary animate-spin" />
          <p className="text-muted-foreground">جاري تحميل تفاصيل الخدمات...</p>
        </div>
      </div>
    );
  }

  if (selectedServices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground">لم يتم تحديد خدمات</p>
          <Button onClick={() => router.push('/beneficiary')}>العودة للرئيسية</Button>
        </div>
      </div>
    );
  }

  const walletMethods = paymentMethods.filter(pm => pm.type === 'wallet_deposit');
  const bankMethods = paymentMethods.filter(pm => pm.type === 'bank_transfer');
  const cashMethods = paymentMethods.filter(pm => pm.type === 'cash');

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">طلب خدمات متعددة</h1>
          <p className="text-sm text-muted-foreground">{toArabicNum(selectedServices.length)} خدمات مختارة</p>
        </div>
      </motion.div>

      {/* Modern Step Progress with animated progress line */}
      <div className="relative px-2">
        <div className="flex items-center justify-between relative">
          {/* Background progress line */}
          <div className="absolute top-5 right-[10%] left-[10%] h-0.5 bg-muted rounded-full" />
          {/* Active progress line */}
          <motion.div
            className="absolute top-5 right-[10%] h-0.5 bg-gradient-to-l from-beneficiary to-rose-400 rounded-full origin-right"
            initial={{ width: '0%' }}
            animate={{ width: `${(currentStep / (steps.length - 1)) * 80}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' as const }}
          />
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            return (
              <div key={step.number} className="flex flex-col items-center gap-1.5 z-10">
                <motion.button
                  onClick={() => index <= currentStep && setCurrentStep(index)}
                  variants={stepVariants}
                  animate={isActive ? 'active' : isCompleted ? 'completed' : 'inactive'}
                  className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-sm ${
                    isActive
                      ? 'bg-gradient-to-bl from-beneficiary to-rose-500 text-white shadow-lg shadow-beneficiary/30'
                      : isCompleted
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-4.5 h-4.5" />
                  )}
                  {isActive && (
                    <motion.div
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-beneficiary"
                      layoutId="beneficiaryStepDot"
                      transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
                    />
                  )}
                </motion.button>
                <span className={`text-[10px] font-bold leading-tight text-center ${
                  isActive ? 'text-beneficiary' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                }`}>
                  <span className="hidden sm:inline">{step.title}</span>
                  <span className="sm:hidden">{toArabicNum(step.number)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div key={currentStep} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
          {/* Step 1: Service Details */}
          {currentStep === 0 && (
            <GlassCard variant="beneficiary" className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-beneficiary" />
                الخدمات المختارة
              </h2>

              {/* Services List */}
              <div className="space-y-2">
                {selectedServices.map((service) => {
                  const ServiceIcon = serviceIconMap[service.icon] || Stethoscope;
                  const catBg = categoryIconBg[service.category] || 'bg-beneficiary/10';
                  const iconClr = categoryIconColor[service.category] || 'text-beneficiary';
                  return (
                    <div key={service.id} className="flex items-center gap-3 p-3 rounded-xl glass">
                      <div className={`w-10 h-10 rounded-xl ${catBg} flex items-center justify-center shrink-0`}>
                        <ServiceIcon className={`w-5 h-5 ${iconClr}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">{service.nameAr}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{service.duration ? `${toArabicNum(service.duration)} دقيقة` : ''}</span>
                        </div>
                      </div>
                      <Currency amount={service.basePrice} className="text-sm font-bold shrink-0" />
                      <button onClick={() => removeService(service.id)} className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Price Summary */}
              <div className="glass rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">مجموع الأسعار الأساسية ({toArabicNum(selectedServices.length)} خدمات)</span>
                  <Currency amount={totalBasePrice} className="text-sm" />
                </div>
                {totalNightFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-orange-600">رسوم الخدمة الليلية ({nightFeePercent}%)</span>
                    <Currency amount={totalNightFee} className="text-xs text-orange-600" />
                  </div>
                )}
                {totalFridayFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-orange-600">رسوم خدمة الجمعة ({fridayFeePercent}%)</span>
                    <Currency amount={totalFridayFee} className="text-xs text-orange-600" />
                  </div>
                )}
                {isEmergency && totalEmergencyFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-red-600">رسوم الطوارئ</span>
                    <Currency amount={totalEmergencyFee} className="text-xs text-red-600" />
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-600">خصم الكوبون</span>
                    <Currency amount={couponDiscount} className="text-xs text-green-600" />
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-600">خصم نقاط الولاء</span>
                    <Currency amount={loyaltyDiscount} className="text-xs text-green-600" />
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                  <span className="font-bold text-base">المبلغ الإجمالي</span>
                  <Currency amount={grandTotal} className="text-lg text-beneficiary font-bold" />
                </div>
              </div>

              {/* Emergency toggle */}
              <div className="flex items-center gap-3 p-3 rounded-xl glass">
                <input
                  type="checkbox"
                  id="emergency-check-multi"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-beneficiary text-beneficiary focus:ring-beneficiary"
                />
                <Label htmlFor="emergency-check-multi" className="cursor-pointer">
                  طلب طوارئ (رسوم إضافية {formatYemeniRial(emergencyFee)})
                </Label>
              </div>

              <div className="space-y-3">
                <Label>ملاحظات إضافية</Label>
                <Textarea placeholder="أضف أي ملاحظات للخدمات..." value={notes} onChange={(e) => setNotes(e.target.value)} dir="rtl" />
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
                <Input id="date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} min={typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : ''} dir="ltr" className="text-left" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">الوقت</Label>
                <Input id="time" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} dir="ltr" className="text-left" />
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
                <Textarea id="address" placeholder="مثال: بجوار مستشفى الثورة، الطابق الثالث..." value={address} onChange={(e) => setAddress(e.target.value)} dir="rtl" rows={2} />
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

              {paymentMethods.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد طرق دفع متاحة حالياً</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cashMethods.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                        <HandCoins className="w-4 h-4" /> نقدي عند الوصول
                      </p>
                      {cashMethods.map(pm => (
                        <label key={pm.id} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                          selectedPaymentMethodId === pm.id ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-transparent glass'
                        }`}>
                          <input type="radio" name="payment" checked={selectedPaymentMethodId === pm.id} onChange={() => setSelectedPaymentMethodId(pm.id)} className="w-4 h-4 text-green-600" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{pm.nameAr}</p>
                            {pm.instructions && <p className="text-xs text-muted-foreground mt-0.5">{pm.instructions}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {walletMethods.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                        <Smartphone className="w-4 h-4" /> إيداع محفظة إلكترونية
                      </p>
                      {walletMethods.map(pm => (
                        <label key={pm.id} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                          selectedPaymentMethodId === pm.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-transparent glass'
                        }`}>
                          <input type="radio" name="payment" checked={selectedPaymentMethodId === pm.id} onChange={() => setSelectedPaymentMethodId(pm.id)} className="w-4 h-4 text-purple-600" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{pm.nameAr}</p>
                              <span className="text-[10px] text-muted-foreground">{pm.nameEn}</span>
                            </div>
                            {selectedPaymentMethodId === pm.id && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-2 border-t border-border">
                                {pm.accountName && (
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                    <span className="text-xs text-muted-foreground shrink-0">الاسم:</span>
                                    <span className="text-sm font-medium flex-1 truncate">{pm.accountName}</span>
                                    <CopyBtn text={pm.accountName} />
                                  </div>
                                )}
                                {pm.accountNumber && (
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                    <span className="text-xs text-muted-foreground shrink-0">الرقم:</span>
                                    <span className="text-sm font-mono font-bold tracking-wider flex-1" dir="ltr">{pm.accountNumber}</span>
                                    <CopyBtn text={pm.accountNumber} />
                                  </div>
                                )}
                                {pm.instructions && <p className="text-xs text-muted-foreground">{pm.instructions}</p>}
                              </motion.div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {bankMethods.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                        <Building2 className="w-4 h-4" /> تحويل بنكي / صرافة
                      </p>
                      {bankMethods.map(pm => (
                        <label key={pm.id} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                          selectedPaymentMethodId === pm.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent glass'
                        }`}>
                          <input type="radio" name="payment" checked={selectedPaymentMethodId === pm.id} onChange={() => setSelectedPaymentMethodId(pm.id)} className="w-4 h-4 text-blue-600" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{pm.nameAr}</p>
                              <span className="text-[10px] text-muted-foreground">{pm.nameEn}</span>
                            </div>
                            {selectedPaymentMethodId === pm.id && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-2 border-t border-border">
                                {pm.accountName && (
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                    <span className="text-xs text-muted-foreground shrink-0">الاسم:</span>
                                    <span className="text-sm font-medium flex-1 truncate">{pm.accountName}</span>
                                    <CopyBtn text={pm.accountName} />
                                  </div>
                                )}
                                {pm.accountNumber && (
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                    <span className="text-xs text-muted-foreground shrink-0">الهاتف:</span>
                                    <span className="text-sm font-mono font-bold tracking-wider flex-1" dir="ltr">{pm.accountNumber}</span>
                                    <CopyBtn text={pm.accountNumber} />
                                  </div>
                                )}
                                {pm.instructions && <p className="text-xs text-muted-foreground">{pm.instructions}</p>}
                              </motion.div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {selectedPaymentMethod && !isCashPayment && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-4 border-t border-border">
                      <Label className="flex items-center gap-2 font-semibold">
                        <Upload className="w-4 h-4 text-beneficiary" />
                        إثبات الدفع (اختياري)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        قم بتحويل المبلغ ثم ارفع صورة إثبات الدفع. يمكنك أيضاً إرسالها عبر الواتساب بعد تأكيد الطلب.
                      </p>
                      {paymentProofPreview ? (
                        <div className="relative rounded-xl overflow-hidden border border-border">
                          <img src={paymentProofPreview} alt="إثبات الدفع" className="w-full max-h-48 object-cover" />
                          <button onClick={() => { setPaymentProofFile(null); setPaymentProofPreview(null); }} className="absolute top-2 left-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-border hover:border-beneficiary/50 cursor-pointer transition-colors">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">اضغط لرفع صورة إثبات الدفع</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handlePaymentProofChange} />
                        </label>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Coupon */}
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-beneficiary" />
                  كوبون خصم (اختياري)
                </Label>
                <div className="flex gap-2">
                  <Input placeholder="أدخل كود الكوبون" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} dir="ltr" className="flex-1" />
                  <Button variant="outline" className="border-beneficiary text-beneficiary shrink-0" onClick={validateCoupon} disabled={!couponCode}>تطبيق</Button>
                </div>
                {couponDiscount > 0 && (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    خصم الكوبون: {formatYemeniRial(couponDiscount)}
                  </p>
                )}
                {loyaltyPoints >= loyaltyRedemptionThreshold && loyaltyRedemptionRate > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl glass">
                    <input
                      type="checkbox"
                      id="loyalty-check-multi"
                      checked={useLoyaltyPoints}
                      onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-beneficiary text-beneficiary focus:ring-beneficiary"
                    />
                    <Label htmlFor="loyalty-check-multi" className="cursor-pointer">
                      استخدام {toArabicNum(loyaltyPoints)} نقطة ولاء (خصم {formatYemeniRial(Math.round(loyaltyPoints / loyaltyRedemptionRate))})
                    </Label>
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {/* Step 5: Summary */}
          {currentStep === 4 && (
            <GlassCard variant="beneficiary" className="space-y-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-beneficiary" />
                ملخص الطلب
              </h2>

              {/* Services List */}
              <div className="glass rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold">الخدمات ({toArabicNum(selectedServices.length)})</p>
                {selectedServices.map((service) => (
                  <div key={service.id} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{service.nameAr}</span>
                    <Currency amount={service.basePrice} className="text-sm" />
                  </div>
                ))}
                <div className="border-t border-border/50 pt-2 space-y-1">
                  {scheduledDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">الموعد</span>
                      <span className="font-medium">{scheduledDate} {scheduledTime}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">العنوان</span>
                    <span className="font-medium max-w-[60%] text-left truncate">{address}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">طريقة الدفع</span>
                    <span className="font-medium">{selectedPaymentMethod?.nameAr || 'غير محدد'}</span>
                  </div>
                  {!isCashPayment && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">إثبات الدفع</span>
                      <span className="font-medium">{paymentProofFile ? '✓ مرفق' : 'سيتم إرساله عبر الواتساب'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing breakdown */}
              <div className="glass rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">مجموع الأسعار الأساسية</span>
                  <Currency amount={totalBasePrice} className="text-sm" />
                </div>
                {totalNightFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-orange-600">رسوم ليلية</span>
                    <Currency amount={totalNightFee} className="text-xs text-orange-600" />
                  </div>
                )}
                {totalFridayFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-orange-600">رسوم الجمعة</span>
                    <Currency amount={totalFridayFee} className="text-xs text-orange-600" />
                  </div>
                )}
                {totalEmergencyFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-red-600">رسوم الطوارئ</span>
                    <Currency amount={totalEmergencyFee} className="text-xs text-red-600" />
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-600">خصم الكوبون</span>
                    <Currency amount={couponDiscount} className="text-xs text-green-600" />
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-600">خصم نقاط الولاء</span>
                    <Currency amount={loyaltyDiscount} className="text-xs text-green-600" />
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                  <span className="font-bold text-base">المبلغ الإجمالي</span>
                  <Currency amount={grandTotal} className="text-lg text-beneficiary font-bold" />
                </div>
              </div>
            </GlassCard>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4 pt-4">
        <Button variant="outline" onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))} disabled={currentStep === 0} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          السابق
        </Button>

        {currentStep < steps.length - 1 ? (
          <Button onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))} disabled={!canProceed()} className="bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground gap-2">
            التالي
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed() || !selectedPaymentMethodId} className="bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground gap-2 min-w-[160px]">
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {isCashPayment ? 'تأكيد الطلب' : 'تأكيد وإرسال إثبات الدفع'}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Sticky Pricing Summary Bar */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border shadow-lg"
      >
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">{toArabicNum(selectedServices.length)} خدمات: {formatYemeniRial(totalBasePrice)}</span>
                {totalNightFee > 0 && (
                  <span className="text-xs text-orange-600">+ ليلي: {formatYemeniRial(totalNightFee)}</span>
                )}
                {totalFridayFee > 0 && (
                  <span className="text-xs text-orange-600">+ جمعة: {formatYemeniRial(totalFridayFee)}</span>
                )}
                {totalEmergencyFee > 0 && (
                  <span className="text-xs text-red-600">+ طوارئ: {formatYemeniRial(totalEmergencyFee)}</span>
                )}
                {couponDiscount > 0 && (
                  <span className="text-xs text-green-600">- كوبون: {formatYemeniRial(couponDiscount)}</span>
                )}
                {loyaltyDiscount > 0 && (
                  <span className="text-xs text-green-600">- ولاء: {formatYemeniRial(loyaltyDiscount)}</span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-left">
              <p className="text-[10px] text-muted-foreground">الإجمالي</p>
              <Currency amount={grandTotal} className="text-lg text-beneficiary font-bold" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function MultiServiceRequestPage() {
  return (
    <Suspense fallback={null}>
      <MultiServiceRequestPageInner />
    </Suspense>
  );
}
