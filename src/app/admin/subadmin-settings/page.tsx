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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { YEMEN_GOVERNORATES } from '@/lib/constants/governorates';

interface ProfileData {
  email: string;
  phone: string;
  governorate: string;
  district: string;
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
    governorate: '',
    district: '',
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

  // Lat/Lng inputs as string for easier input handling
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');

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
            governorate: d.governorate || '',
            district: d.district || '',
            address: d.address || '',
            lat: d.lat ?? null,
            lng: d.lng ?? null,
          });
          if (d.lat != null) setLatStr(String(d.lat));
          if (d.lng != null) setLngStr(String(d.lng));
        }
      } catch {
        // If API fails, use current user data
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
    // Validate email if provided
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      toast.error('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    // Validate phone
    if (profile.phone && !/^[\d+]{9,15}$/.test(profile.phone.replace(/\s/g, ''))) {
      toast.error('يرجى إدخال رقم هاتف صحيح');
      return;
    }

    setIsSavingProfile(true);
    try {
      const lat = latStr ? parseFloat(latStr) : null;
      const lng = lngStr ? parseFloat(lngStr) : null;

      const payload: Record<string, unknown> = {
        email: profile.email || undefined,
        phone: profile.phone || undefined,
        governorate: profile.governorate || undefined,
        district: profile.district || undefined,
        address: profile.address || undefined,
        lat: isNaN(lat as number) ? null : lat,
        lng: isNaN(lng as number) ? null : lng,
      };

      const res = await authFetch('/api/subadmin/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تحديث الملف الشخصي بنجاح');
        // Update auth store with new data
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
              {/* Name (read-only) */}
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input value={user?.name || ''} disabled className="bg-muted/50" />
                <p className="text-[10px] text-muted-foreground">لا يمكن تغيير الاسم من هنا</p>
              </div>

              <Separator />

              {/* Email */}
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

              {/* Phone */}
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

      {/* Location Card */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              الموقع
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-4">
              {/* GPS Auto-Detect Location - Single field with button */}
              <GpsLocationButton
                onLocationDetected={(loc) => {
                  setProfile(prev => ({
                    ...prev,
                    governorate: loc.governorateValue || loc.governorate,
                    district: loc.district || prev.district,
                    address: loc.address || prev.address,
                    lat: loc.latitude,
                    lng: loc.longitude,
                  }));
                  setLatStr(String(loc.latitude));
                  setLngStr(String(loc.longitude));
                }}
                value={profile.address}
                placeholder="اضغط لتحديد موقعك الجغرافي تلقائياً"
                label="تحديد موقعي"
                showMapLink={!!(latStr && lngStr)}
              />

              {/* Governorate + District in one row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المحافظة</Label>
                  <Select
                    value={profile.governorate}
                    onValueChange={(v) => setProfile({ ...profile, governorate: v, district: '' })}
                  >
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label>المديرية</Label>
                  <Input
                    value={profile.district}
                    onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                    placeholder="أدخل اسم المديرية"
                  />
                </div>
              </div>
            </div>
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
              {/* Current Password */}
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

              {/* New Password */}
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

              {/* Confirm Password */}
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
