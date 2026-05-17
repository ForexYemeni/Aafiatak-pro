'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Stethoscope,
  Phone,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Search,
  Loader2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FlaskConical,
  Radiation,
  HeartPulse,
  Baby,
  Syringe,
  Siren,
  Home,
  MoreHorizontal,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/stores/auth-store';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { cn } from '@/lib/utils';
import type { LocationData } from '@/hooks/use-geolocation';
import type { YemenGovernorate } from '@/types';

// ============================================================================
// Props
// ============================================================================

interface RegisterMultiStepProps {
  onBackToLogin: () => void;
  onRegisterSuccess: () => void;
  onError?: (error: string) => void;
}

// ============================================================================
// Password Strength Calculator
// ============================================================================

function getPasswordStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: 1, label: 'ضعيفة' };
  if (score <= 3) return { score: 2, label: 'متوسطة' };
  return { score: 3, label: 'قوية' };
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
// Category Config
// ============================================================================

const CATEGORY_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  activeBg: string;
  activeText: string;
  ring: string;
}> = {
  'تمريض': {
    icon: Stethoscope,
    color: 'text-teal-400',
    bg: 'bg-teal-500/15',
    border: 'border-teal-500/30',
    activeBg: 'bg-teal-500',
    activeText: 'text-white',
    ring: 'ring-teal-500/40',
  },
  'مختبر': {
    icon: FlaskConical,
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30',
    activeBg: 'bg-purple-500',
    activeText: 'text-white',
    ring: 'ring-purple-500/40',
  },
  'أشعة': {
    icon: Radiation,
    color: 'text-blue-400',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    activeBg: 'bg-blue-500',
    activeText: 'text-white',
    ring: 'ring-blue-500/40',
  },
  'طبي': {
    icon: HeartPulse,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/30',
    activeBg: 'bg-indigo-500',
    activeText: 'text-white',
    ring: 'ring-indigo-500/40',
  },
  'توليد': {
    icon: Baby,
    color: 'text-pink-400',
    bg: 'bg-pink-500/15',
    border: 'border-pink-500/30',
    activeBg: 'bg-pink-500',
    activeText: 'text-white',
    ring: 'ring-pink-500/40',
  },
  'علاج': {
    icon: Syringe,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    activeBg: 'bg-amber-500',
    activeText: 'text-white',
    ring: 'ring-amber-500/40',
  },
  'طوارئ': {
    icon: Siren,
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    activeBg: 'bg-red-500',
    activeText: 'text-white',
    ring: 'ring-red-500/40',
  },
  'رعاية': {
    icon: Home,
    color: 'text-green-400',
    bg: 'bg-green-500/15',
    border: 'border-green-500/30',
    activeBg: 'bg-green-500',
    activeText: 'text-white',
    ring: 'ring-green-500/40',
  },
  'أخرى': {
    icon: MoreHorizontal,
    color: 'text-gray-400',
    bg: 'bg-gray-500/15',
    border: 'border-gray-500/30',
    activeBg: 'bg-gray-500',
    activeText: 'text-white',
    ring: 'ring-gray-500/40',
  },
};

// ============================================================================
// Specializations
// ============================================================================

const specializations = [
  { value: 'general_nursing', label: 'ممرض عام', category: 'تمريض' },
  { value: 'emergency_nursing', label: 'ممرض طوارئ', category: 'تمريض' },
  { value: 'critical_care', label: 'ممرض عناية مركزة', category: 'تمريض' },
  { value: 'home_care_nursing', label: 'ممرض منزلي', category: 'تمريض' },
  { value: 'pediatric', label: 'ممرض أطفال', category: 'تمريض' },
  { value: 'surgery_nursing', label: 'ممرض عمليات', category: 'تمريض' },
  { value: 'anesthesia_nursing', label: 'ممرض تخدير', category: 'تمريض' },
  { value: 'dialysis', label: 'ممرض غسيل كلى', category: 'تمريض' },
  { value: 'cardiac_nursing', label: 'ممرض قلب', category: 'تمريض' },
  { value: 'oncology', label: 'ممرض أورام', category: 'تمريض' },
  { value: 'mental_health', label: 'ممرض نفسي', category: 'تمريض' },
  { value: 'elderly_care', label: 'ممرض كبار سن', category: 'تمريض' },
  { value: 'neonatal', label: 'ممرض حديثي الولادة', category: 'تمريض' },
  { value: 'iv_therapy', label: 'تركيب محاليل', category: 'تمريض' },
  { value: 'wound_care', label: 'رعاية جروح', category: 'تمريض' },
  { value: 'post_surgery', label: 'رعاية ما بعد الجراحة', category: 'تمريض' },
  { value: 'lab_specialist', label: 'أخصائي مختبر', category: 'مختبر' },
  { value: 'lab_tech', label: 'فني مختبر', category: 'مختبر' },
  { value: 'blood_draw', label: 'سحب عينات', category: 'مختبر' },
  { value: 'radiology_specialist', label: 'أخصائي أشعة', category: 'أشعة' },
  { value: 'radiology_tech', label: 'فني أشعة', category: 'أشعة' },
  { value: 'physician_assistant', label: 'مساعد طبيب', category: 'طبي' },
  { value: 'respiratory_specialist', label: 'أخصائي تنفسية', category: 'طبي' },
  { value: 'midwife', label: 'قابلة', category: 'توليد' },
  { value: 'physiotherapy', label: 'علاج طبيعي', category: 'علاج' },
  { value: 'nutrition_therapy', label: 'تغذية علاجية', category: 'علاج' },
  { value: 'respiratory_therapy', label: 'علاج تنفسي', category: 'علاج' },
  { value: 'paramedic', label: 'مسعف', category: 'طوارئ' },
  { value: 'emergency_tech', label: 'فني طوارئ', category: 'طوارئ' },
  { value: 'home_care', label: 'رعاية منزلية', category: 'رعاية' },
  { value: 'other', label: 'تخصصات أخرى', category: 'أخرى' },
];

const SPEC_CATEGORIES = ['تمريض', 'مختبر', 'أشعة', 'طبي', 'توليد', 'علاج', 'طوارئ', 'رعاية', 'أخرى'];

// ============================================================================
// Phone Validation Helper
// ============================================================================

function sanitizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.slice(0, 9);
}

function validatePhone(phone: string): string | null {
  if (!phone) return 'رقم الهاتف مطلوب';
  if (phone.length > 9) return 'رقم الهاتف يجب أن يكون ٩ أرقام كحد أقصى';
  if (!phone.startsWith('7')) return 'رقم الهاتف يجب أن يبدأ بـ 7';
  if (phone.length < 9) return 'رقم الهاتف يجب أن يكون ٩ أرقام';
  return null;
}

// ============================================================================
// Shared Sub-components
// ============================================================================

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-[20px] p-4 space-y-3', className)}
      style={{
        background: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  const colorMap: Record<string, string> = {
    teal: 'rgba(20,184,166,0.16)',
    sky: 'rgba(14,165,233,0.16)',
    violet: 'rgba(139,92,246,0.16)',
  };
  const borderMap: Record<string, string> = {
    teal: 'rgba(20,184,166,0.28)',
    sky: 'rgba(14,165,233,0.28)',
    violet: 'rgba(139,92,246,0.28)',
  };
  const textMap: Record<string, string> = {
    teal: 'rgba(20,184,166,0.75)',
    sky: 'rgba(14,165,233,0.75)',
    violet: 'rgba(139,92,246,0.75)',
  };
  const iconColorMap: Record<string, string> = {
    teal: '#2dd4bf',
    sky: '#38bdf8',
    violet: '#a78bfa',
  };

  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        className="w-7 h-7 rounded-[9px] flex items-center justify-center"
        style={{ background: colorMap[color] || colorMap.teal, border: `1px solid ${borderMap[color] || borderMap.teal}` }}
      >
        <Icon className="w-4 h-4" style={{ color: iconColorMap[color] || iconColorMap.teal }} />
      </div>
      <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: textMap[color] || textMap.teal }}>
        {title}
      </span>
    </div>
  );
}

function PhoneInput({
  value,
  onChange,
  error,
  id,
}: {
  value: string;
  onChange: (val: string) => void;
  error: string | null;
  id: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="relative flex">
        {/* +967 prefix badge */}
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-3 rounded-r-[12px] z-10 pointer-events-none gap-1.5"
          style={{ background: 'rgba(255,255,255,0.06)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
        >
          <YemenFlag />
          <span className="text-white/50 text-[11px] font-medium">+967</span>
        </div>
        <Phone className="absolute right-[76px] top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(sanitizePhone(e.target.value))}
          placeholder="7XXXXXXXX"
          inputMode="numeric"
          className="h-[46px] pr-[100px] pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200 w-full"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${error ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
            e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.border = `1px solid ${error ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`;
            e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
          }}
          dir="ltr"
        />
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[11px] text-red-400 flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  error,
  id,
}: {
  value: string;
  onChange: (val: string) => void;
  error: string | null;
  id: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const strength = getPasswordStrength(value);

  const strengthColors = ['bg-red-500', 'bg-amber-500', 'bg-emerald-500'];
  const strengthTextColors = ['text-red-400', 'text-amber-400', 'text-emerald-400'];

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="كلمة المرور"
          className="h-[46px] pr-10 pl-10 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${error ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
            e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.border = `1px solid ${error ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`;
            e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
          }}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors z-10"
        >
          {showPassword ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
        </button>
      </div>

      {/* Password strength indicator */}
      <AnimatePresence>
        {value && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1"
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-all duration-500',
                    i < strength.score ? strengthColors[strength.score - 1] : 'bg-white/10'
                  )}
                />
              ))}
            </div>
            <p className={cn('text-[11px] font-medium transition-colors duration-300', strengthTextColors[strength.score - 1] || 'text-white/30')}>
              قوة كلمة المرور: {strength.label}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[11px] text-red-400 flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  loading,
  variant = 'primary',
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'back';
  className?: string;
}) {
  const isPrimary = variant === 'primary';
  const isBack = variant === 'back';

  return (
    <motion.button
      type={isPrimary ? 'submit' : 'button'}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'w-full h-[48px] rounded-[14px] text-[14px] font-bold transition-all duration-300 flex items-center justify-center gap-2',
        isPrimary && !disabled && 'bg-gradient-to-l from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40',
        isPrimary && disabled && 'bg-white/8 text-white/25 cursor-not-allowed',
        isBack && 'bg-white/5 text-white/50 hover:bg-white/8 hover:text-white/70 border border-white/8',
        isBack && disabled && 'opacity-30 cursor-not-allowed',
        variant === 'secondary' && 'bg-white/5 text-white/60 hover:bg-white/8',
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        children
      )}
    </motion.button>
  );
}

// ============================================================================
// Nurse Step Indicator
// ============================================================================

const NURSE_STEPS = [
  { num: 1, label: 'الشخصية' },
  { num: 2, label: 'التخصص' },
  { num: 3, label: 'الموقع' },
  { num: 4, label: 'الأمان' },
];

function NurseStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-4 px-2" dir="rtl">
      {NURSE_STEPS.map((step, i) => {
        const isActive = currentStep === step.num;
        const isCompleted = currentStep > step.num;

        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                animate={{
                  scale: isActive ? 1.15 : 1,
                  backgroundColor: isCompleted ? '#10b981' : isActive ? '#14b8a6' : 'rgba(255,255,255,0.08)',
                  borderColor: isCompleted ? '#10b981' : isActive ? 'rgba(20,184,166,0.6)' : 'rgba(255,255,255,0.12)',
                }}
                transition={{ duration: 0.3 }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold"
                style={{
                  border: '2px solid',
                  color: isCompleted || isActive ? 'white' : 'rgba(255,255,255,0.3)',
                }}
              >
                {isCompleted ? '✓' : step.num}
              </motion.div>
              <span
                className="text-[9px] font-medium transition-colors"
                style={{ color: isActive ? 'rgba(20,184,166,0.8)' : isCompleted ? '#10b981' : 'rgba(255,255,255,0.25)' }}
              >
                {step.label}
              </span>
            </div>
            {i < NURSE_STEPS.length - 1 && (
              <div
                className="w-6 h-0.5 mx-1 mt-[-14px] rounded-full transition-colors duration-300"
                style={{ background: isCompleted ? '#10b981' : 'rgba(255,255,255,0.08)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RegisterMultiStep({ onBackToLogin, onRegisterSuccess }: RegisterMultiStepProps) {
  const registerNurse = useAuthStore((s) => s.registerNurse);
  const registerBeneficiary = useAuthStore((s) => s.registerBeneficiary);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  // Role selection: 'none' | 'beneficiary' | 'nurse'
  const [registerRole, setRegisterRole] = useState<'none' | 'beneficiary' | 'nurse'>('none');

  // Nurse multi-step
  const [nurseStep, setNurseStep] = useState(1);

  // ── Beneficiary Form State ─────────────────────────────
  const [benName, setBenName] = useState('');
  const [benPhone, setBenPhone] = useState('');
  const [benPassword, setBenPassword] = useState('');
  const [benAddress, setBenAddress] = useState('');
  const [benGovernorate, setBenGovernorate] = useState<YemenGovernorate | ''>('');
  const [benReferralCode, setBenReferralCode] = useState('');
  const [benLocationData, setBenLocationData] = useState<LocationData | null>(null);

  // Beneficiary errors
  const [benNameError, setBenNameError] = useState<string | null>(null);
  const [benPhoneError, setBenPhoneError] = useState<string | null>(null);
  const [benPasswordError, setBenPasswordError] = useState<string | null>(null);
  const [benAddressError, setBenAddressError] = useState<string | null>(null);

  // ── Nurse Form State ────────────────────────────────────
  const [nurseName, setNurseName] = useState('');
  const [nursePhone, setNursePhone] = useState('');
  const [nursePassword, setNursePassword] = useState('');
  const [nurseSpecialization, setNurseSpecialization] = useState('');
  const [nurseLicenseNumber, setNurseLicenseNumber] = useState('');
  const [nurseAddress, setNurseAddress] = useState('');
  const [nurseGovernorate, setNurseGovernorate] = useState<YemenGovernorate | ''>('');
  const [nurseLocationData, setNurseLocationData] = useState<LocationData | null>(null);

  // Nurse specialization picker state
  const [specSearch, setSpecSearch] = useState('');
  const [selectedSpecCategory, setSelectedSpecCategory] = useState('');

  // Nurse errors (per step)
  const [nurseNameError, setNurseNameError] = useState<string | null>(null);
  const [nursePhoneError, setNursePhoneError] = useState<string | null>(null);
  const [nurseNameWarning, setNurseNameWarning] = useState(false);
  const [nurseSpecializationError, setNurseSpecializationError] = useState<string | null>(null);
  const [nurseLicenseError, setNurseLicenseError] = useState<string | null>(null);
  const [nurseAddressError, setNurseAddressError] = useState<string | null>(null);
  const [nursePasswordError, setNursePasswordError] = useState<string | null>(null);

  // ── Handlers ────────────────────────────────────────────

  const handleSelectRole = useCallback((role: 'beneficiary' | 'nurse') => {
    clearError();
    setRegisterRole(role);
  }, [clearError]);

  const handleBackToRoleSelect = useCallback(() => {
    clearError();
    setRegisterRole('none');
    setNurseStep(1);
  }, [clearError]);

  // ── Beneficiary submit ──────────────────────────────────

  const handleBeneficiarySubmit = useCallback(async () => {
    clearError();
    let hasError = false;

    if (!benName.trim()) { setBenNameError('الاسم مطلوب'); hasError = true; }
    else { setBenNameError(null); }

    const phoneErr = validatePhone(benPhone);
    if (phoneErr) { setBenPhoneError(phoneErr); hasError = true; }
    else { setBenPhoneError(null); }

    if (!benPassword || benPassword.length < 6) { setBenPasswordError('كلمة المرور يجب أن تكون ٦ أحرف على الأقل'); hasError = true; }
    else { setBenPasswordError(null); }

    if (!benAddress.trim() && !benLocationData?.address) {
      setBenAddressError('العنوان مطلوب'); hasError = true;
    } else { setBenAddressError(null); }

    if (hasError) return;

    try {
      await registerBeneficiary({
        name: benName.trim(),
        phone: benPhone,
        password: benPassword,
        address: benAddress || benLocationData?.address || '',
        governorate: (benGovernorate || undefined) as YemenGovernorate | undefined,
        referralCode: benReferralCode || undefined,
      });
      onRegisterSuccess();
    } catch {
      // Error handled in store
    }
  }, [benName, benPhone, benPassword, benAddress, benGovernorate, benReferralCode, benLocationData, clearError, registerBeneficiary, onRegisterSuccess]);

  // ── Nurse step navigation ───────────────────────────────

  const canGoNextNurseStep = useCallback((): boolean => {
    if (nurseStep === 1) {
      const nameOk = nurseName.trim().length >= 3;
      const phoneOk = !validatePhone(nursePhone);
      return nameOk && phoneOk;
    }
    if (nurseStep === 2) {
      return !!nurseSpecialization && !!nurseLicenseNumber.trim();
    }
    if (nurseStep === 3) {
      return !!(nurseAddress.trim() || nurseLocationData?.address);
    }
    return false;
  }, [nurseStep, nurseName, nursePhone, nurseSpecialization, nurseLicenseNumber, nurseAddress, nurseLocationData]);

  const handleNurseNext = useCallback(() => {
    if (nurseStep === 1) {
      let hasError = false;
      if (!nurseName.trim() || nurseName.trim().length < 3) { setNurseNameError('الاسم مطلوب'); hasError = true; }
      else { setNurseNameError(null); }
      const phoneErr = validatePhone(nursePhone);
      if (phoneErr) { setNursePhoneError(phoneErr); hasError = true; }
      else { setNursePhoneError(null); }
      if (hasError) return;
    }
    if (nurseStep === 2) {
      let hasError = false;
      if (!nurseSpecialization) { setNurseSpecializationError('التخصص مطلوب'); hasError = true; }
      else { setNurseSpecializationError(null); }
      if (!nurseLicenseNumber.trim()) { setNurseLicenseError('رقم الترخيص مطلوب'); hasError = true; }
      else { setNurseLicenseError(null); }
      if (hasError) return;
    }
    if (nurseStep === 3) {
      if (!nurseAddress.trim() && !nurseLocationData?.address) {
        setNurseAddressError('العنوان مطلوب');
        return;
      }
      setNurseAddressError(null);
    }
    setNurseStep((prev) => Math.min(prev + 1, 4));
  }, [nurseStep, nurseName, nursePhone, nurseSpecialization, nurseLicenseNumber, nurseAddress, nurseLocationData]);

  const handleNurseBack = useCallback(() => {
    if (nurseStep === 1) {
      handleBackToRoleSelect();
    } else {
      setNurseStep((prev) => Math.max(prev - 1, 1));
    }
  }, [nurseStep, handleBackToRoleSelect]);

  const handleNurseSubmit = useCallback(async () => {
    clearError();

    if (!nursePassword || nursePassword.length < 6) {
      setNursePasswordError('كلمة المرور يجب أن تكون ٦ أحرف على الأقل');
      return;
    }
    setNursePasswordError(null);

    // Check 4-part name
    const nameWords = nurseName.trim().split(/\s+/).filter(Boolean);
    if (nameWords.length < 4) {
      setNurseNameWarning(true);
      setTimeout(() => setNurseNameWarning(false), 3000);
      return;
    }

    try {
      await registerNurse({
        name: nurseName.trim(),
        phone: nursePhone,
        password: nursePassword,
        specialization: nurseSpecialization,
        licenseNumber: nurseLicenseNumber.trim(),
        address: nurseAddress || nurseLocationData?.address || '',
        governorate: (nurseGovernorate || undefined) as YemenGovernorate | undefined,
      });
      onRegisterSuccess();
    } catch {
      // Error handled in store
    }
  }, [nurseName, nursePhone, nursePassword, nurseSpecialization, nurseLicenseNumber, nurseAddress, nurseGovernorate, nurseLocationData, clearError, registerNurse, onRegisterSuccess]);

  // ── GPS handlers ────────────────────────────────────────

  const handleBenLocation = useCallback((loc: LocationData) => {
    setBenLocationData(loc);
    if (loc.address) setBenAddress(loc.address);
    if (loc.governorateValue) setBenGovernorate(loc.governorateValue as YemenGovernorate);
  }, []);

  const handleNurseLocation = useCallback((loc: LocationData) => {
    setNurseLocationData(loc);
    if (loc.address) setNurseAddress(loc.address);
    if (loc.governorateValue) setNurseGovernorate(loc.governorateValue as YemenGovernorate);
  }, []);

  // ── Filtered specializations ────────────────────────────

  const filteredSpecs = specializations.filter((s) => {
    const matchCategory = !selectedSpecCategory || s.category === selectedSpecCategory;
    const matchSearch = !specSearch || s.label.includes(specSearch) || s.value.includes(specSearch.toLowerCase());
    return matchCategory && matchSearch;
  });

  // ── Animation variants ──────────────────────────────────

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 40 : -40,
      opacity: 0,
    }),
  };

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 flex flex-col" dir="rtl">
      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 rounded-[14px] p-3 flex items-center gap-2 text-[12px] text-red-300"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" custom={1}>
        {/* ====== STEP 0: ROLE SELECTION ====== */}
        {registerRole === 'none' && (
          <motion.div
            key="role-select"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.28 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              {/* Beneficiary card */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectRole('beneficiary')}
                className="relative rounded-[22px] p-5 text-center transition-all duration-300 overflow-hidden min-h-[140px]"
                style={{
                  background: 'rgba(20,184,166,0.06)',
                  border: '1.5px solid rgba(20,184,166,0.22)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(20,184,166,0.11)';
                  e.currentTarget.style.borderColor = 'rgba(20,184,166,0.48)';
                  e.currentTarget.style.boxShadow = '0 10px 36px -10px rgba(20,184,166,0.28), inset 0 1px 0 rgba(20,184,166,0.22)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(20,184,166,0.06)';
                  e.currentTarget.style.borderColor = 'rgba(20,184,166,0.22)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="absolute inset-0 rounded-[22px]" style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(16,185,129,0.03) 100%)' }} />
                <div className="relative z-10">
                  <div
                    className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', boxShadow: '0 10px 28px -6px rgba(20,184,166,0.55)' }}
                  >
                    <User className="w-7 h-7 text-white" />
                  </div>
                  <span className="block text-[14px] font-bold text-white mb-1">مستفيد/ـة</span>
                  <p className="text-[11px] text-teal-300/60">رعاية منزلية</p>
                </div>
              </motion.button>

              {/* Nurse card */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectRole('nurse')}
                className="relative rounded-[22px] p-5 text-center transition-all duration-300 overflow-hidden min-h-[140px]"
                style={{
                  background: 'rgba(14,165,233,0.06)',
                  border: '1.5px solid rgba(14,165,233,0.22)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(14,165,233,0.11)';
                  e.currentTarget.style.borderColor = 'rgba(14,165,233,0.46)';
                  e.currentTarget.style.boxShadow = '0 10px 36px -10px rgba(14,165,233,0.26), inset 0 1px 0 rgba(14,165,233,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(14,165,233,0.06)';
                  e.currentTarget.style.borderColor = 'rgba(14,165,233,0.22)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="absolute inset-0 rounded-[22px]" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(6,182,212,0.03) 100%)' }} />
                <div className="relative z-10">
                  <div
                    className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)', boxShadow: '0 10px 28px -6px rgba(14,165,233,0.5)' }}
                  >
                    <Stethoscope className="w-7 h-7 text-white" />
                  </div>
                  <span className="block text-[14px] font-bold text-white mb-1">ممرض/ـة</span>
                  <p className="text-[11px] text-sky-300/60">ممرض معتمد</p>
                </div>
              </motion.button>
            </div>

            {/* Back to login link */}
            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full text-center text-[13px] text-white/35 hover:text-white/60 transition-colors py-2"
            >
              العودة لتسجيل الدخول
            </button>
          </motion.div>
        )}

        {/* ====== BENEFICIARY FORM (single scrollable view) ====== */}
        {registerRole === 'beneficiary' && (
          <motion.div
            key="beneficiary-form"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.28 }}
            className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3 -mx-1 px-1 pb-2"
          >
            {/* Back button */}
            <button
              type="button"
              onClick={handleBackToRoleSelect}
              className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-[13px] mb-1"
            >
              <ArrowRight className="w-4 h-4" />
              اختيار نوع الحساب
            </button>

            {/* Card 1: Personal Info */}
            <GlassCard>
              <CardHeader icon={User} title="المعلومات الشخصية" color="teal" />
              {/* Name */}
              <div className="space-y-1.5">
                <div className="relative">
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                  <Input
                    value={benName}
                    onChange={(e) => { setBenName(e.target.value); if (benNameError) setBenNameError(null); }}
                    placeholder="الاسم الكامل"
                    className="h-[46px] pr-10 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: `1px solid ${benNameError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                      e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      e.currentTarget.style.border = `1px solid ${benNameError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`;
                      e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
                      if (!benName.trim()) setBenNameError('الاسم مطلوب');
                    }}
                  />
                </div>
                <AnimatePresence>
                  {benNameError && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[11px] text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {benNameError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              {/* Phone */}
              <PhoneInput value={benPhone} onChange={(v) => { setBenPhone(v); if (benPhoneError) setBenPhoneError(null); }} error={benPhoneError} id="ben-phone" />
            </GlassCard>

            {/* Card 2: Location */}
            <GlassCard>
              <CardHeader icon={MapPin} title="الموقع الجغرافي" color="teal" />
              <GpsLocationButton
                onLocationDetected={handleBenLocation}
                value={benAddress}
                placeholder="اضغط لتحديد موقعك الجغرافي"
              />
              <div className="relative">
                <Input
                  value={benAddress}
                  onChange={(e) => { setBenAddress(e.target.value); if (benAddressError) setBenAddressError(null); }}
                  placeholder="العنوان التفصيلي (اختياري مع تحديد الموقع)"
                  className="h-[46px] pr-4 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${benAddressError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                    e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.border = `1px solid ${benAddressError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`;
                    e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
                  }}
                />
                <AnimatePresence>
                  {benAddressError && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {benAddressError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </GlassCard>

            {/* Card 3: Referral Code */}
            <GlassCard>
              <CardHeader icon={User} title="كود الإحالة" color="teal" />
              <Input
                value={benReferralCode}
                onChange={(e) => setBenReferralCode(e.target.value)}
                placeholder="كود الإحالة (اختياري)"
                className="h-[46px] pr-4 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                  e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                  e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
                }}
              />
            </GlassCard>

            {/* Card 4: Security */}
            <GlassCard>
              <CardHeader icon={Lock} title="الأمان" color="teal" />
              <PasswordInput value={benPassword} onChange={(v) => { setBenPassword(v); if (benPasswordError) setBenPasswordError(null); }} error={benPasswordError} id="ben-password" />
            </GlassCard>

            {/* Submit */}
            <ActionButton onClick={handleBeneficiarySubmit} loading={isLoading} variant="primary">
              إنشاء الحساب
            </ActionButton>
          </motion.div>
        )}

        {/* ====== NURSE FORM (multi-step) ====== */}
        {registerRole === 'nurse' && (
          <motion.div
            key="nurse-form"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.28 }}
            className="flex-1 min-h-0 flex flex-col"
          >
            <NurseStepIndicator currentStep={nurseStep} />

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar -mx-1 px-1 pb-2">
              <AnimatePresence mode="wait" custom={1}>
                {/* Nurse Step 1: Personal Info */}
                {nurseStep === 1 && (
                  <motion.div
                    key="nurse-step-1"
                    custom={1}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                  >
                    <GlassCard>
                      <CardHeader icon={User} title="المعلومات الشخصية" color="sky" />
                      {/* Name */}
                      <div className="space-y-1.5">
                        <div className="relative">
                          <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                          <Input
                            value={nurseName}
                            onChange={(e) => { setNurseName(e.target.value); if (nurseNameError) setNurseNameError(null); }}
                            placeholder="الاسم الرباعي"
                            className="h-[46px] pr-10 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: `1px solid ${nurseNameError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`,
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                              e.currentTarget.style.border = '1px solid rgba(14,165,233,0.58)';
                              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.05)';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                              e.currentTarget.style.border = `1px solid ${nurseNameError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`;
                              e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
                              if (!nurseName.trim()) setNurseNameError('الاسم مطلوب');
                            }}
                          />
                        </div>
                        <AnimatePresence>
                          {nurseNameError && (
                            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[11px] text-red-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> {nurseNameError}
                            </motion.p>
                          )}
                        </AnimatePresence>
                        <AnimatePresence>
                          {nurseNameWarning && (
                            <motion.p
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -8 }}
                              className="text-[11px] text-amber-400 flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              يُفضل كتابة الاسم الرباعي (٤ كلمات)
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                      {/* Phone */}
                      <PhoneInput value={nursePhone} onChange={(v) => { setNursePhone(v); if (nursePhoneError) setNursePhoneError(null); }} error={nursePhoneError} id="nurse-phone" />
                    </GlassCard>

                    <ActionButton onClick={handleNurseNext} disabled={!canGoNextNurseStep()} variant="primary">
                      التالي
                      <ArrowLeft className="w-4 h-4" />
                    </ActionButton>
                  </motion.div>
                )}

                {/* Nurse Step 2: Specialty & License */}
                {nurseStep === 2 && (
                  <motion.div
                    key="nurse-step-2"
                    custom={1}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                  >
                    <GlassCard>
                      <CardHeader icon={Stethoscope} title="التخصص والترخيص" color="sky" />

                      {/* Search input */}
                      <div className="relative">
                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                        <Input
                          value={specSearch}
                          onChange={(e) => setSpecSearch(e.target.value)}
                          placeholder="ابحث عن التخصص..."
                          className="h-[42px] pr-10 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                            e.currentTarget.style.border = '1px solid rgba(14,165,233,0.58)';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.05)';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                            e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
                          }}
                        />
                      </div>

                      {/* Category chips */}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedSpecCategory('')}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                            !selectedSpecCategory ? 'bg-sky-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/8'
                          )}
                        >
                          الكل
                        </button>
                        {SPEC_CATEGORIES.map((cat) => {
                          const cfg = CATEGORY_CONFIG[cat];
                          const CatIcon = cfg?.icon;
                          const isActive = selectedSpecCategory === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedSpecCategory(isActive ? '' : cat)}
                              className={cn(
                                'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1',
                                isActive ? `${cfg?.activeBg} text-white` : `${cfg?.bg} ${cfg?.color} hover:opacity-80`
                              )}
                            >
                              {CatIcon && <CatIcon className="w-3 h-3" />}
                              {cat}
                            </button>
                          );
                        })}
                      </div>

                      {/* Specialties grid */}
                      <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                        {filteredSpecs.map((spec) => {
                          const isSelected = nurseSpecialization === spec.value;
                          return (
                            <motion.button
                              key={spec.value}
                              type="button"
                              whileTap={{ scale: 0.95 }}
                              onClick={() => { setNurseSpecialization(spec.value); if (nurseSpecializationError) setNurseSpecializationError(null); }}
                              className={cn(
                                'px-3 py-2 rounded-[10px] text-[11px] font-medium transition-all text-right',
                                isSelected ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-white/5 text-white/50 hover:bg-white/8'
                              )}
                            >
                              {spec.label}
                            </motion.button>
                          );
                        })}
                        {filteredSpecs.length === 0 && (
                          <p className="col-span-2 text-center text-white/30 text-[12px] py-4">لا توجد نتائج</p>
                        )}
                      </div>
                      <AnimatePresence>
                        {nurseSpecializationError && (
                          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[11px] text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" /> {nurseSpecializationError}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      {/* License Number */}
                      <div className="space-y-1.5 mt-2">
                        <div className="relative">
                          <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
                          <Input
                            value={nurseLicenseNumber}
                            onChange={(e) => { setNurseLicenseNumber(e.target.value); if (nurseLicenseError) setNurseLicenseError(null); }}
                            placeholder="رقم مزاولة الترخيص"
                            className="h-[46px] pr-10 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: `1px solid ${nurseLicenseError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`,
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                              e.currentTarget.style.border = '1px solid rgba(14,165,233,0.58)';
                              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.05)';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                              e.currentTarget.style.border = `1px solid ${nurseLicenseError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`;
                              e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
                              if (!nurseLicenseNumber.trim()) setNurseLicenseError('رقم الترخيص مطلوب');
                            }}
                          />
                        </div>
                        <AnimatePresence>
                          {nurseLicenseError && (
                            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[11px] text-red-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> {nurseLicenseError}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </GlassCard>

                    <div className="flex gap-2">
                      <ActionButton onClick={handleNurseBack} variant="back" className="w-auto flex-1">
                        <ArrowRight className="w-4 h-4" />
                        رجوع
                      </ActionButton>
                      <ActionButton onClick={handleNurseNext} disabled={!canGoNextNurseStep()} variant="primary" className="flex-[2]">
                        التالي
                        <ArrowLeft className="w-4 h-4" />
                      </ActionButton>
                    </div>
                  </motion.div>
                )}

                {/* Nurse Step 3: Location */}
                {nurseStep === 3 && (
                  <motion.div
                    key="nurse-step-3"
                    custom={1}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                  >
                    <GlassCard>
                      <CardHeader icon={MapPin} title="الموقع الجغرافي" color="sky" />
                      <GpsLocationButton
                        onLocationDetected={handleNurseLocation}
                        value={nurseAddress}
                        placeholder="اضغط لتحديد موقعك الجغرافي"
                      />
                      <div className="relative">
                        <Input
                          value={nurseAddress}
                          onChange={(e) => { setNurseAddress(e.target.value); if (nurseAddressError) setNurseAddressError(null); }}
                          placeholder="العنوان التفصيلي (اختياري مع تحديد الموقع)"
                          className="h-[46px] pr-4 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: `1px solid ${nurseAddressError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`,
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                            e.currentTarget.style.border = '1px solid rgba(14,165,233,0.58)';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.05)';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                            e.currentTarget.style.border = `1px solid ${nurseAddressError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`;
                            e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
                          }}
                        />
                        <AnimatePresence>
                          {nurseAddressError && (
                            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> {nurseAddressError}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </GlassCard>

                    <div className="flex gap-2">
                      <ActionButton onClick={handleNurseBack} variant="back" className="w-auto flex-1">
                        <ArrowRight className="w-4 h-4" />
                        رجوع
                      </ActionButton>
                      <ActionButton onClick={handleNurseNext} variant="primary" className="flex-[2]">
                        التالي
                        <ArrowLeft className="w-4 h-4" />
                      </ActionButton>
                    </div>
                  </motion.div>
                )}

                {/* Nurse Step 4: Security */}
                {nurseStep === 4 && (
                  <motion.div
                    key="nurse-step-4"
                    custom={1}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                  >
                    <GlassCard>
                      <CardHeader icon={Lock} title="الأمان" color="sky" />
                      <PasswordInput value={nursePassword} onChange={(v) => { setNursePassword(v); if (nursePasswordError) setNursePasswordError(null); }} error={nursePasswordError} id="nurse-password" />
                    </GlassCard>

                    <div className="flex gap-2">
                      <ActionButton onClick={handleNurseBack} variant="back" className="w-auto flex-1">
                        <ArrowRight className="w-4 h-4" />
                        رجوع
                      </ActionButton>
                      <ActionButton onClick={handleNurseSubmit} loading={isLoading} variant="primary" className="flex-[2]">
                        إنشاء الحساب
                      </ActionButton>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
