'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  User,
  Shield,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ============================================================================
// Props
// ============================================================================

interface ForgotPasswordFlowProps {
  onBack: () => void;
}

// ============================================================================
// Types
// ============================================================================

interface ApiContact {
  phone: string;
  isWhatsApp: boolean;
  label: string;
}

interface ForgotPasswordResponse {
  success: boolean;
  data?: {
    contacts?: ApiContact[];
    userName?: string;
    userPhone?: string;
  };
  error?: {
    message: string;
  };
}

// ============================================================================
// Phone Validation Helpers
// ============================================================================

function sanitizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.slice(0, 9);
}

function validatePhone(phone: string): string | null {
  if (!phone) return 'رقم الهاتف مطلوب';
  if (!phone.startsWith('7')) return 'رقم الهاتف يجب أن يبدأ بـ 7';
  if (phone.length < 9) return 'رقم الهاتف يجب أن يكون ٩ أرقام';
  if (phone.length > 9) return 'رقم الهاتف يجب أن يكون ٩ أرقام كحد أقصى';
  return null;
}

function cleanPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('967')) return digits;
  if (digits.startsWith('0')) return '967' + digits.slice(1);
  if (digits.startsWith('7')) return '967' + digits;
  return digits;
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
// WhatsApp Icon (custom SVG)
// ============================================================================

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ============================================================================
// Animated Background Particles
// ============================================================================

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[
        { x: '12%', y: '18%', size: 12, delay: 0, duration: 7 },
        { x: '88%', y: '28%', size: 9, delay: 1.8, duration: 8 },
        { x: '72%', y: '78%', size: 11, delay: 0.6, duration: 6 },
        { x: '22%', y: '82%', size: 7, delay: 2.2, duration: 9 },
      ].map((p, i) => (
        <motion.div
          key={i}
          className="absolute text-teal-400/8"
          style={{
            left: p.x,
            top: p.y,
            fontSize: p.size,
          }}
          animate={{
            y: [0, -12, 0],
            rotate: [0, 90, 180, 270, 360],
            opacity: [0.12, 0.22, 0.12],
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
      {[
        { x: '18%', y: '48%', size: 4, delay: 0.4 },
        { x: '85%', y: '58%', size: 3, delay: 1.5 },
        { x: '55%', y: '88%', size: 5, delay: 2.8 },
      ].map((p, i) => (
        <motion.div
          key={`dot-${i}`}
          className="absolute rounded-full bg-violet-400/6"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -8, 0],
            opacity: [0.08, 0.2, 0.08],
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
// Step Indicator Component
// ============================================================================

const STEPS = [
  { num: 1, label: 'التحقق' },
  { num: 2, label: 'الدعم' },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-5 px-2" dir="rtl">
      {STEPS.map((step, i) => {
        const isActive = currentStep === step.num;
        const isCompleted = currentStep > step.num;

        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                animate={{
                  scale: isActive ? 1.12 : 1,
                  backgroundColor: isCompleted
                    ? '#10b981'
                    : isActive
                      ? '#14b8a6'
                      : 'rgba(255,255,255,0.08)',
                  borderColor: isCompleted
                    ? '#10b981'
                    : isActive
                      ? 'rgba(20,184,166,0.6)'
                      : 'rgba(255,255,255,0.12)',
                }}
                transition={{ duration: 0.3 }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold"
                style={{
                  border: '2px solid',
                  color: isCompleted || isActive ? 'white' : 'rgba(255,255,255,0.3)',
                }}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  step.num
                )}
              </motion.div>
              <span
                className="text-[9px] font-medium transition-colors"
                style={{
                  color: isActive
                    ? 'rgba(20,184,166,0.8)'
                    : isCompleted
                      ? '#10b981'
                      : 'rgba(255,255,255,0.25)',
                }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-8 h-0.5 mx-1 mt-[-14px] rounded-full transition-colors duration-300"
                style={{
                  background: isCompleted
                    ? '#10b981'
                    : 'rgba(255,255,255,0.08)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Phone Input Component
// ============================================================================

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
          style={{
            background: 'rgba(255,255,255,0.06)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <YemenFlag />
          <span className="text-white/50 text-[11px] font-medium">+967</span>
        </div>
        <Phone
          className="absolute right-[76px] top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        />
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
            e.currentTarget.style.boxShadow =
              '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.border = `1px solid ${error ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`;
            e.currentTarget.style.boxShadow =
              'inset 0 1px 0 rgba(255,255,255,0.05)';
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

// ============================================================================
// Action Button Component
// ============================================================================

function ActionButton({
  children,
  onClick,
  disabled,
  loading,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'back';
}) {
  const isPrimary = variant === 'primary';
  const isBack = variant === 'back';

  return (
    <motion.button
      type={isPrimary ? 'submit' : 'button'}
      whileTap={!disabled && !loading ? { scale: 0.97 } : undefined}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'w-full h-[48px] rounded-[14px] text-[14px] font-bold transition-all duration-300 flex items-center justify-center gap-2',
        isPrimary &&
          !disabled &&
          'bg-gradient-to-l from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40',
        isPrimary && disabled && 'bg-white/8 text-white/25 cursor-not-allowed',
        isBack &&
          'bg-white/5 text-white/50 hover:bg-white/8 hover:text-white/70 border border-white/8',
        isBack && disabled && 'opacity-30 cursor-not-allowed',
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
// Support Card Component
// ============================================================================

function SupportCard({
  index,
  phone,
  userName,
  userPhone,
}: {
  index: number;
  phone: string;
  userName: string;
  userPhone: string;
}) {
  const label = `دعم ${index + 1}`;

  const whatsappMessage = `مرحباً، أريد إعادة تعيين كلمة المرور الخاصة بحسابي.\nالاسم: ${userName}\nرقم الهاتف: ${userPhone}`;
  const cleanPhone = cleanPhoneNumber(phone);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="block rounded-[18px] overflow-hidden cursor-pointer group"
      style={{
        background:
          'linear-gradient(135deg, rgba(37,211,102,0.08) 0%, rgba(37,211,102,0.03) 100%)',
        border: '1px solid rgba(37,211,102,0.2)',
        boxShadow: '0 0 0 0 rgba(37,211,102,0)',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          '0 8px 32px -8px rgba(37,211,102,0.2)';
        e.currentTarget.style.borderColor = 'rgba(37,211,102,0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 0 rgba(37,211,102,0)';
        e.currentTarget.style.borderColor = 'rgba(37,211,102,0.2)';
      }}
    >
      {/* Green accent bar on the right (RTL) */}
      <div className="flex items-stretch">
        <div
          className="w-[3px] self-stretch rounded-r-full"
          style={{
            background:
              'linear-gradient(to bottom, #25D366, #128C7E)',
          }}
        />
        <div className="flex-1 p-4 flex items-center gap-3.5">
          {/* WhatsApp icon container */}
          <div
            className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110"
            style={{
              background:
                'linear-gradient(135deg, #25D366, #128C7E)',
              boxShadow:
                '0 4px 14px -4px rgba(37,211,102,0.35)',
            }}
          >
            <WhatsAppIcon className="w-5 h-5 text-white" />
          </div>

          {/* Label and description */}
          <div className="flex-1 min-w-0">
            <p
              className="text-[14px] font-bold text-white/90 mb-0.5"
            >
              {label}
            </p>
            <p className="text-[11px] text-white/40 leading-relaxed">
              تواصل عبر واتساب لإعادة تعيين كلمة المرور
            </p>
          </div>

          {/* Arrow indicator */}
          <div className="shrink-0">
            <ArrowLeft
              className="w-4 h-4 text-white/30 group-hover:text-[#25D366] transition-colors duration-200"
            />
          </div>
        </div>
      </div>
    </motion.a>
  );
}

// ============================================================================
// Step 1: User Verification
// ============================================================================

function StepVerification({
  onSubmit,
  isLoading,
  error,
  onBack,
}: {
  onSubmit: (name: string, phone: string) => void;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Validate
      let hasError = false;

      if (!name.trim()) {
        setNameError('الاسم الكامل مطلوب');
        hasError = true;
      } else if (name.trim().length < 3) {
        setNameError('الاسم يجب أن يكون ٣ أحرف على الأقل');
        hasError = true;
      } else {
        setNameError(null);
      }

      const phoneErr = validatePhone(phone);
      if (phoneErr) {
        setPhoneError(phoneErr);
        hasError = true;
      } else {
        setPhoneError(null);
      }

      if (hasError) return;

      onSubmit(name.trim(), phone);
    },
    [name, phone, onSubmit],
  );

  return (
    <motion.div
      key="step-verification"
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header icon and text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-center mb-6"
        >
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3"
            style={{
              background:
                'linear-gradient(135deg, rgba(20,184,166,0.16) 0%, rgba(16,185,129,0.12) 100%)',
              border: '1px solid rgba(20,184,166,0.25)',
              boxShadow: '0 8px 24px -8px rgba(20,184,166,0.2)',
            }}
          >
            <Shield className="w-7 h-7 text-teal-400" />
          </div>
          <h2
            className="text-xl font-black text-white/90 mb-1"
          >
            إعادة تعيين كلمة المرور
          </h2>
          <p className="text-[13px] text-white/35 leading-relaxed">
            أدخل بياناتك للتحقق من هويتك والوصول إلى أرقام الدعم
          </p>
        </motion.div>

        {/* API Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className="flex items-start gap-2.5 p-3.5 rounded-2xl text-[13px] text-red-300"
                style={{
                  background: 'rgba(239,68,68,0.09)',
                  border: '1px solid rgba(239,68,68,0.22)',
                }}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span className="leading-relaxed">{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full Name Field */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          className="space-y-2"
        >
          <label
            className="block text-[11.5px] font-bold tracking-wider uppercase mr-0.5"
            style={{ color: 'rgba(255,255,255,0.42)' }}
          >
            الاسم الكامل
          </label>
          <div className="relative">
            <User
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] z-10 pointer-events-none"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            />
            <Input
              id="forgot-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="أدخل اسمك الكامل"
              className="h-[46px] pr-10 pl-4 text-right rounded-[12px] text-sm text-white placeholder-white/22 border-0 focus:outline-none focus:ring-0 transition-all duration-200 w-full"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${nameError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                e.currentTarget.style.border = '1px solid rgba(20,184,166,0.58)';
                e.currentTarget.style.boxShadow =
                  '0 0 0 3px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.border = `1px solid ${nameError ? 'rgba(239,68,68,0.42)' : 'rgba(255,255,255,0.1)'}`;
                e.currentTarget.style.boxShadow =
                  'inset 0 1px 0 rgba(255,255,255,0.05)';
              }}
              dir="rtl"
            />
          </div>
          <AnimatePresence>
            {nameError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[11px] text-red-400 flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3 shrink-0" />
                {nameError}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Phone Number Field */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          className="space-y-2"
        >
          <label
            className="block text-[11.5px] font-bold tracking-wider uppercase mr-0.5"
            style={{ color: 'rgba(255,255,255,0.42)' }}
          >
            رقم الهاتف
          </label>
          <PhoneInput
            value={phone}
            onChange={(val) => {
              setPhone(val);
              if (phoneError) setPhoneError(null);
            }}
            error={phoneError}
            id="forgot-phone"
          />
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.35 }}
        >
          <ActionButton
            variant="primary"
            loading={isLoading}
            disabled={isLoading}
          >
            <span className="flex items-center gap-2">
              التالي
              <ArrowLeft className="w-4 h-4" />
            </span>
          </ActionButton>
        </motion.div>

        {/* Back to Login Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.35 }}
          className="text-center pt-1"
        >
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/40 hover:text-teal-400 transition-colors duration-200 font-medium"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            العودة لتسجيل الدخول
          </button>
        </motion.div>
      </form>
    </motion.div>
  );
}

// ============================================================================
// Step 2: Support Contacts Display
// ============================================================================

function StepSupport({
  contacts,
  userName,
  userPhone,
  onBack,
}: {
  contacts: string[];
  userName: string;
  userPhone: string;
  onBack: () => void;
}) {
  return (
    <motion.div
      key="step-support"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-center mb-6"
      >
        <div
          className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3"
          style={{
            background:
              'linear-gradient(135deg, rgba(37,211,102,0.14) 0%, rgba(18,140,126,0.1) 100%)',
            border: '1px solid rgba(37,211,102,0.22)',
            boxShadow: '0 8px 24px -8px rgba(37,211,102,0.15)',
          }}
        >
          <MessageCircle className="w-7 h-7 text-[#25D366]" />
        </div>
        <h2 className="text-xl font-black text-white/90 mb-1">
          أرقام الدعم الفني
        </h2>
        <p className="text-[13px] text-white/35 leading-relaxed">
          تواصل مع أحد أرقام الدعم عبر واتساب لإعادة تعيين كلمة المرور
        </p>
      </motion.div>

      {/* User info summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        className="rounded-[14px] p-3.5 mb-5"
        style={{
          background: 'rgba(255,255,255,0.035)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(20,184,166,0.12)',
              border: '1px solid rgba(20,184,166,0.2)',
            }}
          >
            <User className="w-4 h-4 text-teal-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white/80 truncate">
              {userName}
            </p>
            <p className="text-[11px] text-white/35" dir="ltr">
              +967 {userPhone}
            </p>
          </div>
          <CheckCircle2 className="w-4 h-4 text-teal-400/60 shrink-0" />
        </div>
      </motion.div>

      {/* Support Cards */}
      {contacts.length > 0 ? (
        <div className="space-y-3 mb-6">
          {contacts.map((phone, index) => (
            <SupportCard
              key={index}
              index={index}
              phone={phone}
              userName={userName}
              userPhone={userPhone}
            />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          className="rounded-[14px] p-5 text-center mb-6"
          style={{
            background: 'rgba(255,255,255,0.035)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <AlertTriangle className="w-8 h-8 text-amber-400/50 mx-auto mb-3" />
          <p className="text-[13px] text-white/45 leading-relaxed">
            لا توجد أرقام دعم متاحة حالياً، يرجى المحاولة لاحقاً
          </p>
        </motion.div>
      )}

      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35 }}
      >
        <ActionButton variant="back" onClick={onBack}>
          <span className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            رجوع
          </span>
        </ActionButton>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Main Component: ForgotPasswordFlow
// ============================================================================

export function ForgotPasswordFlow({ onBack }: ForgotPasswordFlowProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportContacts, setSupportContacts] = useState<string[]>([]);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');

  const handleVerificationSubmit = useCallback(
    async (name: string, phone: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone }),
        });

        const data: ForgotPasswordResponse = await response.json();

        if (!response.ok || !data.success) {
          setError(
            data.error?.message || 'حدث خطأ أثناء التحقق من البيانات',
          );
          return;
        }

        // Extract support contacts from API response
        const apiContacts = data.data?.contacts || [];
        const validContacts = apiContacts
          .filter((c) => c.phone && c.phone.trim() !== '')
          .map((c) => c.phone);

        // Use server-returned user info if available, otherwise fall back to input
        const resolvedName = data.data?.userName || name;
        const resolvedPhone = data.data?.userPhone || phone;

        setSupportContacts(validContacts);
        setUserName(resolvedName);
        setUserPhone(resolvedPhone);
        setCurrentStep(2);
      } catch {
        setError('حدث خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const handleBackToStep1 = useCallback(() => {
    setCurrentStep(1);
    setError(null);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl w-full max-w-md mx-auto"
      style={{
        background:
          'linear-gradient(160deg, rgba(255,255,255,0.068) 0%, rgba(255,255,255,0.028) 100%)',
        backdropFilter: 'blur(36px) saturate(170%)',
        WebkitBackdropFilter: 'blur(36px) saturate(170%)',
        border: '1px solid rgba(255,255,255,0.11)',
        boxShadow:
          '0 44px 130px -22px rgba(0,0,0,0.78), inset 0 1px 0 rgba(255,255,255,0.13), inset 0 -1px 0 rgba(0,0,0,0.15)',
      }}
    >
      {/* Decorative gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(160deg, rgba(20,184,166,0.03) 0%, transparent 50%, rgba(37,211,102,0.02) 100%)',
        }}
      />

      {/* Inner top highlight line */}
      <div
        className="absolute top-0 inset-x-10 h-px rounded-full"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
        }}
      />

      {/* Floating particles */}
      <FloatingParticles />

      <div className="relative p-6 sm:p-8">
        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {currentStep === 1 ? (
            <StepVerification
              onSubmit={handleVerificationSubmit}
              isLoading={isLoading}
              error={error}
              onBack={onBack}
            />
          ) : (
            <StepSupport
              contacts={supportContacts}
              userName={userName}
              userPhone={userPhone}
              onBack={handleBackToStep1}
            />
          )}
        </AnimatePresence>

        {/* Bottom security indicator */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-white/20">
          <Shield className="w-3 h-3" />
          <span className="text-[10px]">بياناتك مشفرة ومحمية</span>
        </div>
      </div>
    </motion.div>
  );
}
