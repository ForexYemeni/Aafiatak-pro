'use client';

import { useState, useEffect, Suspense } from 'react';
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
  MapPin,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useForm, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

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
// Specialization options
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
// Feature Cards Data
// ============================================================================

const features = [
  { icon: Stethoscope, title: 'ممرضون معتمدون', description: 'ممرضون مرخصون ومعتمدون', color: 'text-sky-500' },
  { icon: Heart, title: 'رعاية منزلية', description: 'خدمات صحية في منزلك', color: 'text-purple-500' },
  { icon: Shield, title: 'طوارئ ٢٤/٧', description: 'خدمة طوارئ على مدار الساعة', color: 'text-red-500' },
  { icon: MapPin, title: 'تغطية واسعة', description: 'خدمات في جميع المحافظات', color: 'text-emerald-500' },
];

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
// Password Field Component (declared OUTSIDE render to avoid lint error)
// ============================================================================

interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
  registerObj: UseFormRegister<Record<string, unknown>>;
  name: string;
  error?: { message?: string };
}

function PasswordField({ id, label, placeholder, show, onToggle, registerObj, name, error }: PasswordFieldProps) {
  const registration = registerObj(name);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          className="pr-10 pl-10 text-right h-11"
          dir="ltr"
          {...registration}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error?.message && <p className="text-xs text-destructive">{error.message}</p>}
    </div>
  );
}

// ============================================================================
// Main Login Page Component
// ============================================================================

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');

  const { login, registerNurse, registerBeneficiary, isAuthenticated, user, isLoading, error, clearError } =
    useAuthStore();

  const [activeTab, setActiveTab] = useState<string>('login');
  const [registerRole, setRegisterRole] = useState<string>('beneficiary');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginRole, setLoginRole] = useState<UserRole>('beneficiary');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const destination = redirectPath ?? getDashboardPath(user.role);
      router.replace(destination);
    }
  }, [isAuthenticated, user, router, redirectPath]);

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
    <div className="login-bg min-h-screen flex flex-col relative overflow-hidden" dir="rtl" lang="ar">
      {/* Animated Background Blobs */}
      <div className="login-bg-blob w-72 h-72 bg-purple-400 top-10 -right-20" />
      <div className="login-bg-blob w-96 h-96 bg-sky-400 -bottom-20 -left-32" />
      <div className="login-bg-blob w-64 h-64 bg-emerald-400 bottom-1/3 right-1/4" />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Logo & Brand */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className={cn(
                'w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg',
                'bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700',
                'dark:from-purple-600 dark:via-purple-700 dark:to-purple-800'
              )}
            >
              <Heart className="w-10 h-10 text-white" fill="currentColor" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold bg-gradient-to-l from-purple-600 via-purple-500 to-sky-500 bg-clip-text text-transparent"
            >
              عافيتك
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-sm text-muted-foreground mt-1"
            >
              منصة الرعاية الصحية المنزلية في اليمن
            </motion.p>
          </div>

          {/* Feature Cards - Desktop */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="hidden sm:grid grid-cols-4 gap-3 mb-6"
          >
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="glass rounded-xl p-3 text-center"
              >
                <feature.icon className={cn('w-5 h-5 mx-auto mb-1', feature.color)} />
                <p className="text-xs font-medium">{feature.title}</p>
                <p className="text-[10px] text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Main Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="glass-strong rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Tabs */}
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

              {/* Login Tab */}
              <TabsContent value="login" className="p-6 pt-4 mt-0">
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  {/* Role Quick Select */}
                  <div className="space-y-2">
                    <Label>نوع الحساب</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: 'beneficiary', label: 'مستفيد', icon: User, color: 'beneficiary' },
                        { value: 'nurse', label: 'ممرض/ـة', icon: Stethoscope, color: 'nurse' },
                        { value: 'admin', label: 'مدير', icon: Shield, color: 'admin' },
                      ] as const).map((role) => (
                        <motion.button
                          key={role.value}
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setLoginRole(role.value as UserRole)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all',
                            loginRole === role.value
                              ? `border-${role.color} bg-${role.color}/10 text-${role.color}`
                              : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                          )}
                        >
                          <role.icon className="w-5 h-5" />
                          <span className="text-xs font-medium">{role.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="login-phone">رقم الهاتف</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login-phone"
                        type="tel"
                        placeholder="7XXXXXXXX"
                        className="pr-10 text-right h-11"
                        dir="ltr"
                        {...loginForm.register('phone')}
                      />
                    </div>
                    {loginForm.formState.errors.phone && (
                      <p className="text-xs text-destructive">{loginForm.formState.errors.phone.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="login-password">كلمة المرور</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••"
                        className="pr-10 pl-10 text-right h-11"
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
                      <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox id="remember" />
                      <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                        تذكرني
                      </Label>
                    </div>
                    <button type="button" className="text-xs text-purple-600 dark:text-purple-400 hover:underline">
                      نسيت كلمة المرور؟
                    </button>
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    className={cn(
                      'w-full h-12 text-base font-semibold transition-all',
                      loginRole === 'admin' ? 'bg-admin hover:bg-admin/90 text-admin-foreground' :
                      loginRole === 'nurse' ? 'bg-nurse hover:bg-nurse/90 text-nurse-foreground' :
                      'bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground'
                    )}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        تسجيل الدخول
                        <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Demo Login Hint */}
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-[11px] text-muted-foreground text-center">
                    للتجربة: أدخل أي رقم هاتف وكلمة مرور (٦ أحرف على الأقل)
                  </p>
                </div>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register" className="p-6 pt-4 mt-0">
                {/* Register Role Tabs */}
                <div className="space-y-4 mb-4">
                  <Label>نوع الحساب</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setRegisterRole('beneficiary'); clearError(); }}
                      className={cn(
                        'flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all',
                        registerRole === 'beneficiary'
                          ? 'border-beneficiary bg-beneficiary/10 text-beneficiary'
                          : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <User className="w-4 h-4" />
                      <span className="text-sm font-medium">مستفيد</span>
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setRegisterRole('nurse'); clearError(); }}
                      className={cn(
                        'flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all',
                        registerRole === 'nurse'
                          ? 'border-nurse bg-nurse/10 text-nurse'
                          : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Stethoscope className="w-4 h-4" />
                      <span className="text-sm font-medium">ممرض/ـة</span>
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
                      className="space-y-3"
                    >
                      {/* Name */}
                      <div className="space-y-2">
                        <Label htmlFor="ben-name">الاسم الكامل</Label>
                        <div className="relative">
                          <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="ben-name"
                            placeholder="الاسم الكامل"
                            className="pr-10 text-right h-11"
                            {...beneficiaryForm.register('name')}
                          />
                        </div>
                        {beneficiaryForm.formState.errors.name && (
                          <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.name.message}</p>
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
                            className="pr-10 text-right h-11"
                            dir="ltr"
                            {...beneficiaryForm.register('phone')}
                          />
                        </div>
                        {beneficiaryForm.formState.errors.phone && (
                          <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.phone.message}</p>
                        )}
                      </div>

                      {/* Address */}
                      <div className="space-y-2">
                        <Label htmlFor="ben-address">العنوان</Label>
                        <div className="relative">
                          <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="ben-address"
                            placeholder="عنوانك التفصيلي"
                            className="pr-10 text-right h-11"
                            {...beneficiaryForm.register('address')}
                          />
                        </div>
                        {beneficiaryForm.formState.errors.address && (
                          <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.address.message}</p>
                        )}
                      </div>

                      {/* Governorate */}
                      <div className="space-y-2">
                        <Label>المحافظة</Label>
                        <Select onValueChange={(v) => beneficiaryForm.setValue('governorate', v)}>
                          <SelectTrigger className="h-11">
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

                      {/* Referral Code */}
                      <div className="space-y-2">
                        <Label htmlFor="ben-referral">كود الإحالة (اختياري)</Label>
                        <Input
                          id="ben-referral"
                          placeholder="AF-XXXXXX"
                          className="text-right h-11"
                          dir="ltr"
                          {...beneficiaryForm.register('referralCode')}
                        />
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
                            className="pr-10 pl-10 text-right h-11"
                            dir="ltr"
                            {...beneficiaryForm.register('password')}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {beneficiaryForm.formState.errors.password && (
                          <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.password.message}</p>
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
                            className="pr-10 pl-10 text-right h-11"
                            dir="ltr"
                            {...beneficiaryForm.register('confirmPassword')}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {beneficiaryForm.formState.errors.confirmPassword && (
                          <p className="text-xs text-destructive">{beneficiaryForm.formState.errors.confirmPassword.message}</p>
                        )}
                      </div>

                      {/* Submit */}
                      <Button
                        type="submit"
                        className="w-full h-12 text-base font-semibold bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5 ml-2" />
                            إنشاء حساب مستفيد
                          </>
                        )}
                      </Button>
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
                      className="space-y-3"
                    >
                      {/* Name */}
                      <div className="space-y-2">
                        <Label htmlFor="nurse-name">الاسم الكامل</Label>
                        <div className="relative">
                          <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="nurse-name"
                            placeholder="الاسم الكامل"
                            className="pr-10 text-right h-11"
                            {...nurseForm.register('name')}
                          />
                        </div>
                        {nurseForm.formState.errors.name && (
                          <p className="text-xs text-destructive">{nurseForm.formState.errors.name.message}</p>
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
                            className="pr-10 text-right h-11"
                            dir="ltr"
                            {...nurseForm.register('phone')}
                          />
                        </div>
                        {nurseForm.formState.errors.phone && (
                          <p className="text-xs text-destructive">{nurseForm.formState.errors.phone.message}</p>
                        )}
                      </div>

                      {/* Specialization */}
                      <div className="space-y-2">
                        <Label>التخصص</Label>
                        <Select onValueChange={(v) => nurseForm.setValue('specialization', v)}>
                          <SelectTrigger className="h-11">
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
                        {nurseForm.formState.errors.specialization && (
                          <p className="text-xs text-destructive">{nurseForm.formState.errors.specialization.message}</p>
                        )}
                      </div>

                      {/* License Number */}
                      <div className="space-y-2">
                        <Label htmlFor="nurse-license">رقم الترخيص</Label>
                        <Input
                          id="nurse-license"
                          placeholder="رقم ترخيص المهنة"
                          className="text-right h-11"
                          {...nurseForm.register('licenseNumber')}
                        />
                        {nurseForm.formState.errors.licenseNumber && (
                          <p className="text-xs text-destructive">{nurseForm.formState.errors.licenseNumber.message}</p>
                        )}
                      </div>

                      {/* Governorate */}
                      <div className="space-y-2">
                        <Label>المحافظة</Label>
                        <Select onValueChange={(v) => nurseForm.setValue('governorate', v)}>
                          <SelectTrigger className="h-11">
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

                      {/* Password */}
                      <div className="space-y-2">
                        <Label htmlFor="nurse-password">كلمة المرور</Label>
                        <div className="relative">
                          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="nurse-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••"
                            className="pr-10 pl-10 text-right h-11"
                            dir="ltr"
                            {...nurseForm.register('password')}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {nurseForm.formState.errors.password && (
                          <p className="text-xs text-destructive">{nurseForm.formState.errors.password.message}</p>
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
                            className="pr-10 pl-10 text-right h-11"
                            dir="ltr"
                            {...nurseForm.register('confirmPassword')}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {nurseForm.formState.errors.confirmPassword && (
                          <p className="text-xs text-destructive">{nurseForm.formState.errors.confirmPassword.message}</p>
                        )}
                      </div>

                      {/* Submit */}
                      <Button
                        type="submit"
                        className="w-full h-12 text-base font-semibold bg-nurse hover:bg-nurse/90 text-nurse-foreground"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5 ml-2" />
                            إنشاء حساب ممرض/ـة
                          </>
                        )}
                      </Button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* Bottom Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center"
          >
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" />
              منصة عافيتك للرعاية الصحية المنزلية • صنعاء، اليمن
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-sky-50" dir="rtl">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
