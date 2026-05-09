'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserCog, Mail, Phone, Lock, MapPin, Save, Loader2, Eye, EyeOff,
  Shield, CheckCircle2, AlertCircle, Camera
} from 'lucide-react';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ProfileData {
  email: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function SubadminSettingsPage() {
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    email: '',
    phone: '',
    address: '',
    lat: null,
    lng: null,
  });

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength
  const getPasswordStrength = (password: string) => {
    if (!password) return { label: '', color: '', percent: 0 };
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 1) return { label: 'ضعيفة', color: 'bg-red-500', percent: 20 };
    if (strength <= 2) return { label: 'متوسطة', color: 'bg-amber-500', percent: 40 };
    if (strength <= 3) return { label: 'جيدة', color: 'bg-blue-500', percent: 60 };
    if (strength <= 4) return { label: 'قوية', color: 'bg-emerald-500', percent: 80 };
    return { label: 'قوية جداً', color: 'bg-green-500', percent: 100 };
  };

  const passwordStrength = getPasswordStrength(passwordForm.newPassword);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await authFetch('/api/subadmin/profile');
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setProfile({
            email: d.email || '',
            phone: d.phone || user?.phone || '',
            address: d.address || '',
            lat: d.lat ?? null,
            lng: d.lng ?? null,
          });
        }
      } catch {
        setProfile(prev => ({
          ...prev,
          phone: user?.phone || '',
        }));
      } finally {
        setIsLoading(false);
      }
    };
    void fetchProfile();
  }, [authFetch, user?.phone]);

  const handleSaveProfile = async () => {
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      toast.error('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    if (profile.phone && !/^[\d+]{9,15}$/.test(profile.phone.replace(/\s/g, ''))) {
      toast.error('يرجى إدخال رقم هاتف صحيح');
      return;
    }

    setIsSavingProfile(true);
    try {
      const payload: Record<string, unknown> = {
        email: profile.email || undefined,
        phone: profile.phone || undefined,
        address: profile.address || undefined,
        lat: profile.lat,
        lng: profile.lng,
      };

      const res = await authFetch('/api/subadmin/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تحديث الملف الشخصي بنجاح');
        if (json.data) {
          updateUser({
            phone: json.data.phone || profile.phone,
            name: json.data.name || user?.name,
          });
        }
      } else {
        toast.error(json.message ?? 'فشل تحديث الملف الشخصي');
      }
    } catch {
      toast.error('حدث خطأ أثناء التحديث');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      toast.error('يرجى إدخال كلمة المرور الحالية');
      return;
    }
    if (!passwordForm.newPassword) {
      toast.error('يرجى إدخال كلمة المرور الجديدة');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('كلمة المرور الجديدة غير متطابقة');
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await authFetch('/api/subadmin/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تغيير كلمة المرور بنجاح');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(json.message ?? 'فشل تغيير كلمة المرور');
      }
    } catch {
      toast.error('حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-admin" />
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemAnim}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-admin/20 to-admin/5 flex items-center justify-center border border-admin/20">
            <UserCog className="w-6 h-6 text-admin" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">الملف الشخصي</h2>
            <p className="text-muted-foreground text-sm">إدارة حسابك الشخصي وإعداداتك</p>
          </div>
        </div>
      </motion.div>

      {/* Profile Card - Professional Design */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-admin/10 flex items-center justify-center">
                <UserCog className="w-4 h-4 text-admin" />
              </div>
              معلومات الحساب
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-6">
              {/* User Avatar & Name - Hero Section */}
              <div className="flex items-center gap-4 p-4 glass rounded-2xl">
                <div className="relative">
                  <Avatar className="w-16 h-16 border-2 border-admin/30">
                    <AvatarFallback className="bg-admin/15 text-admin text-xl font-bold">
                      {user?.name?.slice(0, 2) || 'م'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-admin flex items-center justify-center border-2 border-background">
                    <Shield className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-lg font-bold">{user?.name || 'مدير فرعي'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="text-[10px] bg-admin/15 text-admin border-admin/20">
                      <Shield className="w-3 h-3 ml-1" />
                      مدير فرعي
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Form Fields */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">الاسم</Label>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border">
                  <span className="text-sm flex-1">{user?.name || 'غير محدد'}</span>
                  <Badge variant="secondary" className="text-[10px]">لا يمكن تغييره</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-500" />
                    البريد الإلكتروني
                  </Label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    placeholder="example@email.com"
                    dir="ltr"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-green-500" />
                    رقم الهاتف
                  </Label>
                  <Input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="967XXXXXXXX+"
                    dir="ltr"
                    className="bg-background/50"
                  />
                </div>
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Location Card */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              الموقع
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <GpsLocationButton
              onLocationDetected={(loc) => {
                setProfile(prev => ({
                  ...prev,
                  address: loc.address || prev.address,
                  lat: loc.latitude,
                  lng: loc.longitude,
                }));
              }}
              value={profile.address}
              placeholder='اضغط "تحديد موقعي" لرفع موقعك الجغرافي'
              label="تحديد موقعي"
            />
            {profile.lat && profile.lng && (
              <div className="flex items-center gap-2 mt-3 p-2 glass rounded-lg text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 text-red-500" />
                <span dir="ltr">{profile.lat.toFixed(4)}, {profile.lng.toFixed(4)}</span>
                <a
                  href={`https://www.google.com/maps?q=${profile.lat},${profile.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline mr-auto"
                >
                  عرض على الخريطة
                </a>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Save Profile Button */}
      <motion.div variants={itemAnim} className="flex justify-end">
        <Button
          onClick={handleSaveProfile}
          disabled={isSavingProfile}
          className="bg-admin hover:bg-admin/90 gap-2 min-w-40 shadow-lg shadow-admin/20"
          size="lg"
        >
          {isSavingProfile ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جارٍ الحفظ...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              حفظ التغييرات
            </>
          )}
        </Button>
      </motion.div>

      {/* Password Change Card - Professional */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              تغيير كلمة المرور
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">كلمة المرور الحالية</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="أدخل كلمة المرور الحالية"
                    className="bg-background/50 pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="أدخل كلمة المرور الجديدة"
                    className="bg-background/50 pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password Strength Indicator */}
                {passwordForm.newPassword && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">قوة كلمة المرور</span>
                      <span className={`text-[10px] font-medium ${
                        passwordStrength.percent >= 80 ? 'text-green-600' :
                        passwordStrength.percent >= 60 ? 'text-blue-600' :
                        passwordStrength.percent >= 40 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">تأكيد كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    className={`bg-background/50 pl-10 ${
                      passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword
                        ? 'border-red-300 focus:border-red-500'
                        : passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword
                        ? 'border-green-300 focus:border-green-500'
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {passwordForm.confirmPassword && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {passwordForm.newPassword === passwordForm.confirmPassword ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                  <p className="text-xs text-destructive">كلمة المرور غير متطابقة</p>
                )}
                {passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword && (
                  <p className="text-xs text-green-600">كلمة المرور متطابقة</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={isSavingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
                  className="gap-2 bg-admin hover:bg-admin/90"
                >
                  {isSavingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جارٍ التغيير...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      تغيير كلمة المرور
                    </>
                  )}
                </Button>
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
