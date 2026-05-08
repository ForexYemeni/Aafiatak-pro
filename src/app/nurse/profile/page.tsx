'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  AlertTriangle,
  Power,
  PowerOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GlassCard } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toArabicNum } from '@/components/common/date-formatter';
import { compressImage } from '@/lib/utils/image-compress';
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
  identityDocumentData: string | null;
  licenseDocumentData: string | null;
  rejectedReason: string | null;
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

  // Availability confirmation dialog
  const [showAvailabilityConfirm, setShowAvailabilityConfirm] = useState(false);
  const [pendingAvailability, setPendingAvailability] = useState<boolean | null>(null);

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

  // Availability toggle with confirmation
  const handleAvailabilityToggleRequest = (newAvailability: boolean) => {
    // If nurse is not verified, warn them
    if (newAvailability && (profile?.verificationStatus || 'unverified') !== 'verified') {
      setPendingAvailability(newAvailability);
      setShowAvailabilityConfirm(true);
      return;
    }
    setPendingAvailability(newAvailability);
    setShowAvailabilityConfirm(true);
  };

  const handleAvailabilityConfirm = async (confirmed: boolean) => {
    setShowAvailabilityConfirm(false);
    if (!confirmed || pendingAvailability === null || !profile) return;

    setIsAvailabilityLoading(true);
    try {
      const res = await authFetch('/api/nurse/availability', {
        method: 'POST',
        body: JSON.stringify({ isAvailable: pendingAvailability }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) => prev ? { ...prev, isAvailable: pendingAvailability, isOnline: pendingAvailability } : null);
        showToast(pendingAvailability ? 'أنت متاح الآن لاستقبال الطلبات' : 'تم إيقاف الخدمة. يمكنك العودة متى شئت');
      } else {
        showToast(data.message || 'حدث خطأ في تحديث التوفر');
      }
    } catch {
      showToast('حدث خطأ في تحديث التوفر');
    } finally {
      setIsAvailabilityLoading(false);
      setPendingAvailability(null);
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

  // Handle file selection for documents - with automatic compression
  const handleIdentityFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // Show preview immediately from original file
    const reader = new FileReader();
    reader.onload = () => setIdentityPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Compress in background
    try {
      const compressed = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.85,
        maxSizeKB: 500,
      });
      setIdentityFile(compressed);
    } catch {
      // Fallback to original file if compression fails
      setIdentityFile(file);
    }
  };

  const handleLicenseFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // Show preview immediately from original file
    const reader = new FileReader();
    reader.onload = () => setLicensePreview(reader.result as string);
    reader.readAsDataURL(file);

    // Compress in background
    try {
      const compressed = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.85,
        maxSizeKB: 500,
      });
      setLicenseFile(compressed);
    } catch {
      // Fallback to original file if compression fails
      setLicenseFile(file);
    }
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
      // Upload both documents in parallel for speed
      const [identityResult, licenseResult] = await Promise.all([
        (async () => {
          const formData = new FormData();
          formData.append('file', identityFile!);
          formData.append('type', 'identity');
          const res = await authFetch('/api/nurse/documents', {
            method: 'POST',
            body: formData,
          });
          return res.json();
        })(),
        (async () => {
          const formData = new FormData();
          formData.append('file', licenseFile!);
          formData.append('type', 'license');
          const res = await authFetch('/api/nurse/documents', {
            method: 'POST',
            body: formData,
          });
          return res.json();
        })(),
      ]);

      if (!identityResult.success) {
        setUploadError(identityResult.message || 'حدث خطأ في رفع صورة الهوية');
        return;
      }
      if (!licenseResult.success) {
        setUploadError(licenseResult.message || 'حدث خطأ في رفع صورة المزاولة');
        return;
      }

      // Clear file selection
      setIdentityFile(null);
      setLicenseFile(null);
      setIdentityPreview(null);
      setLicensePreview(null);

      showToast('تم رفع المستندات بنجاح. سيتم مراجعتها من قبل الإدارة');
      // Refresh full profile
      fetchProfile();
    } catch (err) {
      console.error('Upload error:', err);
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

  // Helper: get document image src (from base64 data or URL)
  const getDocImageSrc = (data: string | null, url: string | null, preview: string | null) => {
    if (preview) return preview;
    if (data) return data;
    if (url && !url.startsWith('data:stored/')) return url;
    return null;
  };

  // Helper: check if document is uploaded
  const isDocUploaded = (data: string | null, url: string | null, preview: string | null) => {
    return !!(preview || data || (url && !url.startsWith('data:stored/')));
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

  const identitySrc = getDocImageSrc(profile.identityDocumentData, profile.identityDocumentUrl, identityPreview);
  const licenseSrc = getDocImageSrc(profile.licenseDocumentData, profile.licenseDocumentUrl, licensePreview);
  const identityUploaded = isDocUploaded(profile.identityDocumentData, profile.identityDocumentUrl, identityPreview);
  const licenseUploaded = isDocUploaded(profile.licenseDocumentData, profile.licenseDocumentUrl, licensePreview);

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

      {/* Availability Confirmation Dialog */}
      <AnimatePresence>
        {showAvailabilityConfirm && pendingAvailability !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowAvailabilityConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard variant="nurse" className="p-6 space-y-4">
                <div className="flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${pendingAvailability ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                    {pendingAvailability ? (
                      <Power className="w-8 h-8 text-green-600" />
                    ) : (
                      <PowerOff className="w-8 h-8 text-amber-600" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold mb-1">
                    {pendingAvailability ? 'بدء العمل' : 'إيقاف الخدمة'}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {pendingAvailability ? (
                      (profile.verificationStatus || 'unverified') !== 'verified'
                        ? 'حسابك غير موثق بعد. لن يتم إرسال أي طلبات لك حتى يتم توثيق حسابك من قبل الإدارة. هل تريد المتابعة؟'
                        : 'سيتم إعلام النظام بأنك متاح لاستقبال الطلبات والمهام الجديدة. هل أنت مستعد؟'
                    ) : (
                      'لن يتم إرسال أي طلب أو مهمة إليك أثناء إيقاف الخدمة. يمكنك العودة للعمل في أي وقت تكون متاحاً. هل تريد الإيقاف؟'
                    )}
                  </p>
                </div>

                {pendingAvailability && (profile.verificationStatus || 'unverified') !== 'verified' && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">تنبيه هام</span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      يجب توثيق حسابك أولاً برفع الهوية والمزاولة لتتمكن من استقبال الطلبات
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleAvailabilityConfirm(false)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    className={`flex-1 ${pendingAvailability ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                    onClick={() => handleAvailabilityConfirm(true)}
                  >
                    {pendingAvailability ? 'نعم، ابدأ العمل' : 'نعم، أوقف الخدمة'}
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader title="الملف الشخصي" />

      {/* Verification Warning Banner (if not verified) */}
      {(profile.verificationStatus || 'unverified') !== 'verified' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlassCard variant="nurse" className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-700 dark:text-amber-400 mb-0.5">
                  {(!profile.verificationStatus || profile.verificationStatus === 'unverified') && 'حسابك غير موثق'}
                  {profile.verificationStatus === 'pending' && 'حسابك قيد المراجعة'}
                  {profile.verificationStatus === 'rejected' && 'تم رفض التوثيق'}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {(!profile.verificationStatus || profile.verificationStatus === 'unverified') && 'لن يتم إرسال أي طلبات أو مهام إليك حتى يتم توثيق حسابك. يرجى رفع الهوية الوطنية ومزاولة المهنة أدناه.'}
                  {profile.verificationStatus === 'pending' && 'تم رفع المستندات وسيتم مراجعتها من قبل الإدارة قريباً. سنقوم بإشعارك فور التحقق.'}
                  {profile.verificationStatus === 'rejected' && `تم رفض التوثيق${profile.rejectedReason ? `: ${profile.rejectedReason}` : ''}. يرجى رفع المستندات مرة أخرى.`}
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

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
            <BadgeStatus status={profile.verificationStatus || 'unverified'} size="md" />
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
            onCheckedChange={(checked) => handleAvailabilityToggleRequest(checked)}
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
            {/* GPS Auto-Detect Location - Single field */}
            <GpsLocationButton
              onLocationDetected={(loc) => {
                setEditGovernorate(loc.governorate || editGovernorate);
                setEditCity(loc.district || loc.city || editCity);
                setEditAddress(loc.address || editAddress);
              }}
              value={editAddress}
              placeholder='اضغط "تحديد موقعي" لرفع موقعك الجغرافي'
              label="تحديد موقعي"
            />
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
          <BadgeStatus status={profile.verificationStatus || 'unverified'} size="md" />
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
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${identityUploaded ? 'bg-green-500 text-white' : 'bg-nurse/20 text-nurse'}`}>
                  {identityUploaded ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                </div>
                <span className="text-sm font-medium">صورة الهوية الوطنية</span>
              </div>
              <div className={`relative rounded-xl border-2 border-dashed overflow-hidden transition-all ${identityUploaded ? 'border-green-400 dark:border-green-700' : 'border-border hover:border-nurse/50'}`}>
                {identitySrc ? (
                  <div className="relative group">
                    <img
                      src={identitySrc}
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
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${licenseUploaded ? 'bg-green-500 text-white' : 'bg-nurse/20 text-nurse'}`}>
                  {licenseUploaded ? <CheckCircle2 className="w-4 h-4" /> : '2'}
                </div>
                <span className="text-sm font-medium">صورة مزاولة المهنة</span>
              </div>
              <div className={`relative rounded-xl border-2 border-dashed overflow-hidden transition-all ${licenseUploaded ? 'border-green-400 dark:border-green-700' : 'border-border hover:border-nurse/50'}`}>
                {licenseSrc ? (
                  <div className="relative group">
                    <img
                      src={licenseSrc}
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
