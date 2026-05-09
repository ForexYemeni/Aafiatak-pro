'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Save, Loader2, Wallet, X, Percent, Moon, Shield,
  Phone, MessageSquare, FileText, Wrench, MapPin, Users,
  Heart, Gift, Zap, Clock, AlertTriangle, Globe
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-admin" />
      </div>
    );
  }

  const sections = [
    { id: 'commission', label: 'العمولة والرسوم', icon: Percent },
    { id: 'withdrawal', label: 'سحب الأرباح', icon: Wallet },
    { id: 'loyalty', label: 'نقاط الولاء', icon: Gift },
    { id: 'autoassign', label: 'التعيين التلقائي', icon: Zap },
    { id: 'support', label: 'أرقام التواصل', icon: Phone },
    { id: 'legal', label: 'المستندات القانونية', icon: FileText },
    { id: 'maintenance', label: 'وضع الصيانة', icon: Wrench },
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
