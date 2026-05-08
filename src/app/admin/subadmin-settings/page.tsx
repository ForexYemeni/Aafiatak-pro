'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserCog, Mail, Phone, Lock, MapPin, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
      <motion.div variants={itemAnim}>
        <PageHeader title="إعداداتي" description="إدارة حسابك الشخصي وإعداداتك" />
      </motion.div>

      {/* Profile Info Card */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              معلومات الحساب
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input value={user?.name || ''} disabled className="bg-muted/50" />
                <p className="text-[10px] text-muted-foreground">لا يمكن تغيير الاسم من هنا</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  البريد الإلكتروني
                </Label>
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  رقم الهاتف
                </Label>
                <Input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="967XXXXXXXX+"
                  dir="ltr"
                />
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Location Card - Single GPS field only */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
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
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Save Profile Button */}
      <motion.div variants={itemAnim} className="flex justify-end">
        <Button
          onClick={handleSaveProfile}
          disabled={isSavingProfile}
          className="bg-admin hover:bg-admin/90 gap-2 min-w-40"
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

      {/* Password Change Card */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              تغيير كلمة المرور
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>كلمة المرور الحالية</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="أدخل كلمة المرور الحالية"
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
                <Label>كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="أدخل كلمة المرور الجديدة"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>تأكيد كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                  <p className="text-xs text-destructive">كلمة المرور غير متطابقة</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleChangePassword}
                  disabled={isSavingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
                  className="gap-2"
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
