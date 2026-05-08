'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  User,
  Phone,
  MapPin,
  Heart,
  Shield,
  Lock,
  Globe,
  Info,
  LogOut,
  Camera,
  Edit3,
  Loader2,
  ChevronLeft,
  AlertCircle,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GlassCard } from '@/components/common/glass-card';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import type { ApiResponse } from '@/types';

interface BeneficiaryProfile {
  name: string;
  phone: string;
  address: string | null;
  city: string | null;
  governorate: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodType: string | null;
  medicalConditions: string[];
  allergies: string[];
  loyaltyPoints: number;
  orderCount: number;
  totalSpent: number;
}

interface FavoriteNurse {
  id: string;
  name: string;
  rating: number;
  specialization: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { toast } = useToast();

  const [profile, setProfile] = useState<BeneficiaryProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [favoriteNurses, setFavoriteNurses] = useState<FavoriteNurse[]>([]);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Editable fields
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editGovernorate, setEditGovernorate] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editEmergencyRelation, setEditEmergencyRelation] = useState('');

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/beneficiary/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<BeneficiaryProfile> = await res.json();
      if (data.success && data.data) {
        setProfile(data.data);
        setEditName(data.data.name);
        setEditAddress(data.data.address ?? '');
        setEditGovernorate(data.data.governorate ?? '');
        setEditCity(data.data.city ?? '');
        setEditEmergencyName(data.data.emergencyContactName ?? '');
        setEditEmergencyPhone(data.data.emergencyContactPhone ?? '');
        setEditEmergencyRelation(data.data.emergencyContactRelation ?? '');
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const fetchFavorites = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/beneficiary/favorites', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<FavoriteNurse[]> = await res.json();
      if (data.success && data.data) {
        setFavoriteNurses(data.data);
      }
    } catch {
      // Error handled silently
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
    fetchFavorites();
  }, [fetchProfile, fetchFavorites]);

  const saveProfile = async () => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/beneficiary/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName,
          address: editAddress,
          governorate: editGovernorate || undefined,
          city: editCity || undefined,
          emergencyContactName: editEmergencyName,
          emergencyContactPhone: editEmergencyPhone,
          emergencyContactRelation: editEmergencyRelation,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'تم تحديث الملف الشخصي' });
        setIsEditing(false);
        fetchProfile();
      } else {
        toast({ title: 'فشل التحديث', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async () => {
    if (!token || !currentPassword || !newPassword) return;
    try {
      const res = await fetch('/api/beneficiary/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'تم تغيير كلمة المرور' });
        setCurrentPassword('');
        setNewPassword('');
        setShowPasswordForm(false);
      } else {
        toast({ title: data.message ?? 'فشل تغيير كلمة المرور', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    // logout() already handles state clearing, cookie clearing, and navigation
    logout();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-beneficiary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlassCard variant="beneficiary" className="text-center space-y-4 py-6">
          <div className="relative inline-block">
            <Avatar className="w-24 h-24 mx-auto">
              <AvatarFallback className="bg-beneficiary/10 text-beneficiary text-2xl">
                {profile?.name?.slice(0, 2) ?? user?.name?.slice(0, 2) ?? 'م'}
              </AvatarFallback>
            </Avatar>
            <button className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-beneficiary text-beneficiary-foreground flex items-center justify-center shadow-md">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h2 className="text-xl font-bold">{profile?.name ?? user?.name ?? 'مستفيد/ـة'}</h2>
            <p className="text-sm text-muted-foreground">{profile?.phone ?? user?.phone ?? ''}</p>
          </div>
          <div className="flex justify-center gap-6 text-center">
            <div>
              <p className="text-lg font-bold text-beneficiary">{profile?.orderCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">طلب</p>
            </div>
            <div>
              <p className="text-lg font-bold text-beneficiary">{profile?.loyaltyPoints ?? 0}</p>
              <p className="text-xs text-muted-foreground">نقطة</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Heart, label: 'نقاط الولاء', href: '/beneficiary/loyalty', color: 'text-beneficiary' },
          { icon: Shield, label: 'الإحالة', href: '/beneficiary/referral', color: 'text-green-600' },
          { icon: Info, label: 'المساعدة', href: '/beneficiary/help', color: 'text-blue-600' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.href}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push(item.href)}
              className="glass rounded-2xl p-4 flex flex-col items-center gap-2"
            >
              <Icon className={`w-5 h-5 ${item.color}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Personal Info */}
      <GlassCard variant="beneficiary" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-beneficiary" />
            المعلومات الشخصية
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-beneficiary"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {isEditing ? 'إلغاء' : 'تعديل'}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">الاسم</Label>
            {isEditing ? (
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            ) : (
              <p className="text-sm font-medium">{profile?.name ?? 'ـ'}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">رقم الهاتف</Label>
            <p className="text-sm font-medium" dir="ltr">{profile?.phone ?? 'ـ'}</p>
          </div>

          {/* GPS Auto-Detect Location - Single field */}
          {isEditing && (
            <GpsLocationButton
              onLocationDetected={(loc) => {
                setEditGovernorate(loc.governorate || editGovernorate);
                setEditCity(loc.district || loc.city || editCity);
                setEditAddress(loc.address || editAddress);
              }}
              value={editAddress}
              placeholder="اضغط لتحديد موقعك الجغرافي تلقائياً"
              label="تحديد موقعي"
            />
          )}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">العنوان</Label>
            {isEditing ? (
              <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            ) : (
              <p className="text-sm font-medium">{profile?.address ?? 'غير محدد'}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">المحافظة</Label>
            {isEditing ? (
              <Input value={editGovernorate} onChange={(e) => setEditGovernorate(e.target.value)} placeholder="المحافظة" />
            ) : (
              <p className="text-sm font-medium">{profile?.governorate ?? 'غير محدد'}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">المدينة</Label>
            {isEditing ? (
              <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="المدينة" />
            ) : (
              <p className="text-sm font-medium">{profile?.city ?? 'غير محدد'}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">فصيلة الدم</Label>
            <p className="text-sm font-medium">{profile?.bloodType ?? 'غير محدد'}</p>
          </div>
        </div>

        {isEditing && (
          <Button
            onClick={saveProfile}
            disabled={isSaving}
            className="w-full bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            حفظ التعديلات
          </Button>
        )}
      </GlassCard>

      {/* Emergency Contact */}
      <GlassCard variant="beneficiary" className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          جهة اتصال الطوارئ
        </h3>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">الاسم</Label>
            {isEditing ? (
              <Input value={editEmergencyName} onChange={(e) => setEditEmergencyName(e.target.value)} />
            ) : (
              <p className="text-sm font-medium">{profile?.emergencyContactName ?? 'غير محدد'}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">رقم الهاتف</Label>
            {isEditing ? (
              <Input value={editEmergencyPhone} onChange={(e) => setEditEmergencyPhone(e.target.value)} dir="ltr" />
            ) : (
              <p className="text-sm font-medium" dir="ltr">{profile?.emergencyContactPhone ?? 'غير محدد'}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">صلة القرابة</Label>
            {isEditing ? (
              <Input value={editEmergencyRelation} onChange={(e) => setEditEmergencyRelation(e.target.value)} />
            ) : (
              <p className="text-sm font-medium">{profile?.emergencyContactRelation ?? 'غير محدد'}</p>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Medical Notes */}
      <GlassCard variant="beneficiary" className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          ملاحظات طبية
        </h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">الحالات المرضية</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {profile?.medicalConditions && profile.medicalConditions.length > 0 ? (
                profile.medicalConditions.map((cond, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
                    {cond}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد</p>
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">الحساسية</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {profile?.allergies && profile.allergies.length > 0 ? (
                profile.allergies.map((allergy, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs">
                    {allergy}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد</p>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Favorite Nurses */}
      <GlassCard variant="beneficiary" className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" />
          الممرضون المفضلون
        </h3>
        {favoriteNurses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا يوجد ممرضون مفضلون بعد</p>
        ) : (
          <div className="space-y-2">
            {favoriteNurses.map((nurse) => (
              <div key={nurse.id} className="flex items-center gap-3 p-2 glass rounded-xl">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-beneficiary/10 text-beneficiary text-sm">
                    {nurse.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{nurse.name}</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                    <span className="text-xs">{nurse.rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Change Password */}
      <GlassCard variant="beneficiary" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4 text-beneficiary" />
            تغيير كلمة المرور
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPasswordForm(!showPasswordForm)}
          >
            {showPasswordForm ? 'إلغاء' : 'تغيير'}
          </Button>
        </div>
        {showPasswordForm && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>كلمة المرور الحالية</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>كلمة المرور الجديدة</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                dir="ltr"
              />
            </div>
            <Button
              onClick={changePassword}
              disabled={!currentPassword || !newPassword}
              className="w-full bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground"
            >
              تحديث كلمة المرور
            </Button>
          </div>
        )}
      </GlassCard>

      {/* Settings Links */}
      <GlassCard variant="beneficiary" className="space-y-1">
        {[
          { icon: Globe, label: 'إعدادات اللغة', desc: 'العربية', onClick: () => {} },
          { icon: Info, label: 'حول التطبيق', desc: 'الإصدار ١.٠.٠', onClick: () => router.push('/beneficiary/help') },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-accent transition-colors"
            >
              <Icon className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 text-right">
                <p className="text-sm font-medium">{item.label}</p>
              </div>
              <span className="text-xs text-muted-foreground">{item.desc}</span>
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          );
        })}
      </GlassCard>

      {/* Logout */}
      <Button
        variant="destructive"
        className="w-full gap-2"
        onClick={handleLogout}
      >
        <LogOut className="w-5 h-5" />
        تسجيل الخروج
      </Button>
    </div>
  );
}
