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
  Heart,
  Shield,
  Stethoscope,
  User,
  Activity,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';

// ============================================================================
// Validation Schema
// ============================================================================

const loginSchema = z.object({
  phone: z
    .string()
    .min(1, 'رقم الهاتف مطلوب')
    .regex(/^(7\d{8}|\+9677\d{7,8}|9677\d{7,8})$/, 'صيغة رقم الهاتف غير صحيحة (7XXXXXXXX)'),
  password: z
    .string()
    .min(1, 'كلمة المرور مطلوبة')
    .min(6, 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل'),
  role: z.enum(['admin', 'nurse', 'beneficiary'], {
    required_error: 'يرجى اختيار نوع الحساب',
  }),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ============================================================================
// Animated ECG Line
// ============================================================================

function EcgLine() {
  return (
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden pointer-events-none opacity-[0.12]">
      <svg
        className="w-full"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        style={{ height: '60px' }}
      >
        <path
          d="M0,60 L200,60 L220,60 L240,20 L260,100 L280,10 L300,80 L320,60 L400,60 L420,60 L440,25 L460,95 L480,15 L500,75 L520,60 L600,60 L800,60 L820,60 L840,22 L860,98 L880,12 L900,78 L920,60 L1000,60 L1200,60"
          fill="none"
          stroke="url(#login-ekg-gradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ekg-line-draw"
        />
        <defs>
          <linearGradient id="login-ekg-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0" />
            <stop offset="20%" stopColor="#14B8A6" stopOpacity="1" />
            <stop offset="50%" stopColor="#0D9488" stopOpacity="1" />
            <stop offset="80%" stopColor="#8B5CF6" stopOpacity="1" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ============================================================================
// Floating Medical Particles
// ============================================================================

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Plus signs */}
      {[
        { x: '10%', y: '15%', size: 14, delay: 0, duration: 6 },
        { x: '85%', y: '25%', size: 10, delay: 1.5, duration: 7 },
        { x: '75%', y: '75%', size: 12, delay: 0.8, duration: 8 },
        { x: '20%', y: '80%', size: 8, delay: 2, duration: 5 },
        { x: '50%', y: '10%', size: 10, delay: 3, duration: 6 },
      ].map((p, i) => (
        <motion.div
          key={i}
          className="absolute text-teal-400/10 dark:text-teal-400/8"
          style={{
            left: p.x,
            top: p.y,
            fontSize: p.size,
          }}
          animate={{
            y: [0, -15, 0],
            rotate: [0, 90, 180, 270, 360],
            opacity: [0.15, 0.3, 0.15],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
          }}
        >
          +
        </motion.div>
      ))}

      {/* Small circles */}
      {[
        { x: '15%', y: '45%', size: 4, delay: 0.5 },
        { x: '90%', y: '55%', size: 3, delay: 1.2 },
        { x: '60%', y: '85%', size: 5, delay: 2.5 },
        { x: '35%', y: '20%', size: 3, delay: 0.3 },
      ].map((p, i) => (
        <motion.div
          key={`dot-${i}`}
          className="absolute rounded-full bg-violet-400/8 dark:bg-violet-400/6"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -10, 0],
            opacity: [0.1, 0.25, 0.1],
          }}
          transition={{
            duration: 5 + i,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Login Form Component
// ============================================================================

interface LoginFormProps {
  onRegisterClick?: () => void;
  className?: string;
}

export function LoginForm({ onRegisterClick, className }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: '',
      password: '',
      role: 'beneficiary',
      rememberMe: false,
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: LoginFormValues) => {
    clearError();
    try {
      await login(data.phone, data.password);
    } catch {
      // Error is handled in the store
    }
  };

  const roleIconMap: Record<string, React.ElementType> = {
    admin: Shield,
    nurse: Stethoscope,
    beneficiary: User,
  };

  const roleColorMap: Record<string, { bg: string; text: string; gradient: string; shadow: string }> = {
    admin: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/25',
    },
    nurse: {
      bg: 'bg-sky-50 dark:bg-sky-900/20',
      text: 'text-sky-600 dark:text-sky-400',
      gradient: 'from-sky-500 to-teal-600',
      shadow: 'shadow-sky-500/25',
    },
    beneficiary: {
      bg: 'bg-violet-50 dark:bg-violet-900/20',
      text: 'text-violet-600 dark:text-violet-400',
      gradient: 'from-violet-500 to-purple-600',
      shadow: 'shadow-violet-500/25',
    },
  };

  const RoleIcon = roleIconMap[selectedRole] ?? User;
  const roleColors = roleColorMap[selectedRole] ?? roleColorMap.beneficiary;

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
      {/* Decorative gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 via-transparent to-violet-50/50 dark:from-teal-950/30 dark:via-transparent dark:to-violet-950/30 pointer-events-none" />

      {/* ECG line decoration */}
      <EcgLine />

      {/* Floating particles */}
      <FloatingParticles />

      {/* Top accent gradient bar */}
      <div className={cn(
        'absolute top-0 inset-x-0 h-1 bg-gradient-to-l transition-all duration-500',
        roleColors.gradient,
      )} />

      <div className="relative p-6 sm:p-8">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            className="relative inline-block mb-4"
          >
            {/* Glow effect behind icon */}
            <div className={cn(
              'absolute inset-0 blur-xl rounded-2xl transition-colors duration-500',
              selectedRole === 'admin' ? 'bg-amber-400/20' :
              selectedRole === 'nurse' ? 'bg-sky-400/20' :
              'bg-violet-400/20',
            )} />
            <div className={cn(
              'relative w-16 h-16 rounded-2xl mx-auto flex items-center justify-center transition-all duration-500',
              'bg-gradient-to-br',
              roleColors.gradient,
              'shadow-lg',
              roleColors.shadow,
            )}>
              <Heart className="w-8 h-8 text-white" fill="currentColor" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-2xl font-black tracking-tight mb-1"
          >
            عافيتك
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-sm text-muted-foreground flex items-center justify-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-teal-500" />
            منصة الرعاية الصحية المنزلية
          </motion.p>
        </div>

        {/* Error Message */}
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
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Role Selector — Card-based */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="space-y-2"
          >
            <Label className="text-sm font-semibold">نوع الحساب</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'beneficiary', label: 'مستفيد', sublabel: 'طلب خدمة', icon: User, gradient: 'from-violet-500 to-purple-600', ring: 'ring-violet-400/50', bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400' },
                { value: 'nurse', label: 'ممرض', sublabel: 'تقديم رعاية', icon: Stethoscope, gradient: 'from-sky-500 to-teal-600', ring: 'ring-sky-400/50', bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-600 dark:text-sky-400' },
                { value: 'admin', label: 'مدير', sublabel: 'إدارة النظام', icon: Shield, gradient: 'from-amber-500 to-orange-600', ring: 'ring-amber-400/50', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
              ] as const).map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.value;
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setValue('role', role.value as UserRole, { shouldValidate: true })}
                    className={cn(
                      'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200',
                      'focus:outline-none focus-visible:ring-2',
                      isSelected
                        ? cn('border-current ring-2', role.ring, role.text, role.bg)
                        : 'border-border bg-background/60 text-muted-foreground hover:border-border/80 hover:bg-muted/50 active:scale-95'
                    )}
                  >
                    {isSelected && (
                      <div className={cn('absolute inset-0 rounded-[10px] bg-gradient-to-br opacity-10', role.gradient)} />
                    )}
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200',
                      isSelected ? cn('bg-gradient-to-br', role.gradient, 'shadow-md') : 'bg-muted'
                    )}>
                      <Icon className={cn('w-4.5 h-4.5 transition-colors', isSelected ? 'text-white' : '')} />
                    </div>
                    <span className={cn('text-xs font-semibold leading-tight', isSelected ? role.text : '')}>{role.label}</span>
                    <span className={cn('text-[10px] leading-tight opacity-70', isSelected ? role.text : 'text-muted-foreground')}>{role.sublabel}</span>
                  </button>
                );
              })}
            </div>
            <AnimatePresence mode="wait">
              {errors.role && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs text-destructive mr-1"
                >
                  {errors.role.message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Phone */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="space-y-2"
          >
            <Label htmlFor="phone" className="text-sm font-semibold">رقم الهاتف</Label>
            <div className="relative">
              <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="phone"
                type="tel"
                placeholder="7XXXXXXXX"
                className={cn(
                  'pr-11 pl-4 text-right h-12 rounded-xl text-[15px] transition-all duration-200',
                  'bg-white/60 dark:bg-slate-800/60',
                  'border-2 border-slate-200/80 dark:border-slate-700/80',
                  'hover:border-teal-300 dark:hover:border-teal-700',
                  'focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 dark:focus:border-teal-500',
                  'placeholder:text-muted-foreground/40',
                  errors.phone && 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400/20',
                )}
                dir="ltr"
                {...register('phone')}
              />
            </div>
            <AnimatePresence mode="wait">
              {errors.phone && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs text-destructive mr-1"
                >
                  {errors.phone.message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Password */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            className="space-y-2"
          >
            <Label htmlFor="password" className="text-sm font-semibold">كلمة المرور</Label>
            <div className="relative">
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/60 pointer-events-none" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••"
                className={cn(
                  'pr-11 pl-11 text-right h-12 rounded-xl text-[15px] transition-all duration-200',
                  'bg-white/60 dark:bg-slate-800/60',
                  'border-2 border-slate-200/80 dark:border-slate-700/80',
                  'hover:border-teal-300 dark:hover:border-teal-700',
                  'focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 dark:focus:border-teal-500',
                  'placeholder:text-muted-foreground/40',
                  errors.password && 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400/20',
                )}
                dir="ltr"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors p-1"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {showPassword ? (
                    <motion.div
                      key="eyeoff"
                      initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                      transition={{ duration: 0.15 }}
                    >
                      <EyeOff className="w-[18px] h-[18px]" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="eye"
                      initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Eye className="w-[18px] h-[18px]" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
            <AnimatePresence mode="wait">
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs text-destructive mr-1"
                >
                  {errors.password.message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Remember Me */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="flex items-center gap-2"
          >
            <Checkbox
              id="remember"
              onCheckedChange={(checked) => setValue('rememberMe', checked === true)}
            />
            <Label htmlFor="remember" className="text-sm font-normal cursor-pointer text-muted-foreground">
              تذكرني
            </Label>
          </motion.div>

          {/* Submit */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.4 }}
          >
            <Button
              type="submit"
              className={cn(
                'w-full h-12 rounded-xl text-[15px] font-bold transition-all duration-300',
                'bg-gradient-to-l shadow-lg',
                roleColors.gradient,
                roleColors.shadow,
                'hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]',
                'disabled:opacity-60 disabled:hover:scale-100',
              )}
              disabled={isLoading}
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جارٍ تسجيل الدخول...</span>
                  </motion.div>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    تسجيل الدخول
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
        </form>

        {/* Register Link */}
        {onRegisterClick && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-muted-foreground">
              ليس لديك حساب؟{' '}
              <button
                type="button"
                onClick={onRegisterClick}
                className="text-teal-600 dark:text-teal-400 font-semibold hover:underline underline-offset-4 transition-colors"
              >
                إنشاء حساب جديد
              </button>
            </p>
          </motion.div>
        )}

        {/* Bottom decoration */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-muted-foreground/30">
          <Shield className="w-3 h-3" />
          <span className="text-[10px]">بياناتك مشفرة ومحمية</span>
        </div>
      </div>
    </motion.div>
  );
}
