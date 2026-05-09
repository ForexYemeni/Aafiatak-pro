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
  const [countdown, setCountdown] = useState(2);
  const [progress, setProgress] = useState(0);
  const config = roleConfig[user.role] || roleConfig.beneficiary;
  const RoleIcon = config.icon;

  useEffect(() => {
    const startTime = Date.now();
    const duration = 2000;

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

function PasswordStrengthBar({ password, variant = 'dark' }: { password: string; variant?: 'dark' | 'light' }) {
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
              i < strength.score ? strength.color : variant === 'light' ? 'bg-slate-200' : 'bg-muted-foreground/20'
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
// EKG / Heartbeat SVG Animation
// ============================================================================

function EkgAnimation() {
  return (
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden pointer-events-none opacity-20">
      <svg
        className="w-full ekg-line-draw"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        style={{ height: '80px' }}
      >
        <path
          d="M0,60 L200,60 L220,60 L240,20 L260,100 L280,10 L300,80 L320,60 L400,60 L420,60 L440,25 L460,95 L480,15 L500,75 L520,60 L600,60 L800,60 L820,60 L840,22 L860,98 L880,12 L900,78 L920,60 L1000,60 L1200,60"
          fill="none"
          stroke="url(#ekg-gradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="ekg-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
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
// Brand Panel - Left side for desktop split layout
// ============================================================================

function BrandPanel() {
  const features = [
    { icon: Shield, title: 'ممرضون معتمدون', desc: 'فريق طبي مرخص وموثق', delay: 0.6 },
    { icon: Clock, title: 'خدمة ٢٤ ساعة', desc: 'متاحون على مدار الساعة', delay: 0.75 },
    { icon: Activity, title: 'دعم طوارئ', desc: 'استجابة سريعة للحالات', delay: 0.9 },
  ];

  return (
    <div className="relative h-full flex flex-col justify-center items-center p-12 xl:p-16 overflow-hidden">
      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A]" />

      {/* Animated blobs */}
      <div
        className="absolute mesh-blob-1"
        style={{
          width: '500px', height: '500px',
          top: '-10%', right: '-5%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13,148,136,0.3) 0%, rgba(13,148,136,0.08) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute mesh-blob-2"
        style={{
          width: '400px', height: '400px',
          bottom: '-5%', left: '-5%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0.06) 40%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* EKG line */}
      <EkgAnimation />

      {/* Floating medical icons */}
      <motion.div
        className="absolute top-[10%] left-[10%] text-teal-400/10"
        animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Stethoscope className="w-20 h-20" />
      </motion.div>
      <motion.div
        className="absolute bottom-[15%] right-[10%] text-violet-400/10"
        animate={{ y: [0, 10, 0], rotate: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      >
        <Heart className="w-16 h-16" fill="currentColor" />
      </motion.div>
      <motion.div
        className="absolute top-[65%] left-[8%] text-teal-400/8"
        animate={{ y: [0, -8, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      >
        <Shield className="w-14 h-14" />
      </motion.div>

      {/* Floating particles */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/8 animate-float-gentle"
          style={{
            width: seededRandom(i * 3 + 70) * 3 + 2,
            height: seededRandom(i * 3 + 71) * 3 + 2,
            left: `${seededRandom(i * 3 + 72) * 80 + 10}%`,
            top: `${seededRandom(i * 3 + 73) * 80 + 10}%`,
            animationDelay: `${seededRandom(i * 5 + 80) * 3}s`,
            animationDuration: `${seededRandom(i * 5 + 81) * 3 + 4}s`,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 text-center max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
          className="mb-6"
        >
          <div className="relative inline-block">
            <div className="absolute inset-0 blur-xl bg-teal-400/30 rounded-full" />
            <div className="relative w-20 h-20 rounded-2xl mx-auto flex items-center justify-center bg-gradient-to-br from-teal-500/30 to-violet-600/20 backdrop-blur-xl border border-white/15 shadow-2xl shadow-teal-500/20">
              <Heart className="w-10 h-10 text-white" fill="currentColor" />
            </div>
          </div>
        </motion.div>

        {/* Brand name */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="text-5xl font-black text-white mb-3 tracking-tight"
        >
          عافيتك
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-lg text-white/70 font-medium mb-2"
        >
          رعاية صحية منزلية بلمسة زر
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-sm text-white/40 mb-10"
        >
          منصة الرعاية الصحية المنزلية الأولى في اليمن
        </motion.p>

        {/* Feature cards */}
        <div className="space-y-3">
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: feature.delay, duration: 0.5 }}
              className="flex items-center gap-4 bg-white/[0.06] backdrop-blur-sm rounded-xl p-3.5 border border-white/[0.08] hover:bg-white/[0.09] transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500/20 to-teal-600/10 flex items-center justify-center shrink-0 border border-teal-400/15">
                <feature.icon className="w-5 h-5 text-teal-400" />
              </div>
              <div className="text-right flex-1">
                <p className="text-sm font-bold text-white/90">{feature.title}</p>
                <p className="text-[11px] text-white/40">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
          className="mt-8 flex items-center justify-center gap-2 text-white/25 text-xs"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>بياناتك مشفرة ومحمية بتقنيات متقدمة</span>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================================
// Premium Input - Light variant for desktop right panel
// ============================================================================

function PremiumInput({
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
  variant = 'light',
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
  variant?: 'light' | 'dark';
}) {
  const isLight = variant === 'light';

  return (
    <div className="space-y-1.5">
      <div className="premium-input-group">
        <div className="relative">
          <Icon className={cn(
            'absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 z-10 pointer-events-none transition-colors duration-200',
            isLight ? 'text-slate-400' : 'text-white/40'
          )} />
          <Input
            id={id}
            type={type}
            placeholder=" "
            dir={dir}
            className={cn(
              'peer pr-11 pl-11 text-right h-12 rounded-xl premium-input-glow transition-all duration-200',
              isLight
                ? cn(
                    'bg-white border-slate-200 text-slate-900 placeholder-transparent',
                    'hover:border-slate-300',
                    'focus:bg-white focus:border-teal-400 focus:ring-2 focus:ring-teal-400/15',
                    error && 'border-red-400 focus:border-red-400 focus:ring-red-400/15'
                  )
                : cn(
                    'bg-white/[0.06] border-white/[0.1] text-white placeholder-transparent',
                    'hover:bg-white/[0.08] hover:border-white/[0.15]',
                    'focus:bg-white/[0.1] focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/15',
                    error && 'border-red-400/50 focus:border-red-400/70'
                  ),
              className
            )}
            {...registration}
          />
          <label
            htmlFor={id}
            className={cn(
              'premium-floating-label',
              isLight ? 'premium-floating-label-light' : 'premium-floating-label-dark'
            )}
          >
            {label}
          </label>
          {showToggle && (
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                'absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors z-10',
                isLight ? 'text-slate-400 hover:text-slate-600' : 'text-white/40 hover:text-white/70'
              )}
            >
              {toggleIcon}
            </button>
          )}
        </div>
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('text-xs mr-2', isLight ? 'text-red-500' : 'text-red-400')}
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ============================================================================
// Premium Button - Gradient CTA with shimmer
// ============================================================================

function PremiumButton({
  children,
  disabled,
  loading,
  className,
  type = 'submit',
  onClick,
  variant = 'primary',
}: {
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: 'submit' | 'button';
  onClick?: () => void;
  variant?: 'primary' | 'nurse';
}) {
  const isNurse = variant === 'nurse';

  return (
    <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} className="w-full">
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'premium-shimmer-btn relative w-full h-12 rounded-xl font-bold text-base text-white overflow-hidden',
          isNurse
            ? 'bg-gradient-to-l from-sky-600 via-cyan-600 to-teal-600 hover:from-sky-500 hover:via-cyan-500 hover:to-teal-500 shadow-lg shadow-sky-500/20 hover:shadow-xl hover:shadow-sky-500/25'
            : 'bg-gradient-to-l from-teal-600 via-emerald-600 to-violet-600 hover:from-teal-500 hover:via-emerald-500 hover:to-violet-500 shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/25',
          'disabled:opacity-60 disabled:cursor-not-allowed',
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
// Premium Toggle - Tab switch with sliding indicator
// ============================================================================

function PremiumToggle({
  activeTab,
  onTabChange,
  variant = 'light',
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  variant?: 'light' | 'dark';
}) {
  const isLight = variant === 'light';

  return (
    <div className={cn(
      'relative flex rounded-xl p-1',
      isLight ? 'bg-slate-100 border border-slate-200' : 'bg-white/[0.06] border border-white/[0.08]'
    )}>
      {/* Sliding indicator */}
      <motion.div
        className={cn(
          'absolute top-1 bottom-1 rounded-lg',
          isLight
            ? 'bg-white shadow-md shadow-slate-200/50'
            : 'bg-gradient-to-l from-teal-500/80 to-violet-600/80 shadow-lg shadow-teal-500/20'
        )}
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
          'relative z-10 flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors duration-200',
          isLight
            ? (activeTab === 'login' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600')
            : (activeTab === 'login' ? 'text-white' : 'text-white/50 hover:text-white/70')
        )}
      >
        تسجيل دخول
      </button>
      <button
        type="button"
        onClick={() => onTabChange('register')}
        className={cn(
          'relative z-10 flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors duration-200',
          isLight
            ? (activeTab === 'register' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600')
            : (activeTab === 'register' ? 'text-white' : 'text-white/50 hover:text-white/70')
        )}
      >
        إنشاء حساب
      </button>
    </div>
  );
}

// ============================================================================
// Premium Role Card - Animated selection
// ============================================================================

function PremiumRoleCard({
  role,
  isActive,
  onClick,
  icon: Icon,
  title,
  subtitle,
  activeColor,
  variant = 'light',
}: {
  role: string;
  isActive: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  activeColor: string;
  variant?: 'light' | 'dark';
}) {
  const isLight = variant === 'light';

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={cn(
        'relative rounded-xl p-4 text-center transition-all duration-300 overflow-hidden border',
        isLight
          ? (isActive
            ? 'border-teal-300 bg-teal-50/80 shadow-md shadow-teal-100/50'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50')
          : (isActive
            ? 'border-white/25 bg-white/[0.12] shadow-lg'
            : 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/15')
      )}
    >
      {isActive && (
        <motion.div
          layoutId="role-glow-premium"
          className={cn('absolute inset-0 opacity-10', activeColor)}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      )}
      <div className="relative z-10">
        <div className={cn(
          'w-11 h-11 rounded-xl mx-auto mb-2 flex items-center justify-center transition-all duration-300',
          isActive
            ? cn('bg-gradient-to-br shadow-lg', activeColor, 'text-white')
            : isLight
              ? 'bg-slate-100 text-slate-400'
              : 'bg-white/[0.08] text-white/40'
        )}>
          {isActive ? <Icon className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
        </div>
        <span className={cn(
          'text-sm font-bold transition-colors duration-300',
          isLight
            ? (isActive ? 'text-slate-900' : 'text-slate-500')
            : (isActive ? 'text-white' : 'text-white/50')
        )}>
          {title}
        </span>
        <p className={cn(
          'text-[10px] mt-0.5',
          isLight ? 'text-slate-400' : 'text-white/30'
        )}>{subtitle}</p>
      </div>
    </motion.button>
  );
}

// ============================================================================
// Form Section Divider
// ============================================================================

function FormSectionHeader({ icon: Icon, title, color, variant = 'light' }: { icon: React.ElementType; title: string; color: string; variant?: 'light' | 'dark' }) {
  const isLight = variant === 'light';
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={cn('w-3.5 h-3.5', color)} />
      <span className={cn('text-[11px] font-semibold', color)}>{title}</span>
    </div>
  );
}

// ============================================================================
// Main Login Page Component - WORLD-CLASS REDESIGN
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

  // Track whether this is a fresh login (clicked login button)
  // vs returning to the app with an existing session
  const [isFreshLogin, setIsFreshLogin] = useState(false);

  // Handle post-login redirect with loading screen
  const justLoggedOut = searchParams.get('logout') === 'true';

  useEffect(() => {
    if (!_hasHydrated) return;

    // If user is already authenticated (returning to app with saved session)
    // redirect IMMEDIATELY without the 5-second loading screen
    if (isAuthenticated && user && !justLoggedOut && !isFreshLogin) {
      const destination = redirectPath ?? getDashboardPath(user.role);
      // Use window.location.href for reliable full-page navigation
      // This ensures the auth cookie is sent with the request
      window.location.href = destination;
      return;
    }

    // If this is a fresh login, show the animated loading screen
    if (isAuthenticated && user && isFreshLogin && !showLoadingScreen) {
      setShowLoadingScreen(true);
    }

    if (justLoggedOut && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, user, justLoggedOut, showLoadingScreen, isFreshLogin, redirectPath, router, _hasHydrated]);

  const handleLoadingComplete = useCallback(() => {
    if (user) {
      const destination = redirectPath ?? getDashboardPath(user.role);
      // Use window.location.href for reliable full-page navigation
      // This ensures the auth cookie is sent with the request
      window.location.href = destination;
    }
  }, [user, redirectPath]);

  // ============================================================================
  // Login Form
  // ============================================================================

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  });

  const onLoginSubmit = async (data: LoginFormValues) => {
    clearError();
    setIsFreshLogin(true); // Mark as fresh login to show loading screen
    try {
      await login(data.phone, data.password);
    } catch {
      setIsFreshLogin(false); // Reset on failure
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
      setIsFreshLogin(true); // Show loading screen after registration
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
      setIsFreshLogin(true); // Show loading screen after registration
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
  // Error display component
  // ============================================================================
  const ErrorDisplay = ({ variant = 'light' }: { variant?: 'light' | 'dark' }) => (
    <AnimatePresence mode="wait">
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={cn(
            'mb-4 text-sm rounded-xl p-3 flex items-center gap-2 border',
            variant === 'light'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-red-500/10 text-red-300 border-red-500/20'
          )}
        >
          <Shield className="w-4 h-4 shrink-0" />
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ============================================================================
  // Smart login notice component
  // ============================================================================
  const SmartLoginNotice = ({ variant = 'light' }: { variant?: 'light' | 'dark' }) => (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl p-3 border',
        variant === 'light'
          ? 'bg-gradient-to-l from-teal-50 via-emerald-50/50 to-violet-50 border-teal-200/60'
          : 'bg-gradient-to-l from-violet-500/10 via-purple-500/5 to-fuchsia-500/10 border-purple-500/15'
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          variant === 'light'
            ? 'bg-gradient-to-br from-teal-100 to-violet-100'
            : 'bg-gradient-to-br from-violet-500/20 to-purple-500/20'
        )}>
          <Sparkles className={cn('w-4 h-4', variant === 'light' ? 'text-teal-600' : 'text-purple-300')} />
        </div>
        <div>
          <p className={cn('text-xs font-semibold', variant === 'light' ? 'text-slate-700' : 'text-white/80')}>
            تسجيل دخول ذكي
          </p>
          <p className={cn('text-[10px]', variant === 'light' ? 'text-slate-400' : 'text-white/40')}>
            سيتعرف النظام تلقائياً على نوع حسابك
          </p>
        </div>
      </div>
    </motion.div>
  );

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

      {/* ============ DESKTOP: Split-screen layout ============ */}
      <div className="hidden lg:flex lg:h-screen">
        {/* LEFT PANEL - Brand (55%) */}
        <div className="w-[55%] relative">
          <BrandPanel />
        </div>

        {/* RIGHT PANEL - Form (45%) */}
        <div className="w-[45%] bg-[#FAFBFC] relative flex items-center justify-center overflow-y-auto">
          <div className="w-full max-w-[440px] mx-auto px-8 py-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Greeting */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <h2 className="text-2xl font-black text-slate-900 mb-1">
                  {activeTab === 'login' ? 'مرحباً بعودتك' : 'حساب جديد'}
                </h2>
                <p className="text-sm text-slate-400">
                  {activeTab === 'login' ? 'سجّل دخولك للمتابعة إلى عافيتك' : 'أنشئ حسابك وابدأ رحلتك الصحية'}
                </p>
              </motion.div>

              {/* Toggle */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-6"
              >
                <PremiumToggle
                  activeTab={activeTab}
                  onTabChange={(tab) => { setActiveTab(tab); clearError(); }}
                  variant="light"
                />
              </motion.div>

              <ErrorDisplay variant="light" />

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
                    <SmartLoginNotice variant="light" />

                    <PremiumInput
                      id="login-phone"
                      label="رقم الهاتف"
                      icon={Phone}
                      type="tel"
                      dir="ltr"
                      variant="light"
                      registration={loginForm.register('phone')}
                      error={loginForm.formState.errors.phone?.message}
                    />

                    <PremiumInput
                      id="login-password"
                      label="كلمة المرور"
                      icon={Lock}
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      variant="light"
                      showToggle
                      onToggle={() => setShowPassword(!showPassword)}
                      toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      registration={loginForm.register('password')}
                      error={loginForm.formState.errors.password?.message}
                    />

                    <PasswordStrengthBar password={loginPasswordValue} variant="light" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="remember"
                          className="h-3.5 w-3.5 rounded border-slate-300 bg-white text-teal-600 focus:ring-teal-500/30"
                        />
                        <Label htmlFor="remember" className="text-xs font-normal cursor-pointer text-slate-500">تذكرني</Label>
                      </div>
                      <button type="button" className="text-xs text-teal-600/80 hover:text-teal-600 transition-colors font-medium">
                        نسيت كلمة المرور؟
                      </button>
                    </div>

                    <PremiumButton loading={isLoading} disabled={isLoading}>
                      <span className="flex items-center gap-2 justify-center">
                        تسجيل الدخول
                        <ArrowLeft className="w-4 h-4" />
                      </span>
                    </PremiumButton>
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
                      <PremiumRoleCard
                        role="beneficiary"
                        isActive={registerRole === 'beneficiary'}
                        onClick={() => { setRegisterRole('beneficiary'); clearError(); }}
                        icon={User}
                        title="مستفيد"
                        subtitle="رعاية منزلية"
                        activeColor="from-teal-500 to-emerald-600"
                        variant="light"
                      />
                      <PremiumRoleCard
                        role="nurse"
                        isActive={registerRole === 'nurse'}
                        onClick={() => { setRegisterRole('nurse'); clearError(); }}
                        icon={Stethoscope}
                        title="ممرض/ـة"
                        subtitle="ممرض معتمد"
                        activeColor="from-sky-500 to-sky-700"
                        variant="light"
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
                          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 space-y-3">
                            <FormSectionHeader icon={User} title="المعلومات الشخصية" color="text-teal-600" variant="light" />
                            <PremiumInput
                              id="ben-name"
                              label="الاسم الكامل"
                              icon={User}
                              variant="light"
                              registration={beneficiaryForm.register('name')}
                              error={beneficiaryForm.formState.errors.name?.message}
                            />
                            <PremiumInput
                              id="ben-phone"
                              label="رقم الهاتف"
                              icon={Phone}
                              type="tel"
                              dir="ltr"
                              variant="light"
                              registration={beneficiaryForm.register('phone')}
                              error={beneficiaryForm.formState.errors.phone?.message}
                            />
                          </div>

                          {/* Location info */}
                          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 space-y-3">
                            <FormSectionHeader icon={MapPin} title="معلومات الموقع" color="text-teal-600" variant="light" />
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
                            <PremiumInput
                              id="ben-address"
                              label="العنوان"
                              icon={MapPin}
                              variant="light"
                              registration={beneficiaryForm.register('address')}
                              error={beneficiaryForm.formState.errors.address?.message}
                            />
                            <PremiumInput
                              id="ben-referral"
                              label="كود الإحالة (اختياري)"
                              icon={Sparkles}
                              dir="ltr"
                              variant="light"
                              registration={beneficiaryForm.register('referralCode')}
                            />
                          </div>

                          {/* Security */}
                          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 space-y-3">
                            <FormSectionHeader icon={Lock} title="الأمان" color="text-amber-600" variant="light" />
                            <PremiumInput
                              id="ben-password"
                              label="كلمة المرور"
                              icon={Lock}
                              type={showPassword ? 'text' : 'password'}
                              dir="ltr"
                              variant="light"
                              showToggle
                              onToggle={() => setShowPassword(!showPassword)}
                              toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              registration={beneficiaryForm.register('password')}
                              error={beneficiaryForm.formState.errors.password?.message}
                            />
                            <PasswordStrengthBar password={beneficiaryPasswordValue} variant="light" />
                          </div>

                          <PremiumButton loading={isLoading} disabled={isLoading}>
                            <span className="flex items-center gap-2 justify-center">
                              <CheckCircle2 className="w-4 h-4" />
                              إنشاء حساب مستفيد
                            </span>
                          </PremiumButton>
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
                          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 space-y-3">
                            <FormSectionHeader icon={User} title="المعلومات الشخصية" color="text-sky-600" variant="light" />
                            <motion.div
                              className="relative"
                              animate={nurseNameShake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
                              transition={{ duration: 0.5, ease: 'easeInOut' }}
                            >
                              <PremiumInput
                                id="nurse-name"
                                label="الاسم الرباعي"
                                icon={User}
                                variant="light"
                                registration={nurseForm.register('name')}
                                error={nurseNameShake ? undefined : nurseForm.formState.errors.name?.message}
                                className={nurseNameShake ? '!border-red-400' : ''}
                              />
                            </motion.div>
                            {nurseNameWarning && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-1.5"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                <p className="text-xs text-red-500 font-medium">يجب أن تكتب اسمك الرباعي (أربعة أجزاء)</p>
                              </motion.div>
                            )}
                            {nurseForm.formState.errors.name && !nurseNameWarning && (
                              <p className="text-xs text-red-500">{nurseForm.formState.errors.name.message}</p>
                            )}
                            <PremiumInput
                              id="nurse-phone"
                              label="رقم الهاتف"
                              icon={Phone}
                              type="tel"
                              dir="ltr"
                              variant="light"
                              registration={nurseForm.register('phone')}
                              error={nurseForm.formState.errors.phone?.message}
                            />
                          </div>

                          {/* Professional info */}
                          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 space-y-3">
                            <FormSectionHeader icon={Stethoscope} title="المعلومات المهنية" color="text-violet-600" variant="light" />
                            <div className="space-y-1.5">
                              <Label className="text-xs text-slate-500">التخصص</Label>
                              <Select onValueChange={(v) => nurseForm.setValue('specialization', v)}>
                                <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 text-slate-800 hover:border-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/15">
                                  <SelectValue placeholder="اختر التخصص" />
                                </SelectTrigger>
                                <SelectContent>
                                  {specializations.map((spec) => (
                                    <SelectItem key={spec.value} value={spec.value}>{spec.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {nurseForm.formState.errors.specialization && (
                                <p className="text-xs text-red-500">{nurseForm.formState.errors.specialization.message}</p>
                              )}
                            </div>
                            <PremiumInput
                              id="nurse-license"
                              label="رقم الترخيص"
                              icon={Shield}
                              variant="light"
                              registration={nurseForm.register('licenseNumber')}
                              error={nurseForm.formState.errors.licenseNumber?.message}
                            />
                          </div>

                          {/* Location info */}
                          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 space-y-3">
                            <FormSectionHeader icon={MapPin} title="معلومات الموقع" color="text-teal-600" variant="light" />
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
                            <PremiumInput
                              id="nurse-address"
                              label="العنوان التفصيلي"
                              icon={MapPin}
                              variant="light"
                              registration={nurseForm.register('address')}
                              error={nurseForm.formState.errors.address?.message}
                            />
                          </div>

                          {/* Security */}
                          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 space-y-3">
                            <FormSectionHeader icon={Lock} title="الأمان" color="text-amber-600" variant="light" />
                            <PremiumInput
                              id="nurse-password"
                              label="كلمة المرور"
                              icon={Lock}
                              type={showPassword ? 'text' : 'password'}
                              dir="ltr"
                              variant="light"
                              showToggle
                              onToggle={() => setShowPassword(!showPassword)}
                              toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              registration={nurseForm.register('password')}
                              error={nurseForm.formState.errors.password?.message}
                            />
                            <PasswordStrengthBar password={nursePasswordValue} variant="light" />
                          </div>

                          <PremiumButton loading={isLoading} disabled={isLoading} variant="nurse">
                            <span className="flex items-center gap-2 justify-center">
                              <CheckCircle2 className="w-4 h-4" />
                              إنشاء حساب ممرض/ـة
                            </span>
                          </PremiumButton>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ============ MOBILE: Full-screen dark layout ============ */}
      <div className="lg:hidden flex flex-col min-h-screen">
        {/* Dark gradient background */}
        <div className="fixed inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A] -z-10" />

        {/* Animated blobs for mobile */}
        <div className="fixed inset-0 -z-5 overflow-hidden pointer-events-none">
          <div
            className="absolute mesh-blob-1"
            style={{
              width: '300px', height: '300px',
              top: '-10%', right: '-10%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(13,148,136,0.25) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
          <div
            className="absolute mesh-blob-2"
            style={{
              width: '250px', height: '250px',
              bottom: '-5%', left: '-8%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
        </div>

        {/* Mobile header with logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="px-6 pt-10 pb-4 text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-gradient-to-br from-teal-500/25 to-violet-600/15 backdrop-blur-xl border border-white/15 shadow-lg shadow-teal-500/10"
          >
            <Heart className="w-7 h-7 text-white" fill="currentColor" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-black text-white"
          >
            عافيتك
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xs text-white/50 mt-1"
          >
            رعاية صحية منزلية بلمسة زر
          </motion.p>
        </motion.div>

        {/* Form card */}
        <div className="flex-1 px-4 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="relative glass-ultra rounded-2xl noise-overlay">
              <div className="relative z-10 p-5">
                {/* Toggle */}
                <div className="mb-4">
                  <PremiumToggle
                    activeTab={activeTab}
                    onTabChange={(tab) => { setActiveTab(tab); clearError(); }}
                    variant="dark"
                  />
                </div>

                <ErrorDisplay variant="dark" />

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
                      <SmartLoginNotice variant="dark" />

                      <PremiumInput
                        id="m-login-phone"
                        label="رقم الهاتف"
                        icon={Phone}
                        type="tel"
                        dir="ltr"
                        variant="dark"
                        registration={loginForm.register('phone')}
                        error={loginForm.formState.errors.phone?.message}
                        className="h-11"
                      />

                      <PremiumInput
                        id="m-login-password"
                        label="كلمة المرور"
                        icon={Lock}
                        type={showPassword ? 'text' : 'password'}
                        dir="ltr"
                        variant="dark"
                        showToggle
                        onToggle={() => setShowPassword(!showPassword)}
                        toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        registration={loginForm.register('password')}
                        error={loginForm.formState.errors.password?.message}
                        className="h-11"
                      />

                      <PasswordStrengthBar password={loginPasswordValue} variant="dark" />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <input type="checkbox" id="m-remember" className="h-3.5 w-3.5 rounded border-white/20 bg-white/10 text-teal-500 focus:ring-teal-500/30" />
                          <Label htmlFor="m-remember" className="text-[11px] font-normal cursor-pointer text-white/40">تذكرني</Label>
                        </div>
                        <button type="button" className="text-[11px] text-teal-400/70 hover:text-teal-300 transition-colors">نسيت كلمة المرور؟</button>
                      </div>

                      <PremiumButton loading={isLoading} disabled={isLoading}>
                        <span className="flex items-center gap-2 justify-center text-sm">
                          تسجيل الدخول
                          <ArrowLeft className="w-4 h-4" />
                        </span>
                      </PremiumButton>
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
                        <PremiumRoleCard
                          role="beneficiary"
                          isActive={registerRole === 'beneficiary'}
                          onClick={() => { setRegisterRole('beneficiary'); clearError(); }}
                          icon={User}
                          title="مستفيد"
                          subtitle="رعاية منزلية"
                          activeColor="from-teal-500 to-emerald-600"
                          variant="dark"
                        />
                        <PremiumRoleCard
                          role="nurse"
                          isActive={registerRole === 'nurse'}
                          onClick={() => { setRegisterRole('nurse'); clearError(); }}
                          icon={Stethoscope}
                          title="ممرض/ـة"
                          subtitle="ممرض معتمد"
                          activeColor="from-sky-500 to-sky-700"
                          variant="dark"
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
                            <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                              <FormSectionHeader icon={User} title="المعلومات الشخصية" color="text-teal-400" variant="dark" />
                              <PremiumInput
                                id="m-ben-name"
                                label="الاسم الكامل"
                                icon={User}
                                variant="dark"
                                registration={beneficiaryForm.register('name')}
                                error={beneficiaryForm.formState.errors.name?.message}
                                className="h-10"
                              />
                              <PremiumInput
                                id="m-ben-phone"
                                label="رقم الهاتف"
                                icon={Phone}
                                type="tel"
                                dir="ltr"
                                variant="dark"
                                registration={beneficiaryForm.register('phone')}
                                error={beneficiaryForm.formState.errors.phone?.message}
                                className="h-10"
                              />
                            </div>

                            <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                              <FormSectionHeader icon={MapPin} title="معلومات الموقع" color="text-teal-400" variant="dark" />
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
                              <PremiumInput
                                id="m-ben-address"
                                label="العنوان"
                                icon={MapPin}
                                variant="dark"
                                registration={beneficiaryForm.register('address')}
                                error={beneficiaryForm.formState.errors.address?.message}
                                className="h-10"
                              />
                              <PremiumInput
                                id="m-ben-referral"
                                label="كود الإحالة (اختياري)"
                                icon={Sparkles}
                                dir="ltr"
                                variant="dark"
                                registration={beneficiaryForm.register('referralCode')}
                                className="h-10"
                              />
                            </div>

                            <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                              <FormSectionHeader icon={Lock} title="الأمان" color="text-amber-400" variant="dark" />
                              <PremiumInput
                                id="m-ben-password"
                                label="كلمة المرور"
                                icon={Lock}
                                type={showPassword ? 'text' : 'password'}
                                dir="ltr"
                                variant="dark"
                                showToggle
                                onToggle={() => setShowPassword(!showPassword)}
                                toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                registration={beneficiaryForm.register('password')}
                                error={beneficiaryForm.formState.errors.password?.message}
                                className="h-10"
                              />
                              <PasswordStrengthBar password={beneficiaryPasswordValue} variant="dark" />
                            </div>

                            <PremiumButton loading={isLoading} disabled={isLoading}>
                              <span className="flex items-center gap-2 justify-center text-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                إنشاء حساب مستفيد
                              </span>
                            </PremiumButton>
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
                            className="space-y-2.5 max-h-[58vh] overflow-y-auto custom-scrollbar pl-1"
                          >
                            <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                              <FormSectionHeader icon={User} title="المعلومات الشخصية" color="text-sky-400" variant="dark" />
                              <motion.div
                                animate={nurseNameShake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
                                transition={{ duration: 0.5, ease: 'easeInOut' }}
                              >
                                <PremiumInput
                                  id="m-nurse-name"
                                  label="الاسم الرباعي"
                                  icon={User}
                                  variant="dark"
                                  registration={nurseForm.register('name')}
                                  error={nurseNameShake ? undefined : nurseForm.formState.errors.name?.message}
                                  className={cn('h-10', nurseNameShake && '!border-red-400/60')}
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
                              <PremiumInput
                                id="m-nurse-phone"
                                label="رقم الهاتف"
                                icon={Phone}
                                type="tel"
                                dir="ltr"
                                variant="dark"
                                registration={nurseForm.register('phone')}
                                error={nurseForm.formState.errors.phone?.message}
                                className="h-10"
                              />
                            </div>

                            <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                              <FormSectionHeader icon={Stethoscope} title="المعلومات المهنية" color="text-violet-400" variant="dark" />
                              <div className="space-y-1.5">
                                <Label className="text-[10px] text-white/40">التخصص</Label>
                                <Select onValueChange={(v) => nurseForm.setValue('specialization', v)}>
                                  <SelectTrigger className="h-10 rounded-xl bg-white/[0.06] border-white/[0.1] text-white/80 text-xs hover:bg-white/[0.08] focus:border-teal-400/50">
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
                              <PremiumInput
                                id="m-nurse-license"
                                label="رقم الترخيص"
                                icon={Shield}
                                variant="dark"
                                registration={nurseForm.register('licenseNumber')}
                                error={nurseForm.formState.errors.licenseNumber?.message}
                                className="h-10"
                              />
                            </div>

                            <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                              <FormSectionHeader icon={MapPin} title="معلومات الموقع" color="text-teal-400" variant="dark" />
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
                              <PremiumInput
                                id="m-nurse-address"
                                label="العنوان التفصيلي"
                                icon={MapPin}
                                variant="dark"
                                registration={nurseForm.register('address')}
                                error={nurseForm.formState.errors.address?.message}
                                className="h-10"
                              />
                            </div>

                            <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] space-y-2.5">
                              <FormSectionHeader icon={Lock} title="الأمان" color="text-amber-400" variant="dark" />
                              <PremiumInput
                                id="m-nurse-password"
                                label="كلمة المرور"
                                icon={Lock}
                                type={showPassword ? 'text' : 'password'}
                                dir="ltr"
                                variant="dark"
                                showToggle
                                onToggle={() => setShowPassword(!showPassword)}
                                toggleIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                registration={nurseForm.register('password')}
                                error={nurseForm.formState.errors.password?.message}
                                className="h-10"
                              />
                              <PasswordStrengthBar password={nursePasswordValue} variant="dark" />
                            </div>

                            <PremiumButton loading={isLoading} disabled={isLoading} variant="nurse">
                              <span className="flex items-center gap-2 justify-center text-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                إنشاء حساب ممرض/ـة
                              </span>
                            </PremiumButton>
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
  );
}

// ============================================================================
// Default Export with Suspense
// ============================================================================

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A]" dir="rtl">
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
