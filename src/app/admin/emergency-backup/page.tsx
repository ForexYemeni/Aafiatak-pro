'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Download,
  Upload,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  FileArchive,
  Activity,
  LogOut,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Emergency Backup/Restore Page — عافيتك
// Standalone page accessible via emergency token
// ============================================================================

type Tab = 'backup' | 'restore';
type PageStatus = 'loading' | 'valid' | 'invalid' | 'error';

interface AdminInfo {
  name: string;
  phone: string;
}

export default function EmergencyBackupPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  // ── State ──────────────────────────────────────────────────────────
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<Tab>('backup');
  const [showPassword, setShowPassword] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [restorePassword, setRestorePassword] = useState('');
  const [showRestorePassword, setShowRestorePassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [restoreResults, setRestoreResults] = useState<any>(null);
  const [backupProgress, setBackupProgress] = useState<string>('');
  const [restoreProgress, setRestoreProgress] = useState<string>('');

  const expiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Verify token on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setPageStatus('invalid');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/admin/emergency-verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (data.success) {
          setAdminInfo(data.admin);
          setExpiresIn(data.expiresIn || 900);
          setPageStatus('valid');
        } else {
          setPageStatus('invalid');
        }
      } catch {
        setPageStatus('error');
      }
    };

    verifyToken();
  }, [token]);

  // ── Expiry countdown ───────────────────────────────────────────────
  useEffect(() => {
    if (pageStatus !== 'valid' || expiresIn <= 0) return;

    expiryTimerRef.current = setInterval(() => {
      setExpiresIn(prev => {
        if (prev <= 1) {
          if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
          setPageStatus('invalid');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
    };
  }, [pageStatus, expiresIn]);

  // ── Format remaining time ──────────────────────────────────────────
  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  // ── Handle backup ──────────────────────────────────────────────────
  const handleBackup = async () => {
    if (!backupPassword) {
      setStatusMessage({ type: 'error', text: 'يرجى إدخال كلمة مرور الإدارة للتأكيد' });
      return;
    }

    setBackupLoading(true);
    setBackupProgress('جاري إنشاء النسخة الاحتياطية...');
    setStatusMessage(null);

    try {
      const res = await fetch('/api/admin/backup/full', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password: backupPassword }),
      });

      const data = await res.json();

      if (data.success && data.downloadUrl) {
        setBackupProgress('جاري تنزيل الملف...');
        // Download the file
        const downloadRes = await fetch(data.downloadUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (downloadRes.ok) {
          const blob = await downloadRes.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `aafiatak-emergency-backup-${new Date().toISOString().split('T')[0]}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          setStatusMessage({ type: 'success', text: 'تم تنزيل النسخة الاحتياطية بنجاح' });
          setBackupProgress('');
        } else {
          setStatusMessage({ type: 'error', text: 'فشل تنزيل الملف' });
          setBackupProgress('');
        }
      } else if (data.success && data.blob) {
        // Handle base64 blob response
        const byteCharacters = atob(data.blob);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aafiatak-emergency-backup-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setStatusMessage({ type: 'success', text: 'تم تنزيل النسخة الاحتياطية بنجاح' });
        setBackupProgress('');
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'فشل إنشاء النسخة الاحتياطية' });
        setBackupProgress('');
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'حدث خطأ في الاتصال بالخادم' });
      setBackupProgress('');
    } finally {
      setBackupLoading(false);
    }
  };

  // ── Handle restore ─────────────────────────────────────────────────
  const handleRestore = async () => {
    if (!restoreFile) {
      setStatusMessage({ type: 'error', text: 'يرجى اختيار ملف النسخة الاحتياطية' });
      return;
    }

    setRestoreLoading(true);
    setRestoreProgress('جاري رفع الملف...');
    setRestoreResults(null);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      formData.append('mode', restoreMode);

      setRestoreProgress('جاري استعادة البيانات...');

      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      setRestoreProgress('');

      if (data.success) {
        setRestoreResults(data.data);
        setStatusMessage({ type: 'success', text: data.message });
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'فشل استعادة النسخة الاحتياطية' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'حدث خطأ في الاتصال بالخادم' });
      setRestoreProgress('');
    } finally {
      setRestoreLoading(false);
    }
  };

  // ── Handle logout ──────────────────────────────────────────────────
  const handleLogout = () => {
    router.push('/');
  };

  // ====================================================================
  // Render: Invalid/Expired
  // ====================================================================
  if (pageStatus === 'invalid' || pageStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1e] via-[#0d1525] to-[#0a1628]" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8 rounded-3xl max-w-md mx-4"
          style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">رمز الطوارئ غير صالح</h2>
          <p className="text-white/50 mb-6 text-sm leading-relaxed">
            {pageStatus === 'invalid'
              ? 'رمز الوصول الطارئ منتهي الصلاحية أو غير صحيح. يرجى الحصول على رمز جديد من صفحة تسجيل الدخول.'
              : 'تعذر التحقق من رمز الطوارئ. يرجى المحاولة مرة أخرى.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 rounded-2xl font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)' }}
          >
            العودة لتسجيل الدخول
          </button>
        </motion.div>
      </div>
    );
  }

  // ====================================================================
  // Render: Loading
  // ====================================================================
  if (pageStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1e] via-[#0d1525] to-[#0a1628]" dir="rtl">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-10 h-10 text-teal-400" />
        </motion.div>
      </div>
    );
  }

  // ====================================================================
  // Render: Main Page
  // ====================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0d1525] to-[#0a1628] p-4 sm:p-6" dir="rtl">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #14b8a6, transparent)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #10b981, transparent)' }} />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4" style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)' }}>
            <Shield className="w-4 h-4 text-teal-400" />
            <span className="text-teal-300 text-xs font-bold">وصول طارئ</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
            النسخ الاحتياطي والاستعادة
          </h1>
          <p className="text-white/40 text-sm">
            {adminInfo ? `مرحباً، ${adminInfo.name}` : 'جاري التحميل...'}
          </p>

          {/* Timer */}
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Clock className="w-4 h-4 text-amber-400" />
            <span className={cn(
              'text-sm font-mono font-bold',
              expiresIn < 120 ? 'text-red-400' : expiresIn < 300 ? 'text-amber-400' : 'text-teal-400'
            )}>
              {formatTime(expiresIn)}
            </span>
            <span className="text-white/30 text-xs">متبقي</span>
          </div>
        </motion.div>

        {/* ── Tab Switcher ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative flex p-[5px] mb-6 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <motion.div
            className="absolute rounded-[13px]"
            style={{
              top: 5, bottom: 5,
              background: 'linear-gradient(135deg, rgba(13,148,136,0.92) 0%, rgba(16,185,129,0.92) 100%)',
              boxShadow: '0 4px 20px -4px rgba(20,184,166,0.5)',
            }}
            initial={false}
            animate={{ right: activeTab === 'backup' ? '50%' : 5, left: activeTab === 'backup' ? 5 : '50%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          />
          <button
            type="button"
            onClick={() => { setActiveTab('backup'); setStatusMessage(null); }}
            className={cn(
              'relative z-10 flex-1 py-3 text-[13px] font-bold rounded-[13px] transition-colors duration-200 min-h-[46px] flex items-center justify-center gap-2',
              activeTab === 'backup' ? 'text-white' : 'text-white/32 hover:text-white/55'
            )}
          >
            <Download className="w-4 h-4" />
            إنشاء نسخة احتياطية
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('restore'); setStatusMessage(null); }}
            className={cn(
              'relative z-10 flex-1 py-3 text-[13px] font-bold rounded-[13px] transition-colors duration-200 min-h-[46px] flex items-center justify-center gap-2',
              activeTab === 'restore' ? 'text-white' : 'text-white/32 hover:text-white/55'
            )}
          >
            <Upload className="w-4 h-4" />
            استعادة نسخة احتياطية
          </button>
        </motion.div>

        {/* ── Status Message ──────────────────────────────────────────── */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className={cn(
                'flex items-start gap-3 p-4 rounded-2xl text-[13px]',
                statusMessage.type === 'success' ? 'text-emerald-300' : statusMessage.type === 'error' ? 'text-red-300' : 'text-blue-300'
              )} style={{
                background: statusMessage.type === 'success' ? 'rgba(16,185,129,0.09)' : statusMessage.type === 'error' ? 'rgba(239,68,68,0.09)' : 'rgba(59,130,246,0.09)',
                border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16,185,129,0.22)' : statusMessage.type === 'error' ? 'rgba(239,68,68,0.22)' : 'rgba(59,130,246,0.22)'}`
              }}>
                {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />}
                <span className="leading-relaxed">{statusMessage.text}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Content Card ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl p-6 sm:p-8"
          style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <AnimatePresence mode="wait">
            {/* ── Backup Tab ─────────────────────────────────────────── */}
            {activeTab === 'backup' && (
              <motion.div
                key="backup"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.2), rgba(16,185,129,0.2))' }}>
                    <FileArchive className="w-6 h-6 text-teal-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">إنشاء نسخة احتياطية كاملة</h2>
                    <p className="text-white/40 text-xs">تشمل جميع البيانات والإعدادات والمتغيرات</p>
                  </div>
                </div>

                {/* What will be backed up */}
                <div className="mb-6 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-white/50 text-xs font-bold mb-3">سيتم نسخ ما يلي:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Database, label: 'قاعدة البيانات' },
                      { icon: FileArchive, label: 'متغيرات البيئة' },
                      { icon: Shield, label: 'إعدادات الإدارة' },
                      { icon: Activity, label: 'مفاتيح الإشعارات' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-white/40 text-xs">
                        <item.icon className="w-3.5 h-3.5 text-teal-400/60" />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Password confirmation */}
                <div className="mb-6">
                  <label className="block text-white/60 text-xs font-bold mb-2">كلمة مرور الإدارة للتأكيد</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={backupPassword}
                      onChange={e => setBackupPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور"
                      className="w-full h-12 px-4 pl-12 rounded-2xl text-white text-sm placeholder:text-white/20 outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Progress */}
                {backupProgress && (
                  <div className="mb-4 flex items-center gap-2 text-teal-300 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{backupProgress}</span>
                  </div>
                )}

                {/* Submit */}
                <motion.div whileHover={{ scale: 1.016 }} whileTap={{ scale: 0.984 }}>
                  <button
                    type="button"
                    onClick={handleBackup}
                    disabled={backupLoading || !backupPassword}
                    className="w-full h-[54px] rounded-2xl font-bold text-[15px] text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #0d9488 0%, #10b981 55%, #06b6d4 100%)', boxShadow: '0 10px 36px -8px rgba(20,184,166,0.55)' }}
                  >
                    {backupLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        إنشاء وتنزيل النسخة الاحتياطية
                      </>
                    )}
                  </button>
                </motion.div>
              </motion.div>
            )}

            {/* ── Restore Tab ────────────────────────────────────────── */}
            {activeTab === 'restore' && (
              <motion.div
                key="restore"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(234,88,12,0.2))' }}>
                    <Upload className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">استعادة نسخة احتياطية</h2>
                    <p className="text-white/40 text-xs">استعادة جميع البيانات من ملف النسخة الاحتياطية</p>
                  </div>
                </div>

                {/* Warning */}
                <div className="mb-6 p-4 rounded-2xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-amber-200/70 text-xs leading-relaxed">
                      تحذير: وضع الاستبدال سيحذف جميع البيانات الحالية ويستبدلها بالنسخة الاحتياطية. وضع الدمج سيحافظ على البيانات الموجودة ويضيف الجديدة.
                    </p>
                  </div>
                </div>

                {/* File upload */}
                <div className="mb-6">
                  <label className="block text-white/60 text-xs font-bold mb-2">ملف النسخة الاحتياطية (ZIP)</label>
                  <label
                    className="block w-full h-24 rounded-2xl cursor-pointer flex flex-col items-center justify-center gap-2 transition-all hover:border-teal-400/30"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)' }}
                  >
                    <input
                      type="file"
                      accept=".zip"
                      onChange={e => setRestoreFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {restoreFile ? (
                      <>
                        <FileArchive className="w-6 h-6 text-teal-400" />
                        <span className="text-white/60 text-xs">{restoreFile.name}</span>
                        <span className="text-white/30 text-[10px]">{(restoreFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-white/20" />
                        <span className="text-white/30 text-xs">اضغط لاختيار ملف ZIP</span>
                      </>
                    )}
                  </label>
                </div>

                {/* Mode selection */}
                <div className="mb-6">
                  <label className="block text-white/60 text-xs font-bold mb-2">وضع الاستعادة</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRestoreMode('replace')}
                      className={cn(
                        'p-3 rounded-2xl text-xs font-bold transition-all',
                        restoreMode === 'replace'
                          ? 'text-white'
                          : 'text-white/30'
                      )}
                      style={{
                        background: restoreMode === 'replace' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${restoreMode === 'replace' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      <div className="font-bold mb-1">استبدال</div>
                      <div className="text-[10px] font-normal opacity-60">حذف الكامل ثم إدراج</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestoreMode('merge')}
                      className={cn(
                        'p-3 rounded-2xl text-xs font-bold transition-all',
                        restoreMode === 'merge'
                          ? 'text-white'
                          : 'text-white/30'
                      )}
                      style={{
                        background: restoreMode === 'merge' ? 'rgba(20,184,166,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${restoreMode === 'merge' ? 'rgba(20,184,166,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      <div className="font-bold mb-1">دمج</div>
                      <div className="text-[10px] font-normal opacity-60">إضافة مع الحفاظ على الحالي</div>
                    </button>
                  </div>
                </div>

                {/* Password (optional for emergency) */}
                <div className="mb-6">
                  <label className="block text-white/60 text-xs font-bold mb-2">كلمة مرور الإدارة (اختياري للوصول الطارئ)</label>
                  <div className="relative">
                    <input
                      type={showRestorePassword ? 'text' : 'password'}
                      value={restorePassword}
                      onChange={e => setRestorePassword(e.target.value)}
                      placeholder="أدخل كلمة المرور"
                      className="w-full h-12 px-4 pl-12 rounded-2xl text-white text-sm placeholder:text-white/20 outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRestorePassword(!showRestorePassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showRestorePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Progress */}
                {restoreProgress && (
                  <div className="mb-4 flex items-center gap-2 text-amber-300 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{restoreProgress}</span>
                  </div>
                )}

                {/* Submit */}
                <motion.div whileHover={{ scale: 1.016 }} whileTap={{ scale: 0.984 }}>
                  <button
                    type="button"
                    onClick={handleRestore}
                    disabled={restoreLoading || !restoreFile}
                    className="w-full h-[54px] rounded-2xl font-bold text-[15px] text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 55%, #ef4444 100%)', boxShadow: '0 10px 36px -8px rgba(245,158,11,0.55)' }}
                  >
                    {restoreLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        استعادة النسخة الاحتياطية
                      </>
                    )}
                  </button>
                </motion.div>

                {/* Restore Results */}
                <AnimatePresence>
                  {restoreResults && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-6 overflow-hidden"
                    >
                      <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <h3 className="text-white/70 text-xs font-bold mb-3">نتائج الاستعادة</h3>

                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)' }}>
                            <div className="text-emerald-400 text-lg font-black">{restoreResults.totalRestored || 0}</div>
                            <div className="text-white/30 text-[10px]">وثيقة مستعادة</div>
                          </div>
                          <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
                            <div className="text-red-400 text-lg font-black">{restoreResults.totalErrors || 0}</div>
                            <div className="text-white/30 text-[10px]">أخطاء</div>
                          </div>
                          <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)' }}>
                            <div className="text-blue-400 text-lg font-black">{restoreResults.verification?.passed || 0}</div>
                            <div className="text-white/30 text-[10px]">تحقق ناجح</div>
                          </div>
                        </div>

                        {/* Env restore status */}
                        {restoreResults.envRestore && (
                          <div className="mb-2 flex items-center gap-2 text-xs text-white/40">
                            <Activity className="w-3 h-3" />
                            <span>متغيرات البيئة: {restoreResults.envRestore.note}</span>
                          </div>
                        )}

                        {/* Admin settings restore */}
                        {restoreResults.adminSettingsRestore && (
                          <div className="mb-2 flex items-center gap-2 text-xs text-white/40">
                            <Shield className="w-3 h-3" />
                            <span>إعدادات الإدارة: {restoreResults.adminSettingsRestore.note}</span>
                          </div>
                        )}

                        {/* VAPID keys */}
                        {restoreResults.vapidKeysNote && (
                          <div className="flex items-center gap-2 text-xs text-white/40">
                            <Lock className="w-3 h-3" />
                            <span>{restoreResults.vapidKeysNote}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 flex items-center justify-center"
        >
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white/30 hover:text-white/60 text-xs transition-all"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            إنهاء الجلسة الطارئة
          </button>
        </motion.div>

        {/* ── ECG Line Decoration ─────────────────────────────────────── */}
        <div className="mt-8 flex justify-center opacity-20">
          <svg width="200" height="30" viewBox="0 0 200 30" fill="none">
            <path d="M0 15 L30 15 L40 5 L50 25 L55 8 L60 22 L65 15 L100 15 L110 5 L120 25 L125 8 L130 22 L135 15 L200 15" stroke="#14b8a6" strokeWidth="1.5" fill="none">
              <animate attributeName="stroke-dashoffset" from="400" to="0" dur="2s" repeatCount="indefinite" />
            </path>
          </svg>
        </div>
      </div>
    </div>
  );
}
