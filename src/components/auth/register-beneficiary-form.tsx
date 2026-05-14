'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Lock,
  Eye,
  EyeOff,
  User,
  MapPin,
  ArrowRight,
  Heart,
  Users,
  FileText,
  AlertCircle,
  Sparkles,
  Shield,
  Activity,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/stores/auth-store';
import { YEMEN_GOVERNORATES } from '@/lib/constants/governorates';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { cn } from '@/lib/utils';

const beneficiaryRegisterSchema = z
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
    address: z.string().min(1, 'العنوان مطلوب'),
    governorate: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    referralCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });

type BeneficiaryRegisterFormValues = z.infer<typeof beneficiaryRegisterSchema>;

interface RegisterBeneficiaryFormProps {
  onBack?: () => void;
  className?: string;
}

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[
        { x: '8%', y: '12%', size: 12, delay: 0, duration: 7 },
        { x: '88%', y: '20%', size: 9, delay: 1.2, duration: 6 },
        { x: '78%', y: '70%', size: 11, delay: 0.6, duration: 8 },
        { x: '18%', y: '78%', size: 8, delay: 2.1, duration: 5.5 },
        { x: '52%', y: '8%', size: 10, delay: 3.2, duration: 6.5 },
      ].map((p, i) => (
        <motion.div
          key={i}
          className="absolute text-violet-400/10 dark:text-violet-400/8"
          style={{ left: p.x, top: p.y, fontSize: p.size }}
          animate={{ y: [0, -14, 0], rotate: [0, 90, 180, 270, 360], opacity: [0.12, 0.28, 0.12] }}
          transition={{ duration: p.duration, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
        >
          +
        </motion.div>
      ))}
      {[
        { x: '14%', y: '42%', size: 4, delay: 0.4 },
        { x: '92%', y: '58%', size: 3, delay: 1.1 },
        { x: '62%', y: '88%', size: 5, delay: 2.4 },
        { x: '38%', y: '18%', size: 3, delay: 0.2 },
      ].map((p, i) => (
        <motion.div
          key={`dot-${i}`}
          className="absolute rounded-full bg-violet-400/8"
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
  'hover:border-violet-300 dark:hover:border-violet-700',
  'focus:ring-2 focus:ring-violet-400/20 focus:border-violet-400 dark:focus:border-violet-500',
  'placeholder:text-muted-foreground/40',
);

export function RegisterBeneficiaryForm({ onBack, className }: RegisterBeneficiaryFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const registerBeneficiary = useAuthStore((s) => s.registerBeneficiary);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<BeneficiaryRegisterFormValues>({
    resolver: zodResolver(beneficiaryRegisterSchema),
    defaultValues: {
      name: '',
      phone: '',
      password: '',
      confirmPassword: '',
      address: '',
      governorate: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      referralCode: '',
    },
  });

  const onSubmit = async (data: BeneficiaryRegisterFormValues) => {
    clearError();
    try {
      await registerBeneficiary({
        name: data.name,
        phone: data.phone,
        password: data.password,
        address: data.address,
        governorate: data.governorate as typeof YEMEN_GOVERNORATES[number]['value'] | undefined,
        referralCode: data.referralCode || undefined,
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
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 via-transparent to-purple-50/50 dark:from-violet-950/30 dark:via-transparent dark:to-purple-950/30 pointer-events-none" />
      <FloatingParticles />
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-violet-500 to-purple-600" />

      <div className="relative p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-7">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            className="relative inline-block mb-4"
          >
            <div className="absolute inset-0 blur-xl rounded-2xl bg-violet-400/20" />
            <div className="relative w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
              <Heart className="w-8 h-8 text-white" fill="currentColor" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-2xl font-black tracking-tight mb-1"
          >
            إنشاء حساب مستفيد
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-sm text-muted-foreground flex items-center justify-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-violet-500" />
            أنشئ حسابك للحصول على خدمات الرعاية الصحية
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
            <Label htmlFor="ben-name" className="text-sm font-semibold">الاسم الكامل</Label>
            <div className="relative">
              <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="ben-name"
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
            <Label htmlFor="ben-phone" className="text-sm font-semibold">رقم الهاتف</Label>
            <div className="relative">
              <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="ben-phone"
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

          {/* Address + GPS */}
          <motion.div {...fieldAnim(0.43)} className="space-y-2">
            <Label htmlFor="ben-address" className="text-sm font-semibold">العنوان</Label>
            <GpsLocationButton
              onLocationDetected={(loc) => {
                if (loc.address && loc.address !== `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`) {
                  setValue('address', loc.address);
                }
                if (loc.governorateValue) {
                  setValue('governorate', loc.governorateValue);
                }
              }}
              placeholder='اضغط "تحديد موقعي" لرفع موقعك الجغرافي'
              label="تحديد موقعي"
            />
            <div className="relative">
              <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="ben-address"
                placeholder="عنوانك التفصيلي"
                className={cn(inputClass, errors.address && 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400/20')}
                {...register('address')}
              />
            </div>
            <AnimatePresence mode="wait">
              {errors.address && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-xs text-destructive mr-1">
                  {errors.address.message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Emergency contact row */}
          <motion.div {...fieldAnim(0.46)} className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ben-emergency-name" className="text-sm font-semibold">جهة اتصال الطوارئ</Label>
              <div className="relative">
                <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
                <Input
                  id="ben-emergency-name"
                  placeholder="الاسم"
                  className={cn(
                    'pr-10 text-right h-11 rounded-xl text-[14px]',
                    'bg-white/60 dark:bg-slate-800/60',
                    'border-2 border-slate-200/80 dark:border-slate-700/80',
                    'hover:border-violet-300 dark:hover:border-violet-700',
                    'focus:ring-2 focus:ring-violet-400/20 focus:border-violet-400',
                    'placeholder:text-muted-foreground/40 transition-all duration-200',
                  )}
                  {...register('emergencyContactName')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ben-emergency-phone" className="text-sm font-semibold">هاتف الطوارئ</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
                <Input
                  id="ben-emergency-phone"
                  type="tel"
                  placeholder="7XXXXXXXX"
                  className={cn(
                    'pr-10 text-right h-11 rounded-xl text-[14px]',
                    'bg-white/60 dark:bg-slate-800/60',
                    'border-2 border-slate-200/80 dark:border-slate-700/80',
                    'hover:border-violet-300 dark:hover:border-violet-700',
                    'focus:ring-2 focus:ring-violet-400/20 focus:border-violet-400',
                    'placeholder:text-muted-foreground/40 transition-all duration-200',
                  )}
                  dir="ltr"
                  {...register('emergencyContactPhone')}
                />
              </div>
            </div>
          </motion.div>

          {/* Referral Code */}
          <motion.div {...fieldAnim(0.48)} className="space-y-2">
            <Label htmlFor="ben-referral" className="text-sm font-semibold">
              كود الإحالة{' '}
              <span className="text-muted-foreground font-normal text-xs">(اختياري)</span>
            </Label>
            <div className="relative">
              <FileText className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="ben-referral"
                placeholder="AF-XXXXXX"
                className={cn(inputClass, 'pl-4')}
                dir="ltr"
                {...register('referralCode')}
              />
            </div>
          </motion.div>

          {/* Password */}
          <motion.div {...fieldAnim(0.5)} className="space-y-2">
            <Label htmlFor="ben-password" className="text-sm font-semibold">كلمة المرور</Label>
            <div className="relative">
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="ben-password"
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
          <motion.div {...fieldAnim(0.53)} className="space-y-2">
            <Label htmlFor="ben-confirm-password" className="text-sm font-semibold">تأكيد كلمة المرور</Label>
            <div className="relative">
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="ben-confirm-password"
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
            transition={{ delay: 0.58, duration: 0.4 }}
          >
            <Button
              type="submit"
              className={cn(
                'w-full h-12 rounded-xl text-[15px] font-bold transition-all duration-300',
                'bg-gradient-to-l from-violet-500 to-purple-600',
                'shadow-lg shadow-violet-500/25',
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
            transition={{ delay: 0.62, duration: 0.4 }}
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
