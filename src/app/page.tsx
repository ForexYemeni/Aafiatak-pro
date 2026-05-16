'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
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
  Sparkles,
  CheckCircle2,
  Loader2,
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
  confirmPassword: z.string().min(1, 'تأكيد كلمة المرور مطلوب'),
  specialization: z.string().min(1, 'التخصص مطلوب'),
  licenseNumber: z.string().min(1, 'رقم الترخيص مطلوب'),
  address: z.string().min(1, 'العنوان التفصيلي مطلوب'),
  governorate: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirmPassword'],
});

type NurseRegisterFormValues = z.infer<typeof nurseRegisterSchema>;

const beneficiaryRegisterSchema = z.object({
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
}).refine((data) => data.password === data.confirmPassword, {
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
// Post-Login Loading Screen (KEEP AS IS)
// ============================================================================

function PostLoginLoadingScreen({ user, onComplete }: { user: { name: string; role: string }; onComplete: () => void }) {
  const [countdown, setCountdown] = useState(2);
  const [progress, setProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const config = roleConfig[user.role] || roleConfig.beneficiary;
  const RoleIcon = config.icon;

  const confettiColors = useMemo(() => {
    if (user.role === 'nurse') return ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe'];
    if (user.role === 'beneficiary') return ['#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff', '#f3e8ff'];
    return ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7'];
  }, [user.role]);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 800;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressPercent = Math.min(100, (elapsed / duration) * 100);

      setCountdown(0);
      setProgress(progressPercent);

      if (progressPercent > 90 && !showConfetti) {
        setShowConfetti(true);
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        onComplete();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [onComplete, showConfetti]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      dir="rtl"
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br', config.bgGradient)} />

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

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {showConfetti && Array.from({ length: 30 }).map((_, i) => (
          <div
            key={`confetti-${i}`}
            className="confetti-piece"
            style={{
              left: `${seededRandom(i * 5 + 300) * 100}%`,
              top: '-5%',
              background: confettiColors[seededRandom(i * 7 + 400) * 5 | 0],
              animationDelay: `${seededRandom(i * 3 + 500) * 0.8}s`,
              animationDuration: `${seededRandom(i * 5 + 600) * 1.5 + 2}s`,
              width: seededRandom(i * 4 + 700) * 6 + 4,
              height: seededRandom(i * 4 + 701) * 6 + 4,
              borderRadius: seededRandom(i * 2 + 800) > 0.5 ? '50%' : '2px',
            }}
          />
        ))}
        {progress > 30 && ['✨', '💚', '🌟', '⭐', '💫'].map((emoji, i) => (
          <motion.div
            key={`emoji-${i}`}
            className="absolute text-lg"
            style={{
              left: `${seededRandom(i * 5 + 900) * 80 + 10}%`,
              top: `${seededRandom(i * 5 + 901) * 80 + 10}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.2, 0.6, 0.2],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.5,
            }}
          >
            {emoji}
          </motion.div>
        ))}
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

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="relative mb-8"
        >
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
            <motion.div
              animate={{ scale: [1, 1.15, 1, 1.15, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <RoleIcon className="w-14 h-14 text-white" />
            </motion.div>
          </motion.div>

          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/60 shadow-lg" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mb-2"
        >
          <h2 className="text-3xl font-bold text-white mb-2">مرحباً، {user.name}</h2>
        </motion.div>

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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-white/60 text-sm mb-8"
        >
          جارٍ التحويل إلى {config.dashboardLabel}...
        </motion.p>

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
// Password Strength Bar Component
// ============================================================================

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  const colors = ['bg-red-500', 'bg-amber-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600'];
  const textColors = ['text-red-400', 'text-amber-400', 'text-yellow-400', 'text-emerald-400', 'text-emerald-400'];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-1.5 mt-1"
    >
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-500',
              i < strength.score ? colors[strength.score - 1] : 'bg-white/10'
            )}
          />
        ))}
      </div>
      <p className={cn(
        'text-[11px] font-medium transition-colors duration-300',
        textColors[strength.score - 1] || 'text-white/30'
      )}>
        قوة كلمة المرور: {strength.label}
      </p>
    </motion.div>
  );
}

// ============================================================================
// Yemen Flag Component
// ============================================================================

function YemenFlag() {
  return (
    <span className="inline-flex flex-col w-5 h-[14px] rounded-[2px] overflow-hidden shrink-0">
      <span className="bg-[#CE1126] flex-1" />
      <span className="bg-white flex-1" />
      <span className="bg-black flex-1" />
    </span>
  );
}

// ============================================================================
// Main Login Page Component - Elegant Minimalism Redesign
// ============================================================================

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');

  const login = useAuthStore((s) => s.login);
  const registerNurse = useAuthStore((s) => s.registerNurse);
  const registerBeneficiary = useAuthStore((s) => s.registerBeneficiary);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const _hasHydrated = useAuthStore((s) => s._hasHydrated);

  const [activeTab, setActiveTab] = useState<string>('login');
  const [registerRole, setRegisterRole] = useState<string>('beneficiary');
  const [showPassword, setShowPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [nurseNameShake, setNurseNameShake] = useState(false);
  const [nurseNameWarning, setNurseNameWarning] = useState(false);

  const [isFreshLogin, setIsFreshLogin] = useState(false);
  const hasRedirectedRef = useRef(false);
  const logoutGuardConsumedRef = useRef(false);

  // ── Emergency Access State ──────────────────────────────────────────
  const [heartClickCount, setHeartClickCount] = useState(0);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyPassword, setEmergencyPassword] = useState('');
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyError, setEmergencyError] = useState('');
  const [emergencySuccess, setEmergencySuccess] = useState(false);
  const [showEmergencyPassword, setShowEmergencyPassword] = useState(false);
  const heartClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: detect if we arrived after a logout
  useEffect(() => {
    const isAfterLogout = searchParams.get('logout') === 'true';
    if (isAfterLogout) {
      logoutGuardConsumedRef.current = true;
      router.replace('/', { scroll: false });
    }
  }, []);

  // Handle post-login redirect with loading screen
  useEffect(() => {
    if (!_hasHydrated) return;
    if (hasRedirectedRef.current) return;

    if (logoutGuardConsumedRef.current) {
      logoutGuardConsumedRef.current = false;
      return;
    }

    if (isAuthenticated && user && !isFreshLogin) {
      const token = useAuthStore.getState().token;
      if (token) {
        hasRedirectedRef.current = true;
        fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        })
          .then(res => {
            if (res.ok) {
              const destination = redirectPath ?? getDashboardPath(user.role);
              // Use router.push for instant client-side navigation (no full page reload)
              router.push(destination);
            } else {
              useAuthStore.setState({
                user: null,
                token: null,
                refreshToken: null,
                isAuthenticated: false,
              });
              try { localStorage.removeItem('aafiatak-auth-storage'); } catch {}
              hasRedirectedRef.current = false;
            }
          })
          .catch(() => {
            const destination = redirectPath ?? getDashboardPath(user.role);
            // Use router.push for instant client-side navigation
            router.push(destination);
          });
      } else {
        useAuthStore.setState({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
        try { localStorage.removeItem('aafiatak-auth-storage'); } catch {}
      }
      return;
    }

    if (isAuthenticated && user && isFreshLogin && !showLoadingScreen) {
      setShowLoadingScreen(true);
    }
  }, [isAuthenticated, user, showLoadingScreen, isFreshLogin, redirectPath, router, _hasHydrated]);

  const handleLoadingComplete = useCallback(() => {
    if (user) {
      const destination = redirectPath ?? getDashboardPath(user.role);
      // Use router.push for instant client-side navigation (no full page reload)
      router.push(destination);
    }
  }, [user, redirectPath, router]);

  // ── Emergency Heart Click Handler ───────────────────────────────────
  const handleHeartClick = useCallback(() => {
    // Reset timer on each click
    if (heartClickTimerRef.current) {
      clearTimeout(heartClickTimerRef.current);
    }

    setHeartClickCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 10) {
        setShowEmergencyModal(true);
        return 0; // Reset after triggering
      }
      return newCount;
    });

    // Reset count after 3 seconds of no clicks
    heartClickTimerRef.current = setTimeout(() => {
      setHeartClickCount(0);
    }, 3000);
  }, []);

  // ── Emergency Password Submit ───────────────────────────────────────
  const handleEmergencySubmit = useCallback(async () => {
    if (!emergencyPassword) {
      setEmergencyError('يرجى إدخال كلمة المرور');
      return;
    }

    setEmergencyLoading(true);
    setEmergencyError('');

    try {
      const res = await fetch('/api/admin/emergency-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: emergencyPassword }),
      });

      const data = await res.json();

      if (data.success) {
        setEmergencySuccess(true);
        // Wait for animation then redirect
        setTimeout(() => {
          window.location.href = `/admin/emergency-backup?token=${encodeURIComponent(data.token)}`;
        }, 1200);
      } else {
        setEmergencyError(data.error?.message || 'كلمة المرور غير صحيحة');
        // Shake animation will be triggered by error state
      }
    } catch {
      setEmergencyError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setEmergencyLoading(false);
    }
  }, [emergencyPassword]);

  // ── Close Emergency Modal ───────────────────────────────────────────
  const handleCloseEmergencyModal = useCallback(() => {
    if (emergencyLoading) return;
    setShowEmergencyModal(false);
    setEmergencyPassword('');
    setEmergencyError('');
    setEmergencySuccess(false);
    setHeartClickCount(0);
  }, [emergencyLoading]);

  // ============================================================================
  // Login Form
  // ============================================================================

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  });

  const onLoginSubmit = async (data: LoginFormValues) => {
    clearError();
    setIsFreshLogin(true);
    try {
      await login(data.phone, data.password);
    } catch {
      setIsFreshLogin(false);
    }
  };

  // ============================================================================
  // Nurse Register Form
  // ============================================================================

  const nurseForm = useForm<NurseRegisterFormValues>({
    resolver: zodResolver(nurseRegisterSchema),
    defaultValues: {
      name: '', phone: '', password: '', confirmPassword: '',
      specialization: '', licenseNumber: '', address: '', governorate: '',
    },
  });

  const onNurseRegister = async (data: NurseRegisterFormValues) => {
    clearError();

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
      setIsFreshLogin(true);
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
      setIsFreshLogin(true);
    } catch {
      // Error handled in store
    }
  };

  // ============================================================================
  // Password watchers
  // ============================================================================
  const loginPasswordValue = loginForm.watch('password');
  const nursePasswordValue = nurseForm.watch('password');
  const beneficiaryPasswordValue = beneficiaryForm.watch('password');

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen flex items-start justify-center relative overflow-y-auto overflow-x-hidden py-6 sm:py-8" dir="rtl" lang="ar" style={{ maxHeight: '100vh' }}>
      {/* Post-login loading screen */}
      <AnimatePresence>
        {showLoadingScreen && user && (
          <PostLoginLoadingScreen
            user={{ name: user.name, role: user.role }}
            onComplete={handleLoadingComplete}
          />
        )}
      </AnimatePresence>

      {/* === PREMIUM DEEP BACKGROUND === */}
      <div className="fixed inset-0" style={{ background: 'linear-gradient(145deg, #020711 0%, #04091a 45%, #020610 100%)' }} />

      {/* Mesh gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Teal — top right */}
        <div className="absolute rounded-full login-mesh-orb-1" style={{ width: 740, height: 740, top: '-20%', right: '-14%', background: 'radial-gradient(circle, rgba(20,184,166,0.26) 0%, rgba(16,185,129,0.09) 36%, transparent 62%)', filter: 'blur(100px)' }} />
        {/* Violet — bottom left */}
        <div className="absolute rounded-full login-mesh-orb-2" style={{ width: 640, height: 640, bottom: '-16%', left: '-12%', background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, rgba(124,58,237,0.07) 36%, transparent 62%)', filter: 'blur(90px)' }} />
        {/* Cyan — center */}
        <div className="absolute rounded-full login-mesh-orb-3" style={{ width: 480, height: 480, top: '48%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 62%)', filter: 'blur(75px)' }} />
        {/* Emerald accent — bottom right */}
        <div className="absolute rounded-full" style={{ width: 400, height: 400, bottom: '6%', right: '3%', background: 'radial-gradient(circle, rgba(16,185,129,0.11) 0%, transparent 62%)', filter: 'blur(65px)' }} />
        {/* Dot grid overlay */}
        <div className="absolute inset-0 opacity-[0.024]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.85) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      </div>

      {/* Noise texture */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.012]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      {/* === MAIN CARD === */}
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[500px] mx-4 sm:mx-auto my-auto"
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,0.068) 0%, rgba(255,255,255,0.028) 100%)',
          backdropFilter: 'blur(36px) saturate(170%)',
          WebkitBackdropFilter: 'blur(36px) saturate(170%)',
          borderRadius: 28,
          border: '1px solid rgba(255,255,255,0.11)',
          boxShadow: '0 44px 130px -22px rgba(0,0,0,0.78), inset 0 1px 0 rgba(255,255,255,0.13), inset 0 -1px 0 rgba(0,0,0,0.15)',
          maxHeight: activeTab === 'register' ? 'calc(100vh - 48px)' : undefined,
          overflow: activeTab === 'register' ? 'hidden' : undefined,
          display: activeTab === 'register' ? 'flex' : undefined,
          flexDirection: activeTab === 'register' ? 'column' : undefined,
        }}
      >
        {/* Inner top highlight line */}
        <div className="absolute top-0 inset-x-10 h-px rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)' }} />

        <div className={cn('safe-bottom', activeTab === 'register' ? 'flex flex-col min-h-0 overflow-hidden p-5 sm:p-7' : 'p-7 sm:p-9')}>

          {/* === BRAND HEADER === */}
          <motion.div
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.12, duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
            className={cn('text-center shrink-0', activeTab === 'register' ? 'mb-4' : 'mb-9')}
          >
            {/* Icon with pulse ring */}
            <div className={cn('relative inline-block', activeTab === 'register' ? 'mb-3' : 'mb-5')}>
              <motion.div
                animate={{ scale: [1, 1.07, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className={cn('relative rounded-[22px] mx-auto flex items-center justify-center cursor-pointer select-none', activeTab === 'register' ? 'w-[52px] h-[52px]' : 'w-[76px] h-[76px]')}
                style={{
                  background: 'linear-gradient(135deg, #0d9488 0%, #10b981 55%, #06b6d4 100%)',
                  boxShadow: '0 20px 48px -10px rgba(20,184,166,0.45), 0 4px 16px -4px rgba(20,184,166,0.3)',
                }}
                onClick={handleHeartClick}
              >
                <Heart className={cn('text-white pointer-events-none', activeTab === 'register' ? 'w-[24px] h-[24px]' : 'w-[36px] h-[36px]')} fill="currentColor" />
                {/* Click progress dots */}
                {heartClickCount > 0 && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-[3px] pointer-events-none">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-[5px] h-[5px] rounded-full transition-all duration-200"
                        style={{
                          background: i < heartClickCount ? 'rgba(20,184,166,0.9)' : 'rgba(255,255,255,0.15)',
                          transform: i < heartClickCount ? 'scale(1.2)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
              <motion.div
                className="absolute inset-0 rounded-[22px] pointer-events-none"
                animate={{ boxShadow: ['0 0 0 0 rgba(20,184,166,0.35)', '0 0 0 16px rgba(20,184,166,0)', '0 0 0 0 rgba(20,184,166,0)'] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
              />
            </div>
            {/* Brand name */}
            <h1
              className={cn('font-black leading-none', activeTab === 'register' ? 'text-[26px] mb-1' : 'text-[34px] mb-2')}
              style={{ background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.78) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            >
              عافيتك
            </h1>
            {activeTab === 'login' && <p className="text-[13px] font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.32)' }}>رعاية صحية منزلية بلمسة زر</p>}
          </motion.div>

          {/* === TAB SWITCHER === */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className={cn('relative flex p-[5px] rounded-2xl shrink-0', activeTab === 'register' ? 'mb-4' : 'mb-7')}
            style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <motion.div
              className="absolute rounded-[13px]"
              style={{
                top: 5, bottom: 5,
                background: 'linear-gradient(135deg, rgba(13,148,136,0.92) 0%, rgba(16,185,129,0.92) 100%)',
                boxShadow: '0 4px 20px -4px rgba(20,184,166,0.5)',
              }}
              initial={false}
              animate={{ right: activeTab === 'login' ? '50%' : 5, left: activeTab === 'login' ? 5 : '50%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            />
            <button type="button" onClick={() => { setActiveTab('login'); clearError(); }} className={cn('relative z-10 flex-1 py-3 text-[13px] font-bold rounded-[13px] transition-colors duration-200 min-h-[46px]', activeTab === 'login' ? 'text-white' : 'text-white/32 hover:text-white/55')}>
              تسجيل دخول
            </button>
            <button type="button" onClick={() => { setActiveTab('register'); clearError(); }} className={cn('relative z-10 flex-1 py-3 text-[13px] font-bold rounded-[13px] transition-colors duration-200 min-h-[46px]', activeTab === 'register' ? 'text-white' : 'text-white/32 hover:text-white/55')}>
              إنشاء حساب
            </button>
          </motion.div>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-3 p-4 rounded-2xl text-[13px] text-red-300" style={{ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.22)' }}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span className="leading-relaxed">{typeof error === 'string' ? error : String(error)}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ====== LOGIN FORM ====== */}
          <AnimatePresence mode="wait">
            {activeTab === 'login' && (
              <motion.form
                key="login-form"
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                transition={{ duration: 0.28 }}
                onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                className="space-y-4"
              >
                {/* Phone */}
                <div className="space-y-2">
                  <label className="block text-[11.5px] font-bold tracking-wider uppercase mr-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>رقم الهاتف</label>
                  <div className="relative group">
                    <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] z-10 pointer-events-none transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.38)' }} />
                    <Input
                      id="login-phone"
                      type="tel"
                      placeholder="7XXXXXXXX"
                      dir="ltr"
                      className="h-[54px] pr-11 pl-[114px] text-right rounded-2xl text-[15px] text-white placeholder-white/22 border-0 transition-all duration-200 focus:outline-none focus:ring-0"
                      style={{
                        background: loginForm.formState.errors.phone ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.07)',
                        border: `1.5px solid ${loginForm.formState.errors.phone ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.12)'}`,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}
                      onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.border = '1.5px solid rgba(20,184,166,0.65)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(20,184,166,0.13), inset 0 1px 0 rgba(255,255,255,0.06)'; }}
                      onBlur={(e) => { e.currentTarget.style.background = loginForm.formState.errors.phone ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.07)'; e.currentTarget.style.border = `1.5px solid ${loginForm.formState.errors.phone ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.12)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.06)'; }}
                      {...loginForm.register('phone')}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl pointer-events-none" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <YemenFlag />
                      <span className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.48)' }}>+967</span>
                    </div>
                  </div>
                  {loginForm.formState.errors.phone && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[11px] text-red-400 mr-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" />{loginForm.formState.errors.phone.message}
                    </motion.p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="block text-[11.5px] font-bold tracking-wider uppercase mr-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>كلمة المرور</label>
                  <div className="relative">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.38)' }} />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      dir="ltr"
                      className="h-[54px] pr-11 pl-12 text-right rounded-2xl text-[15px] text-white placeholder-white/22 border-0 transition-all duration-200 focus:outline-none focus:ring-0"
                      style={{
                        background: loginForm.formState.errors.password ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.07)',
                        border: `1.5px solid ${loginForm.formState.errors.password ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.12)'}`,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}
                      onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.border = '1.5px solid rgba(20,184,166,0.65)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(20,184,166,0.13), inset 0 1px 0 rgba(255,255,255,0.06)'; }}
                      onBlur={(e) => { e.currentTarget.style.background = loginForm.formState.errors.password ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.07)'; e.currentTarget.style.border = `1.5px solid ${loginForm.formState.errors.password ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.12)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.06)'; }}
                      {...loginForm.register('password')}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors z-10 min-w-[40px] min-h-[40px] flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.35)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[11px] text-red-400 mr-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" />{loginForm.formState.errors.password.message}
                    </motion.p>
                  )}
                  <PasswordStrengthBar password={loginPasswordValue} />
                </div>

                {/* Remember & Forgot */}
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="remember" className="w-4 h-4 rounded border-white/20 bg-white/[0.06] text-teal-500 focus:ring-teal-400/30 focus:ring-offset-0 cursor-pointer" />
                    <Label htmlFor="remember" className="text-[12px] font-normal cursor-pointer" style={{ color: 'rgba(255,255,255,0.38)' }}>تذكرني</Label>
                  </div>
                  <button type="button" className="text-[12px] font-semibold transition-colors duration-200" style={{ color: 'rgba(20,184,166,0.6)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(20,184,166,1)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(20,184,166,0.6)'}
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>

                {/* Submit */}
                <motion.div whileHover={{ scale: 1.016 }} whileTap={{ scale: 0.984 }} className="pt-1">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="login-shimmer-btn relative w-full h-[54px] rounded-2xl font-bold text-[15px] text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, #0d9488 0%, #0ea57a 40%, #06b6d4 100%)',
                      boxShadow: '0 10px 36px -8px rgba(20,184,166,0.55), 0 2px 10px -2px rgba(20,184,166,0.3)',
                    }}
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                      <span className="flex items-center gap-2.5 justify-center">
                        تسجيل الدخول
                        <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                      </span>
                    )}
                  </button>
                </motion.div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* ====== REGISTER FORMS ====== */}
          <AnimatePresence mode="wait">
            {activeTab === 'register' && (
              <motion.div
                key="register-container"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.28 }}
                className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 -mx-1 px-1 pb-2"
              >
                {/* === ROLE SELECTOR === */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Beneficiary card */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setRegisterRole('beneficiary'); clearError(); }}
                    className="relative rounded-[22px] p-5 text-center transition-all duration-300 overflow-hidden min-h-[122px]"
                    style={{
                      background: registerRole === 'beneficiary' ? 'rgba(20,184,166,0.11)' : 'rgba(255,255,255,0.035)',
                      border: `1.5px solid ${registerRole === 'beneficiary' ? 'rgba(20,184,166,0.48)' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: registerRole === 'beneficiary' ? '0 10px 36px -10px rgba(20,184,166,0.28), inset 0 1px 0 rgba(20,184,166,0.22)' : 'none',
                    }}
                  >
                    {registerRole === 'beneficiary' && (
                      <div className="absolute inset-0 rounded-[22px]" style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.13) 0%, rgba(16,185,129,0.05) 100%)' }} />
                    )}
                    <div className="relative z-10">
                      <div className="w-[52px] h-[52px] rounded-2xl mx-auto mb-3 flex items-center justify-center transition-all duration-300"
                        style={{
                          background: registerRole === 'beneficiary' ? 'linear-gradient(135deg, #14b8a6, #10b981)' : 'rgba(255,255,255,0.08)',
                          boxShadow: registerRole === 'beneficiary' ? '0 10px 28px -6px rgba(20,184,166,0.55)' : 'none',
                        }}
                      >
                        <User className={cn('w-[22px] h-[22px] transition-colors', registerRole === 'beneficiary' ? 'text-white' : 'text-white/25')} />
                      </div>
                      <span className={cn('block text-[13px] font-bold mb-0.5 transition-colors', registerRole === 'beneficiary' ? 'text-white' : 'text-white/35')}>مستفيد/ـة</span>
                      <p className={cn('text-[11px] transition-colors', registerRole === 'beneficiary' ? 'text-teal-300/55' : 'text-white/20')}>رعاية منزلية</p>
                    </div>
                  </motion.button>

                  {/* Nurse card */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setRegisterRole('nurse'); clearError(); }}
                    className="relative rounded-[22px] p-5 text-center transition-all duration-300 overflow-hidden min-h-[122px]"
                    style={{
                      background: registerRole === 'nurse' ? 'rgba(14,165,233,0.10)' : 'rgba(255,255,255,0.035)',
                      border: `1.5px solid ${registerRole === 'nurse' ? 'rgba(14,165,233,0.46)' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: registerRole === 'nurse' ? '0 10px 36px -10px rgba(14,165,233,0.26), inset 0 1px 0 rgba(14,165,233,0.2)' : 'none',
                    }}
                  >
                    {registerRole === 'nurse' && (
                      <div className="absolute inset-0 rounded-[22px]" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.13) 0%, rgba(6,182,212,0.05) 100%)' }} />
                    )}
                    <div className="relative z-10">
                      <div className="w-[52px] h-[52px] rounded-2xl mx-auto mb-3 flex items-center justify-center transition-all duration-300"
                        style={{
                          background: registerRole === 'nurse' ? 'linear-gradient(135deg, #0ea5e9, #06b6d4)' : 'rgba(255,255,255,0.08)',
                          boxShadow: registerRole === 'nurse' ? '0 10px 28px -6px rgba(14,165,233,0.5)' : 'none',
                        }}
                      >
                        <Stethoscope className={cn('w-[22px] h-[22px] transition-colors', registerRole === 'nurse' ? 'text-white' : 'text-white/25')} />
                      </div>
                      <span className={cn('block text-[13px] font-bold mb-0.5 transition-colors', registerRole === 'nurse' ? 'text-white' : 'text-white/35')}>ممرض/ـة</span>
                      <p className={cn('text-[11px] transition-colors', registerRole === 'nurse' ? 'text-sky-300/55' : 'text-white/20')}>ممرض معتمد</p>
                    </div>
                  </motion.button>
                </div>

                {/* ===== BENEFICIARY FORM ===== */}
                <AnimatePresence mode="wait">
                  {registerRole === 'beneficiary' && (
                    <motion.form
                      key="beneficiary-form"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.22 }}
                      onSubmit={beneficiaryForm.handleSubmit(onBeneficiaryRegister)}
                      className="space-y-3"
                    >
                      {/* Personal Info */}
                      <div className="rounded-[20px] p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'rgba(20,184,166,0.16)', border: '1px solid rgba(20,184,166,0.28)' }}>
                            <User className="w-3.5 h-3.5 text-teal-400" />
                          </div>
                          <span className="text-[10.5px] font-bold tracking-wider uppercase" style={{ color: 'rgba(20,184,166,0.75)' }}>المعلومات الشخصية</span>
                        </div>
                        {/* Name */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                            <Input id="ben-name" placeholder="الاسم الكامل" className="h-[46px] pr-10 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${beneficiaryForm.formState.errors.name ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                              onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = `1px solid ${beneficiaryForm.formState.errors.name ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              {...beneficiaryForm.register('name')} />
                          </div>
                          {beneficiaryForm.formState.errors.name && <p className="text-[11px] text-red-400 mr-1">{beneficiaryForm.formState.errors.name.message}</p>}
                        </div>
                        {/* Phone */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                            <Input id="ben-phone" type="tel" placeholder="رقم الهاتف" dir="ltr" className="h-[46px] pr-10 pl-[108px] text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${beneficiaryForm.formState.errors.phone ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                              onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = `1px solid ${beneficiaryForm.formState.errors.phone ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              {...beneficiaryForm.register('phone')} />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded-[8px] pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
                              <YemenFlag /><span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>+967</span>
                            </div>
                          </div>
                          {beneficiaryForm.formState.errors.phone && <p className="text-[11px] text-red-400 mr-1">{beneficiaryForm.formState.errors.phone.message}</p>}
                        </div>
                      </div>

                      {/* Location */}
                      <div className="rounded-[20px] p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'rgba(20,184,166,0.16)', border: '1px solid rgba(20,184,166,0.28)' }}>
                            <MapPin className="w-3.5 h-3.5 text-teal-400" />
                          </div>
                          <span className="text-[10.5px] font-bold tracking-wider uppercase" style={{ color: 'rgba(20,184,166,0.75)' }}>معلومات الموقع</span>
                        </div>
                        <GpsLocationButton onLocationDetected={(loc) => {
                          if (loc.governorate && loc.governorateValue) beneficiaryForm.setValue('governorate', loc.governorateValue);
                          if (loc.address || loc.district) beneficiaryForm.setValue('address', loc.district || loc.address);
                        }} />
                        {/* Address */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                            <Input id="ben-address" placeholder="العنوان التفصيلي" className="h-[46px] pr-10 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${beneficiaryForm.formState.errors.address ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                              onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = `1px solid ${beneficiaryForm.formState.errors.address ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              {...beneficiaryForm.register('address')} />
                          </div>
                          {beneficiaryForm.formState.errors.address && <p className="text-[11px] text-red-400 mr-1">{beneficiaryForm.formState.errors.address.message}</p>}
                        </div>
                        {/* Referral */}
                        <div className="relative">
                          <Sparkles className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                          <Input id="ben-referral" placeholder="كود الإحالة (اختياري)" dir="ltr" className="h-[46px] pr-10 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                            onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                            onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                            {...beneficiaryForm.register('referralCode')} />
                        </div>
                      </div>

                      {/* Security */}
                      <div className="rounded-[20px] p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.13)', border: '1px solid rgba(251,191,36,0.24)' }}>
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <span className="text-[10.5px] font-bold tracking-wider uppercase" style={{ color: 'rgba(251,191,36,0.75)' }}>الأمان</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                            <Input id="ben-password" type={showPassword ? 'text' : 'password'} placeholder="كلمة المرور (٦ أحرف على الأقل)" dir="ltr" className="h-[46px] pr-10 pl-10 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${beneficiaryForm.formState.errors.password ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                              onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = `1px solid ${beneficiaryForm.formState.errors.password ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              {...beneficiaryForm.register('password')} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors z-10 min-w-[40px] min-h-[40px] flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {beneficiaryForm.formState.errors.password && <p className="text-[11px] text-red-400 mr-1">{beneficiaryForm.formState.errors.password.message}</p>}
                          <PasswordStrengthBar password={beneficiaryPasswordValue} />
                        </div>
                        {/* Confirm Password */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                            <Input id="ben-confirm-password" type={showPassword ? 'text' : 'password'} placeholder="تأكيد كلمة المرور" dir="ltr" className="h-[46px] pr-10 pl-10 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${beneficiaryForm.formState.errors.confirmPassword ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                              onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = `1px solid ${beneficiaryForm.formState.errors.confirmPassword ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              {...beneficiaryForm.register('confirmPassword')} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors z-10 min-w-[40px] min-h-[40px] flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {beneficiaryForm.formState.errors.confirmPassword && <p className="text-[11px] text-red-400 mr-1">{beneficiaryForm.formState.errors.confirmPassword.message}</p>}
                        </div>
                      </div>

                      {/* Submit */}
                      <motion.div whileHover={{ scale: 1.016 }} whileTap={{ scale: 0.984 }} className="pt-1">
                        <button type="submit" disabled={isLoading} className="login-shimmer-btn relative w-full h-[54px] rounded-2xl font-bold text-[15px] text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0ea57a 40%, #06b6d4 100%)', boxShadow: '0 10px 36px -8px rgba(20,184,166,0.55), 0 2px 10px -2px rgba(20,184,166,0.3)' }}>
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                            <span className="flex items-center gap-2 justify-center"><CheckCircle2 className="w-4 h-4" />إنشاء حساب مستفيد</span>
                          )}
                        </button>
                      </motion.div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* ===== NURSE FORM ===== */}
                <AnimatePresence mode="wait">
                  {registerRole === 'nurse' && (
                    <motion.form
                      key="nurse-form"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.22 }}
                      onSubmit={nurseForm.handleSubmit(onNurseRegister)}
                      className="space-y-3"
                    >
                      {/* Professional Info */}
                      <div className="rounded-[20px] p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.16)', border: '1px solid rgba(14,165,233,0.28)' }}>
                            <Stethoscope className="w-3.5 h-3.5 text-sky-400" />
                          </div>
                          <span className="text-[10.5px] font-bold tracking-wider uppercase" style={{ color: 'rgba(14,165,233,0.75)' }}>المعلومات المهنية</span>
                        </div>

                        {/* Name */}
                        <div className="space-y-1.5">
                          <div className={cn('relative', nurseNameShake && 'animate-shake')}>
                            <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                            <Input id="nurse-name" placeholder="الاسم الرباعي (أربع كلمات)" className="h-[46px] pr-10 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${(nurseForm.formState.errors.name || nurseNameWarning) ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                              onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(14,165,233,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = `1px solid ${(nurseForm.formState.errors.name || nurseNameWarning) ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.1)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              {...nurseForm.register('name')} />
                          </div>
                          {nurseNameWarning && <motion.p initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} className="text-[11px] text-amber-400 mr-1">يجب إدخال الاسم الرباعي (٤ كلمات على الأقل)</motion.p>}
                          {nurseForm.formState.errors.name && !nurseNameWarning && <p className="text-[11px] text-red-400 mr-1">{nurseForm.formState.errors.name.message}</p>}
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                            <Input id="nurse-phone" type="tel" placeholder="رقم الهاتف" dir="ltr" className="h-[46px] pr-10 pl-[108px] text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${nurseForm.formState.errors.phone ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                              onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(14,165,233,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = `1px solid ${nurseForm.formState.errors.phone ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              {...nurseForm.register('phone')} />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded-[8px] pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
                              <YemenFlag /><span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>+967</span>
                            </div>
                          </div>
                          {nurseForm.formState.errors.phone && <p className="text-[11px] text-red-400 mr-1">{nurseForm.formState.errors.phone.message}</p>}
                        </div>

                        {/* Specialization select */}
                        <div className="space-y-1.5">
                          <Select onValueChange={(value) => nurseForm.setValue('specialization', value)} defaultValue={nurseForm.getValues('specialization')}>
                            <SelectTrigger className="h-[46px] rounded-[12px] text-sm text-white border-0 focus:ring-0 focus:outline-none transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${nurseForm.formState.errors.specialization ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                              <SelectValue placeholder="اختر التخصص" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a2235] border-white/[0.1] max-h-60">
                              {specializations.map((spec) => (
                                <SelectItem
                                  key={spec.value}
                                  value={spec.value}
                                  className="text-white/80 focus:bg-white/[0.08] focus:text-white"
                                >
                                  {spec.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {nurseForm.formState.errors.specialization && (
                            <p className="text-xs text-red-400 mr-1">{nurseForm.formState.errors.specialization.message}</p>
                          )}
                        </div>

                        {/* License number */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Shield className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                            <Input id="nurse-license" placeholder="رقم الترخيص المهني" className="h-[46px] pr-10 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${nurseForm.formState.errors.licenseNumber ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                              onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(14,165,233,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = `1px solid ${nurseForm.formState.errors.licenseNumber ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              {...nurseForm.register('licenseNumber')} />
                          </div>
                          {nurseForm.formState.errors.licenseNumber && <p className="text-[11px] text-red-400 mr-1">{nurseForm.formState.errors.licenseNumber.message}</p>}
                        </div>
                      </div>

                      {/* Location */}
                      <div className="rounded-[20px] p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'rgba(20,184,166,0.16)', border: '1px solid rgba(20,184,166,0.28)' }}>
                            <MapPin className="w-3.5 h-3.5 text-teal-400" />
                          </div>
                          <span className="text-[10.5px] font-bold tracking-wider uppercase" style={{ color: 'rgba(20,184,166,0.75)' }}>الموقع</span>
                        </div>
                        <GpsLocationButton onLocationDetected={(loc) => {
                          if (loc.governorate && loc.governorateValue) nurseForm.setValue('governorate', loc.governorateValue);
                          if (loc.address || loc.district) nurseForm.setValue('address', loc.district || loc.address);
                        }} />
                        <div className="space-y-1.5">
                          <div className="relative">
                            <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                            <Input id="nurse-address" placeholder="العنوان التفصيلي" className="h-[46px] pr-10 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${nurseForm.formState.errors.address ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                              onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = `1px solid ${nurseForm.formState.errors.address ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              {...nurseForm.register('address')} />
                          </div>
                          {nurseForm.formState.errors.address && <p className="text-[11px] text-red-400 mr-1">{nurseForm.formState.errors.address.message}</p>}
                        </div>
                      </div>

                      {/* Security */}
                      <div className="rounded-[20px] p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.13)', border: '1px solid rgba(251,191,36,0.24)' }}>
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <span className="text-[10.5px] font-bold tracking-wider uppercase" style={{ color: 'rgba(251,191,36,0.75)' }}>الأمان</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                            <Input id="nurse-password" type={showPassword ? 'text' : 'password'} placeholder="كلمة المرور (٦ أحرف على الأقل)" dir="ltr" className="h-[46px] pr-10 pl-10 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${nurseForm.formState.errors.password ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                              onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = `1px solid ${nurseForm.formState.errors.password ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              {...nurseForm.register('password')} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors z-10 min-w-[40px] min-h-[40px] flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {nurseForm.formState.errors.password && <p className="text-[11px] text-red-400 mr-1">{nurseForm.formState.errors.password.message}</p>}
                          <PasswordStrengthBar password={nursePasswordValue} />
                        </div>
                        {/* Confirm Password */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                            <Input id="nurse-confirm-password" type={showPassword ? 'text' : 'password'} placeholder="تأكيد كلمة المرور" dir="ltr" className="h-[46px] pr-10 pl-10 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${nurseForm.formState.errors.confirmPassword ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                              onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(14,165,233,0.58)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = `1px solid ${nurseForm.formState.errors.confirmPassword ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)'; }}
                              {...nurseForm.register('confirmPassword')} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors z-10 min-w-[40px] min-h-[40px] flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {nurseForm.formState.errors.confirmPassword && <p className="text-[11px] text-red-400 mr-1">{nurseForm.formState.errors.confirmPassword.message}</p>}
                        </div>
                      </div>

                      {/* Submit */}
                      <motion.div whileHover={{ scale: 1.016 }} whileTap={{ scale: 0.984 }} className="pt-1">
                        <button type="submit" disabled={isLoading} className="login-shimmer-btn relative w-full h-[54px] rounded-2xl font-bold text-[15px] text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                          style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 45%, #06b6d4 100%)', boxShadow: '0 10px 36px -8px rgba(14,165,233,0.55), 0 2px 10px -2px rgba(14,165,233,0.3)' }}>
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                            <span className="flex items-center gap-2 justify-center"><CheckCircle2 className="w-4 h-4" />إنشاء حساب ممرض/ـة</span>
                          )}
                        </button>
                      </motion.div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trust badge */}
          {activeTab === 'login' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65 }}
            className="mt-7 flex items-center justify-center gap-2 shrink-0"
            style={{ color: 'rgba(255,255,255,0.18)' }}
          >
            <Shield className="w-3 h-3" />
            <span className="text-[11px]">بياناتك مشفرة ومحمية بالكامل</span>
          </motion.div>
          )}

        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          Emergency Access Modal
          ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showEmergencyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
            onClick={handleCloseEmergencyModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-full max-w-sm rounded-3xl p-7 relative overflow-hidden"
              style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* ECG Line Animation */}
              <div className="absolute bottom-0 left-0 right-0 h-8 opacity-10 overflow-hidden">
                <svg width="100%" height="32" viewBox="0 0 400 32" preserveAspectRatio="none" fill="none">
                  <path d="M0 16 L50 16 L70 4 L80 28 L90 6 L100 26 L110 16 L200 16 L220 4 L230 28 L240 6 L250 26 L260 16 L400 16" stroke="#14b8a6" strokeWidth="2" fill="none">
                    <animate attributeName="stroke-dashoffset" from="800" to="0" dur="3s" repeatCount="indefinite" />
                  </path>
                </svg>
              </div>

              {/* Lock Icon */}
              <div className="text-center mb-5">
                <motion.div
                  animate={emergencySuccess ? { scale: [1, 1.2, 1] } : { scale: [1, 1.05, 1] }}
                  transition={emergencySuccess ? { duration: 0.5 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
                  style={{
                    background: emergencySuccess
                      ? 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.3))'
                      : 'linear-gradient(135deg, rgba(20,184,166,0.2), rgba(16,185,129,0.2))',
                    boxShadow: emergencySuccess
                      ? '0 0 30px rgba(16,185,129,0.3)'
                      : '0 0 20px rgba(20,184,166,0.15)',
                  }}
                >
                  {emergencySuccess ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    </motion.div>
                  ) : (
                    <Lock className="w-8 h-8 text-teal-400" />
                  )}
                </motion.div>
                <h3 className="text-lg font-black text-white mb-1">الوصول الطارئ للنسخ الاحتياطي</h3>
                <p className="text-white/35 text-xs">هذه الميزة مخصصة للإدارة فقط</p>
              </div>

              {/* Success State */}
              {emergencySuccess ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-4"
                >
                  <p className="text-emerald-300 text-sm font-bold mb-2">تم التحقق بنجاح!</p>
                  <p className="text-white/40 text-xs">جاري التحويل إلى صفحة النسخ الاحتياطي...</p>
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400 mx-auto mt-3" />
                </motion.div>
              ) : (
                <>
                  {/* Error Display */}
                  <AnimatePresence>
                    {emergencyError && (
                      <motion.div
                        initial={{ opacity: 0, x: 0 }}
                        animate={{ opacity: 1, x: [0, -8, 8, -4, 4, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ x: { duration: 0.4 }, opacity: { duration: 0.2 } }}
                        className="mb-4 p-3 rounded-xl text-[12px] text-red-300 flex items-center gap-2"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                        <span>{emergencyError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Password Input */}
                  <div className="mb-5">
                    <label className="block text-white/50 text-xs font-bold mb-2">أدخل كلمة مرور الإدارة</label>
                    <div className="relative">
                      <input
                        type={showEmergencyPassword ? 'text' : 'password'}
                        value={emergencyPassword}
                        onChange={e => { setEmergencyPassword(e.target.value); setEmergencyError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') handleEmergencySubmit(); }}
                        placeholder="كلمة المرور"
                        autoFocus
                        className="w-full h-12 px-4 pl-12 rounded-2xl text-white text-sm placeholder:text-white/20 outline-none transition-all focus:ring-1 focus:ring-teal-400/30"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmergencyPassword(!showEmergencyPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showEmergencyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <motion.div whileHover={{ scale: 1.016 }} whileTap={{ scale: 0.984 }}>
                    <button
                      type="button"
                      onClick={handleEmergencySubmit}
                      disabled={emergencyLoading}
                      className="w-full h-[50px] rounded-2xl font-bold text-[14px] text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #0d9488 0%, #10b981 55%, #06b6d4 100%)', boxShadow: '0 8px 30px -6px rgba(20,184,166,0.5)' }}
                    >
                      {emergencyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                          <Lock className="w-4 h-4" />
                          دخول الطوارئ
                        </>
                      )}
                    </button>
                  </motion.div>

                  {/* Cancel Button */}
                  <button
                    type="button"
                    onClick={handleCloseEmergencyModal}
                    disabled={emergencyLoading}
                    className="w-full mt-3 h-10 rounded-2xl text-white/30 hover:text-white/50 text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    إلغاء
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Page wrapper with Suspense for useSearchParams
// ============================================================================

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1e] via-[#0d1525] to-[#0a1628]" dir="rtl">
          <Loader2 className="w-8 h-8 animate-spin text-teal-400/50" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
