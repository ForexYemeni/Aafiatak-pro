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
  User,
  MapPin,
  ArrowRight,
  Heart,
  Users,
  FileText,
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

// ============================================================================
// Beneficiary Registration Form Component
// ============================================================================

interface RegisterBeneficiaryFormProps {
  onBack?: () => void;
  className?: string;
}

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
        <div className="w-14 h-14 rounded-2xl bg-beneficiary/10 text-beneficiary mx-auto mb-3 flex items-center justify-center">
          <Heart className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold">تسجيل مستفيد/ـة</h2>
        <p className="text-sm text-muted-foreground mt-1">
          أنشئ حسابك للحصول على خدمات الرعاية الصحية
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
          <Label htmlFor="ben-name">الاسم الكامل</Label>
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="ben-name"
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
          <Label htmlFor="ben-phone">رقم الهاتف</Label>
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="ben-phone"
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

        {/* Address + GPS Auto-Detect */}
        <div className="space-y-2">
          <Label htmlFor="ben-address">العنوان</Label>
          <GpsLocationButton
            onLocationDetected={(loc) => {
              if (loc.address && loc.address !== `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`) {
                setValue('address', loc.address);
              }
              if (loc.governorateValue) {
                setValue('governorate', loc.governorateValue);
              }
            }}
            placeholder="اضغط لتحديد موقعك الجغرافي تلقائياً"
            label="تحديد موقعي"
          />
          <div className="relative">
            <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="ben-address"
              placeholder="عنوانك التفصيلي"
              className="pr-10 text-right"
              {...register('address')}
            />
          </div>
          {errors.address && (
            <p className="text-xs text-destructive">{errors.address.message}</p>
          )}
        </div>

        {/* Governorate */}
        <div className="space-y-2">
          <Label>المحافظة</Label>
          <Select onValueChange={(value) => setValue('governorate', value)}>
            <SelectTrigger className="text-right">
              <MapPin className="w-4 h-4 text-muted-foreground ml-2" />
              <SelectValue placeholder="اختر المحافظة" />
            </SelectTrigger>
            <SelectContent>
              {YEMEN_GOVERNORATES.map((gov) => (
                <SelectItem key={gov.value} value={gov.value}>
                  {gov.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Emergency Contact Name */}
        <div className="space-y-2">
          <Label htmlFor="ben-emergency-name">اسم جهة الاتصال للطوارئ</Label>
          <div className="relative">
            <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="ben-emergency-name"
              placeholder="اسم شخص للطوارئ"
              className="pr-10 text-right"
              {...register('emergencyContactName')}
            />
          </div>
        </div>

        {/* Emergency Contact Phone */}
        <div className="space-y-2">
          <Label htmlFor="ben-emergency-phone">هاتف جهة الاتصال للطوارئ</Label>
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="ben-emergency-phone"
              type="tel"
              placeholder="7XXXXXXXX"
              className="pr-10 text-right"
              dir="ltr"
              {...register('emergencyContactPhone')}
            />
          </div>
        </div>

        {/* Referral Code */}
        <div className="space-y-2">
          <Label htmlFor="ben-referral">كود الإحالة (اختياري)</Label>
          <div className="relative">
            <FileText className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="ben-referral"
              placeholder="AF-XXXXXX"
              className="pr-10 text-right"
              dir="ltr"
              {...register('referralCode')}
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="ben-password">كلمة المرور</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="ben-password"
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
          <Label htmlFor="ben-confirm-password">تأكيد كلمة المرور</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="ben-confirm-password"
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
          className="w-full bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground"
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
