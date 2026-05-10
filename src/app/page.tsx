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
              window.location.href = destination;
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
            window.location.href = destination;
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
      name: '', phone: '', password: '',
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" dir="rtl" lang="ar">
      {/* Post-login loading screen */}
      <AnimatePresence>
        {showLoadingScreen && user && (
          <PostLoginLoadingScreen
            user={{ name: user.name, role: user.role }}
            onComplete={handleLoadingComplete}
          />
        )}
      </AnimatePresence>

      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0f1e] via-[#0d1525] to-[#0a1628]" />

      {/* Animated mesh gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-[600px] h-[600px] rounded-full login-mesh-orb-1"
          style={{
            top: '-15%',
            right: '-10%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, rgba(20,184,166,0.03) 40%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full login-mesh-orb-2"
          style={{
            bottom: '-10%',
            left: '-8%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.02) 40%, transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full login-mesh-orb-3"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Subtle noise overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[480px] mx-4 sm:mx-auto login-glass-card rounded-3xl"
      >
        <div className="p-6 sm:p-8 lg:p-10 safe-bottom">
          {/* Logo Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-center mb-8"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/25"
            >
              <Heart className="w-8 h-8 text-white" fill="currentColor" />
            </motion.div>
            <h1 className="text-3xl font-black text-white mb-1">عافيتك</h1>
            <p className="text-sm text-white/40">رعاية صحية منزلية بلمسة زر</p>
          </motion.div>

          {/* Tab Switcher */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative flex bg-white/[0.04] rounded-xl p-1 mb-6 border border-white/[0.06]"
          >
            <motion.div
              className="absolute top-1 bottom-1 rounded-lg bg-gradient-to-l from-teal-500/80 to-emerald-500/80"
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
              onClick={() => { setActiveTab('login'); clearError(); }}
              className={cn(
                'relative z-10 flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors duration-200 min-h-[44px]',
                activeTab === 'login' ? 'text-white' : 'text-white/40 hover:text-white/60'
              )}
            >
              تسجيل دخول
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('register'); clearError(); }}
              className={cn(
                'relative z-10 flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors duration-200 min-h-[44px]',
                activeTab === 'register' ? 'text-white' : 'text-white/40 hover:text-white/60'
              )}
            >
              إنشاء حساب
            </button>
          </motion.div>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 text-sm text-red-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ====== Login Form ====== */}
          <AnimatePresence mode="wait">
            {activeTab === 'login' && (
              <motion.form
                key="login-form"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.25 }}
                onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                className="space-y-4"
              >
                {/* Phone input with +967 prefix */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] z-10 pointer-events-none text-white/30" />
                    <Input
                      id="login-phone"
                      type="tel"
                      placeholder="رقم الهاتف"
                      dir="ltr"
                      className={cn(
                        'peer h-12 pr-11 pl-[105px] text-right rounded-xl text-[15px]',
                        'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/25',
                        'hover:bg-white/[0.08] hover:border-white/[0.12]',
                        'focus:bg-white/[0.1] focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/15',
                        loginForm.formState.errors.phone && 'border-red-400/50 focus:border-red-400/70',
                        'transition-all duration-200'
                      )}
                      {...loginForm.register('phone')}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] pointer-events-none">
                      <YemenFlag />
                      <span className="text-white/50 text-[13px] font-semibold tracking-wide">+967</span>
                    </div>
                  </div>
                  {loginForm.formState.errors.phone && (
                    <motion.p
                      initial={{ opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-400 mr-1"
                    >
                      {loginForm.formState.errors.phone.message}
                    </motion.p>
                  )}
                </div>

                {/* Password input */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] z-10 pointer-events-none text-white/30" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="كلمة المرور"
                      dir="ltr"
                      className={cn(
                        'peer h-12 pr-11 pl-11 text-right rounded-xl text-[15px]',
                        'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/25',
                        'hover:bg-white/[0.08] hover:border-white/[0.12]',
                        'focus:bg-white/[0.1] focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/15',
                        loginForm.formState.errors.password && 'border-red-400/50 focus:border-red-400/70',
                        'transition-all duration-200'
                      )}
                      {...loginForm.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors z-10 min-w-[44px] min-h-[44px] flex items-center justify-center -my-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <motion.p
                      initial={{ opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-400 mr-1"
                    >
                      {loginForm.formState.errors.password.message}
                    </motion.p>
                  )}
                  <PasswordStrengthBar password={loginPasswordValue} />
                </div>

                {/* Remember me & forgot password */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember"
                      className="w-4 h-4 rounded border-white/20 bg-white/[0.06] text-teal-500 focus:ring-teal-400/30 focus:ring-offset-0 cursor-pointer"
                    />
                    <Label htmlFor="remember" className="text-xs font-normal cursor-pointer text-white/40">تذكرني</Label>
                  </div>
                  <button type="button" className="text-xs text-teal-400/70 hover:text-teal-400 transition-colors font-medium">
                    نسيت كلمة المرور؟
                  </button>
                </div>

                {/* Submit button */}
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="pt-1">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={cn(
                      'login-shimmer-btn relative w-full h-12 rounded-xl font-bold text-[15px] text-white overflow-hidden',
                      'bg-gradient-to-l from-teal-500 via-emerald-500 to-cyan-500',
                      'shadow-lg shadow-teal-500/20',
                      'hover:shadow-xl hover:shadow-teal-500/25',
                      'disabled:opacity-60 disabled:cursor-not-allowed',
                      'transition-all duration-300'
                    )}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      <span className="flex items-center gap-2 justify-center">
                        تسجيل الدخول
                        <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                      </span>
                    )}
                  </button>
                </motion.div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* ====== Register Forms ====== */}
          <AnimatePresence mode="wait">
            {activeTab === 'register' && (
              <motion.div
                key="register-container"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {/* Role selector */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setRegisterRole('beneficiary'); clearError(); }}
                    className={cn(
                      'relative rounded-2xl p-4 text-center transition-all duration-300 overflow-hidden border min-h-[100px]',
                      registerRole === 'beneficiary'
                        ? 'border-teal-400/30 bg-white/[0.08] shadow-lg shadow-teal-500/10'
                        : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.1]'
                    )}
                  >
                    {registerRole === 'beneficiary' && (
                      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-emerald-500/5" />
                    )}
                    <div className="relative z-10">
                      <div className={cn(
                        'w-12 h-12 rounded-xl mx-auto mb-2.5 flex items-center justify-center transition-all duration-300',
                        registerRole === 'beneficiary'
                          ? 'bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25'
                          : 'bg-white/[0.08] text-white/30'
                      )}>
                        <User className="w-5 h-5" />
                      </div>
                      <span className={cn(
                        'text-sm font-bold transition-colors duration-300',
                        registerRole === 'beneficiary' ? 'text-white' : 'text-white/40'
                      )}>
                        مستفيد/ـة
                      </span>
                      <p className="text-[11px] mt-0.5 text-white/25">رعاية منزلية</p>
                    </div>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setRegisterRole('nurse'); clearError(); }}
                    className={cn(
                      'relative rounded-2xl p-4 text-center transition-all duration-300 overflow-hidden border min-h-[100px]',
                      registerRole === 'nurse'
                        ? 'border-sky-400/30 bg-white/[0.08] shadow-lg shadow-sky-500/10'
                        : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.1]'
                    )}
                  >
                    {registerRole === 'nurse' && (
                      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-cyan-500/5" />
                    )}
                    <div className="relative z-10">
                      <div className={cn(
                        'w-12 h-12 rounded-xl mx-auto mb-2.5 flex items-center justify-center transition-all duration-300',
                        registerRole === 'nurse'
                          ? 'bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-lg shadow-sky-500/25'
                          : 'bg-white/[0.08] text-white/30'
                      )}>
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <span className={cn(
                        'text-sm font-bold transition-colors duration-300',
                        registerRole === 'nurse' ? 'text-white' : 'text-white/40'
                      )}>
                        ممرض/ـة
                      </span>
                      <p className="text-[11px] mt-0.5 text-white/25">ممرض معتمد</p>
                    </div>
                  </motion.button>
                </div>

                {/* Beneficiary Registration Form */}
                <AnimatePresence mode="wait">
                  {registerRole === 'beneficiary' && (
                    <motion.form
                      key="beneficiary-form"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={beneficiaryForm.handleSubmit(onBeneficiaryRegister)}
                      className="space-y-3"
                    >
                      {/* Personal info section */}
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-teal-400" />
                          </div>
                          <span className="text-xs font-semibold text-teal-400">المعلومات الشخصية</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="relative">
                            <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] z-10 pointer-events-none text-white/25" />
                            <Input
                              id="ben-name"
                              placeholder="الاسم الكامل"
                              className={cn(
                                'h-11 pr-10 pl-4 text-right rounded-xl text-sm',
                                'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/20',
                                'hover:bg-white/[0.08] hover:border-white/[0.12]',
                                'focus:bg-white/[0.1] focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/15',
                                beneficiaryForm.formState.errors.name && 'border-red-400/50',
                                'transition-all duration-200'
                              )}
                              {...beneficiaryForm.register('name')}
                            />
                          </div>
                          {beneficiaryForm.formState.errors.name && (
                            <p className="text-xs text-red-400 mr-1">{beneficiaryForm.formState.errors.name.message}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="relative">
                            <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] z-10 pointer-events-none text-white/25" />
                            <Input
                              id="ben-phone"
                              type="tel"
                              placeholder="رقم الهاتف"
                              dir="ltr"
                              className={cn(
                                'h-11 pr-10 pl-[105px] text-right rounded-xl text-sm',
                                'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/20',
                                'hover:bg-white/[0.08] hover:border-white/[0.12]',
                                'focus:bg-white/[0.1] focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/15',
                                beneficiaryForm.formState.errors.phone && 'border-red-400/50',
                                'transition-all duration-200'
                              )}
                              {...beneficiaryForm.register('phone')}
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.06] border border-white/[0.08] pointer-events-none">
                              <YemenFlag />
                              <span className="text-white/40 text-[12px] font-semibold">+967</span>
                            </div>
                          </div>
                          {beneficiaryForm.formState.errors.phone && (
                            <p className="text-xs text-red-400 mr-1">{beneficiaryForm.formState.errors.phone.message}</p>
                          )}
                        </div>
                      </div>

                      {/* Location section */}
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center">
                            <MapPin className="w-3.5 h-3.5 text-teal-400" />
                          </div>
                          <span className="text-xs font-semibold text-teal-400">معلومات الموقع</span>
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
                        />

                        <div className="space-y-1.5">
                          <div className="relative">
                            <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] z-10 pointer-events-none text-white/25" />
                            <Input
                              id="ben-address"
                              placeholder="العنوان"
                              className={cn(
                                'h-11 pr-10 pl-4 text-right rounded-xl text-sm',
                                'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/20',
                                'hover:bg-white/[0.08] hover:border-white/[0.12]',
                                'focus:bg-white/[0.1] focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/15',
                                beneficiaryForm.formState.errors.address && 'border-red-400/50',
                                'transition-all duration-200'
                              )}
                              {...beneficiaryForm.register('address')}
                            />
                          </div>
                          {beneficiaryForm.formState.errors.address && (
                            <p className="text-xs text-red-400 mr-1">{beneficiaryForm.formState.errors.address.message}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="relative">
                            <Sparkles className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] z-10 pointer-events-none text-white/25" />
                            <Input
                              id="ben-referral"
                              placeholder="كود الإحالة (اختياري)"
                              dir="ltr"
                              className={cn(
                                'h-11 pr-10 pl-4 text-right rounded-xl text-sm',
                                'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/20',
                                'hover:bg-white/[0.08] hover:border-white/[0.12]',
                                'focus:bg-white/[0.1] focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/15',
                                'transition-all duration-200'
                              )}
                              {...beneficiaryForm.register('referralCode')}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Security section */}
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <span className="text-xs font-semibold text-amber-400">الأمان</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="relative">
                            <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] z-10 pointer-events-none text-white/25" />
                            <Input
                              id="ben-password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="كلمة المرور"
                              dir="ltr"
                              className={cn(
                                'h-11 pr-10 pl-10 text-right rounded-xl text-sm',
                                'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/20',
                                'hover:bg-white/[0.08] hover:border-white/[0.12]',
                                'focus:bg-white/[0.1] focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/15',
                                beneficiaryForm.formState.errors.password && 'border-red-400/50',
                                'transition-all duration-200'
                              )}
                              {...beneficiaryForm.register('password')}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors z-10 min-w-[40px] min-h-[40px] flex items-center justify-center"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {beneficiaryForm.formState.errors.password && (
                            <p className="text-xs text-red-400 mr-1">{beneficiaryForm.formState.errors.password.message}</p>
                          )}
                          <PasswordStrengthBar password={beneficiaryPasswordValue} />
                        </div>
                      </div>

                      {/* Submit button */}
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="pt-1">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className={cn(
                            'login-shimmer-btn relative w-full h-12 rounded-xl font-bold text-[15px] text-white overflow-hidden',
                            'bg-gradient-to-l from-teal-500 via-emerald-500 to-cyan-500',
                            'shadow-lg shadow-teal-500/20',
                            'hover:shadow-xl hover:shadow-teal-500/25',
                            'disabled:opacity-60 disabled:cursor-not-allowed',
                            'transition-all duration-300'
                          )}
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                          ) : (
                            <span className="flex items-center gap-2 justify-center">
                              <CheckCircle2 className="w-4 h-4" />
                              إنشاء حساب مستفيد
                            </span>
                          )}
                        </button>
                      </motion.div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Nurse Registration Form */}
                <AnimatePresence mode="wait">
                  {registerRole === 'nurse' && (
                    <motion.form
                      key="nurse-form"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={nurseForm.handleSubmit(onNurseRegister)}
                      className="space-y-3"
                    >
                      {/* Personal info section */}
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center">
                            <Stethoscope className="w-3.5 h-3.5 text-sky-400" />
                          </div>
                          <span className="text-xs font-semibold text-sky-400">المعلومات المهنية</span>
                        </div>

                        {/* Name with shake animation */}
                        <div className="space-y-1.5">
                          <div className={cn('relative', nurseNameShake && 'animate-shake')}>
                            <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] z-10 pointer-events-none text-white/25" />
                            <Input
                              id="nurse-name"
                              placeholder="الاسم الرباعي (أربع كلمات)"
                              className={cn(
                                'h-11 pr-10 pl-4 text-right rounded-xl text-sm',
                                'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/20',
                                'hover:bg-white/[0.08] hover:border-white/[0.12]',
                                'focus:bg-white/[0.1] focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/15',
                                (nurseForm.formState.errors.name || nurseNameWarning) && 'border-amber-400/50',
                                'transition-all duration-200'
                              )}
                              {...nurseForm.register('name')}
                            />
                          </div>
                          {nurseNameWarning && (
                            <motion.p
                              initial={{ opacity: 0, y: -3 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-xs text-amber-400 mr-1"
                            >
                              يجب إدخال الاسم الرباعي (٤ كلمات على الأقل)
                            </motion.p>
                          )}
                          {nurseForm.formState.errors.name && !nurseNameWarning && (
                            <p className="text-xs text-red-400 mr-1">{nurseForm.formState.errors.name.message}</p>
                          )}
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] z-10 pointer-events-none text-white/25" />
                            <Input
                              id="nurse-phone"
                              type="tel"
                              placeholder="رقم الهاتف"
                              dir="ltr"
                              className={cn(
                                'h-11 pr-10 pl-[105px] text-right rounded-xl text-sm',
                                'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/20',
                                'hover:bg-white/[0.08] hover:border-white/[0.12]',
                                'focus:bg-white/[0.1] focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/15',
                                nurseForm.formState.errors.phone && 'border-red-400/50',
                                'transition-all duration-200'
                              )}
                              {...nurseForm.register('phone')}
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.06] border border-white/[0.08] pointer-events-none">
                              <YemenFlag />
                              <span className="text-white/40 text-[12px] font-semibold">+967</span>
                            </div>
                          </div>
                          {nurseForm.formState.errors.phone && (
                            <p className="text-xs text-red-400 mr-1">{nurseForm.formState.errors.phone.message}</p>
                          )}
                        </div>

                        {/* Specialization select */}
                        <div className="space-y-1.5">
                          <Select
                            onValueChange={(value) => nurseForm.setValue('specialization', value)}
                            defaultValue={nurseForm.getValues('specialization')}
                          >
                            <SelectTrigger className={cn(
                              'h-11 rounded-xl text-sm',
                              'bg-white/[0.06] border-white/[0.08] text-white',
                              'hover:bg-white/[0.08] hover:border-white/[0.12]',
                              'focus:ring-sky-400/15',
                              nurseForm.formState.errors.specialization && 'border-red-400/50',
                              'transition-all duration-200'
                            )}>
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
                            <Shield className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] z-10 pointer-events-none text-white/25" />
                            <Input
                              id="nurse-license"
                              placeholder="رقم الترخيص"
                              className={cn(
                                'h-11 pr-10 pl-4 text-right rounded-xl text-sm',
                                'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/20',
                                'hover:bg-white/[0.08] hover:border-white/[0.12]',
                                'focus:bg-white/[0.1] focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/15',
                                nurseForm.formState.errors.licenseNumber && 'border-red-400/50',
                                'transition-all duration-200'
                              )}
                              {...nurseForm.register('licenseNumber')}
                            />
                          </div>
                          {nurseForm.formState.errors.licenseNumber && (
                            <p className="text-xs text-red-400 mr-1">{nurseForm.formState.errors.licenseNumber.message}</p>
                          )}
                        </div>
                      </div>

                      {/* Location section */}
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center">
                            <MapPin className="w-3.5 h-3.5 text-sky-400" />
                          </div>
                          <span className="text-xs font-semibold text-sky-400">معلومات الموقع</span>
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
                        />

                        <div className="space-y-1.5">
                          <div className="relative">
                            <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] z-10 pointer-events-none text-white/25" />
                            <Input
                              id="nurse-address"
                              placeholder="العنوان التفصيلي"
                              className={cn(
                                'h-11 pr-10 pl-4 text-right rounded-xl text-sm',
                                'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/20',
                                'hover:bg-white/[0.08] hover:border-white/[0.12]',
                                'focus:bg-white/[0.1] focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/15',
                                nurseForm.formState.errors.address && 'border-red-400/50',
                                'transition-all duration-200'
                              )}
                              {...nurseForm.register('address')}
                            />
                          </div>
                          {nurseForm.formState.errors.address && (
                            <p className="text-xs text-red-400 mr-1">{nurseForm.formState.errors.address.message}</p>
                          )}
                        </div>
                      </div>

                      {/* Security section */}
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <span className="text-xs font-semibold text-amber-400">الأمان</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="relative">
                            <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] z-10 pointer-events-none text-white/25" />
                            <Input
                              id="nurse-password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="كلمة المرور"
                              dir="ltr"
                              className={cn(
                                'h-11 pr-10 pl-10 text-right rounded-xl text-sm',
                                'bg-white/[0.06] border-white/[0.08] text-white placeholder-white/20',
                                'hover:bg-white/[0.08] hover:border-white/[0.12]',
                                'focus:bg-white/[0.1] focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/15',
                                nurseForm.formState.errors.password && 'border-red-400/50',
                                'transition-all duration-200'
                              )}
                              {...nurseForm.register('password')}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors z-10 min-w-[40px] min-h-[40px] flex items-center justify-center"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {nurseForm.formState.errors.password && (
                            <p className="text-xs text-red-400 mr-1">{nurseForm.formState.errors.password.message}</p>
                          )}
                          <PasswordStrengthBar password={nursePasswordValue} />
                        </div>
                      </div>

                      {/* Submit button */}
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="pt-1">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className={cn(
                            'login-shimmer-btn relative w-full h-12 rounded-xl font-bold text-[15px] text-white overflow-hidden',
                            'bg-gradient-to-l from-sky-500 via-cyan-500 to-teal-500',
                            'shadow-lg shadow-sky-500/20',
                            'hover:shadow-xl hover:shadow-sky-500/25',
                            'disabled:opacity-60 disabled:cursor-not-allowed',
                            'transition-all duration-300'
                          )}
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                          ) : (
                            <span className="flex items-center gap-2 justify-center">
                              <CheckCircle2 className="w-4 h-4" />
                              إنشاء حساب ممرض/ـة
                            </span>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 flex items-center justify-center gap-2 text-white/15 text-[11px]"
          >
            <Shield className="w-3 h-3" />
            <span>بياناتك مشفرة ومحمية بتقنيات متقدمة</span>
          </motion.div>
        </div>
      </motion.div>
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
