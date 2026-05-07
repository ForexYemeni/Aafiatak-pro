'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
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
};

export default function AdminSettingsPage() {
  const authFetch = useAuthFetch();
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="إعدادات المنصة" description="تخصيص إعدادات منصة عافيتك" />
      </motion.div>

      {/* Commission & Fees */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle>العمولة والرسوم</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>نسبة العمولة (%)</Label>
                <Input
                  type="number"
                  value={settings.commissionRate}
                  onChange={(e) => updateField('commissionRate', Number(e.target.value))}
                  min={0}
                  max={100}
                />
              </div>
              <div className="space-y-2">
                <Label>رسوم الطوارئ (ر.ي)</Label>
                <Input
                  type="number"
                  value={settings.emergencyFee}
                  onChange={(e) => updateField('emergencyFee', Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>رسوم الخدمة الليلية (%)</Label>
                <Input
                  type="number"
                  value={settings.nightFeePercent}
                  onChange={(e) => updateField('nightFeePercent', Number(e.target.value))}
                  min={0}
                  max={100}
                />
              </div>
              <div className="space-y-2">
                <Label>رسوم خدمة الجمعة (%)</Label>
                <Input
                  type="number"
                  value={settings.fridayFeePercent}
                  onChange={(e) => updateField('fridayFeePercent', Number(e.target.value))}
                  min={0}
                  max={100}
                />
              </div>
              <div className="space-y-2">
                <Label>بداية أوقات الخدمة الليلية (ساعة)</Label>
                <Input
                  type="number"
                  value={settings.nightStartHour}
                  onChange={(e) => updateField('nightStartHour', Number(e.target.value))}
                  min={0}
                  max={23}
                />
              </div>
              <div className="space-y-2">
                <Label>نهاية أوقات الخدمة الليلية (ساعة)</Label>
                <Input
                  type="number"
                  value={settings.nightEndHour}
                  onChange={(e) => updateField('nightEndHour', Number(e.target.value))}
                  min={0}
                  max={23}
                />
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Loyalty & Referral */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle>نقاط الولاء والإحالة</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>نقاط لكل طلب</Label>
                <Input
                  type="number"
                  value={settings.loyaltyPointsPerOrder}
                  onChange={(e) => updateField('loyaltyPointsPerOrder', Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>حد الاسترداد (نقاط)</Label>
                <Input
                  type="number"
                  value={settings.loyaltyRedemptionThreshold}
                  onChange={(e) => updateField('loyaltyRedemptionThreshold', Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>مكافأة الإحالة (نقاط)</Label>
                <Input
                  type="number"
                  value={settings.referralReward}
                  onChange={(e) => updateField('referralReward', Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>الحد الأدنى للطلب (ر.ي)</Label>
                <Input
                  type="number"
                  value={settings.minOrderAmount}
                  onChange={(e) => updateField('minOrderAmount', Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Auto ClipboardList */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle>التعيين التلقائي</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">التعيين التلقائي للطلبات</p>
                  <p className="text-sm text-muted-foreground">تعيين الممرضين تلقائيًا للطلبات الجديدة</p>
                </div>
                <Switch
                  checked={settings.autoAssignEnabled}
                  onCheckedChange={(v) => updateField('autoAssignEnabled', v)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">الإرسال التلقائي للطوارئ</p>
                  <p className="text-sm text-muted-foreground">إرسال أقرب ممرض تلقائيًا لحالات الطوارئ</p>
                </div>
                <Switch
                  checked={settings.emergencyAutoDispatch}
                  onCheckedChange={(v) => updateField('emergencyAutoDispatch', v)}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>نصف قطر التعيين الأقصى (كم)</Label>
                <Input
                  type="number"
                  value={settings.maxNurseClipboardListRadius}
                  onChange={(e) => updateField('maxNurseClipboardListRadius', Number(e.target.value))}
                  min={1}
                  max={100}
                />
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Support Info */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle>معلومات الدعم</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>هاتف الدعم</Label>
                <Input
                  value={settings.supportPhone}
                  onChange={(e) => updateField('supportPhone', e.target.value)}
                  placeholder="967XXXXXXXX+"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>بريد الدعم</Label>
                <Input
                  value={settings.supportEmail}
                  onChange={(e) => updateField('supportEmail', e.target.value)}
                  placeholder="support@aafiatak.com"
                  dir="ltr"
                  type="email"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>واتساب الدعم</Label>
                <Input
                  value={settings.supportWhatsApp}
                  onChange={(e) => updateField('supportWhatsApp', e.target.value)}
                  placeholder="967XXXXXXXX+"
                  dir="ltr"
                />
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Maintenance Mode */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle>وضع الصيانة</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تفعيل وضع الصيانة</p>
                  <p className="text-sm text-muted-foreground">تعطيل المنصة مؤقتًا للصيانة</p>
                </div>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={(v) => updateField('maintenanceMode', v)}
                />
              </div>
              {settings.maintenanceMode && (
                <div className="space-y-2">
                  <Label>رسالة الصيانة</Label>
                  <Textarea
                    value={settings.maintenanceMessageAr}
                    onChange={(e) => updateField('maintenanceMessageAr', e.target.value)}
                    placeholder="المنصة حاليًا تحت الصيانة، سنرجع قريبًا..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Save Button */}
      <motion.div variants={itemAnim} className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-admin hover:bg-admin/90 gap-2 min-w-40"
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
