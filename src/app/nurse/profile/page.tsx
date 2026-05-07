'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Phone,
  FileText,
  Shield,
  Camera,
  Edit3,
  Save,
  Lock,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GlassCard } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toArabicNum } from '@/components/common/date-formatter';
import Link from 'next/link';

// ---- Types ----

interface NurseProfile {
  id: string;
  name: string;
  phone: string;
  specialization: string[];
  licenseNumber: string | null;
  verificationStatus: string;
  isAvailable: boolean;
  isOnline: boolean;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  totalEarnings: number;
  availableBalance: number;
  bio: string | null;
  nationalId: string | null;
  address: string | null;
  city: string | null;
  governorate: string | null;
  experience: number;
  identityDocumentUrl: string | null;
  licenseDocumentUrl: string | null;
  rejectedReason: string | null;
  documents: Array<{
    id: string;
    type: string;
    url: string;
    status: string;
  }>;
}

// ---- Specialization labels ----

const specializationLabels: Record<string, string> = {
  general_nursing: 'تمريض عام',
  critical_care: 'رعاية حرجة',
  pediatric: 'تمريض أطفال',
  elderly_care: 'رعاية المسنين',
  physiotherapy: 'علاج طبيعي',
  wound_care: 'عناية بالجروح',
  iv_therapy: 'علاج وريدي',
  mental_health: 'صحة نفسية',
  post_surgery: 'رعاية ما بعد الجراحة',
  emergency: 'طوارئ',
};

// ---- Component ----

export default function NurseProfilePage() {
  const [profile, setProfile] = useState<NurseProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editGovernorate, setEditGovernorate] = useState('');
  const [editExperience, setEditExperience] = useState('');

  // Document upload state
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [identityPreview, setIdentityPreview] = useState<string | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  const authFetch = useAuthFetch();
  const updateUser = useAuthStore((s) => s.updateUser);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await authFetch('/api/nurse/profile');
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data as NurseProfile;
        setProfile(p);
        setEditName(p.name);
        setEditBio(p.bio ?? '');
        setEditAddress(p.address ?? '');
        setEditCity(p.city ?? '');
        setEditGovernorate(p.governorate ?? '');
        setEditExperience(String(p.experience ?? 0));
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await authFetch('/api/nurse/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName,
          bio: editBio,
          address: editAddress,
          city: editCity,
          governorate: editGovernorate,
          experience: Number(editExperience) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) => prev ? { ...prev, name: editName, bio: editBio, address: editAddress, city: editCity, governorate: editGovernorate, experience: Number(editExperience) || 0 } : null);
        updateUser({ name: editName });
        setIsEditing(false);
        showToast('تم تحديث الملف الشخصي بنجاح');
      }
    } catch {
      showToast('حدث خطأ في تحديث الملف الشخصي');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvailabilityToggle = async () => {
    if (!profile) return;
    setIsAvailabilityLoading(true);
    try {
      const res = await authFetch('/api/nurse/availability', {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !profile.isAvailable }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) => prev ? { ...prev, isAvailable: !prev.isAvailable, isOnline: !prev.isAvailable } : null);
        showToast(profile.isAvailable ? 'أنت غير متاح الآن' : 'أنت متاح الآن لاستقبال الطلبات');
      }
    } catch {
      showToast('حدث خطأ في تحديث التوفر');
    } finally {
      setIsAvailabilityLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('يرجى ملء جميع الحقول');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور الجديدة غير متطابقة');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('كلمة المرور يجب أن تكون ٦ أحرف على الأقل');
      return;
    }
    setIsPasswordSaving(true);
    try {
      const res = await authFetch('/api/nurse/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordSection(false);
        showToast('تم تغيير كلمة المرور بنجاح');
      } else {
        setPasswordError(data.message ?? 'فشل تغيير كلمة المرور');
      }
    } catch {
      setPasswordError('حدث خطأ في تغيير كلمة المرور');
    } finally {
      setIsPasswordSaving(false);
    }
  };



  // Handle file selection for documents
  const handleIdentityFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('حجم صورة الهوية يجب أن يكون أقل من 10 ميجابايت');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setUploadError('صورة الهوية يجب أن تكون بصيغة JPEG أو PNG أو WebP');
      return;
    }
    setIdentityFile(file);
    const reader = new FileReader();
    reader.onload = () => setIdentityPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLicenseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('حجم صورة المزاولة يجب أن يكون أقل من 10 ميجابايت');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setUploadError('صورة المزاولة يجب أن تكون بصيغة JPEG أو PNG أو WebP');
      return;
    }
    setLicenseFile(file);
    const reader = new FileReader();
    reader.onload = () => setLicensePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadDocuments = async () => {
    if (!identityFile && !licenseFile) {
      setUploadError('يرجى اختيار صورة الهوية الوطنية وصورة مزاولة المهنة');
      return;
    }
    if (!identityFile) {
      setUploadError('يرجى اختيار صورة الهوية الوطنية');
      return;
    }
    if (!licenseFile) {
      setUploadError('يرجى اختيار صورة مزاولة المهنة');
      return;
    }

    setIsUploadingDocs(true);
    setUploadError(null);

    try {
      // Upload identity document
      const identityFormData = new FormData();
      identityFormData.append('file', identityFile);
      identityFormData.append('type', 'identity');
      const identityRes = await authFetch('/api/nurse/documents', {
        method: 'POST',
        body: identityFormData,
      });
      const identityData = await identityRes.json();
      if (!identityData.success) {
        setUploadError(identityData.message || 'حدث خطأ في رفع صورة الهوية');
        setIsUploadingDocs(false);
        return;
      }

      // Upload license document
      const licenseFormData = new FormData();
      licenseFormData.append('file', licenseFile);
      licenseFormData.append('type', 'license');
      const licenseRes = await authFetch('/api/nurse/documents', {
        method: 'POST',
        body: licenseFormData,
      });
      const licenseData = await licenseRes.json();
      if (!licenseData.success) {
        setUploadError(licenseData.message || 'حدث خطأ في رفع صورة المزاولة');
        setIsUploadingDocs(false);
        return;
      }

      // Update profile state with new URLs
      setProfile((prev) => prev ? {
        ...prev,
        identityDocumentUrl: identityData.data?.identityDocumentUrl || prev.identityDocumentUrl,
        licenseDocumentUrl: licenseData.data?.licenseDocumentUrl || prev.licenseDocumentUrl,
        verificationStatus: identityData.data?.verificationStatus || prev.verificationStatus,
      } : null);

      // Clear file selection
      setIdentityFile(null);
      setLicenseFile(null);
      setIdentityPreview(null);
      setLicensePreview(null);

      showToast('تم رفع المستندات بنجاح. سيتم مراجعتها من قبل الإدارة');
      // Refresh full profile
      fetchProfile();
    } catch {
      setUploadError('حدث خطأ في رفع المستندات. يرجى المحاولة مرة أخرى');
    } finally {
      setIsUploadingDocs(false);
    }
  };

  const handleRemoveIdentityFile = () => {
    setIdentityFile(null);
    setIdentityPreview(null);
  };

  const handleRemoveLicenseFile = () => {
    setLicenseFile(null);
    setLicensePreview(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="الملف الشخصي" />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <PageHeader title="الملف الشخصي" />
        <GlassCard variant="nurse" className="p-6 text-center">
          <p className="text-muted-foreground">لم يتم العثور على بيانات الملف الشخصي</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-4 right-4 z-50 glass-strong rounded-xl p-3 text-center text-sm font-medium shadow-lg border border-nurse/30"
        >
          {toast}
        </motion.div>
      )}

      <PageHeader title="الملف الشخصي" />

      {/* Profile Header */}
      <GlassCard variant="nurse" className="p-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <Avatar className="w-24 h-24 text-2xl">
              <AvatarFallback className="bg-nurse/10 text-nurse text-2xl">
                {profile.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <button className="absolute bottom-0 right-0 w-8 h-8 bg-nurse text-nurse-foreground rounded-full flex items-center justify-center shadow-md">
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-xl font-bold mb-1">{profile.name}</h2>
          <p className="text-sm text-muted-foreground mb-2">{profile.phone}</p>

          <div className="flex items-center gap-2 mb-3">
            <BadgeStatus status={profile.verificationStatus} size="md" />
            {profile.verificationStatus === 'rejected' && profile.rejectedReason && (
              <span className="text-xs text-red-500">({profile.rejectedReason})</span>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 w-full mt-2">
            <div className="text-center">
              <p className="text-lg font-bold text-nurse">{toArabicNum(profile.completedJobs)}</p>
              <p className="text-xs text-muted-foreground">خدمة مكتملة</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-500">{toArabicNum(profile.rating.toFixed(1))}</p>
              <p className="text-xs text-muted-foreground">تقييم</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">{toArabicNum(profile.experience)}</p>
              <p className="text-xs text-muted-foreground">سنة خبرة</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Availability Toggle */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${profile.isAvailable ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <div>
              <p className="font-semibold text-sm">
                {profile.isAvailable ? 'متاح الآن' : 'غير متاح'}
              </p>
              <p className="text-xs text-muted-foreground">
                {profile.isAvailable ? 'يمكنك استقبال طلبات جديدة' : 'لن يتم تعيين طلبات لك'}
              </p>
            </div>
          </div>
          <Switch
            checked={profile.isAvailable}
            onCheckedChange={handleAvailabilityToggle}
            disabled={isAvailabilityLoading}
            className="data-[state=checked]:bg-green-600"
          />
        </div>
      </GlassCard>

      {/* Profile Info */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">المعلومات الشخصية</h3>
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? <XCircle className="w-4 h-4 me-1" /> : <Edit3 className="w-4 h-4 me-1" />}
            {isEditing ? 'إلغاء' : 'تعديل'}
          </Button>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">الاسم</Label>
              <Input id="name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">نبذة عنك</Label>
              <Textarea id="bio" value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">العنوان</Label>
              <Input id="address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">المدينة</Label>
                <Input id="city" value={editCity} onChange={(e) => setEditCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gov">المحافظة</Label>
                <Input id="gov" value={editGovernorate} onChange={(e) => setEditGovernorate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="experience">سنوات الخبرة</Label>
              <Input id="experience" type="number" value={editExperience} onChange={(e) => setEditExperience(e.target.value)} min={0} />
            </div>
            <Button
              className="w-full bg-nurse hover:bg-nurse/90"
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin me-2" />
              ) : (
                <Save className="w-4 h-4 me-2" />
              )}
              حفظ التعديلات
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <InfoRow icon={<Phone className="w-4 h-4" />} label="الهاتف" value={profile.phone} />
            <InfoRow icon={<Shield className="w-4 h-4" />} label="رقم الترخيص" value={profile.licenseNumber ?? 'غير محدد'} />
            <InfoRow icon={<FileText className="w-4 h-4" />} label="التخصص" value={(profile.specialization || []).map((s) => specializationLabels[s] ?? s).join('، ') || 'غير محدد'} />
            <InfoRow icon={<Clock className="w-4 h-4" />} label="سنوات الخبرة" value={`${toArabicNum(profile.experience)} سنة`} />
            {profile.bio && <InfoRow icon={<User className="w-4 h-4" />} label="نبذة" value={profile.bio} />}
            {profile.address && <InfoRow icon={<User className="w-4 h-4" />} label="العنوان" value={profile.address} />}
            {profile.governorate && <InfoRow icon={<User className="w-4 h-4" />} label="المحافظة" value={profile.governorate} />}
          </div>
        )}
      </GlassCard>

      {/* Documents Section / Verification */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">توثيق الحساب</h3>
          <BadgeStatus status={profile.verificationStatus} size="md" />
        </div>

        {profile.verificationStatus === 'verified' ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">حساب موثق</p>
              <p className="text-sm text-green-600/80 dark:text-green-400/80">يمكنك استقبال الطلبات والمهام</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {profile.verificationStatus === 'rejected' && profile.rejectedReason && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20">
                <p className="text-xs text-red-600 dark:text-red-400 mb-1">سبب رفض التوثيق</p>
                <p className="text-sm">{profile.rejectedReason}</p>
              </div>
            )}

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                يجب توثيق حسابك برفع صورة الهوية الوطنية وصورة مزاولة المهنة لاستقبال الطلبات. لن يتم تعيين أي طلب لك حتى يتم توثيق حسابك.
              </p>
            </div>

            {/* Step 1: National ID Image */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${identityPreview || profile.identityDocumentUrl ? 'bg-green-500 text-white' : 'bg-nurse/20 text-nurse'}`}>
                  {identityPreview || profile.identityDocumentUrl ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                </div>
                <span className="text-sm font-medium">صورة الهوية الوطنية</span>
              </div>
              <div className={`relative rounded-xl border-2 border-dashed overflow-hidden transition-all ${(identityPreview || profile.identityDocumentUrl) ? 'border-green-400 dark:border-green-700' : 'border-border hover:border-nurse/50'}`}>
                {(identityPreview || profile.identityDocumentUrl) ? (
                  <div className="relative group">
                    <img
                      src={identityPreview || profile.identityDocumentUrl || ''}
                      alt="الهوية الوطنية"
                      className="w-full h-36 object-contain bg-muted/20"
                    />
                    {identityPreview && (
                      <button
                        onClick={handleRemoveIdentityFile}
                        className="absolute top-2 left-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                      <p className="text-[10px] text-white text-center">
                        {identityPreview ? 'تم اختيار الصورة - في انتظار الرفع' : 'تم رفع الهوية الوطنية'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-36 cursor-pointer hover:bg-muted/20 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-nurse/10 flex items-center justify-center mb-2">
                      <Upload className="w-5 h-5 text-nurse" />
                    </div>
                    <p className="text-xs text-muted-foreground">اضغط لاختيار صورة الهوية</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">JPEG, PNG, WebP - حد أقصى 10 ميجا</p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleIdentityFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Step 2: Professional License Image */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${licensePreview || profile.licenseDocumentUrl ? 'bg-green-500 text-white' : 'bg-nurse/20 text-nurse'}`}>
                  {licensePreview || profile.licenseDocumentUrl ? <CheckCircle2 className="w-4 h-4" /> : '2'}
                </div>
                <span className="text-sm font-medium">صورة مزاولة المهنة</span>
              </div>
              <div className={`relative rounded-xl border-2 border-dashed overflow-hidden transition-all ${(licensePreview || profile.licenseDocumentUrl) ? 'border-green-400 dark:border-green-700' : 'border-border hover:border-nurse/50'}`}>
                {(licensePreview || profile.licenseDocumentUrl) ? (
                  <div className="relative group">
                    <img
                      src={licensePreview || profile.licenseDocumentUrl || ''}
                      alt="مزاولة المهنة"
                      className="w-full h-36 object-contain bg-muted/20"
                    />
                    {licensePreview && (
                      <button
                        onClick={handleRemoveLicenseFile}
                        className="absolute top-2 left-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                      <p className="text-[10px] text-white text-center">
                        {licensePreview ? 'تم اختيار الصورة - في انتظار الرفع' : 'تم رفع مزاولة المهنة'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-36 cursor-pointer hover:bg-muted/20 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-nurse/10 flex items-center justify-center mb-2">
                      <Upload className="w-5 h-5 text-nurse" />
                    </div>
                    <p className="text-xs text-muted-foreground">اضغط لاختيار صورة المزاولة</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">JPEG, PNG, WebP - حد أقصى 10 ميجا</p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleLicenseFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Upload Error */}
            {uploadError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
              </div>
            )}

            {/* Upload Button */}
            <Button
              className="w-full bg-nurse hover:bg-nurse/90 gap-2 h-12 text-base"
              onClick={handleUploadDocuments}
              disabled={isUploadingDocs || (!identityFile && !licenseFile)}
            >
              {isUploadingDocs ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري رفع المستندات...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>{identityFile && licenseFile ? 'رفع الهوية والمزاولة' : identityFile ? 'رفع الهوية الوطنية' : licenseFile ? 'رفع مزاولة المهنة' : 'رفع المستندات'}</span>
                </>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">اختر صورة الهوية الوطنية ثم صورة مزاولة المهنة واضغط رفع المستندات</p>
          </div>
        )}
      </GlassCard>

      {/* Change Password */}
      <GlassCard variant="nurse" className="p-4">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setShowPasswordSection(!showPasswordSection)}
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-nurse" />
            <span className="font-semibold text-sm">تغيير كلمة المرور</span>
          </div>
          <ChevronLeft className={`w-5 h-5 transition-transform ${showPasswordSection ? '-rotate-90' : ''}`} />
        </button>

        {showPasswordSection && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="mt-4 space-y-3"
          >
            {passwordError && (
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
                {passwordError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="current-pw">كلمة المرور الحالية</Label>
              <div className="relative">
                <Input
                  id="current-pw"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">تأكيد كلمة المرور</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-nurse hover:bg-nurse/90"
              onClick={handleChangePassword}
              disabled={isPasswordSaving}
            >
              {isPasswordSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin me-2" />
              ) : (
                <Lock className="w-4 h-4 me-2" />
              )}
              تغيير كلمة المرور
            </Button>
          </motion.div>
        )}
      </GlassCard>

      {/* Quick Links */}
      <GlassCard variant="nurse" className="p-4">
        <h3 className="font-semibold mb-3">روابط سريعة</h3>
        <div className="space-y-2">
          <Link href="/nurse/ratings" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
            <span className="text-sm">التقييمات والمراجعات</span>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link href="/nurse/chat" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
            <span className="text-sm">المحادثات</span>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link href="/nurse/help" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
            <span className="text-sm">المساعدة والدعم</span>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}

// ---- Info Row Component ----

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium line-clamp-2">{value}</p>
      </div>
    </div>
  );
}
