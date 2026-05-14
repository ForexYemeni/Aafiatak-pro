'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Save, Loader2, Wallet, X, Percent, Moon, Shield,
  Phone, MessageSquare, FileText, Wrench, MapPin, Users,
  Heart, Gift, Zap, Clock, AlertTriangle, Globe, Briefcase, Building2,
  Database, CheckCircle, Eye, EyeOff, RefreshCw, AlertOctagon, CreditCard,
  Trash2, TriangleAlert
} from 'lucide-react';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface SettingsData {
  commissionRate: number;
  emergencyFee: number;
  deploymentServiceFee: number;
  deploymentCreatorFee: number;
  deploymentApplicantFee: number;
  deploymentFeeResponsible: 'applicant' | 'creator';
  deploymentPaymentMethod: string;
  deploymentWalletNumber: string;
  deploymentWalletOwnerName: string;
  deploymentBankAccountInfo: string;
  bankAccountInfo: string;
  nightFeePercent: number;
  fridayFeePercent: number;
  nightStartHour: number;
  nightEndHour: number;
  minOrderAmount: number;
  loyaltyPointsPerOrder: number;
  loyaltyRedemptionThreshold: number;
  referralReward: number;
  maxNurseClipboardListRadius: number;
  autoAssignEnabled: boolean;
  emergencyAutoDispatch: boolean;
  maintenanceMode: boolean;
  maintenanceMessageAr: string;
  supportPhone: string;
  supportEmail: string;
  supportWhatsApp: string;
  supportPhones: string[];
  supportWhatsAppNumbers: string[];
  termsAndConditionsAr: string;
  privacyPolicyAr: string;
  withdrawalFee: number;
  enabledWalletTypes: string[];
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const defaultSettings: SettingsData = {
  commissionRate: 15,
  emergencyFee: 500,
  deploymentServiceFee: 500,
  deploymentCreatorFee: 500,
  deploymentApplicantFee: 500,
  deploymentFeeResponsible: 'applicant',
  deploymentPaymentMethod: '',
  deploymentWalletNumber: '',
  deploymentWalletOwnerName: '',
  deploymentBankAccountInfo: '',
  bankAccountInfo: '',
  nightFeePercent: 20,
  fridayFeePercent: 15,
  nightStartHour: 22,
  nightEndHour: 6,
  minOrderAmount: 1000,
  loyaltyPointsPerOrder: 10,
  loyaltyRedemptionThreshold: 100,
  referralReward: 50,
  maxNurseClipboardListRadius: 10,
  autoAssignEnabled: true,
  emergencyAutoDispatch: true,
  maintenanceMode: false,
  maintenanceMessageAr: '',
  supportPhone: '',
  supportEmail: '',
  supportWhatsApp: '',
  supportPhones: [],
  supportWhatsAppNumbers: [],
  termsAndConditionsAr: '',
  privacyPolicyAr: '',
  withdrawalFee: 200,
  enabledWalletTypes: ['جيب', 'جوالي', 'فلوسك', 'حوالة بنكية'],
};

export default function AdminSettingsPage() {
  const authFetch = useAuthFetch();
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('commission');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await authFetch('/api/admin/settings');
        const json = await res.json();
        if (json.success && json.data) {
          setSettings({ ...defaultSettings, ...json.data });
        }
      } catch {
        toast.error('فشل تحميل الإعدادات');
      } finally {
        setIsLoading(false);
      }
    };
    void fetchSettings();
  }, [authFetch]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await authFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم حفظ الإعدادات بنجاح');
      } else {
        toast.error(json.message ?? 'فشل حفظ الإعدادات');
      }
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // ── Database Switch State ─────────────────────────────────────────
  const [dbInfo, setDbInfo] = useState<{ maskedUri: string; databaseName: string; isConnected: boolean; connectionState: string; stats: Record<string, number> } | null>(null);
  const [newDbUri, setNewDbUri] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [currentPasswordConfirm, setCurrentPasswordConfirm] = useState('');
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [isSwitchingDb, setIsSwitchingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ status: string; databaseName: string; collectionsCount: number; isEmpty: boolean } | null>(null);
  const [dbSwitchResult, setDbSwitchResult] = useState<{ newAdminPhone: string; newDatabase: string; deploymentTriggered: boolean; nextStep: string } | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  // ── Backup State ──────────────────────────────────────────────────
  const [showBackupSection, setShowBackupSection] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStats, setBackupStats] = useState<{ documents: number; collections: number } | null>(null);

  // ── Reset All Data State ──────────────────────────────────────────
  const [showResetSection, setShowResetSection] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ totalDeleted: number; summary: Record<string, number> } | null>(null);

  // Fetch current database info when database section is opened
  useEffect(() => {
    if (activeSection === 'database' && !dbInfo) {
      const fetchDbInfo = async () => {
        try {
          const res = await authFetch('/api/admin/database/current');
          const json = await res.json();
          if (json.success && json.data) {
            setDbInfo(json.data);
          }
        } catch {
          toast.error('فشل تحميل معلومات قاعدة البيانات');
        }
      };
      void fetchDbInfo();
    }
  }, [activeSection, authFetch, dbInfo]);

  const handleTestDbConnection = async () => {
    if (!newDbUri.trim()) {
      toast.error('أدخل رابط MongoDB أولاً');
      return;
    }
    setIsTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await authFetch('/api/admin/database/validate', {
        method: 'POST',
        body: JSON.stringify({ uri: newDbUri.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setDbTestResult(json.data);
        toast.success('تم الاتصال بقاعدة البيانات بنجاح!');
      } else {
        toast.error(json.error?.message ?? 'فشل الاتصال بقاعدة البيانات');
      }
    } catch {
      toast.error('حدث خطأ أثناء اختبار الاتصال');
    } finally {
      setIsTestingDb(false);
    }
  };

  const handleSwitchDatabase = async () => {
    // Validation
    if (!newDbUri.trim()) { toast.error('أدخل رابط MongoDB الجديد'); return; }
    if (!newAdminPhone.trim()) { toast.error('أدخل رقم هاتف الإدارة الجديد'); return; }
    if (!newAdminPassword.trim()) { toast.error('أدخل كلمة مرور الإدارة الجديدة'); return; }
    if (newAdminPassword !== confirmAdminPassword) { toast.error('كلمة المرور وتأكيدها غير متطابقتين'); return; }
    if (newAdminPassword.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (!currentPasswordConfirm.trim()) { toast.error('أدخل كلمة مرور الإدارة الحالية للتأكيد'); return; }

    // Double confirmation
    const confirmed = window.confirm(
      '⚠️ تحذير مهم!\n\n' +
      'سيتم تبديل قاعدة البيانات بالكامل. هذا الإجراء لا يمكن التراجع عنه!\n\n' +
      'هل أنت متأكد من رغبتك في المتابعة؟'
    );
    if (!confirmed) return;

    setIsSwitchingDb(true);
    setDbSwitchResult(null);
    try {
      const res = await authFetch('/api/admin/database/switch', {
        method: 'POST',
        body: JSON.stringify({
          newUri: newDbUri.trim(),
          adminPhone: newAdminPhone.trim(),
          adminPassword: newAdminPassword,
          currentPassword: currentPasswordConfirm,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDbSwitchResult(json.data);
        toast.success('تم تبديل قاعدة البيانات بنجاح!');
        // Clear form
        setNewDbUri('');
        setNewAdminPhone('');
        setNewAdminPassword('');
        setConfirmAdminPassword('');
        setCurrentPasswordConfirm('');
        setDbTestResult(null);
      } else {
        toast.error(json.error?.message ?? 'فشل تبديل قاعدة البيانات');
      }
    } catch {
      toast.error('حدث خطأ أثناء تبديل قاعدة البيانات');
    } finally {
      setIsSwitchingDb(false);
    }
  };

  // ── Backup Handler ────────────────────────────────────────────────
  const handleCreateBackup = async () => {
    if (!backupPassword.trim()) {
      toast.error('أدخل كلمة المرور للمتابعة');
      return;
    }
    setIsBackingUp(true);
    setBackupStats(null);
    try {
      const res = await authFetch('/api/admin/backup', {
        method: 'POST',
        body: JSON.stringify({ password: backupPassword }),
      });
      if (!res.ok) {
        let msg = 'فشل إنشاء النسخة الاحتياطية';
        try { const j = await res.json(); msg = j.error?.message ?? j.message ?? msg; } catch {}
        toast.error(msg);
        return;
      }
      const docs = Number(res.headers.get('X-Backup-Documents') ?? 0);
      const cols = Number(res.headers.get('X-Backup-Collections') ?? 0);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `aafiatak-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupStats({ documents: docs, collections: cols });
      setBackupPassword('');
      toast.success('تم إنشاء النسخة الاحتياطية وتحميلها بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء إنشاء النسخة الاحتياطية');
    } finally {
      setIsBackingUp(false);
    }
  };

  // ── Reset All Data Handler ────────────────────────────────────────
  const handleResetAllData = async () => {
    if (resetConfirmText !== 'احذف') {
      toast.error('اكتب كلمة "احذف" بالضبط في حقل التأكيد');
      return;
    }
    if (!resetPassword.trim()) {
      toast.error('أدخل كلمة المرور للتأكيد');
      return;
    }

    setIsResetting(true);
    setResetResult(null);
    try {
      const res = await authFetch('/api/admin/reset-data', {
        method: 'POST',
        body: JSON.stringify({ password: resetPassword, confirmText: resetConfirmText }),
      });
      const json = await res.json();
      if (json.success) {
        setResetResult(json.data);
        setResetPassword('');
        setResetConfirmText('');
        toast.success('تم حذف جميع البيانات بنجاح');
      } else {
        toast.error(json.error?.message ?? json.message ?? 'فشل حذف البيانات');
      }
    } catch {
      toast.error('حدث خطأ أثناء حذف البيانات');
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-admin" />
      </div>
    );
  }

  const sections = [
    { id: 'commission', label: 'العمولة والرسوم', icon: Percent },
    { id: 'deployment', label: 'إعدادات التكليفات', icon: Briefcase },
    { id: 'withdrawal', label: 'سحب الأرباح', icon: Wallet },
    { id: 'loyalty', label: 'نقاط الولاء', icon: Gift },
    { id: 'autoassign', label: 'التعيين التلقائي', icon: Zap },
    { id: 'support', label: 'أرقام التواصل', icon: Phone },
    { id: 'legal', label: 'المستندات القانونية', icon: FileText },
    { id: 'maintenance', label: 'وضع الصيانة', icon: Wrench },
    { id: 'database', label: 'قاعدة البيانات', icon: Database },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemAnim}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-admin/20 to-admin/5 flex items-center justify-center border border-admin/20">
              <Settings className="w-6 h-6 text-admin" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">إعدادات المنصة</h2>
              <p className="text-muted-foreground text-sm">تخصيص إعدادات منصة عافيتك</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-admin hover:bg-admin/90 gap-2 min-w-36 shadow-lg shadow-admin/20"
            size="lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جارٍ الحفظ...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                حفظ الإعدادات
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Section Navigation Tabs */}
      <motion.div variants={itemAnim}>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeSection === section.id
                  ? 'bg-admin text-white shadow-md shadow-admin/20'
                  : 'glass hover:bg-admin/10 text-muted-foreground hover:text-foreground'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Commission & Fees */}
      {activeSection === 'commission' && (
        <motion.div variants={itemAnim} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="admin">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Percent className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                العمولة والرسوم
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">نسبة العمولة (%)</Label>
                  <Input
                    type="number"
                    value={settings.commissionRate}
                    onChange={(e) => updateField('commissionRate', Number(e.target.value))}
                    min={0}
                    max={100}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">رسوم الطوارئ (ر.ي)</Label>
                  <Input
                    type="number"
                    value={settings.emergencyFee}
                    onChange={(e) => updateField('emergencyFee', Number(e.target.value))}
                    min={0}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">رسوم الخدمة الليلية (%)</Label>
                  <Input
                    type="number"
                    value={settings.nightFeePercent}
                    onChange={(e) => updateField('nightFeePercent', Number(e.target.value))}
                    min={0}
                    max={100}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">رسوم خدمة الجمعة (%)</Label>
                  <Input
                    type="number"
                    value={settings.fridayFeePercent}
                    onChange={(e) => updateField('fridayFeePercent', Number(e.target.value))}
                    min={0}
                    max={100}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-indigo-500" />
                    بداية أوقات الخدمة الليلية (ساعة)
                  </Label>
                  <Input
                    type="number"
                    value={settings.nightStartHour}
                    onChange={(e) => updateField('nightStartHour', Number(e.target.value))}
                    min={0}
                    max={23}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-indigo-500" />
                    نهاية أوقات الخدمة الليلية (ساعة)
                  </Label>
                  <Input
                    type="number"
                    value={settings.nightEndHour}
                    onChange={(e) => updateField('nightEndHour', Number(e.target.value))}
                    min={0}
                    max={23}
                    className="bg-background/50"
                  />
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Deployment Settings */}
      {activeSection === 'deployment' && (
        <motion.div variants={itemAnim} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="admin">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                إعدادات التكليفات
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-6">
                {/* Info banner */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800/50">
                  <Briefcase className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400 mb-1">إعدادات التكليفات</p>
                    <p className="text-xs text-cyan-600/80 dark:text-cyan-400/70 leading-relaxed">
                      تحكم في رسوم وعمولات خدمة التكليف ومعلومات الحساب البنكي لتحويل الأرباح
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-cyan-500" />
                      رسوم خدمة التكليف (ر.ي)
                    </Label>
                    <Input
                      type="number"
                      value={settings.deploymentServiceFee}
                      onChange={(e) => updateField('deploymentServiceFee', Number(e.target.value))}
                      min={0}
                      className="bg-background/50"
                    />
                    <p className="text-[10px] text-muted-foreground">رسوم خدمة تُضاف لكل تكليف جديد</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-amber-500" />
                      نسبة عمولة الإدارة (%)
                    </Label>
                    <Input
                      type="number"
                      value={settings.commissionRate}
                      onChange={(e) => updateField('commissionRate', Number(e.target.value))}
                      min={0}
                      max={100}
                      className="bg-background/50"
                    />
                    <p className="text-[10px] text-muted-foreground">نسبة العمولة التي تخصمها الإدارة من كل تكليف</p>
                  </div>
                </div>

                <Separator />

                {/* Fee Responsibility */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                      <Wallet className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">من يتحمل رسوم التكليف</p>
                      <p className="text-[10px] text-muted-foreground">اختر الشخص المسؤول عن دفع رسوم التكليف</p>
                    </div>
                  </div>

                  {/* Fee Responsibility Toggle */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => updateField('deploymentFeeResponsible', 'applicant')}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        settings.deploymentFeeResponsible === 'applicant'
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                          : 'border-border bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      <Users className={`w-6 h-6 mx-auto mb-2 ${settings.deploymentFeeResponsible === 'applicant' ? 'text-teal-600 dark:text-teal-400' : 'text-muted-foreground'}`} />
                      <p className={`text-sm font-medium ${settings.deploymentFeeResponsible === 'applicant' ? 'text-teal-700 dark:text-teal-300' : 'text-muted-foreground'}`}>
                        المكلف (المتقدم)
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">الممرض المتقدم يدفع الرسوم</p>
                    </button>
                    <button
                      onClick={() => updateField('deploymentFeeResponsible', 'creator')}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        settings.deploymentFeeResponsible === 'creator'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-border bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      <Users className={`w-6 h-6 mx-auto mb-2 ${settings.deploymentFeeResponsible === 'creator' ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`} />
                      <p className={`text-sm font-medium ${settings.deploymentFeeResponsible === 'creator' ? 'text-orange-700 dark:text-orange-300' : 'text-muted-foreground'}`}>
                        صاحب التكليف
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">منشئ التكليف يدفع الرسوم</p>
                    </button>
                  </div>

                  {/* Fee Amount */}
                  <div className="space-y-2 max-w-xs">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      {settings.deploymentFeeResponsible === 'applicant' ? (
                        <Users className="w-3.5 h-3.5 text-teal-500" />
                      ) : (
                        <Users className="w-3.5 h-3.5 text-orange-500" />
                      )}
                      مبلغ الرسوم (ر.ي)
                    </Label>
                    <Input
                      type="number"
                      value={settings.deploymentFeeResponsible === 'applicant' ? settings.deploymentApplicantFee : settings.deploymentCreatorFee}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (settings.deploymentFeeResponsible === 'applicant') {
                          updateField('deploymentApplicantFee', val);
                        } else {
                          updateField('deploymentCreatorFee', val);
                        }
                      }}
                      min={0}
                      className="bg-background/50"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {settings.deploymentFeeResponsible === 'applicant'
                        ? 'الرسوم التي يدفعها الممرض المتقدم للتكليف'
                        : 'الرسوم التي يدفعها منشئ التكليف'}
                    </p>
                  </div>

                  {/* Preview */}
                  <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800/50">
                    <p className="text-[10px] text-cyan-600 dark:text-cyan-400 mb-2 font-medium">معاينة الرسوم عند إنشاء تكليف:</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">المسؤول عن الرسوم</span>
                        <span className="font-medium">
                          {settings.deploymentFeeResponsible === 'applicant' ? 'المكلف (المتقدم)' : 'صاحب التكليف'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">مبلغ الرسوم</span>
                        <span className="font-medium">
                          {settings.deploymentFeeResponsible === 'applicant'
                            ? `${settings.deploymentApplicantFee} ر.ي`
                            : `${settings.deploymentCreatorFee} ر.ي`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Payment Method Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">معلومات الدفع</p>
                      <p className="text-[10px] text-muted-foreground">تظهر للمكلف عند الحاجة للدفع</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                        طريقة الدفع
                      </Label>
                      <Input
                        value={settings.deploymentPaymentMethod}
                        onChange={(e) => updateField('deploymentPaymentMethod', e.target.value)}
                        placeholder="مثال: جيب، جوالي، فلوسك، حوالة بنكية"
                        className="bg-background/50"
                      />
                      <p className="text-[10px] text-muted-foreground">نوع المحفظة أو طريقة التحويل</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                        رقم المحفظة
                      </Label>
                      <Input
                        value={settings.deploymentWalletNumber}
                        onChange={(e) => updateField('deploymentWalletNumber', e.target.value)}
                        placeholder="رقم الحساب أو المحفظة"
                        dir="ltr"
                        className="bg-background/50"
                      />
                      <p className="text-[10px] text-muted-foreground">رقم المحفظة أو الحساب للتحويل إليه</p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-500" />
                        اسم صاحب المحفظة
                      </Label>
                      <Input
                        value={settings.deploymentWalletOwnerName}
                        onChange={(e) => updateField('deploymentWalletOwnerName', e.target.value)}
                        placeholder="الاسم الكامل لصاحب المحفظة"
                        className="bg-background/50"
                      />
                      <p className="text-[10px] text-muted-foreground">الاسم المسجل على المحفظة أو الحساب</p>
                    </div>
                  </div>

                  {/* Payment Info Preview */}
                  {(settings.deploymentPaymentMethod || settings.deploymentWalletNumber || settings.deploymentWalletOwnerName) && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-2 font-medium">معاينة ما يراه المكلف عند الدفع:</p>
                      <div className="space-y-1.5 text-xs">
                        {settings.deploymentPaymentMethod && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">طريقة الدفع</span>
                            <span className="font-medium">{settings.deploymentPaymentMethod}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">المبلغ</span>
                          <span className="font-medium">
                            {settings.deploymentFeeResponsible === 'applicant'
                              ? `${settings.deploymentApplicantFee} ر.ي`
                              : `${settings.deploymentCreatorFee} ر.ي`
                            }
                          </span>
                        </div>
                        {settings.deploymentWalletNumber && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">رقم المحفظة</span>
                            <span className="font-medium" dir="ltr">{settings.deploymentWalletNumber}</span>
                          </div>
                        )}
                        {settings.deploymentWalletOwnerName && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">اسم صاحب المحفظة</span>
                            <span className="font-medium">{settings.deploymentWalletOwnerName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Bank Account Info for Deployments (legacy) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                    معلومات الحساب البنكي الإضافية
                  </Label>
                  <Textarea
                    value={settings.deploymentBankAccountInfo}
                    onChange={(e) => updateField('deploymentBankAccountInfo', e.target.value)}
                    placeholder="معلومات إضافية مثل: اسم البنك، رقم الحساب، IBAN..."
                    rows={3}
                    className="text-sm bg-background/50"
                  />
                  <p className="text-[10px] text-muted-foreground">معلومات بنكية إضافية تظهر للمكلف (اختياري)</p>
                </div>

                <Separator />

                {/* General Bank Account Info */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                    معلومات الحساب البنكي العام
                  </Label>
                  <Textarea
                    value={settings.bankAccountInfo}
                    onChange={(e) => updateField('bankAccountInfo', e.target.value)}
                    placeholder="اسم البنك: &#10;رقم الحساب: &#10;اسم صاحب الحساب: &#10;IBAN:"
                    rows={5}
                    className="text-sm bg-background/50"
                  />
                  <p className="text-[10px] text-muted-foreground">معلومات الحساب البنكي لتحويل أرباح الممرضين</p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Withdrawal & Nurse Payout Settings */}
      {activeSection === 'withdrawal' && (
        <motion.div variants={itemAnim} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="admin">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                إعدادات سحب الأرباح
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-6">
                <div className="space-y-2 max-w-xs">
                  <Label className="text-sm font-medium">رسوم السحب (ر.ي)</Label>
                  <Input
                    type="number"
                    value={settings.withdrawalFee}
                    onChange={(e) => updateField('withdrawalFee', Number(e.target.value))}
                    min={0}
                    className="bg-background/50"
                  />
                  <p className="text-[10px] text-muted-foreground">رسوم تُخصم تلقائياً من كل طلب سحب أرباح</p>
                </div>

                <Separator />

                {/* Wallet Types */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Wallet className="w-4 h-4" />
                        أنواع المحافظ المتاحة للسحب
                      </Label>
                      <p className="text-[10px] text-muted-foreground mt-0.5">المحافظ التي يمكن للممرضين اختيارها عند طلب السحب</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateField('enabledWalletTypes', [...settings.enabledWalletTypes, ''])}
                      className="text-xs gap-1 border-admin/20 hover:bg-admin/5"
                    >
                      <Plus className="w-3 h-3" />
                      إضافة محفظة
                    </Button>
                  </div>
                  {settings.enabledWalletTypes.length === 0 && (
                    <div className="text-center py-6 glass rounded-xl">
                      <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">لم يتم إضافة محافظ بعد</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {settings.enabledWalletTypes.map((wallet, i) => (
                      <div key={`wallet-${i}`} className="flex gap-2 glass rounded-xl p-2">
                        <Input
                          value={wallet}
                          onChange={(e) => {
                            const updated = [...settings.enabledWalletTypes];
                            updated[i] = e.target.value;
                            updateField('enabledWalletTypes', updated);
                          }}
                          placeholder="اسم المحفظة"
                          className="bg-background/50 border-0"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive hover:bg-destructive/10 w-8 h-8"
                          onClick={() => {
                            const updated = settings.enabledWalletTypes.filter((_, idx) => idx !== i);
                            updateField('enabledWalletTypes', updated);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Loyalty & Referral */}
      {activeSection === 'loyalty' && (
        <motion.div variants={itemAnim} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="admin">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Gift className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                نقاط الولاء والإحالة
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-pink-500" />
                    نقاط لكل طلب
                  </Label>
                  <Input
                    type="number"
                    value={settings.loyaltyPointsPerOrder}
                    onChange={(e) => updateField('loyaltyPointsPerOrder', Number(e.target.value))}
                    min={0}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">حد الاسترداد (نقاط)</Label>
                  <Input
                    type="number"
                    value={settings.loyaltyRedemptionThreshold}
                    onChange={(e) => updateField('loyaltyRedemptionThreshold', Number(e.target.value))}
                    min={0}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-500" />
                    مكافأة الإحالة (نقاط)
                  </Label>
                  <Input
                    type="number"
                    value={settings.referralReward}
                    onChange={(e) => updateField('referralReward', Number(e.target.value))}
                    min={0}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">الحد الأدنى للطلب (ر.ي)</Label>
                  <Input
                    type="number"
                    value={settings.minOrderAmount}
                    onChange={(e) => updateField('minOrderAmount', Number(e.target.value))}
                    min={0}
                    className="bg-background/50"
                  />
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Auto Assignment */}
      {activeSection === 'autoassign' && (
        <motion.div variants={itemAnim} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="admin">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                التعيين التلقائي
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-5">
                <div className="flex items-center justify-between p-4 glass rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">التعيين التلقائي للطلبات</p>
                      <p className="text-xs text-muted-foreground">تعيين الممرضين تلقائيًا للطلبات الجديدة</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.autoAssignEnabled}
                    onCheckedChange={(v) => updateField('autoAssignEnabled', v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 glass rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">الإرسال التلقائي للطوارئ</p>
                      <p className="text-xs text-muted-foreground">إرسال أقرب ممرض تلقائيًا لحالات الطوارئ</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.emergencyAutoDispatch}
                    onCheckedChange={(v) => updateField('emergencyAutoDispatch', v)}
                  />
                </div>

                <div className="space-y-2 max-w-xs">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    نصف قطر التعيين الأقصى (كم)
                  </Label>
                  <Input
                    type="number"
                    value={settings.maxNurseClipboardListRadius}
                    onChange={(e) => updateField('maxNurseClipboardListRadius', Number(e.target.value))}
                    min={1}
                    max={100}
                    className="bg-background/50"
                  />
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Support Contact Numbers */}
      {activeSection === 'support' && (
        <motion.div variants={itemAnim} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="admin">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                أرقام التواصل والدعم
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-6">
                {/* Phone Numbers */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-blue-500" />
                      أرقام الهاتف
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateField('supportPhones', [...settings.supportPhones, ''])}
                      className="text-xs gap-1 border-admin/20 hover:bg-admin/5"
                    >
                      <Plus className="w-3 h-3" />
                      إضافة رقم
                    </Button>
                  </div>
                  {settings.supportPhones.length === 0 && (
                    <div className="text-center py-4 glass rounded-xl">
                      <Phone className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">لم يتم إضافة أرقام بعد</p>
                    </div>
                  )}
                  {settings.supportPhones.map((phone, i) => (
                    <div key={`phone-${i}`} className="flex gap-2">
                      <Input
                        value={phone}
                        onChange={(e) => {
                          const updated = [...settings.supportPhones];
                          updated[i] = e.target.value;
                          updateField('supportPhones', updated);
                        }}
                        placeholder="967XXXXXXXX+"
                        dir="ltr"
                        className="bg-background/50"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:bg-destructive/10 w-8 h-8"
                        onClick={() => {
                          const updated = settings.supportPhones.filter((_, idx) => idx !== i);
                          updateField('supportPhones', updated);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* WhatsApp Numbers */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-green-500" />
                      أرقام الواتساب
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateField('supportWhatsAppNumbers', [...settings.supportWhatsAppNumbers, ''])}
                      className="text-xs gap-1 border-admin/20 hover:bg-admin/5"
                    >
                      <Plus className="w-3 h-3" />
                      إضافة رقم
                    </Button>
                  </div>
                  {settings.supportWhatsAppNumbers.length === 0 && (
                    <div className="text-center py-4 glass rounded-xl">
                      <MessageSquare className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">لم يتم إضافة أرقام بعد</p>
                    </div>
                  )}
                  {settings.supportWhatsAppNumbers.map((wa, i) => (
                    <div key={`wa-${i}`} className="flex gap-2">
                      <Input
                        value={wa}
                        onChange={(e) => {
                          const updated = [...settings.supportWhatsAppNumbers];
                          updated[i] = e.target.value;
                          updateField('supportWhatsAppNumbers', updated);
                        }}
                        placeholder="967XXXXXXXX+"
                        dir="ltr"
                        className="bg-background/50"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:bg-destructive/10 w-8 h-8"
                        onClick={() => {
                          const updated = settings.supportWhatsAppNumbers.filter((_, idx) => idx !== i);
                          updateField('supportWhatsAppNumbers', updated);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Legal Content */}
      {activeSection === 'legal' && (
        <motion.div variants={itemAnim} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="admin">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                المستندات القانونية
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">شروط والأحكام</Label>
                  <Textarea
                    value={settings.termsAndConditionsAr}
                    onChange={(e) => updateField('termsAndConditionsAr', e.target.value)}
                    placeholder="اكتب شروط وأحكام استخدام المنصة هنا..."
                    rows={8}
                    className="text-sm bg-background/50"
                  />
                  <p className="text-[10px] text-muted-foreground">يمكنك استخدام HTML لتنسيق النص (عناوين، قوائم، روابط...)</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">سياسة الخصوصية</Label>
                  <Textarea
                    value={settings.privacyPolicyAr}
                    onChange={(e) => updateField('privacyPolicyAr', e.target.value)}
                    placeholder="اكتب سياسة الخصوصية هنا..."
                    rows={8}
                    className="text-sm bg-background/50"
                  />
                  <p className="text-[10px] text-muted-foreground">يمكنك استخدام HTML لتنسيق النص</p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Maintenance Mode */}
      {activeSection === 'maintenance' && (
        <motion.div variants={itemAnim} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="admin" className={settings.maintenanceMode ? 'border-red-200 dark:border-red-900/50' : ''}>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${settings.maintenanceMode ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-900/30'}`}>
                  <Wrench className={`w-4 h-4 ${settings.maintenanceMode ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`} />
                </div>
                وضع الصيانة
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-5">
                <div className="flex items-center justify-between p-4 glass rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings.maintenanceMode ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted'}`}>
                      <Wrench className={`w-5 h-5 ${settings.maintenanceMode ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">تفعيل وضع الصيانة</p>
                      <p className="text-xs text-muted-foreground">تعطيل المنصة مؤقتًا للصيانة</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.maintenanceMode}
                    onCheckedChange={(v) => updateField('maintenanceMode', v)}
                  />
                </div>
                {settings.maintenanceMode && (
                  <div className="space-y-2 border-2 border-red-200 dark:border-red-900/50 rounded-xl p-4 bg-red-50/50 dark:bg-red-950/20">
                    <Label className="text-sm font-medium text-red-700 dark:text-red-400">رسالة الصيانة</Label>
                    <Textarea
                      value={settings.maintenanceMessageAr}
                      onChange={(e) => updateField('maintenanceMessageAr', e.target.value)}
                      placeholder="المنصة حاليًا تحت الصيانة، سنرجع قريبًا..."
                      rows={3}
                      className="bg-background/50"
                    />
                  </div>
                )}
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Database Management */}
      {activeSection === 'database' && (
        <motion.div variants={itemAnim} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Current Database Info */}
          <GlassCard variant="admin">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <Database className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                قاعدة البيانات الحالية
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
                  <CheckCircle className={`w-5 h-5 shrink-0 ${dbInfo?.isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">الحالة: {dbInfo?.isConnected ? 'متصلة' : 'غير متصلة'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate" dir="ltr">{dbInfo?.maskedUri || 'جارٍ التحميل...'}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">{dbInfo?.databaseName || '---'}</span>
                </div>
                {dbInfo?.stats && Object.keys(dbInfo.stats).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(dbInfo.stats).filter(([, v]) => v >= 0).map(([col, count]) => (
                      <div key={col} className="p-2.5 rounded-xl glass">
                        <p className="text-[10px] text-muted-foreground truncate">{col}</p>
                        <p className="text-sm font-bold">{count}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Success Result */}
          {dbSwitchResult && (
            <GlassCard variant="admin" className="border-emerald-200 dark:border-emerald-800/50">
              <GlassCardContent>
                <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">تم تبديل قاعدة البيانات بنجاح!</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between max-w-xs mx-auto p-3 rounded-xl bg-white/50 dark:bg-black/20">
                      <span className="text-muted-foreground">رقم الإدارة الجديد</span>
                      <span className="font-bold text-lg" dir="ltr">{dbSwitchResult.newAdminPhone}</span>
                    </div>
                    <div className="flex items-center justify-between max-w-xs mx-auto p-3 rounded-xl bg-white/50 dark:bg-black/20">
                      <span className="text-muted-foreground">قاعدة البيانات</span>
                      <span className="font-medium">{dbSwitchResult.newDatabase}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-center p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                    <AlertOctagon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">{dbSwitchResult.nextStep}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">احفظ بيانات الدخول الجديدة الآن! لن تظهر مرة أخرى.</p>
                </div>
              </GlassCardContent>
            </GlassCard>
          )}

          {/* Switch Database Form */}
          <GlassCard variant="admin" className="border-rose-200 dark:border-rose-900/50">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                تبديل إلى قاعدة بيانات جديدة
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-6">
                {/* Warning Banner */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                  <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">تحذير مهم</p>
                    <ul className="text-xs text-red-600/80 dark:text-red-400/70 space-y-1 list-disc mr-4 leading-relaxed">
                      <li>سيتم فقدان جميع بيانات الجلسة الحالية</li>
                      <li>سيتم إنشاء حساب إدارة بالبيانات التي تكتبها أدناه في القاعدة الجديدة</li>
                      <li>سيتم تحديث متغيرات Vercel وإعادة النشر تلقائياً</li>
                      <li>الإجراء لا يمكن التراجع عنه</li>
                    </ul>
                  </div>
                </div>

                {/* New MongoDB URI */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-rose-500" />
                    رابط MongoDB الجديد
                  </Label>
                  <Input
                    value={newDbUri}
                    onChange={(e) => { setNewDbUri(e.target.value); setDbTestResult(null); }}
                    placeholder="mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/dbname"
                    dir="ltr"
                    className="bg-background/50 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">تأكد أن IP Access List = 0.0.0.0/0 في إعدادات MongoDB Atlas</p>
                </div>

                {/* Test Connection Button */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleTestDbConnection}
                    disabled={isTestingDb || !newDbUri.trim()}
                    className="gap-2 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                  >
                    {isTestingDb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    {isTestingDb ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
                  </Button>
                  {dbTestResult && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      <span>متصل - {dbTestResult.databaseName} ({dbTestResult.collectionsCount} مجموعة)</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* New Admin Credentials */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">بيانات حساب الإدارة في القاعدة الجديدة</p>
                      <p className="text-[10px] text-muted-foreground">اكتب بيانات الدخول التي تريدها للحساب الإداري</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-blue-500" />
                        رقم هاتف الإدارة الجديد
                      </Label>
                      <Input
                        value={newAdminPhone}
                        onChange={(e) => setNewAdminPhone(e.target.value)}
                        placeholder="700000000"
                        dir="ltr"
                        className="bg-background/50"
                      />
                      <p className="text-[10px] text-muted-foreground">9 أرقام تبدأ بـ 7</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">كلمة المرور الجديدة</Label>
                      <div className="relative">
                        <Input
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="6 أحرف على الأقل"
                          className="bg-background/50 pr-10"
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
                      <Label className="text-sm font-medium">تأكيد كلمة المرور</Label>
                      <Input
                        value={confirmAdminPassword}
                        onChange={(e) => setConfirmAdminPassword(e.target.value)}
                        type="password"
                        placeholder="أعد كتابة كلمة المرور"
                        className="bg-background/50"
                      />
                      {confirmAdminPassword && confirmAdminPassword !== newAdminPassword && (
                        <p className="text-[10px] text-red-500">كلمة المرور غير متطابقة</p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Current Password Confirmation */}
                <div className="space-y-2 max-w-md">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-500" />
                    تأكيد بكلمة مرور الإدارة الحالية
                  </Label>
                  <div className="relative">
                    <Input
                      value={currentPasswordConfirm}
                      onChange={(e) => setCurrentPasswordConfirm(e.target.value)}
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="أدخل كلمة مرورك الحالية للتأكيد"
                      className="bg-background/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">هذا الإجراء يتطلب تأكيدك بكلمة مرورك الحالية</p>
                </div>

                {/* Switch Button */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSwitchDatabase}
                    disabled={isSwitchingDb || !newDbUri.trim() || !newAdminPhone.trim() || !newAdminPassword.trim() || !currentPasswordConfirm.trim()}
                    className="bg-rose-600 hover:bg-rose-700 gap-2 min-w-48 shadow-lg shadow-rose-600/20 text-white"
                    size="lg"
                  >
                    {isSwitchingDb ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جارٍ التبديل...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        تبديل قاعدة البيانات
                      </>
                    )}
                  </Button>
                  {isSwitchingDb && (
                    <p className="text-xs text-muted-foreground">قد تستغرق هذه العملية بضع دقائق...</p>
                  )}
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* ── Full Backup ──────────────────────────────────────────── */}
      <motion.div variants={itemAnim}>
        <GlassCard className="border-emerald-200 dark:border-emerald-900/40">
          <GlassCardHeader>
            <div className="flex items-center justify-between">
              <GlassCardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                نسخة احتياطية كاملة من الألف إلى الياء
              </GlassCardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowBackupSection(!showBackupSection); setBackupStats(null); setBackupPassword(''); }}
                className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 gap-1.5"
              >
                {showBackupSection ? <X className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" />}
                {showBackupSection ? 'إغلاق' : 'إنشاء نسخة'}
              </Button>
            </div>
          </GlassCardHeader>

          {showBackupSection && (
            <GlassCardContent className="space-y-5">

              {/* What's included */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Users, label: 'جميع المستخدمين', sub: 'مستفيدون، ممرضون، مشرفون' },
                  { icon: FileText, label: 'الطلبات والتكليفات', sub: 'جميع طلبات الخدمة والتكليفات' },
                  { icon: MessageSquare, label: 'المحادثات والرسائل', sub: 'جميع الدردشات والإشعارات' },
                  { icon: Wallet, label: 'المعاملات المالية', sub: 'طلبات السحب والكوبونات' },
                  { icon: AlertTriangle, label: 'حالات الطوارئ', sub: 'طلبات الطوارئ والإسناد' },
                  { icon: Settings, label: 'إعدادات المنصة', sub: 'جميع إعدادات النظام' },
                  { icon: Shield, label: 'متغيرات Vercel', sub: 'MONGODB_URI, JWT_SECRET وغيرها' },
                  { icon: Zap, label: 'الخدمات والتقييمات', sub: 'قوائم الخدمات وتقييمات المستخدمين' },
                ].map(({ icon: Icon, label, sub }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">{label}</p>
                      <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="border-emerald-100 dark:border-emerald-900/30" />

              {/* Success result */}
              {backupStats && (
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-4">
                  <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      تم تنزيل النسخة الاحتياطية بنجاح
                    </p>
                    <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                      {backupStats.documents.toLocaleString('ar')} وثيقة من {backupStats.collections} مجموعة — ملف JSON يمكن استخدامه لاستعادة البيانات
                    </p>
                  </div>
                </div>
              )}

              {/* Password field */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  كلمة مرور حساب الإدارة
                </Label>
                <div className="relative">
                  <Input
                    type={showBackupPassword ? 'text' : 'password'}
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBackup(); }}
                    placeholder="أدخل كلمة مرورك للتأكيد قبل التنزيل"
                    dir="ltr"
                    className="bg-background/50 pl-10"
                    disabled={isBackingUp}
                  />
                  <button
                    type="button"
                    onClick={() => setShowBackupPassword(!showBackupPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showBackupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  النسخة الاحتياطية تحتوي على بيانات حساسة — تأكد من حفظها في مكان آمن
                </p>
              </div>

              {/* Download button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleCreateBackup}
                  disabled={isBackingUp || !backupPassword.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 gap-2 min-w-52 shadow-lg shadow-emerald-600/20 text-white"
                  size="lg"
                >
                  {isBackingUp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جارٍ تجميع البيانات...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      تنزيل النسخة الاحتياطية
                    </>
                  )}
                </Button>
                {isBackingUp && (
                  <p className="text-xs text-muted-foreground">قد يستغرق هذا بضع ثوانٍ حسب حجم البيانات...</p>
                )}
              </div>

            </GlassCardContent>
          )}
        </GlassCard>
      </motion.div>

      {/* ── Danger Zone: Reset All Data ─────────────────────────── */}
      <motion.div variants={itemAnim}>
        <GlassCard className="border-red-200 dark:border-red-900/50">
          <GlassCardHeader>
            <div className="flex items-center justify-between">
              <GlassCardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                منطقة الخطر — حذف جميع البيانات
              </GlassCardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowResetSection(!showResetSection); setResetResult(null); setResetPassword(''); setResetConfirmText(''); }}
                className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 gap-1.5"
              >
                {showResetSection ? <X className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                {showResetSection ? 'إغلاق' : 'إظهار'}
              </Button>
            </div>
          </GlassCardHeader>

          {showResetSection && (
            <GlassCardContent className="space-y-5">

              {/* Warning Banner */}
              <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 p-4">
                <TriangleAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">تحذير: هذا الإجراء لا يمكن التراجع عنه</p>
                  <p className="text-xs text-red-600/80 dark:text-red-400/80 leading-relaxed">
                    سيتم حذف جميع البيانات التالية نهائياً وبشكل دائم:
                  </p>
                  <ul className="text-xs text-red-600/70 dark:text-red-400/70 space-y-0.5 mt-2 list-none">
                    {[
                      'جميع حسابات المستفيدين',
                      'جميع حسابات الممرضين',
                      'جميع حسابات المشرفين الفرعيين',
                      'جميع الطلبات والتكليفات',
                      'جميع الإشعارات',
                      'جميع المحادثات والرسائل',
                      'جميع المعاملات المالية',
                      'جميع طلبات السحب',
                      'جميع حالات الطوارئ',
                      'جميع التقييمات والشكاوى',
                      'جميع الكوبونات والمكافآت',
                      'سجلات النشاط',
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
                    ✓ سيبقى فقط: حساب الإدارة الرئيسي + إعدادات المنصة
                  </p>
                </div>
              </div>

              <Separator className="border-red-100 dark:border-red-900/30" />

              {/* Result Banner */}
              {resetResult && (
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-4">
                  <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      تم الحذف بنجاح — {resetResult.totalDeleted.toLocaleString('ar')} وثيقة محذوفة
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(resetResult.summary).map(([col, count]) => (
                        <span
                          key={col}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                        >
                          {col}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation Steps */}
              <div className="space-y-4">
                {/* Step 1: Type confirmation word */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs flex items-center justify-center font-bold">١</span>
                    اكتب كلمة التأكيد
                  </Label>
                  <Input
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder='اكتب "احذف" بالعربية للتأكيد'
                    dir="rtl"
                    className={`bg-background/50 border transition-colors ${
                      resetConfirmText === 'احذف'
                        ? 'border-red-400 dark:border-red-600 focus:ring-red-300'
                        : 'border-input'
                    }`}
                    disabled={isResetting}
                  />
                  {resetConfirmText.length > 0 && resetConfirmText !== 'احذف' && (
                    <p className="text-[10px] text-red-500">اكتب بالضبط: احذف</p>
                  )}
                  {resetConfirmText === 'احذف' && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> صحيح
                    </p>
                  )}
                </div>

                {/* Step 2: Password */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs flex items-center justify-center font-bold">٢</span>
                    كلمة مرور حساب الإدارة
                  </Label>
                  <div className="relative">
                    <Input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="أدخل كلمة مرورك الحالية"
                      dir="ltr"
                      className="bg-background/50 pl-10"
                      disabled={isResetting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">مطلوبة للتحقق من هويتك قبل تنفيذ الحذف</p>
                </div>
              </div>

              {/* Delete Button */}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={handleResetAllData}
                  disabled={
                    isResetting ||
                    resetConfirmText !== 'احذف' ||
                    !resetPassword.trim()
                  }
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-40 gap-2 min-w-52 shadow-lg shadow-red-600/20 text-white"
                  size="lg"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جارٍ حذف البيانات...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      حذف جميع البيانات نهائياً
                    </>
                  )}
                </Button>
                {isResetting && (
                  <p className="text-xs text-muted-foreground">قد تستغرق هذه العملية لحظات...</p>
                )}
              </div>

            </GlassCardContent>
          )}
        </GlassCard>
      </motion.div>

      {/* Fixed Save Button at Bottom */}
      <motion.div variants={itemAnim} className="flex justify-end pb-4">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-admin hover:bg-admin/90 gap-2 min-w-40 shadow-lg shadow-admin/20"
          size="lg"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جارٍ الحفظ...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              حفظ الإعدادات
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}

function ClipboardList({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
    </svg>
  );
}
