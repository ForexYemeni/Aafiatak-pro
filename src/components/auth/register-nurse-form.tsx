'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Phone,
  Lock,
  Eye,
  EyeOff,
  Stethoscope,
  User,
  CreditCard,
  MapPin,
  ArrowRight,
} from 'lucide-react';
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

// ============================================================================
// Validation Schema
// ============================================================================

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

// ============================================================================
// Nurse Registration Form Component
// ============================================================================

interface RegisterNurseFormProps {
  onBack?: () => void;
  className?: string;
}

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

export function RegisterNurseForm({ onBack, className }: RegisterNurseFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const registerNurse = useAuthStore((s) => s.registerNurse);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const {
    register,
    handleSubmit,
    setValue,
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

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className={cn('glass rounded-2xl p-6 sm:p-8 w-full max-w-md mx-auto', className)}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-nurse/10 text-nurse mx-auto mb-3 flex items-center justify-center">
          <Stethoscope className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold">تسجيل ممرض/ـة</h2>
        <p className="text-sm text-muted-foreground mt-1">
          أنشئ حسابك كممرض/ـة معتمد/ـة
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-destructive/10 text-destructive text-sm rounded-xl p-3 mb-4"
        >
          {error}
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="nurse-name">الاسم الكامل</Label>
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="nurse-name"
              placeholder="الاسم الكامل"
              className="pr-10 text-right"
              {...register('name')}
            />
          </div>
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="nurse-phone">رقم الهاتف</Label>
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="nurse-phone"
              type="tel"
              placeholder="7XXXXXXXX"
              className="pr-10 text-right"
              dir="ltr"
              {...register('phone')}
            />
          </div>
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>

        {/* Specialization */}
        <div className="space-y-2">
          <Label>التخصص</Label>
          <Select onValueChange={(value) => setValue('specialization', value)}>
            <SelectTrigger className="text-right">
              <SelectValue placeholder="اختر التخصص" />
            </SelectTrigger>
            <SelectContent>
              {specializations.map((spec) => (
                <SelectItem key={spec.value} value={spec.value}>
                  {spec.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.specialization && (
            <p className="text-xs text-destructive">{errors.specialization.message}</p>
          )}
        </div>

        {/* License Number */}
        <div className="space-y-2">
          <Label htmlFor="nurse-license">رقم الترخيص</Label>
          <div className="relative">
            <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="nurse-license"
              placeholder="رقم ترخيص المهنة"
              className="pr-10 text-right"
              {...register('licenseNumber')}
            />
          </div>
          {errors.licenseNumber && (
            <p className="text-xs text-destructive">{errors.licenseNumber.message}</p>
          )}
        </div>

        {/* Location - GPS Auto-Detect */}
        <div className="space-y-2">
          <Label>الموقع</Label>
          <GpsLocationButton
            onLocationDetected={(loc) => {
              if (loc.governorateValue) {
                setValue('governorate', loc.governorateValue);
              }
            }}
            placeholder='اضغط "تحديد موقعي" لرفع موقعك الجغرافي'
            label="تحديد موقعي"
          />
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="nurse-password">كلمة المرور</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="nurse-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••"
              className="pr-10 pl-10 text-right"
              dir="ltr"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="nurse-confirm-password">تأكيد كلمة المرور</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="nurse-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="••••••"
              className="pr-10 pl-10 text-right"
              dir="ltr"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full bg-nurse hover:bg-nurse/90 text-nurse-foreground"
          disabled={isLoading}
        >
          {isLoading ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب'}
        </Button>
      </form>

      {/* Back to Login */}
      {onBack && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 justify-center transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            العودة لتسجيل الدخول
          </button>
        </div>
      )}
    </motion.div>
  );
}
