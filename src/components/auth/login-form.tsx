'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Phone, Lock, Eye, EyeOff, Heart, Shield, Stethoscope, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

  const RoleIcon = roleIconMap[selectedRole] ?? User;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn('glass rounded-2xl p-6 sm:p-8 w-full max-w-md mx-auto', className)}
    >
      {/* Logo / Brand */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
          className={cn(
            'w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center',
            selectedRole === 'admin' ? 'bg-admin/10 text-admin' :
            selectedRole === 'nurse' ? 'bg-nurse/10 text-nurse' :
            'bg-beneficiary/10 text-beneficiary'
          )}
        >
          <Heart className="w-8 h-8" />
        </motion.div>
        <h1 className="text-2xl font-bold mb-1">عافيتك</h1>
        <p className="text-sm text-muted-foreground">منصة الرعاية الصحية المنزلية</p>
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
        {/* Role Selector */}
        <div className="space-y-2">
          <Label>نوع الحساب</Label>
          <Select
            defaultValue="beneficiary"
            onValueChange={(value) => setValue('role', value as UserRole)}
          >
            <SelectTrigger className="text-right">
              <div className="flex items-center gap-2">
                <RoleIcon className="w-4 h-4" />
                <SelectValue placeholder="اختر نوع الحساب" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beneficiary">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-beneficiary" />
                  <span>مستفيد/ـة</span>
                </div>
              </SelectItem>
              <SelectItem value="nurse">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-nurse" />
                  <span>ممرض/ـة</span>
                </div>
              </SelectItem>
              <SelectItem value="admin">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-admin" />
                  <span>مدير</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {errors.role && (
            <p className="text-xs text-destructive">{errors.role.message}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">رقم الهاتف</Label>
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="phone"
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

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password"
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
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Remember Me */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            onCheckedChange={(checked) => setValue('rememberMe', checked === true)}
          />
          <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
            تذكرني
          </Label>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className={cn(
            'w-full',
            selectedRole === 'admin' ? 'bg-admin hover:bg-admin/90 text-admin-foreground' :
            selectedRole === 'nurse' ? 'bg-nurse hover:bg-nurse/90 text-nurse-foreground' :
            'bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground'
          )}
          disabled={isLoading}
        >
          {isLoading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
        </Button>
      </form>

      {/* Register Link */}
      {onRegisterClick && (
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            ليس لديك حساب؟{' '}
            <button
              type="button"
              onClick={onRegisterClick}
              className="text-primary font-medium hover:underline"
            >
              إنشاء حساب جديد
            </button>
          </p>
        </div>
      )}
    </motion.div>
  );
}
