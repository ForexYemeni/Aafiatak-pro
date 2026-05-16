'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  Droplets,
  Gift,
  Users,
  HelpCircle,
  Sparkles,
  Wallet,
  Activity,
  Bug,
  Stethoscope,
  Eye,
  EyeOff,
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
import { toArabicNumerals } from '@/components/common/currency';
import type { ApiResponse } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
} as const;

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
} as const;

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
} as const;

// Medical condition color map
const conditionColors: Record<string, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  default: { bg: 'bg-red-50 dark:bg-red-900/15', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800/30', icon: Activity },
};

const allergyColors: Record<string, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  default: { bg: 'bg-orange-50 dark:bg-orange-900/15', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800/30', icon: Bug },
};

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
  const [editBloodType, setEditBloodType] = useState('');

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
        setEditBloodType(data.data.bloodType ?? '');
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
          bloodType: editBloodType || undefined,
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
    <motion.div
      className="space-y-5"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ═══════════════════════════════════════════ */}
      {/* Profile Header with Gradient Banner          */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={staggerItem}>
        <GlassCard variant="beneficiary" className="overflow-hidden p-0">
          {/* Gradient Banner */}
          <div className="relative h-28 bg-gradient-to-l from-beneficiary via-purple-500 to-pink-500 overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute top-4 left-12 w-8 h-8 rounded-full bg-white/5" />
          </div>

          {/* Avatar overlapping banner */}
          <div className="relative px-5 -mt-14 pb-5">
            <div className="relative inline-block">
              <Avatar className="w-24 h-24 ring-4 ring-background shadow-xl">
                <AvatarFallback className="bg-beneficiary/20 text-beneficiary text-2xl font-bold">
                  {profile?.name?.slice(0, 2) ?? user?.name?.slice(0, 2) ?? 'م'}
                </AvatarFallback>
              </Avatar>
              <button className="absolute bottom-1 left-1 w-8 h-8 rounded-full bg-beneficiary text-beneficiary-foreground flex items-center justify-center shadow-md hover:bg-beneficiary/90 transition-colors">
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3">
              <h2 className="text-xl font-bold">{profile?.name ?? user?.name ?? 'مستفيد/ـة'}</h2>
              <p className="text-sm text-muted-foreground mt-0.5" dir="ltr">{profile?.phone ?? user?.phone ?? ''}</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'الطلبات', value: profile?.orderCount ?? 0, icon: Stethoscope, color: 'from-beneficiary to-purple-600' },
                { label: 'النقاط', value: profile?.loyaltyPoints ?? 0, icon: Sparkles, color: 'from-amber-500 to-orange-500' },
                { label: 'المصروف', value: profile?.totalSpent ?? 0, icon: Wallet, color: 'from-emerald-500 to-green-600' },
              ].map((stat, i) => {
                const StatIcon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.1, duration: 0.3, ease: 'easeOut' as const }}
                    className="text-center p-2.5 rounded-xl bg-muted/40 dark:bg-muted/15"
                  >
                    <div className={`w-8 h-8 mx-auto rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-1.5 shadow-sm`}>
                      <StatIcon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-base font-bold">
                      {stat.label === 'المصروف'
                        ? `${toArabicNumerals(stat.value)} ر.ي`
                        : toArabicNumerals(stat.value)
                      }
                    </p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* Quick Actions Grid with Gradient Icons       */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={staggerItem}>
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { icon: Gift, label: 'نقاط الولاء', href: '/beneficiary/loyalty', gradient: 'from-beneficiary to-purple-600' },
            { icon: Users, label: 'الإحالة', href: '/beneficiary/referral', gradient: 'from-emerald-500 to-green-600' },
            { icon: HelpCircle, label: 'المساعدة', href: '/beneficiary/help', gradient: 'from-sky-500 to-blue-600' },
            { icon: Heart, label: 'المفضلة', href: '/beneficiary/orders', gradient: 'from-rose-500 to-pink-600' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.href + item.label}
                whileTap={{ scale: 0.93 }}
                onClick={() => router.push(item.href)}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl glass-beneficiary hover:shadow-md transition-all"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-sm`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-medium text-center leading-tight">{item.label}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* Personal Info                                */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={staggerItem}>
        <GlassCard variant="beneficiary" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-beneficiary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-beneficiary" />
              </div>
              المعلومات الشخصية
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1 rounded-lg ${isEditing ? 'text-destructive' : 'text-beneficiary'}`}
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
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-xl" />
              ) : (
                <p className="text-sm font-medium">{profile?.name ?? 'ـ'}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">رقم الهاتف</Label>
              <p className="text-sm font-medium" dir="ltr">{profile?.phone ?? 'ـ'}</p>
            </div>

            {/* GPS Auto-Detect Location */}
            {isEditing && (
              <GpsLocationButton
                onLocationDetected={(loc) => {
                  if (loc.governorate) setEditGovernorate(loc.governorate);
                  if (loc.district || loc.city) setEditCity(loc.district || loc.city || editCity);
                  // Accept any address — coordinates initially, then enriched address via callback
                  if (loc.address) setEditAddress(loc.address);
                }}
                value={editAddress}
                placeholder='اضغط "تحديد موقعي" لرفع موقعك الجغرافي'
                label="تحديد موقعي"
              />
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">العنوان</Label>
              {isEditing ? (
                <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="rounded-xl" />
              ) : (
                <p className="text-sm font-medium">{profile?.address ?? 'غير محدد'}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">فصيلة الدم</Label>
              {isEditing ? (
                <Select value={editBloodType} onValueChange={setEditBloodType}>
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue placeholder="اختر فصيلة الدم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm font-medium flex items-center gap-1.5">
                  {profile?.bloodType ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-800/30">
                      <Droplets className="w-3.5 h-3.5" />
                      {profile.bloodType}
                    </span>
                  ) : (
                    'غير محدد'
                  )}
                </p>
              )}
            </div>
          </div>

          <AnimatePresence>
            {isEditing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Button
                  onClick={saveProfile}
                  disabled={isSaving}
                  className="w-full bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground gap-2 rounded-xl"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  حفظ التعديلات
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* Emergency Contact                            */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={staggerItem}>
        <GlassCard variant="beneficiary" className="space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            جهة اتصال الطوارئ
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">الاسم</Label>
              {isEditing ? (
                <Input value={editEmergencyName} onChange={(e) => setEditEmergencyName(e.target.value)} className="rounded-xl" />
              ) : (
                <p className="text-sm font-medium">{profile?.emergencyContactName ?? 'غير محدد'}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">رقم الهاتف</Label>
              {isEditing ? (
                <Input value={editEmergencyPhone} onChange={(e) => setEditEmergencyPhone(e.target.value)} dir="ltr" className="rounded-xl" />
              ) : (
                <p className="text-sm font-medium" dir="ltr">{profile?.emergencyContactPhone ?? 'غير محدد'}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">صلة القرابة</Label>
              {isEditing ? (
                <Input value={editEmergencyRelation} onChange={(e) => setEditEmergencyRelation(e.target.value)} className="rounded-xl" />
              ) : (
                <p className="text-sm font-medium">{profile?.emergencyContactRelation ?? 'غير محدد'}</p>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* Medical Notes with Colored Tag Chips         */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={staggerItem}>
        <GlassCard variant="beneficiary" className="space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Heart className="w-4 h-4 text-red-500" />
            </div>
            ملاحظات طبية
          </h3>
          <div className="space-y-4">
            {/* Medical Conditions */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                <Activity className="w-3 h-3 text-red-500" />
                الحالات المرضية
              </Label>
              <div className="flex flex-wrap gap-2">
                {profile?.medicalConditions && profile.medicalConditions.length > 0 ? (
                  profile.medicalConditions.map((cond, i) => (
                    <motion.span
                      key={i}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/30"
                    >
                      <Activity className="w-3 h-3" />
                      {cond}
                    </motion.span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-xl text-xs">لا توجد حالات مسجلة</span>
                )}
              </div>
            </div>

            {/* Allergies */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                <Bug className="w-3 h-3 text-orange-500" />
                الحساسية
              </Label>
              <div className="flex flex-wrap gap-2">
                {profile?.allergies && profile.allergies.length > 0 ? (
                  profile.allergies.map((allergy, i) => (
                    <motion.span
                      key={i}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-orange-50 dark:bg-orange-900/15 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/30"
                    >
                      <Bug className="w-3 h-3" />
                      {allergy}
                    </motion.span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-xl text-xs">لا توجد حساسية مسجلة</span>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* Favorite Nurses Horizontal Scroll             */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={staggerItem}>
        <GlassCard variant="beneficiary" className="space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Star className="w-4 h-4 text-yellow-500" />
            </div>
            الممرضون المفضلون
          </h3>
          {favoriteNurses.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                <Heart className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">لا يوجد ممرضون مفضلون بعد</p>
              <p className="text-xs text-muted-foreground mt-1">سيظهر هنا الممرضون الذين تقيّمهم بشكل إيجابي</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
              {favoriteNurses.map((nurse, i) => (
                <motion.div
                  key={nurse.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.35, ease: 'easeOut' as const }}
                  className="shrink-0 w-[140px]"
                >
                  <div className="p-3 rounded-2xl glass-beneficiary text-center space-y-2 hover:shadow-md transition-all">
                    <Avatar className="w-12 h-12 mx-auto ring-2 ring-beneficiary/20">
                      <AvatarFallback className="bg-beneficiary/10 text-beneficiary text-sm font-bold">
                        {nurse.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-semibold truncate">{nurse.name}</p>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        <span className="text-[11px] font-bold">{toArabicNumerals(nurse.rating.toFixed(1))}</span>
                      </div>
                      {nurse.specialization && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{nurse.specialization}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* Change Password                              */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={staggerItem}>
        <GlassCard variant="beneficiary" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-beneficiary/10 flex items-center justify-center">
                <Lock className="w-4 h-4 text-beneficiary" />
              </div>
              تغيير كلمة المرور
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="rounded-lg"
            >
              {showPasswordForm ? 'إلغاء' : 'تغيير'}
            </Button>
          </div>
          <AnimatePresence>
            {showPasswordForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div className="space-y-1">
                  <Label>كلمة المرور الحالية</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    dir="ltr"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label>كلمة المرور الجديدة</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    dir="ltr"
                    className="rounded-xl"
                  />
                </div>
                <Button
                  onClick={changePassword}
                  disabled={!currentPassword || !newPassword}
                  className="w-full bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground rounded-xl"
                >
                  تحديث كلمة المرور
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* Settings Links                               */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={staggerItem}>
        <GlassCard variant="beneficiary" className="space-y-1 p-0 overflow-hidden">
          {[
            { icon: Globe, label: 'إعدادات اللغة', desc: 'العربية', onClick: () => {} },
            { icon: Info, label: 'حول التطبيق', desc: 'الإصدار ١.٠.٠', onClick: () => router.push('/beneficiary/help') },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="flex items-center gap-3 w-full p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-medium">{item.label}</p>
                </div>
                <span className="text-xs text-muted-foreground">{item.desc}</span>
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
            );
          })}
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* Logout Button                                */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={staggerItem}>
        <Button
          variant="destructive"
          className="w-full gap-2 rounded-xl"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </Button>
      </motion.div>
    </motion.div>
  );
}
