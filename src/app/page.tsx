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
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const nurseRegisterSchema = z
  .object({
    name: z.string().min(1, 'الاسم مطلوب').min(3, 'الاسم يجب أن يكون ٣ أحرف على الأقل'),
    phone: z
      .string()
      .min(1, 'رقم الهاتف مطلوب')
      .regex(/^(7\d{8}|\+9677\d{7,8}|9677\d{7,8})$/, 'صيغة رقم الهاتف غير صحيحة'),
    password: z.string().min(1, 'كلمة المرور مطلوبة').min(6, 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل'),
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

const beneficiaryRegisterSchema = z
  .object({
    name: z.string().min(1, 'الاسم مطلوب').min(3, 'الاسم يجب أن يكون ٣ أحرف على الأقل'),
    phone: z
      .string()
      .min(1, 'رقم الهاتف مطلوب')
      .regex(/^(7\d{8}|\+9677\d{7,8}|9677\d{7,8})$/, 'صيغة رقم الهاتف غير صحيحة'),
    password: z.string().min(1, 'كلمة المرور مطلوبة').min(6, 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل'),
    confirmPassword: z.string().min(1, 'تأكيد كلمة المرور مطلوب'),
    address: z.string().min(1, 'العنوان مطلوب'),
    governorate: z.string().optional(),
    referralCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
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
// Floating Particles Component
// ============================================================================

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/20 dark:bg-white/10"
          style={{
            width: seededRandom(i * 4) * 4 + 2,
            height: seededRandom(i * 4 + 1) * 4 + 2,
            left: `${seededRandom(i * 4 + 2) * 100}%`,
            top: `${seededRandom(i * 4 + 3) * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, seededRandom(i * 7) * 20 - 10, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: seededRandom(i * 7 + 1) * 4 + 3,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: seededRandom(i * 7 + 2) * 3,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Hero Section Component (Right side on desktop)
// ============================================================================

function HeroSection() {
  const features = [
    { icon: Stethoscope, title: 'ممرضون معتمدون', desc: 'ممرضون مرخصون ومعتمدون', color: 'from-sky-400 to-sky-600' },
    { icon: Heart, title: 'رعاية منزلية', desc: 'خدمات صحية في منزلك', color: 'from-purple-400 to-purple-600' },
    { icon: Shield, title: 'طوارئ ٢٤/٧', desc: 'خدمة طوارئ على مدار الساعة', color: 'from-red-400 to-red-600' },
    { icon: MapPin, title: 'تغطية واسعة', desc: 'خدمات في جميع المحافظات', color: 'from-emerald-400 to-emerald-600' },
  ];

  const trustIndicators = [
    { icon: Users, text: 'أكثر من ١٠٠٠ ممرض معتمد' },
    { icon: Clock, text: 'خدمة طوارئ ٢٤/٧' },
    { icon: Activity, text: 'رعاية صحية متكاملة' },
  ];

  return (
    <div className="relative h-full flex flex-col justify-center items-center p-8 lg:p-12 overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-purple-700 to-sky-700 dark:from-purple-900 dark:via-purple-950 dark:to-sky-950" />
        <motion.div
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1], x: [0, -30, 0], y: [0, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.3) 0%, transparent 70%)' }}
          animate={{ scale: [1.1, 0.9, 1.1], x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <FloatingParticles />

      {/* Content */}
      <div className="relative z-10 text-center max-w-md">
        {/* Logo with pulse */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="relative mx-auto mb-6"
        >
          <motion.div
            animate={{ boxShadow: ['0 0 0 0 rgba(168,85,247,0.4)', '0 0 0 20px rgba(168,85,247,0)', '0 0 0 0 rgba(168,85,247,0)'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl"
          >
            <Heart className="w-12 h-12 text-white" fill="currentColor" />
          </motion.div>
        </motion.div>

        {/* Brand name */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-5xl font-bold text-white mb-3"
        >
          عافيتك
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-lg text-white/80 mb-10"
        >
          منصة الرعاية الصحية المنزلية في اليمن
        </motion.p>

        {/* Feature cards */}
        <div className="grid grid-cols-2 gap-3 mb-10">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
              whileHover={{ scale: 1.05, y: -2 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-right cursor-default group"
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-2 bg-gradient-to-br', feature.color, 'shadow-lg group-hover:shadow-xl transition-shadow')}>
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-white">{feature.title}</p>
              <p className="text-xs text-white/60 mt-0.5">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="space-y-3"
        >
          {trustIndicators.map((indicator, i) => (
            <motion.div
              key={indicator.text}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3 + i * 0.1 }}
              className="flex items-center gap-3 text-white/70 text-sm justify-center"
            >
              <indicator.icon className="w-4 h-4 text-white/50" />
              <span>{indicator.text}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Floating decorative icons */}
      <motion.div
        className="absolute top-[15%] left-[10%] text-white/10"
        animate={{ y: [0, -15, 0], rotate: [0, 10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Stethoscope className="w-12 h-12" />
      </motion.div>
      <motion.div
        className="absolute bottom-[20%] right-[10%] text-white/10"
        animate={{ y: [0, 10, 0], rotate: [0, -10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      >
        <Heart className="w-10 h-10" />
      </motion.div>
      <motion.div
        className="absolute top-[60%] left-[5%] text-white/10"
        animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      >
        <Shield className="w-11 h-11" />
      </motion.div>
    </div>
  );
}

// ============================================================================
// Mobile Hero Header (compact)
// ============================================================================

function MobileHeroHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-sky-700 dark:from-purple-900 dark:via-purple-950 dark:to-sky-950 px-6 pt-10 pb-8 text-center"
    >
      <FloatingParticles />
      <div className="relative z-10">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-white/20 backdrop-blur-xl border border-white/30 shadow-lg"
        >
          <Heart className="w-7 h-7 text-white" fill="currentColor" />
        </motion.div>
        <h1 className="text-2xl font-bold text-white">عافيتك</h1>
        <p className="text-sm text-white/70 mt-1">منصة الرعاية الصحية المنزلية في اليمن</p>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Post-Login Loading Screen with 5-Second Countdown
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
            {/* Background circle */}
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="5"
            />
            {/* Progress circle */}
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
// Main Login Page Component
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);

  // Handle post-login redirect with loading screen
  const justLoggedOut = searchParams.get('logout') === 'true';

  useEffect(() => {
    // Wait for hydration before checking auth state
    if (!_hasHydrated) return;

    if (isAuthenticated && user && !justLoggedOut && !showLoadingScreen) {
      // Show the loading screen first
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
      name: '', phone: '', password: '', confirmPassword: '',
      specialization: '', licenseNumber: '', governorate: '',
    },
  });

  const onNurseRegister = async (data: NurseRegisterFormValues) => {
    clearError();
    try {
      await registerNurse({
        name: data.name,
        phone: data.phone,
        password: data.password,
        specialization: data.specialization,
        licenseNumber: data.licenseNumber,
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
      name: '', phone: '', password: '', confirmPassword: '',
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

      {/* ---- Desktop: Split-screen layout ---- */}
      <div className="hidden lg:flex lg:h-screen">
        {/* Right side: Hero branding */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-1/2 relative"
        >
          <HeroSection />
        </motion.div>

        {/* Left side: Form */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className="w-1/2 flex items-center justify-center p-8 bg-background relative"
        >
          {/* Subtle dot grid background */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />

          <div className="w-full max-w-md relative z-10">
            {/* Welcome text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <h2 className="text-2xl font-bold text-foreground">مرحباً بك في عافيتك</h2>
              <p className="text-muted-foreground mt-1">سجّل دخولك للوصول إلى حسابك</p>
            </motion.div>

            {/* Main form card with gradient border */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="relative rounded-3xl overflow-hidden"
            >
              {/* Animated gradient border */}
              <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-purple-500 via-sky-500 to-emerald-500 opacity-20 blur-[1px]" />
              <div className="relative glass-strong rounded-3xl shadow-2xl border border-white/30 dark:border-white/10">
                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); clearError(); }}>
                  <TabsList className="w-full rounded-none border-b border-border/50 bg-transparent h-14 p-0">
                    <TabsTrigger
                      value="login"
                      className="flex-1 h-full rounded-none text-base font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400"
                    >
                      تسجيل دخول
                    </TabsTrigger>
                    <TabsTrigger
                      value="register"
                      className="flex-1 h-full rounded-none text-base font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400"
                    >
                      إنشاء حساب
                    </TabsTrigger>
                  </TabsList>

                  {/* Error Display */}
                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mx-6 mt-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm rounded-xl p-3 flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ====== Login Tab ====== */}
                  <TabsContent value="login" className="p-6 pt-5 mt-0">
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5">
                      {/* Smart login notice */}
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-l from-purple-500/5 via-sky-500/5 to-emerald-500/5 rounded-2xl p-4 border border-purple-500/10"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-sky-500/20 flex items-center justify-center shrink-0">
                            <Sparkles className="w-5 h-5 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">تسجيل دخول ذكي</p>
                            <p className="text-xs text-muted-foreground mt-0.5">سيتعرف النظام تلقائياً على نوع حسابك عند تسجيل الدخول</p>
                          </div>
                        </div>
                      </motion.div>

                      {/* Phone */}
                      <div className="space-y-2">
                        <Label htmlFor="login-phone" className="text-sm font-medium">رقم الهاتف</Label>
                        <div className="relative">
                          <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="login-phone"
                            type="tel"
                            placeholder="7XXXXXXXX"
                            className="pr-10 text-right h-12 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-colors"
                            dir="ltr"
                            {...loginForm.register('phone')}
                          />
                        </div>
                        {loginForm.formState.errors.phone && (
                          <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive">
                            {loginForm.formState.errors.phone.message}
                          </motion.p>
                        )}
                      </div>

                      {/* Password */}
                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-sm font-medium">كلمة المرور</Label>
                        <div className="relative">
                          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••"
                            className="pr-10 pl-10 text-right h-12 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-colors"
                            dir="ltr"
                            {...loginForm.register('password')}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {loginForm.formState.errors.password && (
                          <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive">
                            {loginForm.formState.errors.password.message}
                          </motion.p>
                        )}
                      </div>

                      {/* Remember me + Forgot password */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="remember"
                            className="h-4 w-4 rounded border-border/50 text-purple-600 focus:ring-purple-500"
                          />
                          <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">تذكرني</Label>
                        </div>
                        <button type="button" className="text-xs text-purple-600 dark:text-purple-400 hover:underline">
                          نسيت كلمة المرور؟
                        </button>
                      </div>

                      {/* Submit button */}
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          type="submit"
                          className="w-full h-12 text-base font-bold rounded-xl shadow-lg transition-all duration-300 bg-gradient-to-l from-purple-600 via-purple-700 to-sky-700 hover:opacity-90 text-white"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <span className="flex items-center gap-2">
                              تسجيل الدخول
                              <ArrowLeft className="w-4 h-4" />
                            </span>
                          )}
                        </Button>
                      </motion.div>
                    </form>
                  </TabsContent>

                  {/* ====== Register Tab ====== */}
                  <TabsContent value="register" className="p-6 pt-5 mt-0">
                    {/* Register role toggle */}
                    <div className="space-y-3 mb-5">
                      <Label className="text-sm font-medium">نوع الحساب</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { setRegisterRole('beneficiary'); clearError(); }}
                          className={cn(
                            'relative rounded-2xl p-4 text-center transition-all duration-300 overflow-hidden border-2',
                            registerRole === 'beneficiary'
                              ? 'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400 shadow-lg'
                              : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50'
                          )}
                        >
                          {registerRole === 'beneficiary' && (
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-700 opacity-10" />
                          )}
                          <div className="relative z-10">
                            <User className="w-6 h-6 mx-auto mb-1.5" />
                            <span className="text-sm font-bold">مستفيد</span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">احصل على رعاية منزلية</p>
                          </div>
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { setRegisterRole('nurse'); clearError(); }}
                          className={cn(
                            'relative rounded-2xl p-4 text-center transition-all duration-300 overflow-hidden border-2',
                            registerRole === 'nurse'
                              ? 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-400 shadow-lg'
                              : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50'
                          )}
                        >
                          {registerRole === 'nurse' && (
                            <div className="absolute inset-0 bg-gradient-to-br from-sky-500 to-sky-700 opacity-10" />
                          )}
                          <div className="relative z-10">
                            <Stethoscope className="w-6 h-6 mx-auto mb-1.5" />
                            <span className="text-sm font-bold">ممرض/ـة</span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">انضم كممرض معتمد</p>
                          </div>
                        </motion.button>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {/* Beneficiary Registration Form */}
                      {registerRole === 'beneficiary' && (
                        <motion.form
                          key="beneficiary-form"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.25 }}
                          onSubmit={beneficiaryForm.handleSubmit(onBeneficiaryRegister)}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <Label htmlFor="ben-name">الاسم الكامل</Label>
                            <div className="relative">
                              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input id="ben-name" placeholder="الاسم الكامل" className="pr-10 text-right h-11 rounded-xl" {...beneficiaryForm.register('name')} />
                            </div>
                            {beneficiaryForm.formState.errors.name && <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.name.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="ben-phone">رقم الهاتف</Label>
                            <div className="relative">
                              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input id="ben-phone" type="tel" placeholder="7XXXXXXXX" className="pr-10 text-right h-11 rounded-xl" dir="ltr" {...beneficiaryForm.register('phone')} />
                            </div>
                            {beneficiaryForm.formState.errors.phone && <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.phone.message}</p>}
                          </div>
                          {/* GPS Location Detection */}
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
                          <div className="space-y-2">
                            <Label htmlFor="ben-address">العنوان</Label>
                            <div className="relative">
                              <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input id="ben-address" placeholder="عنوانك التفصيلي" className="pr-10 text-right h-11 rounded-xl" {...beneficiaryForm.register('address')} />
                            </div>
                            {beneficiaryForm.formState.errors.address && <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.address.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>المحافظة</Label>
                            <Select onValueChange={(v) => beneficiaryForm.setValue('governorate', v)}>
                              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                              <SelectContent>{YEMEN_GOVERNORATES.map((gov) => (<SelectItem key={gov.value} value={gov.value}>{gov.label}</SelectItem>))}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="ben-referral">كود الإحالة (اختياري)</Label>
                            <Input id="ben-referral" placeholder="AF-XXXXXX" className="text-right h-11 rounded-xl" dir="ltr" {...beneficiaryForm.register('referralCode')} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="ben-password">كلمة المرور</Label>
                            <div className="relative">
                              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input id="ben-password" type={showPassword ? 'text' : 'password'} placeholder="••••••" className="pr-10 pl-10 text-right h-11 rounded-xl" dir="ltr" {...beneficiaryForm.register('password')} />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {beneficiaryForm.formState.errors.password && <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.password.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="ben-confirm-password">تأكيد كلمة المرور</Label>
                            <div className="relative">
                              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input id="ben-confirm-password" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••" className="pr-10 pl-10 text-right h-11 rounded-xl" dir="ltr" {...beneficiaryForm.register('confirmPassword')} />
                              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {beneficiaryForm.formState.errors.confirmPassword && <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.confirmPassword.message}</p>}
                          </div>
                          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                            <Button type="submit" className="w-full h-12 text-base font-bold rounded-xl bg-gradient-to-l from-purple-500 to-purple-700 hover:opacity-90 text-white shadow-lg" disabled={isLoading}>
                              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />إنشاء حساب مستفيد</span>}
                            </Button>
                          </motion.div>
                        </motion.form>
                      )}

                      {/* Nurse Registration Form */}
                      {registerRole === 'nurse' && (
                        <motion.form
                          key="nurse-form"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.25 }}
                          onSubmit={nurseForm.handleSubmit(onNurseRegister)}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <Label htmlFor="nurse-name">الاسم الكامل</Label>
                            <div className="relative">
                              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input id="nurse-name" placeholder="الاسم الكامل" className="pr-10 text-right h-11 rounded-xl" {...nurseForm.register('name')} />
                            </div>
                            {nurseForm.formState.errors.name && <p className="text-xs text-destructive">{nurseForm.formState.errors.name.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="nurse-phone">رقم الهاتف</Label>
                            <div className="relative">
                              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input id="nurse-phone" type="tel" placeholder="7XXXXXXXX" className="pr-10 text-right h-11 rounded-xl" dir="ltr" {...nurseForm.register('phone')} />
                            </div>
                            {nurseForm.formState.errors.phone && <p className="text-xs text-destructive">{nurseForm.formState.errors.phone.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>التخصص</Label>
                            <Select onValueChange={(v) => nurseForm.setValue('specialization', v)}>
                              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="اختر التخصص" /></SelectTrigger>
                              <SelectContent>{specializations.map((spec) => (<SelectItem key={spec.value} value={spec.value}>{spec.label}</SelectItem>))}</SelectContent>
                            </Select>
                            {nurseForm.formState.errors.specialization && <p className="text-xs text-destructive">{nurseForm.formState.errors.specialization.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="nurse-license">رقم الترخيص</Label>
                            <Input id="nurse-license" placeholder="رقم ترخيص المهنة" className="text-right h-11 rounded-xl" {...nurseForm.register('licenseNumber')} />
                            {nurseForm.formState.errors.licenseNumber && <p className="text-xs text-destructive">{nurseForm.formState.errors.licenseNumber.message}</p>}
                          </div>
                          {/* GPS Location Detection */}
                          <GpsLocationButton
                            onLocationDetected={(loc) => {
                              if (loc.governorate && loc.governorateValue) {
                                nurseForm.setValue('governorate', loc.governorateValue);
                              }
                            }}
                            size="sm"
                            className="w-full"
                          />
                          <div className="space-y-2">
                            <Label>المحافظة</Label>
                            <Select onValueChange={(v) => nurseForm.setValue('governorate', v)}>
                              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                              <SelectContent>{YEMEN_GOVERNORATES.map((gov) => (<SelectItem key={gov.value} value={gov.value}>{gov.label}</SelectItem>))}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="nurse-password">كلمة المرور</Label>
                            <div className="relative">
                              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input id="nurse-password" type={showPassword ? 'text' : 'password'} placeholder="••••••" className="pr-10 pl-10 text-right h-11 rounded-xl" dir="ltr" {...nurseForm.register('password')} />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {nurseForm.formState.errors.password && <p className="text-xs text-destructive">{nurseForm.formState.errors.password.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="nurse-confirm-password">تأكيد كلمة المرور</Label>
                            <div className="relative">
                              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input id="nurse-confirm-password" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••" className="pr-10 pl-10 text-right h-11 rounded-xl" dir="ltr" {...nurseForm.register('confirmPassword')} />
                              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {nurseForm.formState.errors.confirmPassword && <p className="text-xs text-destructive">{nurseForm.formState.errors.confirmPassword.message}</p>}
                          </div>
                          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                            <Button type="submit" className="w-full h-12 text-base font-bold rounded-xl bg-gradient-to-l from-sky-500 to-sky-700 hover:opacity-90 text-white shadow-lg" disabled={isLoading}>
                              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />إنشاء حساب ممرض/ـة</span>}
                            </Button>
                          </motion.div>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </TabsContent>
                </Tabs>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* ---- Mobile & Tablet: Single column layout ---- */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <MobileHeroHeader />

        <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 bg-background relative">
          {/* Dot grid background */}
          <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]" style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }} />

          <div className="w-full max-w-md relative z-10">
            {/* Main form card with gradient border */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative rounded-3xl overflow-hidden"
            >
              <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-purple-500 via-sky-500 to-emerald-500 opacity-15 blur-[1px]" />
              <div className="relative glass-strong rounded-3xl shadow-2xl border border-white/30 dark:border-white/10">
                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); clearError(); }}>
                  <TabsList className="w-full rounded-none border-b border-border/50 bg-transparent h-12 p-0">
                    <TabsTrigger
                      value="login"
                      className="flex-1 h-full rounded-none text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400"
                    >
                      تسجيل دخول
                    </TabsTrigger>
                    <TabsTrigger
                      value="register"
                      className="flex-1 h-full rounded-none text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400"
                    >
                      إنشاء حساب
                    </TabsTrigger>
                  </TabsList>

                  {/* Error Display */}
                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mx-5 mt-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm rounded-xl p-3 flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ====== Mobile Login Tab ====== */}
                  <TabsContent value="login" className="p-5 pt-4 mt-0">
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      {/* Smart login notice */}
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-l from-purple-500/5 via-sky-500/5 to-emerald-500/5 rounded-xl p-3 border border-purple-500/10"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-sky-500/20 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">تسجيل دخول ذكي</p>
                            <p className="text-[10px] text-muted-foreground">النظام يتعرف على نوع حسابك تلقائياً</p>
                          </div>
                        </div>
                      </motion.div>

                      {/* Phone */}
                      <div className="space-y-1.5">
                        <Label htmlFor="m-login-phone" className="text-xs font-medium">رقم الهاتف</Label>
                        <div className="relative">
                          <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="m-login-phone" type="tel" placeholder="7XXXXXXXX" className="pr-10 text-right h-11 rounded-xl border-border/50 bg-muted/20" dir="ltr" {...loginForm.register('phone')} />
                        </div>
                        {loginForm.formState.errors.phone && <p className="text-xs text-destructive">{loginForm.formState.errors.phone.message}</p>}
                      </div>

                      {/* Password */}
                      <div className="space-y-1.5">
                        <Label htmlFor="m-login-password" className="text-xs font-medium">كلمة المرور</Label>
                        <div className="relative">
                          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="m-login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••" className="pr-10 pl-10 text-right h-11 rounded-xl border-border/50 bg-muted/20" dir="ltr" {...loginForm.register('password')} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {loginForm.formState.errors.password && <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>}
                      </div>

                      {/* Remember + Forgot */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="m-remember" className="h-3.5 w-3.5 rounded border-border/50 text-purple-600 focus:ring-purple-500" />
                          <Label htmlFor="m-remember" className="text-xs font-normal cursor-pointer">تذكرني</Label>
                        </div>
                        <button type="button" className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline">نسيت كلمة المرور؟</button>
                      </div>

                      {/* Submit */}
                      <motion.div whileTap={{ scale: 0.98 }}>
                        <Button type="submit" className="w-full h-11 text-sm font-bold rounded-xl shadow-lg bg-gradient-to-l from-purple-600 via-purple-700 to-sky-700 hover:opacity-90 text-white" disabled={isLoading}>
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2">تسجيل الدخول <ArrowLeft className="w-4 h-4" /></span>}
                        </Button>
                      </motion.div>
                    </form>
                  </TabsContent>

                  {/* ====== Mobile Register Tab ====== */}
                  <TabsContent value="register" className="p-5 pt-4 mt-0">
                    <div className="space-y-3 mb-4">
                      <Label className="text-xs font-medium">نوع الحساب</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={() => { setRegisterRole('beneficiary'); clearError(); }}
                          className={cn(
                            'rounded-xl p-3 text-center transition-all duration-300 border-2',
                            registerRole === 'beneficiary'
                              ? 'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400 shadow-md'
                              : 'border-border/50 bg-muted/30 text-muted-foreground'
                          )}
                        >
                          <User className="w-5 h-5 mx-auto mb-1" />
                          <span className="text-xs font-bold">مستفيد</span>
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={() => { setRegisterRole('nurse'); clearError(); }}
                          className={cn(
                            'rounded-xl p-3 text-center transition-all duration-300 border-2',
                            registerRole === 'nurse'
                              ? 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-400 shadow-md'
                              : 'border-border/50 bg-muted/30 text-muted-foreground'
                          )}
                        >
                          <Stethoscope className="w-5 h-5 mx-auto mb-1" />
                          <span className="text-xs font-bold">ممرض/ـة</span>
                        </motion.button>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {registerRole === 'beneficiary' && (
                        <motion.form key="m-beneficiary-form" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }} transition={{ duration: 0.2 }} onSubmit={beneficiaryForm.handleSubmit(onBeneficiaryRegister)} className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="m-ben-name" className="text-xs">الاسم الكامل</Label>
                            <div className="relative"><User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="m-ben-name" placeholder="الاسم الكامل" className="pr-10 text-right h-10 rounded-xl" {...beneficiaryForm.register('name')} /></div>
                            {beneficiaryForm.formState.errors.name && <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.name.message}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="m-ben-phone" className="text-xs">رقم الهاتف</Label>
                            <div className="relative"><Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="m-ben-phone" type="tel" placeholder="7XXXXXXXX" className="pr-10 text-right h-10 rounded-xl" dir="ltr" {...beneficiaryForm.register('phone')} /></div>
                            {beneficiaryForm.formState.errors.phone && <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.phone.message}</p>}
                          </div>
                          {/* GPS Location Detection */}
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
                          <div className="space-y-1.5">
                            <Label htmlFor="m-ben-address" className="text-xs">العنوان</Label>
                            <div className="relative"><MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="m-ben-address" placeholder="عنوانك التفصيلي" className="pr-10 text-right h-10 rounded-xl" {...beneficiaryForm.register('address')} /></div>
                            {beneficiaryForm.formState.errors.address && <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.address.message}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">المحافظة</Label>
                            <Select onValueChange={(v) => beneficiaryForm.setValue('governorate', v)}><SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="اختر المحافظة" /></SelectTrigger><SelectContent>{YEMEN_GOVERNORATES.map((gov) => (<SelectItem key={gov.value} value={gov.value}>{gov.label}</SelectItem>))}</SelectContent></Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="m-ben-referral" className="text-xs">كود الإحالة (اختياري)</Label>
                            <Input id="m-ben-referral" placeholder="AF-XXXXXX" className="text-right h-10 rounded-xl" dir="ltr" {...beneficiaryForm.register('referralCode')} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="m-ben-password" className="text-xs">كلمة المرور</Label>
                            <div className="relative"><Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="m-ben-password" type={showPassword ? 'text' : 'password'} placeholder="••••••" className="pr-10 pl-10 text-right h-10 rounded-xl" dir="ltr" {...beneficiaryForm.register('password')} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
                            {beneficiaryForm.formState.errors.password && <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.password.message}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="m-ben-confirm" className="text-xs">تأكيد كلمة المرور</Label>
                            <div className="relative"><Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="m-ben-confirm" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••" className="pr-10 pl-10 text-right h-10 rounded-xl" dir="ltr" {...beneficiaryForm.register('confirmPassword')} /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
                            {beneficiaryForm.formState.errors.confirmPassword && <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.confirmPassword.message}</p>}
                          </div>
                          <motion.div whileTap={{ scale: 0.98 }}>
                            <Button type="submit" className="w-full h-11 text-sm font-bold rounded-xl bg-gradient-to-l from-purple-500 to-purple-700 hover:opacity-90 text-white shadow-lg" disabled={isLoading}>
                              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />إنشاء حساب مستفيد</span>}
                            </Button>
                          </motion.div>
                        </motion.form>
                      )}

                      {registerRole === 'nurse' && (
                        <motion.form key="m-nurse-form" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }} onSubmit={nurseForm.handleSubmit(onNurseRegister)} className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="m-nurse-name" className="text-xs">الاسم الكامل</Label>
                            <div className="relative"><User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="m-nurse-name" placeholder="الاسم الكامل" className="pr-10 text-right h-10 rounded-xl" {...nurseForm.register('name')} /></div>
                            {nurseForm.formState.errors.name && <p className="text-xs text-destructive">{nurseForm.formState.errors.name.message}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="m-nurse-phone" className="text-xs">رقم الهاتف</Label>
                            <div className="relative"><Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="m-nurse-phone" type="tel" placeholder="7XXXXXXXX" className="pr-10 text-right h-10 rounded-xl" dir="ltr" {...nurseForm.register('phone')} /></div>
                            {nurseForm.formState.errors.phone && <p className="text-xs text-destructive">{nurseForm.formState.errors.phone.message}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">التخصص</Label>
                            <Select onValueChange={(v) => nurseForm.setValue('specialization', v)}><SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="اختر التخصص" /></SelectTrigger><SelectContent>{specializations.map((spec) => (<SelectItem key={spec.value} value={spec.value}>{spec.label}</SelectItem>))}</SelectContent></Select>
                            {nurseForm.formState.errors.specialization && <p className="text-xs text-destructive">{nurseForm.formState.errors.specialization.message}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="m-nurse-license" className="text-xs">رقم الترخيص</Label>
                            <Input id="m-nurse-license" placeholder="رقم ترخيص المهنة" className="text-right h-10 rounded-xl" {...nurseForm.register('licenseNumber')} />
                            {nurseForm.formState.errors.licenseNumber && <p className="text-xs text-destructive">{nurseForm.formState.errors.licenseNumber.message}</p>}
                          </div>
                          {/* GPS Location Detection */}
                          <GpsLocationButton
                            onLocationDetected={(loc) => {
                              if (loc.governorate && loc.governorateValue) {
                                nurseForm.setValue('governorate', loc.governorateValue);
                              }
                            }}
                            size="sm"
                            className="w-full"
                          />
                          <div className="space-y-1.5">
                            <Label className="text-xs">المحافظة</Label>
                            <Select onValueChange={(v) => nurseForm.setValue('governorate', v)}><SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="اختر المحافظة" /></SelectTrigger><SelectContent>{YEMEN_GOVERNORATES.map((gov) => (<SelectItem key={gov.value} value={gov.value}>{gov.label}</SelectItem>))}</SelectContent></Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="m-nurse-password" className="text-xs">كلمة المرور</Label>
                            <div className="relative"><Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="m-nurse-password" type={showPassword ? 'text' : 'password'} placeholder="••••••" className="pr-10 pl-10 text-right h-10 rounded-xl" dir="ltr" {...nurseForm.register('password')} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
                            {nurseForm.formState.errors.password && <p className="text-xs text-destructive">{nurseForm.formState.errors.password.message}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="m-nurse-confirm" className="text-xs">تأكيد كلمة المرور</Label>
                            <div className="relative"><Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="m-nurse-confirm" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••" className="pr-10 pl-10 text-right h-10 rounded-xl" dir="ltr" {...nurseForm.register('confirmPassword')} /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
                            {nurseForm.formState.errors.confirmPassword && <p className="text-xs text-destructive">{nurseForm.formState.errors.confirmPassword.message}</p>}
                          </div>
                          <motion.div whileTap={{ scale: 0.98 }}>
                            <Button type="submit" className="w-full h-11 text-sm font-bold rounded-xl bg-gradient-to-l from-sky-500 to-sky-700 hover:opacity-90 text-white shadow-lg" disabled={isLoading}>
                              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />إنشاء حساب ممرض/ـة</span>}
                            </Button>
                          </motion.div>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </TabsContent>
                </Tabs>
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-purple-700 to-sky-700" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-white/20 backdrop-blur-xl border border-white/30">
            <Heart className="w-8 h-8 text-white animate-pulse" fill="currentColor" />
          </div>
          <p className="text-white/70 text-sm">جارٍ تحميل صفحة تسجيل الدخول...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
