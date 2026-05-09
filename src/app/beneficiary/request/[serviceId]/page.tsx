'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Smartphone,
  Building2,
  HandCoins,
  Copy,
  Check,
  MessageCircle,
  Upload,
  Image as ImageIcon,
  X,
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
  { number: 1, title: 'تفاصيل الخدمة', icon: Stethoscope },
  { number: 2, title: 'الموعد والوقت', icon: Calendar },
  { number: 3, title: 'العنوان', icon: MapPin },
  { number: 4, title: 'الدفع', icon: CreditCard },
  { number: 5, title: 'تأكيد الطلب', icon: CheckCircle2 },
];

// Payment method from API
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

// Copy button helper
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
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [isEmergency, setIsEmergency] = useState(false);
  const [pricing, setPricing] = useState<ServicePricing | null>(null);

  // Payment methods from API
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [emergencyFee, setEmergencyFee] = useState(5000);
  const [supportWhatsApp, setSupportWhatsApp] = useState('+967123456789');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);

  // Pricing settings from API
  const [commissionRate, setCommissionRate] = useState(15);
  const [nightFeeEnabled, setNightFeeEnabled] = useState(false);
  const [nightFeePercent, setNightFeePercent] = useState(0);
  const [nightStartHour, setNightStartHour] = useState(22);
  const [nightEndHour, setNightEndHour] = useState(6);
  const [fridayFeeEnabled, setFridayFeeEnabled] = useState(false);
  const [fridayFeePercent, setFridayFeePercent] = useState(0);

  // Loyalty points
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyRedemptionRate, setLoyaltyRedemptionRate] = useState(0);
  const [loyaltyRedemptionThreshold, setLoyaltyRedemptionThreshold] = useState(100);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  // Get selected payment method details
  const selectedPaymentMethod = paymentMethods.find(pm => pm.id === selectedPaymentMethodId);
  const isCashPayment = selectedPaymentMethod?.type === 'cash';

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

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/methods');
      const data = await res.json();
      if (data.success && data.data) {
        const methods = Array.isArray(data.data) ? data.data : [];
        setPaymentMethods(methods);
        // Auto-select cash if available
        const cashMethod = methods.find((m: PaymentMethodItem) => m.type === 'cash');
        if (cashMethod) setSelectedPaymentMethodId(cashMethod.id);
      }
    } catch {
      // silent
    }
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
        const wa = supportData.data.supportWhatsAppNumbers?.[0] || supportData.data.supportWhatsApp || '+967123456789';
        setSupportWhatsApp(wa);
      }
    } catch {
      // silent
    }
  }, []);

  // Fetch loyalty points
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
    fetchService();
    fetchPaymentMethods();
    fetchSettings();
    fetchLoyalty();
  }, [fetchService, fetchPaymentMethods, fetchSettings, fetchLoyalty]);

  // Calculate pricing when relevant fields change
  useEffect(() => {
    if (!service) return;
    const basePrice = service.basePrice;

    // Calculate night fee
    let nightFee = 0;
    if (nightFeeEnabled && scheduledTime) {
      const hour = parseInt(scheduledTime.split(':')[0]);
      const isNight = nightStartHour > nightEndHour
        ? (hour >= nightStartHour || hour < nightEndHour)
        : (hour >= nightStartHour && hour < nightEndHour);
      if (isNight) {
        nightFee = Math.round(basePrice * (nightFeePercent / 100));
      }
    }

    // Calculate Friday fee
    let fridayFee = 0;
    if (fridayFeeEnabled && scheduledDate) {
      const dayOfWeek = new Date(scheduledDate).getDay();
      if (dayOfWeek === 5) { // Friday
        fridayFee = Math.round(basePrice * (fridayFeePercent / 100));
      }
    }

    const emergencyFeeAmount = isEmergency ? emergencyFee : 0;
    const loyaltyDiscount = (useLoyaltyPoints && loyaltyRedemptionRate > 0 && loyaltyPoints >= loyaltyRedemptionThreshold)
      ? Math.round(loyaltyPoints / loyaltyRedemptionRate)
      : 0;
    const subtotal = basePrice + nightFee + fridayFee + emergencyFeeAmount;
    const discount = couponDiscount;
    const totalPrice = Math.max(0, subtotal - discount - loyaltyDiscount);
    const commission = Math.round(totalPrice * (commissionRate / 100));
    const nursePayout = totalPrice - commission;

    setPricing({
      basePrice,
      nightFee,
      fridayFee,
      emergencyFee: emergencyFeeAmount,
      discount,
      loyaltyDiscount,
      couponDiscount: couponDiscount,
      totalPrice,
      commission,
      nursePayout,
    });
  }, [service, isEmergency, couponDiscount, emergencyFee, commissionRate, nightFeeEnabled, nightFeePercent, nightStartHour, nightEndHour, fridayFeeEnabled, fridayFeePercent, scheduledDate, scheduledTime, useLoyaltyPoints, loyaltyPoints, loyaltyRedemptionRate, loyaltyRedemptionThreshold]);

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

  const handlePaymentProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPaymentProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!token || !service || !pricing || !selectedPaymentMethod) return;
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
          paymentMethod: selectedPaymentMethod.type,
          paymentMethodId: selectedPaymentMethodId,
          couponCode: couponCode || undefined,
          hasPaymentProof: !isCashPayment && !!paymentProofFile,
          paymentProofData: !isCashPayment && paymentProofPreview ? paymentProofPreview : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const orderId = data.data?.id || data.data?._id?.toString() || '';

        // If non-cash payment, open WhatsApp with professional message
        if (!isCashPayment) {
          const msg = buildWhatsAppMessage(orderId, service, pricing);
          const waUrl = `https://wa.me/${supportWhatsApp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
          window.open(waUrl, '_blank');
        }

        toast({ title: isCashPayment ? 'تم إنشاء الطلب بنجاح' : 'تم إنشاء الطلب - يرجى إرسال إثبات الدفع عبر الواتساب' });
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

  const buildWhatsAppMessage = (orderId: string, svc: Service, prc: ServicePricing) => {
    const lines = [
      '🏥 *عافيتك - طلب خدمة جديدة*',
      '━━━━━━━━━━━━━━━━━━',
      `📋 *رقم الطلب:* \`#${orderId.slice(-6).toUpperCase()}\``,
      `🆔 *معرف الطلب:* \`${orderId}\``,
      `🩺 *الخدمة:* ${svc.nameAr}`,
      `💰 *المبلغ:* ${formatYemeniRial(prc.totalPrice)}`,
    ];
    if (prc.emergencyFee > 0) {
      lines.push(`🚨 *رسوم الطوارئ:* ${formatYemeniRial(prc.emergencyFee)}`);
    }
    lines.push(`👤 *المستفيد:* ${useAuthStore.getState().user?.name || 'غير محدد'}`);
    lines.push(`📱 *رقم المستفيد:* ${useAuthStore.getState().user?.phone || 'غير محدد'}`);
    if (address) lines.push(`📍 *العنوان:* ${address}`);
    if (selectedPaymentMethod) {
      lines.push(`💳 *طريقة الدفع:* ${selectedPaymentMethod.nameAr}`);
    }
    lines.push('━━━━━━━━━━━━━━━━━━');
    lines.push('📎 إثبات الدفع مرفق');
    return lines.join('\n');
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: return !!service;
      case 1: return true;
      case 2: return lat !== 0 && lng !== 0;
      case 3: return !!selectedPaymentMethodId;
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

  // Group payment methods by type
  const walletMethods = paymentMethods.filter(pm => pm.type === 'wallet_deposit');
  const bankMethods = paymentMethods.filter(pm => pm.type === 'bank_transfer');
  const cashMethods = paymentMethods.filter(pm => pm.type === 'cash');

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'wallet_deposit': return <Smartphone className="w-5 h-5" />;
      case 'bank_transfer': return <Building2 className="w-5 h-5" />;
      case 'cash': return <HandCoins className="w-5 h-5" />;
      default: return <CreditCard className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'wallet_deposit': return 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800';
      case 'bank_transfer': return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      case 'cash': return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      default: return 'bg-muted border-border';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'wallet_deposit': return 'إيداع محفظة';
      case 'bank_transfer': return 'تحويل بنكي';
      case 'cash': return 'نقدي عند الوصول';
      default: return type;
    }
  };

  // Calculate loyalty discount for display
  const loyaltyDiscount = (useLoyaltyPoints && loyaltyRedemptionRate > 0 && loyaltyPoints >= loyaltyRedemptionThreshold)
    ? Math.round(loyaltyPoints / loyaltyRedemptionRate)
    : 0;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
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
                  isActive ? 'bg-beneficiary text-beneficiary-foreground' : isCompleted ? 'bg-beneficiary/10 text-beneficiary' : 'glass text-muted-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{step.title}</span>
                <span className="sm:hidden">{step.number}</span>
              </button>
              {index < steps.length - 1 && <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div key={currentStep} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
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
              {/* Full Price Breakdown - shown from the start */}
              <div className="glass rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">السعر الأساسي</span>
                  <Currency amount={service.basePrice} className="text-sm" />
                </div>
                {pricing && pricing.nightFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-orange-600">رسوم الخدمة الليلية ({nightFeePercent}%)</span>
                    <Currency amount={pricing.nightFee} className="text-xs text-orange-600" />
                  </div>
                )}
                {pricing && pricing.fridayFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-orange-600">رسوم خدمة الجمعة ({fridayFeePercent}%)</span>
                    <Currency amount={pricing.fridayFee} className="text-xs text-orange-600" />
                  </div>
                )}
                {isEmergency && pricing && pricing.emergencyFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-red-600">رسوم الطوارئ</span>
                    <Currency amount={pricing.emergencyFee} className="text-xs text-red-600" />
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                  <span className="font-bold text-base">المبلغ الإجمالي</span>
                  <Currency amount={pricing?.totalPrice || service.basePrice} className="text-lg text-beneficiary font-bold" />
                </div>
                <p className="text-[10px] text-muted-foreground text-center">يشمل جميع الرسوم والخدمات</p>
              </div>
              {service.isEmergency && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm">هذه خدمة طوارئ - سيتم تطبيق رسوم إضافية</span>
                </div>
              )}
              <div className="space-y-3">
                <Label>ملاحظات إضافية</Label>
                <Textarea placeholder="أضف أي ملاحظات للخدمة..." value={notes} onChange={(e) => setNotes(e.target.value)} dir="rtl" />
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
                  طلب طوارئ (رسوم إضافية {formatYemeniRial(emergencyFee)})
                </Label>
              </div>
              {isEmergency && pricing && pricing.emergencyFee > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-red-700 dark:text-red-400 font-medium">السعر بعد رسوم الطوارئ</span>
                    <Currency amount={pricing.totalPrice} className="text-lg text-red-600 dark:text-red-400 font-bold" />
                  </div>
                </motion.div>
              )}
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
                <Input id="date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} min={new Date().toISOString().split('T')[0]} dir="ltr" className="text-left" />
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
                <p className="text-xs text-muted-foreground">أضف أي تفاصيل تساعد الممرض/ـة في الوصول إليك</p>
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

              {/* Total Amount Summary */}
              {pricing && (
                <div className="rounded-xl bg-beneficiary/5 border border-beneficiary/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الخدمة</span>
                    <span className="text-sm font-medium">{service.nameAr}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">السعر الأساسي</span>
                    <Currency amount={pricing.basePrice} className="text-sm" />
                  </div>
                  {pricing.nightFee > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-orange-600">رسوم ليلية</span>
                      <Currency amount={pricing.nightFee} className="text-xs text-orange-600" />
                    </div>
                  )}
                  {pricing.fridayFee > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-orange-600">رسوم الجمعة</span>
                      <Currency amount={pricing.fridayFee} className="text-xs text-orange-600" />
                    </div>
                  )}
                  {pricing.emergencyFee > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-red-600">رسوم الطوارئ</span>
                      <Currency amount={pricing.emergencyFee} className="text-xs text-red-600" />
                    </div>
                  )}
                  {pricing.discount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-green-600">خصم الكوبون</span>
                      <Currency amount={-pricing.discount} className="text-xs text-green-600" />
                    </div>
                  )}
                  {pricing.loyaltyDiscount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-green-600">خصم نقاط الولاء</span>
                      <Currency amount={-pricing.loyaltyDiscount} className="text-xs text-green-600" />
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-beneficiary/20">
                    <span className="font-bold text-base">المبلغ الإجمالي</span>
                    <Currency amount={pricing.totalPrice} className="text-lg text-beneficiary font-bold" />
                  </div>
                  {selectedPaymentMethod && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs text-muted-foreground">طريقة الدفع المختارة</span>
                      <span className="text-xs font-semibold text-beneficiary">{selectedPaymentMethod.nameAr}</span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethods.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد طرق دفع متاحة حالياً</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Cash Methods */}
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

                  {/* Wallet Methods */}
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

                  {/* Bank/Exchange Methods */}
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

                  {/* Payment Proof Upload for non-cash */}
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

                {/* Loyalty Points Toggle */}
                {loyaltyPoints >= loyaltyRedemptionThreshold && loyaltyRedemptionRate > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl glass">
                    <input
                      type="checkbox"
                      id="loyalty-check"
                      checked={useLoyaltyPoints}
                      onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-beneficiary text-beneficiary focus:ring-beneficiary"
                    />
                    <Label htmlFor="loyalty-check" className="cursor-pointer">
                      استخدام {toArabicNum(loyaltyPoints)} نقطة ولاء (خصم {formatYemeniRial(Math.round(loyaltyPoints / loyaltyRedemptionRate))})
                    </Label>
                  </div>
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
                  <span className="font-medium text-sm">{selectedPaymentMethod?.nameAr || 'غير محدد'}</span>
                </div>
                {!isCashPayment && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">إثبات الدفع</span>
                    <span className="font-medium text-sm">{paymentProofFile ? '✓ مرفق' : 'سيتم إرساله عبر الواتساب'}</span>
                  </div>
                )}
              </div>

              {/* Payment Details for non-cash */}
              {selectedPaymentMethod && !isCashPayment && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 space-y-2">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">تفاصيل التحويل</p>
                  {selectedPaymentMethod.accountName && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">الاسم:</span>
                      <span className="text-sm font-medium">{selectedPaymentMethod.accountName}</span>
                    </div>
                  )}
                  {selectedPaymentMethod.accountNumber && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{selectedPaymentMethod.type === 'wallet_deposit' ? 'الرقم:' : 'الهاتف:'}</span>
                      <span className="text-sm font-mono font-bold" dir="ltr">{selectedPaymentMethod.accountNumber}</span>
                    </div>
                  )}
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-2">
                    <MessageCircle className="w-3.5 h-3.5" />
                    بعد التأكيد سيتم فتح الواتساب لإرسال إثبات الدفع
                  </p>
                </div>
              )}

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
      {pricing && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border shadow-lg"
        >
          <div className="max-w-2xl mx-auto px-4 py-3">
            {/* Compact pricing summary */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">الأساسي: {formatYemeniRial(pricing.basePrice)}</span>
                  {pricing.nightFee > 0 && (
                    <span className="text-xs text-orange-600">+ ليلي: {formatYemeniRial(pricing.nightFee)}</span>
                  )}
                  {pricing.fridayFee > 0 && (
                    <span className="text-xs text-orange-600">+ جمعة: {formatYemeniRial(pricing.fridayFee)}</span>
                  )}
                  {pricing.emergencyFee > 0 && (
                    <span className="text-xs text-red-600">+ طوارئ: {formatYemeniRial(pricing.emergencyFee)}</span>
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
                <Currency amount={pricing.totalPrice} className="text-lg text-beneficiary font-bold" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
