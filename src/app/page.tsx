'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Stethoscope,
  User,
  Shield,
  ShieldCheck,
  MapPin,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Loader2,
  Activity,
  Clock,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/lib/stores/auth-store';
import { YEMEN_GOVERNORATES } from '@/lib/constants/governorates';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

// ============================================================================
// Seeded pseudo-random to avoid hydration mismatch
// ============================================================================

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ============================================================================
// Password Strength Calculator
// ============================================================================

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score: 1, label: 'ضعيفة', color: 'bg-red-500' };
  if (score <= 2) return { score: 2, label: 'متوسطة', color: 'bg-amber-500' };
  if (score <= 3) return { score: 3, label: 'جيدة', color: 'bg-yellow-500' };
  if (score <= 4) return { score: 4, label: 'قوية', color: 'bg-emerald-500' };
  return { score: 5, label: 'قوية جداً', color: 'bg-emerald-600' };
}

// ============================================================================
// Validation Schemas
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
});

type LoginFormValues = z.infer<typeof loginSchema>;

const nurseRegisterSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب').min(3, 'الاسم يجب أن يكون ٣ أحرف على الأقل'),
  phone: z
    .string()
    .min(1, 'رقم الهاتف مطلوب')
    .regex(/^(7\d{8}|\+9677\d{7,8}|9677\d{7,8})$/, 'صيغة رقم الهاتف غير صحيحة'),
  password: z.string().min(1, 'كلمة المرور مطلوبة').min(6, 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل'),
  specialization: z.string().min(1, 'التخصص مطلوب'),
  licenseNumber: z.string().min(1, 'رقم الترخيص مطلوب'),
  address: z.string().min(1, 'العنوان التفصيلي مطلوب'),
  governorate: z.string().optional(),
});

type NurseRegisterFormValues = z.infer<typeof nurseRegisterSchema>;

const beneficiaryRegisterSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب').min(3, 'الاسم يجب أن يكون ٣ أحرف على الأقل'),
  phone: z
    .string()
    .min(1, 'رقم الهاتف مطلوب')
    .regex(/^(7\d{8}|\+9677\d{7,8}|9677\d{7,8})$/, 'صيغة رقم الهاتف غير صحيحة'),
  password: z.string().min(1, 'كلمة المرور مطلوبة').min(6, 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل'),
  address: z.string().min(1, 'العنوان مطلوب'),
  governorate: z.string().optional(),
  referralCode: z.string().optional(),
});

type BeneficiaryRegisterFormValues = z.infer<typeof beneficiaryRegisterSchema>;

// ============================================================================
// Constants
// ============================================================================

const specializations = [
  { value: 'general_nursing', label: 'تمريض عام' },
  { value: 'critical_care', label: 'الرعاية الحرجة' },
  { value: 'pediatric', label: 'طب الأطفال' },
  { value: 'elderly_care', label: 'رعاية المسنين' },
  { value: 'physiotherapy', label: 'العلاج الطبيعي' },
  { value: 'wound_care', label: 'علاج الجروح' },
  { value: 'iv_therapy', label: 'العلاج الوريدي' },
  { value: 'mental_health', label: 'الصحة النفسية' },
  { value: 'post_surgery', label: 'رعاية ما بعد الجراحة' },
  { value: 'emergency', label: 'الطوارئ' },
  { value: 'lab_technician', label: 'مخبري' },
  { value: 'medical_assistant', label: 'مساعد طبيب' },
  { value: 'general_practitioner', label: 'طبيب عام' },
  { value: 'critical_care_doctor', label: 'طبيب عناية' },
  { value: 'nursery_nurse', label: 'ممرض حضانة' },
  { value: 'anesthesia', label: 'التخدير' },
  { value: 'radiology', label: 'الأشعة' },
  { value: 'pharmacy', label: 'الصيدلة' },
  { value: 'dentistry', label: 'طب الأسنان' },
  { value: 'obstetrics', label: 'التوليد والنساء' },
  { value: 'cardiology_nursing', label: 'تمريض القلب' },
  { value: 'oncology_nursing', label: 'تمريض الأورام' },
  { value: 'dialysis_nursing', label: 'تمريض الكلى والغسيل' },
  { value: 'respiratory_therapy', label: 'العلاج التنفسي' },
  { value: 'nutrition', label: 'التغذية العلاجية' },
];

// ============================================================================
// Role Configuration for Auto-Detected Display
// ============================================================================

const roleConfig: Record<string, {
  label: string;
  icon: React.ElementType;
  gradient: string;
  bgGradient: string;
  ringColor: string;
  textColor: string;
  welcomeMsg: string;
  dashboardLabel: string;
}> = {
  admin: {
    label: 'مدير النظام',
    icon: Shield,
    gradient: 'from-amber-500 to-amber-700',
    bgGradient: 'from-amber-600 via-amber-700 to-orange-800',
    ringColor: 'rgba(245, 158, 11, 0.4)',
    textColor: 'text-amber-500',
    welcomeMsg: 'مرحباً بك في لوحة التحكم',
    dashboardLabel: 'لوحة تحكم الإدارة',
  },
  subadmin: {
    label: 'مدير فرعي',
    icon: ShieldCheck,
    gradient: 'from-orange-500 to-orange-700',
    bgGradient: 'from-orange-600 via-orange-700 to-red-800',
    ringColor: 'rgba(249, 115, 22, 0.4)',
    textColor: 'text-orange-500',
    welcomeMsg: 'مرحباً بك في لوحة الإدارة',
    dashboardLabel: 'لوحة الإدارة المحدودة',
  },
  nurse: {
    label: 'ممرض/ـة',
    icon: Stethoscope,
    gradient: 'from-sky-500 to-sky-700',
    bgGradient: 'from-sky-600 via-sky-700 to-blue-800',
    ringColor: 'rgba(14, 165, 233, 0.4)',
    textColor: 'text-sky-500',
    welcomeMsg: 'مرحباً بك في حسابك المهني',
    dashboardLabel: 'لوحة الممرض/ـة',
  },
  beneficiary: {
    label: 'مستفيد/ـة',
    icon: User,
    gradient: 'from-purple-500 to-purple-700',
    bgGradient: 'from-purple-600 via-purple-700 to-indigo-800',
    ringColor: 'rgba(168, 85, 247, 0.4)',
    textColor: 'text-purple-500',
    welcomeMsg: 'مرحباً بك في منصة عافيتك',
    dashboardLabel: 'الرئيسية',
  },
};

// ============================================================================
// Dashboard redirect helper
// ============================================================================

function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'subadmin':
      return '/admin';
    case 'nurse':
      return '/nurse';
    case 'beneficiary':
      return '/beneficiary';
    default:
      return '/';
  }
}

// ============================================================================
// Post-Login Loading Screen with 5-Second Countdown (KEEP AS IS)
// ============================================================================

function PostLoginLoadingScreen({ user, onComplete }: { user: { name: string; role: string }; onComplete: () => void }) {
  const [countdown, setCountdown] = useState(5);
  const [progress, setProgress] = useState(0);
  const config = roleConfig[user.role] || roleConfig.beneficiary;
  const RoleIcon = config.icon;

  useEffect(() => {
    const startTime = Date.now();
    const duration = 5000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      const progressPercent = Math.min(100, (elapsed / duration) * 100);

      setCountdown(remaining);
      setProgress(progressPercent);

      if (elapsed >= duration) {
        clearInterval(interval);
        onComplete();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      dir="rtl"
    >
      {/* Dynamic gradient background based on role */}
      <div className={cn('absolute inset-0 bg-gradient-to-br', config.bgGradient)} />

      {/* Animated orbs */}
      <motion.div
        className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full"
        style={{ background: `radial-gradient(circle, ${config.ringColor} 0%, transparent 70%)` }}
        animate={{ scale: [1, 1.3, 1], x: [0, -50, 0], y: [0, 30, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)' }}
        animate={{ scale: [1.2, 0.8, 1.2], x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/15"
            style={{
              width: seededRandom(i * 4 + 100) * 6 + 2,
              height: seededRandom(i * 4 + 101) * 6 + 2,
              left: `${seededRandom(i * 4 + 102) * 100}%`,
              top: `${seededRandom(i * 4 + 103) * 100}%`,
            }}
            animate={{
              y: [0, -40, 0],
              x: [0, seededRandom(i * 7 + 200) * 30 - 15, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: seededRandom(i * 7 + 201) * 5 + 3,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: seededRandom(i * 7 + 202) * 3,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        {/* Heartbeat animation icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="relative mb-8"
        >
          {/* Pulsing rings */}
          <motion.div
            animate={{
              boxShadow: [
                `0 0 0 0 ${config.ringColor}`,
                `0 0 0 30px rgba(0,0,0,0)`,
                `0 0 0 0 rgba(0,0,0,0)`,
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            className="w-28 h-28 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-xl border-2 border-white/30"
          >
            {/* Heartbeat effect */}
            <motion.div
              animate={{ scale: [1, 1.15, 1, 1.15, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <RoleIcon className="w-14 h-14 text-white" />
            </motion.div>
          </motion.div>

          {/* Orbiting dot */}
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/60 shadow-lg" />
          </motion.div>
        </motion.div>

        {/* Welcome message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mb-2"
        >
          <h2 className="text-3xl font-bold text-white mb-2">مرحباً، {user.name}</h2>
        </motion.div>

        {/* Role detection badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mb-6"
        >
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md rounded-full px-5 py-2.5 border border-white/20">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span className="text-white/90 text-sm font-medium">تم التعرف على حسابك كـ</span>
            <span className="text-white font-bold text-sm">{config.label}</span>
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </div>
        </motion.div>

        {/* Dashboard label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-white/60 text-sm mb-8"
        >
          جارٍ التحويل إلى {config.dashboardLabel}...
        </motion.p>

        {/* Countdown timer - circular */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.4 }}
          className="relative mb-6"
        >
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
            <motion.circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 34}
              strokeDashoffset={2 * Math.PI * 34 * (1 - progress / 100)}
              style={{ transition: 'stroke-dashoffset 0.1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              key={countdown}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="text-2xl font-bold text-white"
            >
              {countdown}
            </motion.span>
          </div>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          className="w-64"
        >
          <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white/80"
              style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
            />
          </div>
        </motion.div>

        {/* Loading steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-6 space-y-2"
        >
          {[
            { label: 'التحقق من الهوية', done: progress > 15 },
            { label: 'تحميل بيانات الحساب', done: progress > 40 },
            { label: 'إعداد لوحة التحكم', done: progress > 65 },
            { label: 'جاهز للتحويل', done: progress > 85 },
          ].map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.6 + i * 0.3 }}
              className="flex items-center gap-2"
            >
              <AnimatePresence mode="wait">
                {step.done ? (
                  <motion.div
                    key="done"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="loading"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white/80"
                  />
                )}
              </AnimatePresence>
              <span className={cn(
                'text-xs transition-colors duration-300',
                step.done ? 'text-white/80' : 'text-white/40'
              )}>
                {step.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Password Strength Bar Component (KEEP AS IS)
// ============================================================================

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-1"
    >
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-300',
              i < strength.score ? strength.color : 'bg-muted-foreground/20'
            )}
          />
        ))}
      </div>
      <p className={cn(
        'text-[10px] font-medium transition-colors duration-300',
        strength.score <= 1 ? 'text-red-500' :
        strength.score <= 2 ? 'text-amber-500' :
        strength.score <= 3 ? 'text-yellow-500' :
        'text-emerald-500'
      )}>
        قوة كلمة المرور: {strength.label}
      </p>
    </motion.div>
  );
}

// ============================================================================
// NEW: Animated Mesh Background (CSS-only, no framer-motion)
// ============================================================================

function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-purple-900 to-slate-950 dark:from-gray-950 dark:via-purple-950 dark:to-slate-950" />

      {/* Organic mesh blobs */}
      <div
        className="absolute mesh-blob-1"
        style={{
          width: '60vw', height: '60vw', maxWidth: '700px', maxHeight: '700px',
          top: '-15%', right: '-10%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0.1) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute mesh-blob-2"
        style={{
          width: '50vw', height: '50vw', maxWidth: '600px', maxHeight: '600px',
          bottom: '-10%', left: '-8%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, rgba(20,184,166,0.08) 40%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />
      <div
        className="absolute mesh-blob-3"
        style={{
          width: '40vw', height: '40vw', maxWidth: '500px', maxHeight: '500px',
          top: '30%', left: '50%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0.05) 40%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
      <div
        className="absolute mesh-blob-4"
        style={{
          width: '35vw', height: '35vw', maxWidth: '450px', maxHeight: '450px',
          top: '60%', right: '20%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, rgba(168,85,247,0.05) 40%, transparent 70%)',
          filter: 'blur(55px)',
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating particles (CSS-only) */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/10 animate-float-gentle"
          style={{
            width: seededRandom(i * 3 + 50) * 3 + 2,
            height: seededRandom(i * 3 + 51) * 3 + 2,
            left: `${seededRandom(i * 3 + 52) * 90 + 5}%`,
            top: `${seededRandom(i * 3 + 53) * 90 + 5}%`,
            animationDelay: `${seededRandom(i * 5 + 60) * 3}s`,
            animationDuration: `${seededRandom(i * 5 + 61) * 3 + 3}s`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// NEW: Floating Input Component
// ============================================================================

function FloatingInput({
  id,
  label,
  icon: Icon,
  type = 'text',
  dir,
  showToggle,
  onToggle,
  toggleIcon,
  registration,
  error,
  className,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  type?: string;
  dir?: string;
  showToggle?: boolean;
  onToggle?: () => void;
  toggleIcon?: React.ReactNode;
  registration: object;
  error?: string;
  className?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="floating-input-group">
        <div className="relative">
          <Icon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 z-10 pointer-events-none" />
          <Input
            id={id}
            type={type}
            placeholder=" "
            dir={dir}
            className={cn(
              'peer pr-11 pl-11 text-right h-12 rounded-2xl input-glow',
              'bg-white/[0.06] border-white/[0.1] text-white placeholder-transparent',
              'hover:bg-white/[0.08] hover:border-white/[0.15]',
              'focus:bg-white/[0.1] focus:border-purple-400/50',
              error && 'border-red-400/50 focus:border-red-400/70',
              className
            )}
            {...registration}
          />
          <label
            htmlFor={id}
            className="floating-label"
          >
            {label}
          </label>
          {showToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors z-10"
            >
              {toggleIcon}
            </button>
          )}
        </div>
      </div>
      {error && (
        <motion.p initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-400 mr-2">
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ============================================================================
// NEW: Shimmer Button Component
// ============================================================================

function ShimmerButton({
  children,
  disabled,
  loading,
  className,
  type = 'submit',
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: 'submit' | 'button';
  onClick?: () => void;
}) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full">
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'shimmer-btn w-full h-12 rounded-2xl font-bold text-base text-white',
          'bg-gradient-to-l from-violet-600 via-purple-600 to-fuchsia-600',
          'hover:from-violet-500 hover:via-purple-500 hover:to-fuchsia-500',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          'shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30',
          'transition-all duration-300',
          className
        )}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        ) : (
          children
        )}
      </button>
    </motion.div>
  );
}

// ============================================================================
// NEW: Modern Pill Toggle Component
// ============================================================================

function ModernToggle({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <div className="relative flex bg-white/[0.06] rounded-2xl p-1 border border-white/[0.08]">
      {/* Sliding indicator */}
      <motion.div
        className="absolute top-1 bottom-1 rounded-xl bg-gradient-to-l from-violet-500/80 to-purple-600/80 shadow-lg shadow-purple-500/20"
        initial={false}
        animate={{
          x: activeTab === 'login' ? '0%' : '100%',
          width: '50%',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ right: activeTab === 'login' ? '50%' : '0%' }}
      />
      <button
        type="button"
        onClick={() => onTabChange('login')}
        className={cn(
          'relative z-10 flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors duration-200',
          activeTab === 'login' ? 'text-white' : 'text-white/50 hover:text-white/70'
        )}
      >
        تسجيل دخول
      </button>
      <button
        type="button"
        onClick={() => onTabChange('register')}
        className={cn(
          'relative z-10 flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors duration-200',
          activeTab === 'register' ? 'text-white' : 'text-white/50 hover:text-white/70'
        )}
      >
        إنشاء حساب
      </button>
    </div>
  );
}

// ============================================================================
// NEW: Role Card Component (3D tilt effect)
// ============================================================================

function RoleCard({
  role,
  isActive,
  onClick,
  icon: Icon,
  title,
  subtitle,
  activeColor,
}: {
  role: string;
  isActive: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  activeColor: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        'tilt-card relative rounded-2xl p-4 text-center transition-all duration-300 overflow-hidden border',
        isActive
          ? 'border-white/30 bg-white/[0.12] shadow-lg'
          : 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/15'
      )}
    >
      {isActive && (
        <motion.div
          layoutId="role-glow"
          className={cn('absolute inset-0 opacity-15', activeColor)}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      )}
      <div className="relative z-10">
        <div className={cn(
          'w-11 h-11 rounded-xl mx-auto mb-2 flex items-center justify-center transition-all duration-300',
          isActive
            ? cn('bg-gradient-to-br shadow-lg', activeColor, 'text-white')
            : 'bg-white/[0.08] text-white/40'
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={cn(
          'text-sm font-bold transition-colors duration-300',
          isActive ? 'text-white' : 'text-white/50'
        )}>
          {title}
        </span>
        <p className="text-[10px] text-white/30 mt-0.5">{subtitle}</p>
      </div>
    </motion.button>
  );
}

// ============================================================================
// NEW: Mobile Gradient Header
// ============================================================================

function MobileGradientHeader() {
  return (
    <div className="relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-purple-800 to-slate-900 dark:from-gray-950 dark:via-purple-950 dark:to-slate-950" />
      <div
        className="absolute mesh-blob-1 -top-1/2 -right-1/4"
        style={{
          width: '300px', height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute mesh-blob-2 -bottom-1/2 -left-1/4"
        style={{
          width: '250px', height: '250px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 px-6 pt-10 pb-6 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-white/15 backdrop-blur-xl border border-white/25 shadow-lg shadow-purple-500/10"
        >
          <Heart className="w-7 h-7 text-white" fill="currentColor" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-white"
        >
          عافيتك
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-white/60 mt-1"
        >
          منصة الرعاية الصحية المنزلية في اليمن
        </motion.p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Login Page Component (COMPLETELY REDESIGNED)
// ============================================================================

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');

  const { login, registerNurse, registerBeneficiary, isAuthenticated, user, isLoading, error, clearError, _hasHydrated } =
    useAuthStore();

  const [activeTab, setActiveTab] = useState<string>('login');
  const [registerRole, setRegisterRole] = useState<string>('beneficiary');
  const [showPassword, setShowPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [nurseNameShake, setNurseNameShake] = useState(false);
  const [nurseNameWarning, setNurseNameWarning] = useState(false);

  // Handle post-login redirect with loading screen
  const justLoggedOut = searchParams.get('logout') === 'true';

  useEffect(() => {
    if (!_hasHydrated) return;

    if (isAuthenticated && user && !justLoggedOut && !showLoadingScreen) {
      setShowLoadingScreen(true);
    }
    if (justLoggedOut && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, user, justLoggedOut, showLoadingScreen, _hasHydrated]);

  const handleLoadingComplete = useCallback(() => {
    if (user) {
      const destination = redirectPath ?? getDashboardPath(user.role);
      router.replace(destination);
    }
  }, [user, redirectPath, router]);

  // ============================================================================
  // Login Form
  // ============================================================================

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  });

  const onLoginSubmit = async (data: LoginFormValues) => {
    clearError();
    try {
      await login(data.phone, data.password);
    } catch {
      // Error handled in store
    }
  };

  // ============================================================================
  // Nurse Register Form
  // ============================================================================

  const nurseForm = useForm<NurseRegisterFormValues>({
    resolver: zodResolver(nurseRegisterSchema),
    defaultValues: {
      name: '', phone: '', password: '',
      specialization: '', licenseNumber: '', address: '', governorate: '',
    },
  });

  const onNurseRegister = async (data: NurseRegisterFormValues) => {
    clearError();

    // Validate four-part name (الاسم الرباعي)
    const nameWords = data.name.trim().split(/\s+/).filter(Boolean);
    if (nameWords.length < 4) {
      setNurseNameShake(true);
      setNurseNameWarning(true);
      setTimeout(() => {
        setNurseNameShake(false);
      }, 600);
      setTimeout(() => {
        setNurseNameWarning(false);
      }, 3000);
      return;
    }

    try {
      await registerNurse({
        name: data.name,
        phone: data.phone,
        password: data.password,
        specialization: data.specialization,
        licenseNumber: data.licenseNumber,
        address: data.address,
        governorate: data.governorate as never,
      });
    } catch {
      // Error handled in store
    }
  };

  // ============================================================================
  // Beneficiary Register Form
  // ============================================================================

  const beneficiaryForm = useForm<BeneficiaryRegisterFormValues>({
    resolver: zodResolver(beneficiaryRegisterSchema),
    defaultValues: {
      name: '', phone: '', password: '',
      address: '', governorate: '', referralCode: '',
    },
  });

  const onBeneficiaryRegister = async (data: BeneficiaryRegisterFormValues) => {
    clearError();
    try {
      await registerBeneficiary({
        name: data.name,
        phone: data.phone,
        password: data.password,
        address: data.address,
        governorate: data.governorate as never,
        referralCode: data.referralCode || undefined,
      });
    } catch {
      // Error handled in store
    }
  };

  // ============================================================================
  // Password watchers for strength indicator
  // ============================================================================
  const loginPasswordValue = loginForm.watch('password');
  const nursePasswordValue = nurseForm.watch('password');
  const beneficiaryPasswordValue = beneficiaryForm.watch('password');

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" dir="rtl" lang="ar">
      {/* Post-login loading screen */}
      <AnimatePresence>
        {showLoadingScreen && user && (
          <PostLoginLoadingScreen
            user={{ name: user.name, role: user.role }}
            onComplete={handleLoadingComplete}
          />
        )}
      </AnimatePresence>

      {/* ============ DESKTOP: Full-screen immersive layout ============ */}
      <div className="hidden lg:flex lg:h-screen items-center justify-center relative">
        <AnimatedBackground />

        {/* Centered glassmorphic card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-20 w-full max-w-[460px] mx-8"
        >
          {/* Animated gradient border */}
          <div className="absolute -inset-[1px] rounded-3xl overflow-hidden">
            <div
              className="absolute inset-0 animate-gradient-border"
              style={{
                background: 'conic-gradient(from 0deg, rgba(139,92,246,0.3), rgba(20,184,166,0.3), rgba(59,130,246,0.3), rgba(168,85,247,0.3), rgba(139,92,246,0.3))',
              }}
            />
          </div>

          {/* Main glass card */}
          <div className="relative glass-ultra rounded-3xl noise-overlay">
            <div className="relative z-10 p-8">
              {/* Logo & brand */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center mb-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-violet-500/30 to-purple-600/30 backdrop-blur-xl border border-white/20 shadow-xl shadow-purple-500/20"
                >
                  <Heart className="w-8 h-8 text-white" fill="currentColor" />
                </motion.div>
                <h1 className="text-2xl font-bold text-white">عافيتك</h1>
                <p className="text-sm text-white/40 mt-1">منصة الرعاية الصحية المنزلية في اليمن</p>
              </motion.div>

              {/* Modern toggle */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mb-6"
              >
                <ModernToggle
                  activeTab={activeTab}
                  onTabChange={(tab) => { setActiveTab(tab); clearError(); }}
                />
              </motion.div>

              {/* Error Display */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 bg-red-500/10 text-red-300 text-sm rounded-xl p-3 flex items-center gap-2 border border-red-500/20"
                  >
                    <Shield className="w-4 h-4 shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ====== Login Form ====== */}
              <AnimatePresence mode="wait">
                {activeTab === 'login' && (
                  <motion.form
                    key="login-form"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                    className="space-y-4"
                  >
                    {/* Smart login notice */}
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-l from-violet-500/10 via-purple-500/5 to-fuchsia-500/10 rounded-xl p-3 border border-purple-500/15"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 text-purple-300" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white/80">تسجيل دخول ذكي</p>
                          <p className="text-[10px] text-white/40">سيتعرف النظام تلقائياً على نوع حسابك</p>
                        </div>
                      </div>
                    </motion.div>

                    <FloatingInput
                      id="login-phone"
                      label="رقم الهاتف"
                      icon={Phone}
                      type="tel"
                      dir="ltr"
                      registration={loginForm.register('phone')}
                      error={loginForm.formState.errors.phone?.message}
                    />

                    <FloatingInput
                      id="login-password"
                      label="كلمة المرور"
                      icon={Lock}
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      showToggle
                      onToggle={() => setShowPassword(!showPassword)}
                      toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      registration={loginForm.register('password')}
                      error={loginForm.formState.errors.password?.message}
                    />

                    <PasswordStrengthBar password={loginPasswordValue} />

                    {/* Remember + Forgot */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="remember"
                          className="h-3.5 w-3.5 rounded border-white/20 bg-white/10 text-purple-500 focus:ring-purple-500/30"
                        />
                        <Label htmlFor="remember" className="text-xs font-normal cursor-pointer text-white/50">تذكرني</Label>
                      </div>
                      <button type="button" className="text-xs text-purple-400/80 hover:text-purple-300 transition-colors">
                        نسيت كلمة المرور؟
                      </button>
                    </div>

                    <ShimmerButton loading={isLoading} disabled={isLoading}>
                      <span className="flex items-center gap-2 justify-center">
                        تسجيل الدخول
                        <ArrowLeft className="w-4 h-4" />
                      </span>
                    </ShimmerButton>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* ====== Register Forms ====== */}
              <AnimatePresence mode="wait">
                {activeTab === 'register' && (
                  <motion.div
                    key="register-container"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    {/* Role selector */}
                    <div className="grid grid-cols-2 gap-3">
                      <RoleCard
                        role="beneficiary"
                        isActive={registerRole === 'beneficiary'}
                        onClick={() => { setRegisterRole('beneficiary'); clearError(); }}
                        icon={User}
                        title="مستفيد"
                        subtitle="رعاية منزلية"
                        activeColor="from-purple-500 to-purple-700"
                      />
                      <RoleCard
                        role="nurse"
                        isActive={registerRole === 'nurse'}
                        onClick={() => { setRegisterRole('nurse'); clearError(); }}
                        icon={Stethoscope}
                        title="ممرض/ـة"
                        subtitle="ممرض معتمد"
                        activeColor="from-sky-500 to-sky-700"
                      />
                    </div>

                    <AnimatePresence mode="wait">
                      {/* Beneficiary Registration Form */}
                      {registerRole === 'beneficiary' && (
                        <motion.form
                          key="beneficiary-form"
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 15 }}
                          transition={{ duration: 0.25 }}
                          onSubmit={beneficiaryForm.handleSubmit(onBeneficiaryRegister)}
                          className="space-y-3"
                        >
                          {/* Personal info */}
                          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06] space-y-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <User className="w-3.5 h-3.5 text-purple-400" />
                              <span className="text-[10px] font-semibold text-purple-400">المعلومات الشخصية</span>
                            </div>
                            <FloatingInput
                              id="ben-name"
                              label="الاسم الكامل"
                              icon={User}
                              registration={beneficiaryForm.register('name')}
                              error={beneficiaryForm.formState.errors.name?.message}
                            />
                            <FloatingInput
                              id="ben-phone"
                              label="رقم الهاتف"
                              icon={Phone}
                              type="tel"
                              dir="ltr"
                              registration={beneficiaryForm.register('phone')}
                              error={beneficiaryForm.formState.errors.phone?.message}
                            />
                          </div>

                          {/* Location info */}
                          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06] space-y-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <MapPin className="w-3.5 h-3.5 text-teal-400" />
                              <span className="text-[10px] font-semibold text-teal-400">معلومات الموقع</span>
                            </div>
                            <GpsLocationButton
                              onLocationDetected={(loc) => {
                                if (loc.governorate && loc.governorateValue) {
                                  beneficiaryForm.setValue('governorate', loc.governorateValue);
                                }
                                if (loc.address || loc.district) {
                                  beneficiaryForm.setValue('address', loc.district || loc.address);
                                }
                              }}
                              size="sm"
                              className="w-full"
                            />
                            <FloatingInput
                              id="ben-address"
                              label="العنوان"
                              icon={MapPin}
                              registration={beneficiaryForm.register('address')}
                              error={beneficiaryForm.formState.errors.address?.message}
                            />
                            <FloatingInput
                              id="ben-referral"
                              label="كود الإحالة (اختياري)"
                              icon={Sparkles}
                              dir="ltr"
                              registration={beneficiaryForm.register('referralCode')}
                            />
                          </div>

                          {/* Security */}
                          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06] space-y-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Lock className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[10px] font-semibold text-amber-400">الأمان</span>
                            </div>
                            <FloatingInput
                              id="ben-password"
                              label="كلمة المرور"
                              icon={Lock}
                              type={showPassword ? 'text' : 'password'}
                              dir="ltr"
                              showToggle
                              onToggle={() => setShowPassword(!showPassword)}
                              toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              registration={beneficiaryForm.register('password')}
                              error={beneficiaryForm.formState.errors.password?.message}
                            />
                            <PasswordStrengthBar password={beneficiaryPasswordValue} />
                          </div>

                          <ShimmerButton loading={isLoading} disabled={isLoading}>
                            <span className="flex items-center gap-2 justify-center">
                              <CheckCircle2 className="w-4 h-4" />
                              إنشاء حساب مستفيد
                            </span>
                          </ShimmerButton>
                        </motion.form>
                      )}

                      {/* Nurse Registration Form */}
                      {registerRole === 'nurse' && (
                        <motion.form
                          key="nurse-form"
                          initial={{ opacity: 0, x: 15 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -15 }}
                          transition={{ duration: 0.25 }}
                          onSubmit={nurseForm.handleSubmit(onNurseRegister)}
                          className="space-y-3 max-h-[55vh] overflow-y-auto custom-scrollbar pl-1"
                        >
                          {/* Personal info */}
                          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06] space-y-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <User className="w-3.5 h-3.5 text-sky-400" />
                              <span className="text-[10px] font-semibold text-sky-400">المعلومات الشخصية</span>
                            </div>
                            <motion.div
                              className="relative"
                              animate={nurseNameShake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
                              transition={{ duration: 0.5, ease: 'easeInOut' }}
                            >
                              <FloatingInput
                                id="nurse-name"
                                label="الاسم الرباعي"
                                icon={User}
                                registration={nurseForm.register('name')}
                                error={nurseNameShake ? undefined : nurseForm.formState.errors.name?.message}
                                className={nurseNameShake ? 'border-red-400/60!' : ''}
                              />
                            </motion.div>
                            {nurseNameWarning && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-1.5"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                <p className="text-xs text-red-400 font-medium">يجب أن تكتب اسمك الرباعي (أربعة أجزاء)</p>
                              </motion.div>
                            )}
                            {nurseForm.formState.errors.name && !nurseNameWarning && (
                              <p className="text-xs text-red-400">{nurseForm.formState.errors.name.message}</p>
                            )}
                            <FloatingInput
                              id="nurse-phone"
                              label="رقم الهاتف"
                              icon={Phone}
                              type="tel"
                              dir="ltr"
                              registration={nurseForm.register('phone')}
                              error={nurseForm.formState.errors.phone?.message}
                            />
                          </div>

                          {/* Professional info */}
                          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06] space-y-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Stethoscope className="w-3.5 h-3.5 text-violet-400" />
                              <span className="text-[10px] font-semibold text-violet-400">المعلومات المهنية</span>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-white/50">التخصص</Label>
                              <Select onValueChange={(v) => nurseForm.setValue('specialization', v)}>
                                <SelectTrigger className="h-11 rounded-xl bg-white/[0.06] border-white/[0.1] text-white/80 hover:bg-white/[0.08] focus:border-purple-400/50">
                                  <SelectValue placeholder="اختر التخصص" />
                                </SelectTrigger>
                                <SelectContent>
                                  {specializations.map((spec) => (
                                    <SelectItem key={spec.value} value={spec.value}>{spec.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {nurseForm.formState.errors.specialization && (
                                <p className="text-xs text-red-400">{nurseForm.formState.errors.specialization.message}</p>
                              )}
                            </div>
                            <FloatingInput
                              id="nurse-license"
                              label="رقم الترخيص"
                              icon={Shield}
                              registration={nurseForm.register('licenseNumber')}
                              error={nurseForm.formState.errors.licenseNumber?.message}
                            />
                          </div>

                          {/* Location info */}
                          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06] space-y-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <MapPin className="w-3.5 h-3.5 text-teal-400" />
                              <span className="text-[10px] font-semibold text-teal-400">معلومات الموقع</span>
                            </div>
                            <GpsLocationButton
                              onLocationDetected={(loc) => {
                                if (loc.governorate && loc.governorateValue) {
                                  nurseForm.setValue('governorate', loc.governorateValue);
                                }
                                if (loc.address || loc.district) {
                                  nurseForm.setValue('address', loc.district || loc.address);
                                }
                              }}
                              size="sm"
                              className="w-full"
                            />
                            <FloatingInput
                              id="nurse-address"
                              label="العنوان التفصيلي"
                              icon={MapPin}
                              registration={nurseForm.register('address')}
                              error={nurseForm.formState.errors.address?.message}
                            />
                          </div>

                          {/* Security */}
                          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06] space-y-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Lock className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[10px] font-semibold text-amber-400">الأمان</span>
                            </div>
                            <FloatingInput
                              id="nurse-password"
                              label="كلمة المرور"
                              icon={Lock}
                              type={showPassword ? 'text' : 'password'}
                              dir="ltr"
                              showToggle
                              onToggle={() => setShowPassword(!showPassword)}
                              toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              registration={nurseForm.register('password')}
                              error={nurseForm.formState.errors.password?.message}
                            />
                            <PasswordStrengthBar password={nursePasswordValue} />
                          </div>

                          <ShimmerButton loading={isLoading} disabled={isLoading} className="from-sky-600 via-cyan-600 to-teal-600 hover:from-sky-500 hover:via-cyan-500 hover:to-teal-500 shadow-sky-500/25">
                            <span className="flex items-center gap-2 justify-center">
                              <CheckCircle2 className="w-4 h-4" />
                              إنشاء حساب ممرض/ـة
                            </span>
                          </ShimmerButton>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Floating decorative elements */}
        <motion.div
          className="absolute top-[8%] left-[8%] text-white/[0.04] z-10 hidden xl:block"
          animate={{ y: [0, -15, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Stethoscope className="w-16 h-16" />
        </motion.div>
        <motion.div
          className="absolute bottom-[12%] right-[8%] text-white/[0.04] z-10 hidden xl:block"
          animate={{ y: [0, 12, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        >
          <Heart className="w-14 h-14" />
        </motion.div>
        <motion.div
          className="absolute top-[70%] left-[5%] text-white/[0.04] z-10 hidden xl:block"
          animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        >
          <Shield className="w-12 h-12" />
        </motion.div>
      </div>

      {/* ============ MOBILE: Compact layout ============ */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <MobileGradientHeader />

        {/* Form card sliding over the gradient */}
        <div className="flex-1 bg-gradient-to-b from-slate-900 to-gray-950 dark:from-gray-950 dark:to-gray-950 -mt-3 relative">
          <AnimatedBackground />

          <div className="relative z-10 px-4 pt-6 pb-8 max-w-md mx-auto w-full">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative"
            >
              {/* Animated gradient border */}
              <div className="absolute -inset-[1px] rounded-2xl overflow-hidden">
                <div
                  className="absolute inset-0 animate-gradient-border"
                  style={{
                    background: 'conic-gradient(from 0deg, rgba(139,92,246,0.2), rgba(20,184,166,0.2), rgba(59,130,246,0.2), rgba(168,85,247,0.2), rgba(139,92,246,0.2))',
                  }}
                />
              </div>

              {/* Main glass card */}
              <div className="relative glass-ultra rounded-2xl noise-overlay">
                <div className="relative z-10 p-5">
                  {/* Toggle */}
                  <div className="mb-5">
                    <ModernToggle
                      activeTab={activeTab}
                      onTabChange={(tab) => { setActiveTab(tab); clearError(); }}
                    />
                  </div>

                  {/* Error Display */}
                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 bg-red-500/10 text-red-300 text-xs rounded-xl p-2.5 flex items-center gap-2 border border-red-500/20"
                      >
                        <Shield className="w-3.5 h-3.5 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Mobile Login Form */}
                  <AnimatePresence mode="wait">
                    {activeTab === 'login' && (
                      <motion.form
                        key="m-login-form"
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 15 }}
                        transition={{ duration: 0.25 }}
                        onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                        className="space-y-3"
                      >
                        {/* Smart login notice */}
                        <div className="bg-gradient-to-l from-violet-500/10 via-purple-500/5 to-fuchsia-500/10 rounded-xl p-2.5 border border-purple-500/15">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-white/80">تسجيل دخول ذكي</p>
                              <p className="text-[9px] text-white/40">النظام يتعرف على نوع حسابك تلقائياً</p>
                            </div>
                          </div>
                        </div>

                        <FloatingInput
                          id="m-login-phone"
                          label="رقم الهاتف"
                          icon={Phone}
                          type="tel"
                          dir="ltr"
                          registration={loginForm.register('phone')}
                          error={loginForm.formState.errors.phone?.message}
                          className="h-11"
                        />

                        <FloatingInput
                          id="m-login-password"
                          label="كلمة المرور"
                          icon={Lock}
                          type={showPassword ? 'text' : 'password'}
                          dir="ltr"
                          showToggle
                          onToggle={() => setShowPassword(!showPassword)}
                          toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          registration={loginForm.register('password')}
                          error={loginForm.formState.errors.password?.message}
                          className="h-11"
                        />

                        <PasswordStrengthBar password={loginPasswordValue} />

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <input type="checkbox" id="m-remember" className="h-3.5 w-3.5 rounded border-white/20 bg-white/10 text-purple-500 focus:ring-purple-500/30" />
                            <Label htmlFor="m-remember" className="text-[11px] font-normal cursor-pointer text-white/40">تذكرني</Label>
                          </div>
                          <button type="button" className="text-[11px] text-purple-400/70 hover:text-purple-300 transition-colors">نسيت كلمة المرور؟</button>
                        </div>

                        <ShimmerButton loading={isLoading} disabled={isLoading}>
                          <span className="flex items-center gap-2 justify-center text-sm">
                            تسجيل الدخول
                            <ArrowLeft className="w-4 h-4" />
                          </span>
                        </ShimmerButton>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* Mobile Register Forms */}
                  <AnimatePresence mode="wait">
                    {activeTab === 'register' && (
                      <motion.div
                        key="m-register-container"
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -15 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-3"
                      >
                        {/* Role selector */}
                        <div className="grid grid-cols-2 gap-2">
                          <RoleCard
                            role="beneficiary"
                            isActive={registerRole === 'beneficiary'}
                            onClick={() => { setRegisterRole('beneficiary'); clearError(); }}
                            icon={User}
                            title="مستفيد"
                            subtitle="رعاية منزلية"
                            activeColor="from-purple-500 to-purple-700"
                          />
                          <RoleCard
                            role="nurse"
                            isActive={registerRole === 'nurse'}
                            onClick={() => { setRegisterRole('nurse'); clearError(); }}
                            icon={Stethoscope}
                            title="ممرض/ـة"
                            subtitle="ممرض معتمد"
                            activeColor="from-sky-500 to-sky-700"
                          />
                        </div>

                        <AnimatePresence mode="wait">
                          {/* Mobile Beneficiary Form */}
                          {registerRole === 'beneficiary' && (
                            <motion.form
                              key="m-beneficiary-form"
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 12 }}
                              transition={{ duration: 0.2 }}
                              onSubmit={beneficiaryForm.handleSubmit(onBeneficiaryRegister)}
                              className="space-y-2.5"
                            >
                              {/* Personal info */}
                              <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3 h-3 text-purple-400" />
                                  <span className="text-[9px] font-semibold text-purple-400">المعلومات الشخصية</span>
                                </div>
                                <FloatingInput
                                  id="m-ben-name"
                                  label="الاسم الكامل"
                                  icon={User}
                                  registration={beneficiaryForm.register('name')}
                                  error={beneficiaryForm.formState.errors.name?.message}
                                  className="h-10"
                                />
                                <FloatingInput
                                  id="m-ben-phone"
                                  label="رقم الهاتف"
                                  icon={Phone}
                                  type="tel"
                                  dir="ltr"
                                  registration={beneficiaryForm.register('phone')}
                                  error={beneficiaryForm.formState.errors.phone?.message}
                                  className="h-10"
                                />
                              </div>

                              {/* Location */}
                              <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-3 h-3 text-teal-400" />
                                  <span className="text-[9px] font-semibold text-teal-400">معلومات الموقع</span>
                                </div>
                                <GpsLocationButton
                                  onLocationDetected={(loc) => {
                                    if (loc.governorate && loc.governorateValue) {
                                      beneficiaryForm.setValue('governorate', loc.governorateValue);
                                    }
                                    if (loc.address || loc.district) {
                                      beneficiaryForm.setValue('address', loc.district || loc.address);
                                    }
                                  }}
                                  size="sm"
                                  className="w-full"
                                />
                                <FloatingInput
                                  id="m-ben-address"
                                  label="العنوان"
                                  icon={MapPin}
                                  registration={beneficiaryForm.register('address')}
                                  error={beneficiaryForm.formState.errors.address?.message}
                                  className="h-10"
                                />
                                <FloatingInput
                                  id="m-ben-referral"
                                  label="كود الإحالة (اختياري)"
                                  icon={Sparkles}
                                  dir="ltr"
                                  registration={beneficiaryForm.register('referralCode')}
                                  className="h-10"
                                />
                              </div>

                              {/* Security */}
                              <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                                <div className="flex items-center gap-1.5">
                                  <Lock className="w-3 h-3 text-amber-400" />
                                  <span className="text-[9px] font-semibold text-amber-400">الأمان</span>
                                </div>
                                <FloatingInput
                                  id="m-ben-password"
                                  label="كلمة المرور"
                                  icon={Lock}
                                  type={showPassword ? 'text' : 'password'}
                                  dir="ltr"
                                  showToggle
                                  onToggle={() => setShowPassword(!showPassword)}
                                  toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  registration={beneficiaryForm.register('password')}
                                  error={beneficiaryForm.formState.errors.password?.message}
                                  className="h-10"
                                />
                                <PasswordStrengthBar password={beneficiaryPasswordValue} />
                              </div>

                              <ShimmerButton loading={isLoading} disabled={isLoading}>
                                <span className="flex items-center gap-2 justify-center text-sm">
                                  <CheckCircle2 className="w-4 h-4" />
                                  إنشاء حساب مستفيد
                                </span>
                              </ShimmerButton>
                            </motion.form>
                          )}

                          {/* Mobile Nurse Form */}
                          {registerRole === 'nurse' && (
                            <motion.form
                              key="m-nurse-form"
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -12 }}
                              transition={{ duration: 0.2 }}
                              onSubmit={nurseForm.handleSubmit(onNurseRegister)}
                              className="space-y-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar pl-1"
                            >
                              {/* Personal info */}
                              <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3 h-3 text-sky-400" />
                                  <span className="text-[9px] font-semibold text-sky-400">المعلومات الشخصية</span>
                                </div>
                                <motion.div
                                  animate={nurseNameShake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
                                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                                >
                                  <FloatingInput
                                    id="m-nurse-name"
                                    label="الاسم الرباعي"
                                    icon={User}
                                    registration={nurseForm.register('name')}
                                    error={nurseNameShake ? undefined : nurseForm.formState.errors.name?.message}
                                    className={cn('h-10', nurseNameShake && 'border-red-400/60!')}
                                  />
                                </motion.div>
                                {nurseNameWarning && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-1.5"
                                  >
                                    <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                                    <p className="text-[10px] text-red-400 font-medium">يجب أن تكتب اسمك الرباعي (أربعة أجزاء)</p>
                                  </motion.div>
                                )}
                                {nurseForm.formState.errors.name && !nurseNameWarning && (
                                  <p className="text-xs text-red-400">{nurseForm.formState.errors.name.message}</p>
                                )}
                                <FloatingInput
                                  id="m-nurse-phone"
                                  label="رقم الهاتف"
                                  icon={Phone}
                                  type="tel"
                                  dir="ltr"
                                  registration={nurseForm.register('phone')}
                                  error={nurseForm.formState.errors.phone?.message}
                                  className="h-10"
                                />
                              </div>

                              {/* Professional info */}
                              <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                                <div className="flex items-center gap-1.5">
                                  <Stethoscope className="w-3 h-3 text-violet-400" />
                                  <span className="text-[9px] font-semibold text-violet-400">المعلومات المهنية</span>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] text-white/40">التخصص</Label>
                                  <Select onValueChange={(v) => nurseForm.setValue('specialization', v)}>
                                    <SelectTrigger className="h-10 rounded-xl bg-white/[0.06] border-white/[0.1] text-white/80 text-xs hover:bg-white/[0.08] focus:border-purple-400/50">
                                      <SelectValue placeholder="اختر التخصص" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {specializations.map((spec) => (
                                        <SelectItem key={spec.value} value={spec.value}>{spec.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {nurseForm.formState.errors.specialization && (
                                    <p className="text-[10px] text-red-400">{nurseForm.formState.errors.specialization.message}</p>
                                  )}
                                </div>
                                <FloatingInput
                                  id="m-nurse-license"
                                  label="رقم الترخيص"
                                  icon={Shield}
                                  registration={nurseForm.register('licenseNumber')}
                                  error={nurseForm.formState.errors.licenseNumber?.message}
                                  className="h-10"
                                />
                              </div>

                              {/* Location info */}
                              <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-3 h-3 text-teal-400" />
                                  <span className="text-[9px] font-semibold text-teal-400">معلومات الموقع</span>
                                </div>
                                <GpsLocationButton
                                  onLocationDetected={(loc) => {
                                    if (loc.governorate && loc.governorateValue) {
                                      nurseForm.setValue('governorate', loc.governorateValue);
                                    }
                                    if (loc.address || loc.district) {
                                      nurseForm.setValue('address', loc.district || loc.address);
                                    }
                                  }}
                                  size="sm"
                                  className="w-full"
                                />
                                <FloatingInput
                                  id="m-nurse-address"
                                  label="العنوان التفصيلي"
                                  icon={MapPin}
                                  registration={nurseForm.register('address')}
                                  error={nurseForm.formState.errors.address?.message}
                                  className="h-10"
                                />
                              </div>

                              {/* Security */}
                              <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                                <div className="flex items-center gap-1.5">
                                  <Lock className="w-3 h-3 text-amber-400" />
                                  <span className="text-[9px] font-semibold text-amber-400">الأمان</span>
                                </div>
                                <FloatingInput
                                  id="m-nurse-password"
                                  label="كلمة المرور"
                                  icon={Lock}
                                  type={showPassword ? 'text' : 'password'}
                                  dir="ltr"
                                  showToggle
                                  onToggle={() => setShowPassword(!showPassword)}
                                  toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  registration={nurseForm.register('password')}
                                  error={nurseForm.formState.errors.password?.message}
                                  className="h-10"
                                />
                                <PasswordStrengthBar password={nursePasswordValue} />
                              </div>

                              <ShimmerButton loading={isLoading} disabled={isLoading} className="from-sky-600 via-cyan-600 to-teal-600 hover:from-sky-500 hover:via-cyan-500 hover:to-teal-500 shadow-sky-500/25">
                                <span className="flex items-center gap-2 justify-center text-sm">
                                  <CheckCircle2 className="w-4 h-4" />
                                  إنشاء حساب ممرض/ـة
                                </span>
                              </ShimmerButton>
                            </motion.form>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Default Export with Suspense
// ============================================================================

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-950 via-purple-900 to-slate-950" dir="rtl">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center animate-pulse">
              <Heart className="w-8 h-8 text-white/60" fill="currentColor" />
            </div>
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جارٍ التحميل...</span>
            </div>
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
