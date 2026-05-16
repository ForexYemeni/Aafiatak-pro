'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Lock,
  Eye,
  EyeOff,
  Stethoscope,
  User,
  CreditCard,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Shield,
  Activity,
  Check,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/stores/auth-store';
import { YEMEN_GOVERNORATES } from '@/lib/constants/governorates';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { cn } from '@/lib/utils';
import {
  DEFAULT_SPECIALIZATIONS,
  SPECIALIZATION_CATEGORIES,
  SPECIALIZATION_CATEGORIES_META,
  getCategoryMeta,
} from '@/lib/constants';

const nurseRegisterSchema = z
  .object({
    name: z
      .string()
      .min(1, 'الاسم مطلوب')
      .min(3, 'الاسم يجب أن يكون ٣ أحرف على الأقل'),
    phone: z
      .string()
      .min(1, 'رقم الهاتف مطلوب')
      .regex(/^(7\d{8}|\+9677\d{7,8}|9677\d{7,8})$/, 'صيغة رقم الهاتف غير صحيحة'),
    password: z
      .string()
      .min(1, 'كلمة المرور مطلوبة')
      .min(6, 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل'),
    confirmPassword: z.string().min(1, 'تأكيد كلمة المرور مطلوب'),
    specialization: z.string().min(1, 'التخصص مطلوب'),
    licenseNumber: z.string().min(1, 'رقم الترخيص مطلوب'),
    governorate: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });

type NurseRegisterFormValues = z.infer<typeof nurseRegisterSchema>;

interface RegisterNurseFormProps {
  onBack?: () => void;
  className?: string;
}

// Dynamic specializations grouped by category
const specializationGroups = SPECIALIZATION_CATEGORIES.map((cat) => {
  const meta = SPECIALIZATION_CATEGORIES_META.find((m) => m.id === cat);
  const items = DEFAULT_SPECIALIZATIONS
    .filter((s) => s.category === cat)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  return {
    category: cat,
    icon: meta?.icon || '📋',
    items,
  };
}).filter((g) => g.items.length > 0);

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[
        { x: '8%', y: '12%', size: 12, delay: 0, duration: 7 },
        { x: '88%', y: '20%', size: 9, delay: 1.4, duration: 6 },
        { x: '80%', y: '72%', size: 11, delay: 0.7, duration: 8 },
        { x: '15%', y: '80%', size: 8, delay: 2.2, duration: 5.5 },
        { x: '50%', y: '6%', size: 10, delay: 3.1, duration: 6.5 },
      ].map((p, i) => (
        <motion.div
          key={i}
          className="absolute text-sky-400/10 dark:text-sky-400/8"
          style={{ left: p.x, top: p.y, fontSize: p.size }}
          animate={{ y: [0, -14, 0], rotate: [0, 90, 180, 270, 360], opacity: [0.12, 0.28, 0.12] }}
          transition={{ duration: p.duration, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
        >
          +
        </motion.div>
      ))}
      {[
        { x: '14%', y: '44%', size: 4, delay: 0.5 },
        { x: '92%', y: '56%', size: 3, delay: 1.3 },
        { x: '60%', y: '86%', size: 5, delay: 2.6 },
        { x: '36%', y: '20%', size: 3, delay: 0.3 },
      ].map((p, i) => (
        <motion.div
          key={`dot-${i}`}
          className="absolute rounded-full bg-sky-400/8"
          style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
          animate={{ y: [0, -10, 0], opacity: [0.08, 0.22, 0.08] }}
          transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
        />
      ))}
    </div>
  );
}

const inputClass = cn(
  'pr-11 pl-4 text-right h-12 rounded-xl text-[15px] transition-all duration-200',
  'bg-white/60 dark:bg-slate-800/60',
  'border-2 border-slate-200/80 dark:border-slate-700/80',
  'hover:border-sky-300 dark:hover:border-sky-700',
  'focus:ring-2 focus:ring-sky-400/20 focus:border-sky-400 dark:focus:border-sky-500',
  'placeholder:text-muted-foreground/40',
);

export function RegisterNurseForm({ onBack, className }: RegisterNurseFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('تمريض');
  const registerNurse = useAuthStore((s) => s.registerNurse);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NurseRegisterFormValues>({
    resolver: zodResolver(nurseRegisterSchema),
    defaultValues: {
      name: '',
      phone: '',
      password: '',
      confirmPassword: '',
      specialization: '',
      licenseNumber: '',
      governorate: '',
    },
  });

  const selectedSpec = watch('specialization');
  const selectedSpecMeta = selectedSpec ? DEFAULT_SPECIALIZATIONS.find((s) => s.id === selectedSpec) : null;

  const handleSelectSpec = (specId: string) => {
    setValue('specialization', specId, { shouldValidate: true });
  };

  // Get items for current category
  const currentCategoryItems = DEFAULT_SPECIALIZATIONS
    .filter((s) => s.category === selectedCategory)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const onSubmit = async (data: NurseRegisterFormValues) => {
    clearError();
    try {
      await registerNurse({
        name: data.name,
        phone: data.phone,
        password: data.password,
        specialization: data.specialization,
        licenseNumber: data.licenseNumber,
        governorate: data.governorate as typeof YEMEN_GOVERNORATES[number]['value'] | undefined,
      });
    } catch {
      // Error is handled in the store
    }
  };

  const fieldAnim = (delay: number) => ({
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    transition: { delay, duration: 0.4 },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-3xl w-full max-w-md mx-auto',
        'bg-white/80 dark:bg-slate-900/80',
        'backdrop-blur-2xl',
        'border border-white/40 dark:border-white/10',
        'shadow-2xl shadow-black/5 dark:shadow-black/30',
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50/50 via-transparent to-teal-50/50 dark:from-sky-950/30 dark:via-transparent dark:to-teal-950/30 pointer-events-none" />
      <FloatingParticles />
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-sky-500 to-teal-600" />

      <div className="relative p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-7">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            className="relative inline-block mb-4"
          >
            <div className="absolute inset-0 blur-xl rounded-2xl bg-sky-400/20" />
            <div className="relative w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-gradient-to-br from-sky-500 to-teal-600 shadow-lg shadow-sky-500/25">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-2xl font-black tracking-tight mb-1"
          >
            إنشاء حساب ممرض
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-sm text-muted-foreground flex items-center justify-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-sky-500" />
            انضم كممرض/ـة معتمد/ـة على منصة عافيتك
          </motion.p>
        </div>

        {/* Error */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mb-4"
            >
              <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-xl p-3 border border-red-200/50 dark:border-red-800/50">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <motion.div {...fieldAnim(0.35)} className="space-y-2">
            <Label htmlFor="nurse-name" className="text-sm font-semibold">الاسم الكامل</Label>
            <div className="relative">
              <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="nurse-name"
                placeholder="أدخل اسمك الكامل"
                className={cn(inputClass, errors.name && 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400/20')}
                {...register('name')}
              />
            </div>
            <AnimatePresence mode="wait">
              {errors.name && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-xs text-destructive mr-1">
                  {errors.name.message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Phone */}
          <motion.div {...fieldAnim(0.4)} className="space-y-2">
            <Label htmlFor="nurse-phone" className="text-sm font-semibold">رقم الهاتف</Label>
            <div className="relative">
              <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="nurse-phone"
                type="tel"
                placeholder="7XXXXXXXX"
                className={cn(inputClass, 'pl-4', errors.phone && 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400/20')}
                dir="ltr"
                {...register('phone')}
              />
            </div>
            <AnimatePresence mode="wait">
              {errors.phone && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-xs text-destructive mr-1">
                  {errors.phone.message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Specialization Selection - Visual Grid */}
          <motion.div {...fieldAnim(0.43)} className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-sky-500" />
              التخصص
            </Label>

            {/* Category Tabs */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
              {SPECIALIZATION_CATEGORIES_META.map((cat) => {
                const isActive = selectedCategory === cat.id;
                const hasSelected = selectedSpec && DEFAULT_SPECIALIZATIONS.some((s) => s.id === selectedSpec && s.category === cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border-2',
                      isActive
                        ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 shadow-sm'
                        : hasSelected
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                          : 'bg-white/40 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/60 text-muted-foreground hover:border-sky-200 dark:hover:border-sky-800',
                    )}
                  >
                    <span className="ml-1">{cat.icon}</span>
                    {cat.label}
                    {hasSelected && <Check className="w-3 h-3 inline mr-1 text-green-500" />}
                  </button>
                );
              })}
            </div>

            {/* Specialization Items Grid */}
            <div className="grid grid-cols-2 gap-2 min-h-[80px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedCategory}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="col-span-2 grid grid-cols-2 gap-2"
                >
                  {currentCategoryItems.map((spec) => {
                    const isSelected = selectedSpec === spec.id;
                    const catMeta = getCategoryMeta(spec.category);
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => handleSelectSpec(spec.id)}
                        className={cn(
                          'relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 border-2 text-right',
                          isSelected
                            ? 'bg-sky-100 dark:bg-sky-900/40 border-sky-400 dark:border-sky-600 text-sky-800 dark:text-sky-200 shadow-md shadow-sky-200/50 dark:shadow-sky-900/30 scale-[1.02]'
                            : 'bg-white/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60 hover:border-sky-200 dark:hover:border-sky-800 hover:bg-white/80 dark:hover:bg-slate-800/80',
                        )}
                      >
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center"
                          >
                            <Check className="w-3 h-3 text-white" />
                          </motion.div>
                        )}
                        <span className="text-base shrink-0">{catMeta?.icon || '📋'}</span>
                        <span className="font-medium text-[13px] leading-tight">{spec.label}</span>
                      </button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Selected specialization display */}
            <AnimatePresence mode="wait">
              {selectedSpecMeta && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800"
                >
                  <Check className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="text-xs text-sky-700 dark:text-sky-300">
                    التخصص المختار: <span className="font-bold">{selectedSpecMeta.label}</span>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {errors.specialization && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-xs text-destructive mr-1">
                  {errors.specialization.message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* License Number - Full Width */}
          <motion.div {...fieldAnim(0.46)} className="space-y-2">
            <Label htmlFor="nurse-license" className="text-sm font-semibold">رقم الترخيص</Label>
            <div className="relative">
              <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
              <Input
                id="nurse-license"
                placeholder="رقم الترخيص"
                className={cn(
                  'pr-10 text-right h-12 rounded-xl text-[14px]',
                  'bg-white/60 dark:bg-slate-800/60',
                  'border-2 border-slate-200/80 dark:border-slate-700/80',
                  'hover:border-sky-300 dark:hover:border-sky-700',
                  'focus:ring-2 focus:ring-sky-400/20 focus:border-sky-400',
                  'placeholder:text-muted-foreground/40 transition-all duration-200',
                  errors.licenseNumber && 'border-red-400',
                )}
                {...register('licenseNumber')}
              />
            </div>
            <AnimatePresence mode="wait">
              {errors.licenseNumber && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-xs text-destructive mr-1">
                  {errors.licenseNumber.message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Location GPS */}
          <motion.div {...fieldAnim(0.46)} className="space-y-2">
            <Label className="text-sm font-semibold">الموقع</Label>
            <GpsLocationButton
              onLocationDetected={(loc) => {
                if (loc.governorateValue) {
                  setValue('governorate', loc.governorateValue);
                }
              }}
              placeholder='اضغط "تحديد موقعي" لرفع موقعك الجغرافي'
              label="تحديد موقعي"
            />
          </motion.div>

          {/* Password */}
          <motion.div {...fieldAnim(0.49)} className="space-y-2">
            <Label htmlFor="nurse-password" className="text-sm font-semibold">كلمة المرور</Label>
            <div className="relative">
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="nurse-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••"
                className={cn(inputClass, 'pl-11', errors.password && 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400/20')}
                dir="ltr"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors p-1"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {showPassword ? (
                    <motion.div key="off" initial={{ scale: 0.5, opacity: 0, rotate: -90 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }}>
                      <EyeOff className="w-[18px] h-[18px]" />
                    </motion.div>
                  ) : (
                    <motion.div key="on" initial={{ scale: 0.5, opacity: 0, rotate: -90 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }}>
                      <Eye className="w-[18px] h-[18px]" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
            <AnimatePresence mode="wait">
              {errors.password && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-xs text-destructive mr-1">
                  {errors.password.message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Confirm Password */}
          <motion.div {...fieldAnim(0.52)} className="space-y-2">
            <Label htmlFor="nurse-confirm-password" className="text-sm font-semibold">تأكيد كلمة المرور</Label>
            <div className="relative">
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="nurse-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••"
                className={cn(inputClass, 'pl-11', errors.confirmPassword && 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400/20')}
                dir="ltr"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors p-1"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {showConfirmPassword ? (
                    <motion.div key="off" initial={{ scale: 0.5, opacity: 0, rotate: -90 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }}>
                      <EyeOff className="w-[18px] h-[18px]" />
                    </motion.div>
                  ) : (
                    <motion.div key="on" initial={{ scale: 0.5, opacity: 0, rotate: -90 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }}>
                      <Eye className="w-[18px] h-[18px]" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
            <AnimatePresence mode="wait">
              {errors.confirmPassword && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-xs text-destructive mr-1">
                  {errors.confirmPassword.message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Submit */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.57, duration: 0.4 }}
          >
            <Button
              type="submit"
              className={cn(
                'w-full h-12 rounded-xl text-[15px] font-bold transition-all duration-300',
                'bg-gradient-to-l from-sky-500 to-teal-600',
                'shadow-lg shadow-sky-500/25',
                'hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]',
                'disabled:opacity-60 disabled:hover:scale-100',
              )}
              disabled={isLoading}
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جارٍ إنشاء الحساب...</span>
                  </motion.div>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    إنشاء الحساب
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
        </form>

        {/* Back to Login */}
        {onBack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="mt-5 text-center"
          >
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 justify-center transition-colors group"
            >
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              العودة لتسجيل الدخول
            </button>
          </motion.div>
        )}

        <div className="mt-5 flex items-center justify-center gap-1.5 text-muted-foreground/30">
          <Shield className="w-3 h-3" />
          <span className="text-[10px]">بياناتك مشفرة ومحمية</span>
        </div>
      </div>
    </motion.div>
  );
}
