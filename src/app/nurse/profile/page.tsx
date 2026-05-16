import { SPECIALIZATION_LABELS, YEMEN_GOVERNORATES } from '@/lib/constants';
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Droplets,
  MapPin,
  Star,
  Award,
  Briefcase,
  Heart,
  IdCard,
  BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GlassCard } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { VerifiedBadge } from '@/components/common/verified-badge';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toArabicNum } from '@/components/common/date-formatter';
import { compressImage } from '@/lib/utils/image-compress';
import { toast as sonnerToast } from 'sonner';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  bloodType: string | null;
  experience: number;
  identityDocumentUrl: string | null;
  licenseDocumentUrl: string | null;
  identityDocumentData: string | null;
  licenseDocumentData: string | null;
  avatar: string | null;
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

const governorateOptions = YEMEN_GOVERNORATES;

// ---- Info Row Component ----

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

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

  const [showAvailabilityConfirm, setShowAvailabilityConfirm] = useState(false);
  const [pendingAvailability, setPendingAvailability] = useState<boolean | null>(null);

  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editGovernorate, setEditGovernorate] = useState('');
  const [editExperience, setEditExperience] = useState('');
  const [editBloodType, setEditBloodType] = useState('');

  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [identityPreview, setIdentityPreview] = useState<string | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  const authFetch = useAuthFetch();
  const updateUser = useAuthStore((s) => s.updateUser);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
        setEditBloodType(p.bloodType ?? '');
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
          bloodType: editBloodType || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) => prev ? { ...prev, name: editName, bio: editBio, address: editAddress, city: editCity, governorate: editGovernorate, experience: Number(editExperience) || 0, bloodType: editBloodType || null } : null);
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

  const handleAvailabilityToggleRequest = (newAvailability: boolean) => {
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

    const reader = new FileReader();
    reader.onload = () => setIdentityPreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      const compressed = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.85,
        maxSizeKB: 500,
      });
      setIdentityFile(compressed);
    } catch {
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

    const reader = new FileReader();
    reader.onload = () => setLicensePreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      const compressed = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.85,
        maxSizeKB: 500,
      });
      setLicenseFile(compressed);
    } catch {
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

      setIdentityFile(null);
      setLicenseFile(null);
      setIdentityPreview(null);
      setLicensePreview(null);

      showToast('تم رفع المستندات بنجاح. سيتم مراجعتها من قبل الإدارة');
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

  const getDocImageSrc = (data: string | null, url: string | null, preview: string | null) => {
    if (preview) return preview;
    if (data) return data;
    if (url && !url.startsWith('data:stored/')) return url;
    return null;
  };

  const isDocUploaded = (data: string | null, url: string | null, preview: string | null) => {
    return !!(preview || data || (url && !url.startsWith('data:stored/')));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const res = await authFetch('/api/nurse/profile', {
          method: 'PATCH',
          body: JSON.stringify({ avatar: base64 }),
        });
        const data = await res.json();
        if (data.success) {
          sonnerToast.success('تم تحديث الصورة الشخصية');
          fetchProfile();
        } else {
          sonnerToast.error('فشل تحديث الصورة');
        }
      };
      reader.readAsDataURL(compressed);
    } catch {
      sonnerToast.error('حدث خطأ أثناء معالجة الصورة');
    }
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
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-4 right-4 z-50 glass-strong rounded-2xl p-3 text-center text-sm font-bold shadow-xl border border-nurse/30"
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
              transition={{ ease: 'easeOut' as const }}
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
                  <h3 className="text-lg font-black mb-1">
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
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400">تنبيه هام</span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      يجب توثيق حسابك أولاً برفع الهوية والمزاولة لتتمكن من استقبال الطلبات
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => handleAvailabilityConfirm(false)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    className={`flex-1 rounded-xl font-bold ${pendingAvailability ? 'bg-gradient-to-l from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700' : 'bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'}`}
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

      <PageHeader
        title="الملف الشخصي"
        action={{
          label: 'معاينة السيرة الذاتية',
          icon: <FileText className="w-4 h-4" />,
          onClick: () => { window.location.href = '/nurse/cv'; },
        }}
      />

      {/* ══════════════ Verification Warning Banner ══════════════ */}
      {(profile.verificationStatus || 'unverified') !== 'verified' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: 'easeOut' as const }}
        >
          <GlassCard variant="nurse" className="p-4 border-2 border-amber-200 dark:border-amber-800/50 bg-gradient-to-l from-amber-50/80 to-orange-50/50 dark:from-amber-900/10 dark:to-orange-900/5">
            <div className="flex items-start gap-3">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' as const }}
                className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0"
              >
                <Shield className="w-5 h-5 text-amber-600" />
              </motion.div>
              <div className="flex-1">
                <p className="font-bold text-sm text-amber-700 dark:text-amber-400 mb-0.5">
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

      {/* ══════════════ Profile Header with Gradient Banner ══════════════ */}
      <GlassCard variant="nurse" className="p-0 overflow-hidden">
        {/* Gradient Banner */}
        <div className="relative bg-gradient-to-bl from-nurse via-sky-500 to-teal-500 h-28">
          <div className="absolute -top-8 -left-8 w-28 h-28 rounded-full bg-white/8 blur-sm" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/6" />
        </div>
        
        {/* Profile Content */}
        <div className="relative px-5 pb-5">
          <div className="flex flex-col items-center text-center -mt-12">
            <div className="relative mb-3">
              <Avatar className="w-24 h-24 text-2xl ring-4 ring-background shadow-xl">
                {profile.avatar ? (
                  <AvatarImage src={profile.avatar} alt={profile.name} />
                ) : null}
                <AvatarFallback className="bg-nurse/10 text-nurse text-2xl">
                  {profile.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'م'}
                </AvatarFallback>
              </Avatar>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-9 h-9 bg-gradient-to-bl from-nurse to-sky-500 text-white rounded-full flex items-center justify-center shadow-lg"
              >
                <Camera className="w-4 h-4" />
              </motion.button>
              <input type="file" accept="image/*" className="hidden" ref={avatarInputRef} onChange={handleAvatarChange} />
            </div>

            <h2 className="text-xl font-black mb-1 flex items-center justify-center gap-1.5">
              {profile.name}
              {profile.verificationStatus === 'verified' && <VerifiedBadge size="md" showText={false} />}
            </h2>
            <p className="text-sm text-muted-foreground mb-2">{profile.phone}</p>

            <div className="flex items-center gap-2 mb-3">
              <BadgeStatus status={profile.verificationStatus || 'unverified'} size="md" />
              {profile.verificationStatus === 'rejected' && profile.rejectedReason && (
                <span className="text-xs text-red-500">({profile.rejectedReason})</span>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 w-full mt-2">
              <div className="text-center p-2.5 rounded-2xl bg-nurse/5 border border-nurse/10">
                <div className="flex items-center justify-center gap-1">
                  <Award className="w-3.5 h-3.5 text-nurse" />
                  <p className="text-lg font-black text-nurse">{toArabicNum(profile.completedJobs)}</p>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium">خدمة مكتملة</p>
              </div>
              <div className="text-center p-2.5 rounded-2xl bg-amber-50/50 dark:bg-amber-900/5 border border-amber-200/30 dark:border-amber-800/20">
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <p className="text-lg font-black text-amber-500">{toArabicNum(profile.rating.toFixed(1))}</p>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium">تقييم</p>
              </div>
              <div className="text-center p-2.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/5 border border-emerald-200/30 dark:border-emerald-800/20">
                <div className="flex items-center justify-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-lg font-black text-emerald-600">{toArabicNum(profile.experience)}</p>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium">سنة خبرة</p>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ══════════════ Availability Toggle ══════════════ */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={profile.isAvailable ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' as const }}
              className={`w-3.5 h-3.5 rounded-full ${profile.isAvailable ? 'bg-emerald-500 shadow-lg shadow-emerald-500/40' : 'bg-gray-400'}`}
            />
            <div>
              <p className="font-bold text-sm">
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
            className="data-[state=checked]:bg-emerald-600"
          />
        </div>
      </GlassCard>

      {/* ══════════════ Profile Info ══════════════ */}
      <GlassCard variant="nurse" className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-nurse/10 flex items-center justify-center">
              <User className="w-4 h-4 text-nurse" />
            </div>
            <h3 className="font-bold">المعلومات الشخصية</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)} className="rounded-xl">
            {isEditing ? <XCircle className="w-4 h-4 me-1" /> : <Edit3 className="w-4 h-4 me-1" />}
            {isEditing ? 'إلغاء' : 'تعديل'}
          </Button>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold">الاسم</Label>
              <Input id="name" value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio" className="font-semibold">نبذة عنك</Label>
              <Textarea id="bio" value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} className="rounded-xl" />
            </div>
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
              <Label htmlFor="experience" className="font-semibold">سنوات الخبرة</Label>
              <Input id="experience" type="number" value={editExperience} onChange={(e) => setEditExperience(e.target.value)} min={0} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">المحافظة</Label>
              <Select value={editGovernorate} onValueChange={setEditGovernorate}>
                <SelectTrigger className="w-full rounded-xl h-11">
                  <SelectValue placeholder="اختر المحافظة" />
                </SelectTrigger>
                <SelectContent>
                  {governorateOptions.map((gov) => (
                    <SelectItem key={gov} value={gov}>{gov}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">فصيلة الدم</Label>
              <Select value={editBloodType} onValueChange={setEditBloodType}>
                <SelectTrigger className="w-full rounded-xl h-11">
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
            </div>
            <Button
              className="w-full bg-gradient-to-l from-nurse to-sky-500 hover:from-sky-600 hover:to-sky-600 rounded-xl h-12 font-bold shadow-lg shadow-nurse/25"
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
          <div className="space-y-1">
            <InfoRow icon={<Phone className="w-4 h-4 text-muted-foreground" />} label="الهاتف" value={profile.phone} />
            <InfoRow icon={<Shield className="w-4 h-4 text-muted-foreground" />} label="رقم الترخيص" value={profile.licenseNumber ?? 'غير محدد'} />
            <InfoRow icon={<Heart className="w-4 h-4 text-muted-foreground" />} label="التخصص" value={(profile.specialization || []).map((s) => specializationLabels[s] ?? s).join('، ') || 'غير محدد'} />
            <InfoRow icon={<Clock className="w-4 h-4 text-muted-foreground" />} label="سنوات الخبرة" value={`${toArabicNum(profile.experience)} سنة`} />
            <InfoRow icon={<Droplets className="w-4 h-4 text-muted-foreground" />} label="فصيلة الدم" value={profile.bloodType || 'غير محدد'} />
            {profile.bio && <InfoRow icon={<User className="w-4 h-4 text-muted-foreground" />} label="نبذة" value={profile.bio} />}
            {profile.address && <InfoRow icon={<MapPin className="w-4 h-4 text-muted-foreground" />} label="العنوان" value={profile.address} />}
            <InfoRow icon={<MapPin className="w-4 h-4 text-muted-foreground" />} label="المحافظة" value={profile.governorate || 'غير محدد'} />
          </div>
        )}
      </GlassCard>

      {/* ══════════════ Documents Section ══════════════ */}
      <GlassCard variant="nurse" className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-nurse/10 flex items-center justify-center">
              <IdCard className="w-4 h-4 text-nurse" />
            </div>
            <h3 className="font-bold">توثيق الحساب</h3>
          </div>
          <BadgeStatus status={profile.verificationStatus || 'unverified'} size="md" />
        </div>

        {profile.verificationStatus === 'verified' ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-l from-emerald-50 to-green-50/50 dark:from-emerald-900/20 dark:to-green-900/10 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            <div>
              <p className="font-black text-emerald-700 dark:text-emerald-400">حساب موثق</p>
              <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">يمكنك استقبال الطلبات والمهام</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {profile.verificationStatus === 'rejected' && profile.rejectedReason && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-600 dark:text-red-400 font-bold mb-0.5">سبب رفض التوثيق</p>
                <p className="text-sm">{profile.rejectedReason}</p>
              </div>
            )}

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                يجب توثيق حسابك برفع صورة الهوية الوطنية وصورة مزاولة المهنة لاستقبال الطلبات. لن يتم تعيين أي طلب لك حتى يتم توثيق حسابك.
              </p>
            </div>

            {/* Step 1: National ID Image */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${identityUploaded ? 'bg-emerald-500 text-white' : 'bg-nurse/20 text-nurse'}`}>
                  {identityUploaded ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                </div>
                <span className="text-sm font-bold">صورة الهوية الوطنية</span>
              </div>
              <div className={`relative rounded-2xl border-2 border-dashed overflow-hidden transition-all ${identityUploaded ? 'border-emerald-400 dark:border-emerald-700' : 'border-border hover:border-nurse/50'}`}>
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
                        className="absolute top-2 left-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                      <p className="text-[10px] text-white text-center font-medium">
                        {identityPreview ? 'تم اختيار الصورة - في انتظار الرفع' : 'تم رفع الهوية الوطنية'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-36 cursor-pointer hover:bg-muted/20 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-nurse/10 flex items-center justify-center mb-2">
                      <Upload className="w-5 h-5 text-nurse" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">اضغط لاختيار صورة الهوية</p>
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
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${licenseUploaded ? 'bg-emerald-500 text-white' : 'bg-nurse/20 text-nurse'}`}>
                  {licenseUploaded ? <CheckCircle2 className="w-4 h-4" /> : '2'}
                </div>
                <span className="text-sm font-bold">صورة مزاولة المهنة</span>
              </div>
              <div className={`relative rounded-2xl border-2 border-dashed overflow-hidden transition-all ${licenseUploaded ? 'border-emerald-400 dark:border-emerald-700' : 'border-border hover:border-nurse/50'}`}>
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
                        className="absolute top-2 left-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                      <p className="text-[10px] text-white text-center font-medium">
                        {licensePreview ? 'تم اختيار الصورة - في انتظار الرفع' : 'تم رفع مزاولة المهنة'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-36 cursor-pointer hover:bg-muted/20 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-nurse/10 flex items-center justify-center mb-2">
                      <Upload className="w-5 h-5 text-nurse" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">اضغط لاختيار صورة المزاولة</p>
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

            {uploadError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{uploadError}</p>
              </div>
            )}

            <Button
              className="w-full bg-gradient-to-l from-nurse to-sky-500 hover:from-sky-600 hover:to-sky-600 gap-2 h-12 text-base font-bold shadow-lg shadow-nurse/25 rounded-xl"
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
            <p className="text-[10px] text-muted-foreground text-center font-medium">اختر صورة الهوية الوطنية ثم صورة مزاولة المهنة واضغط رفع المستندات</p>
          </div>
        )}
      </GlassCard>

      {/* ══════════════ Change Password ══════════════ */}
      <GlassCard variant="nurse" className="p-5">
        <button
          onClick={() => setShowPasswordSection(!showPasswordSection)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-nurse/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-nurse" />
            </div>
            <h3 className="font-bold">تغيير كلمة المرور</h3>
          </div>
          <ChevronLeft className={`w-4 h-4 text-muted-foreground transition-transform ${showPasswordSection ? '-rotate-90' : ''}`} />
        </button>

        <AnimatePresence>
          {showPasswordSection && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' as const }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="font-semibold">كلمة المرور الحالية</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="rounded-xl h-11"
                      dir="ltr"
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
                  <Label className="font-semibold">كلمة المرور الجديدة</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="rounded-xl h-11"
                      dir="ltr"
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
                  <Label className="font-semibold">تأكيد كلمة المرور الجديدة</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rounded-xl h-11"
                    dir="ltr"
                  />
                </div>

                {passwordError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">{passwordError}</p>
                  </div>
                )}

                <Button
                  className="w-full bg-gradient-to-l from-nurse to-sky-500 hover:from-sky-600 hover:to-sky-600 rounded-xl h-11 font-bold"
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </div>
  );
}
