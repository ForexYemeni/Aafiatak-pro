'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Ambulance,
  Clock,
  Tag,
  Sparkles,
  Heart,
  Baby,
  Activity,
  Brain,
  Pill,
  Syringe,
  Thermometer,
  Eye,
  CheckCircle2,
  ShoppingCart,
  X,
  Star,
  ArrowLeft,
  Flame,
  Plus,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/common/glass-card';
import { Currency, formatYemeniRial } from '@/components/common/currency';
import { EmptyState } from '@/components/common/empty-state';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { SearchInput } from '@/components/common/search-input';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toArabicNum } from '@/components/common/date-formatter';
import type { ApiResponse, Service, ServiceCategory } from '@/types';

// ═══════════════════════════════════════════════════════════════════════
// STATIC CONFIG
// ═══════════════════════════════════════════════════════════════════════

const categoryIcons: Record<string, React.ElementType> = {
  medical: Stethoscope,
  nursing: Heart,
  physiotherapy: Activity,
  elderly_care: Brain,
  pediatric: Baby,
  post_surgery: Pill,
  lab: Syringe,
  emergency: Ambulance,
};

const categoryLabels: Record<string, string> = {
  medical: 'طبية',
  nursing: 'تمريض',
  physiotherapy: 'علاج طبيعي',
  elderly_care: 'رعاية المسنين',
  pediatric: 'أطفال',
  post_surgery: 'بعد الجراحة',
  lab: 'مختبرات',
  emergency: 'طوارئ',
};

const categoryGradients: Record<string, string> = {
  medical: 'from-sky-400 to-blue-600',
  nursing: 'from-rose-400 to-pink-600',
  physiotherapy: 'from-emerald-400 to-green-600',
  elderly_care: 'from-amber-400 to-orange-600',
  pediatric: 'from-violet-400 to-purple-600',
  post_surgery: 'from-orange-400 to-red-500',
  lab: 'from-cyan-400 to-teal-600',
  emergency: 'from-red-500 to-rose-700',
};

const categoryGlowColors: Record<string, string> = {
  medical: 'shadow-sky-500/25',
  nursing: 'shadow-rose-500/25',
  physiotherapy: 'shadow-emerald-500/25',
  elderly_care: 'shadow-amber-500/25',
  pediatric: 'shadow-violet-500/25',
  post_surgery: 'shadow-orange-500/25',
  lab: 'shadow-cyan-500/25',
  emergency: 'shadow-red-500/30',
};

const categoryBgColors: Record<string, string> = {
  medical: 'bg-sky-50 dark:bg-sky-950/30',
  nursing: 'bg-rose-50 dark:bg-rose-950/30',
  physiotherapy: 'bg-emerald-50 dark:bg-emerald-950/30',
  elderly_care: 'bg-amber-50 dark:bg-amber-950/30',
  pediatric: 'bg-violet-50 dark:bg-violet-950/30',
  post_surgery: 'bg-orange-50 dark:bg-orange-950/30',
  lab: 'bg-cyan-50 dark:bg-cyan-950/30',
  emergency: 'bg-red-50 dark:bg-red-950/30',
};

const serviceIconMap: Record<string, React.ElementType> = {
  Stethoscope,
  Heart,
  Activity,
  Baby,
  Syringe,
  Pill,
  Thermometer,
  Eye,
  Ambulance,
  Brain,
};

// ═══════════════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════

const heroVariants = {
  hidden: { opacity: 0, y: -30, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
} as const;

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
} as const;

const staggerItem = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
} as const;

const categoryStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
} as const;

const categoryItem = {
  hidden: { opacity: 0, scale: 0.85, y: 8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
} as const;

const fabVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { delay: 0.6, type: 'spring', stiffness: 200, damping: 15 },
  },
} as const;

const bottomBarVariants = {
  hidden: { y: 120, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', damping: 25, stiffness: 300 },
  },
  exit: { y: 120, opacity: 0 },
} as const;

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function BeneficiaryHomePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [activeCoupons, setActiveCoupons] = useState<
    Array<{ code: string; discountPercent: number; maxDiscountAmount?: number }>
  >([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  // ──────────────────────── DATA FETCHING ────────────────────────

  const fetchServices = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (activeCategory !== 'all') params.set('category', activeCategory);

      const res = await fetch(`/api/beneficiary/services?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<Service[]> = await res.json();
      if (data.success && data.data) {
        const sorted = [...data.data].sort((a: Service, b: Service) => {
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          return a.nameAr.localeCompare(b.nameAr, 'ar');
        });
        setServices(sorted);
      }
    } catch {
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, searchQuery, activeCategory]);

  const fetchActiveOrdersCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/beneficiary/orders?status=active&limit=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.pagination) {
        setActiveOrdersCount(data.pagination.total);
      }
    } catch {
      setActiveOrdersCount(0);
    }
  }, [token]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    fetchActiveOrdersCount();
  }, [fetchActiveOrdersCount]);

  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const res = await fetch('/api/admin/coupons?active=true&limit=3');
        const data = await res.json();
        if (data.success && data.data?.coupons) {
          setActiveCoupons(
            data.data.coupons.filter((c: any) => new Date(c.expiresAt) > new Date())
          );
        }
      } catch {
        /* silent */
      }
    };
    fetchCoupons();
  }, []);

  // ──────────────────────── DERIVED STATE ────────────────────────

  const categories: { key: string; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'all', label: 'الكل', icon: Sparkles, color: 'from-beneficiary to-purple-600' },
    ...Object.entries(categoryLabels).map(([key, label]) => ({
      key,
      label,
      icon: categoryIcons[key] ?? Stethoscope,
      color: categoryGradients[key] ?? 'from-gray-400 to-gray-500',
    })),
  ];

  const getServiceIcon = (iconName: string): React.ElementType => {
    return serviceIconMap[iconName] ?? Stethoscope;
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedServices(new Set());

  const selectedServicesList = services.filter((s) => selectedServices.has(s.id));
  const totalPrice = selectedServicesList.reduce((sum, s) => sum + s.basePrice, 0);
  const popularServices = services.filter((s) => s.sortOrder <= 4).slice(0, 8);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-5 pb-28">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HERO SECTION - Gradient mesh with aurora effect              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={heroVariants}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-beneficiary via-purple-600 to-teal-500 p-6 pb-8 text-white shadow-2xl shadow-beneficiary/30"
      >
        {/* Animated mesh gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl login-mesh-orb-1" />
          <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-teal-400/20 blur-2xl login-mesh-orb-2" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-purple-300/15 blur-xl login-mesh-orb-3" />
          <div className="absolute top-6 right-1/4 w-24 h-24 rounded-full bg-white/8 blur-md" />
          <div className="absolute bottom-10 left-1/3 w-20 h-20 rounded-full bg-teal-200/10 blur-sm" />
          {/* Aurora overlay */}
          <div className="aurora-bg opacity-60" />
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative z-10">
          {/* Top row */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, ease: 'easeOut' as const }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 backdrop-blur-sm text-[11px] font-bold mb-3"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                منصة عافيتك
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, ease: 'easeOut' as const }}
                className="text-2xl sm:text-3xl font-black leading-tight"
              >
                مرحباً {user?.name?.split(' ')[0] || ''}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm opacity-85 mt-1.5 font-medium"
              >
                خدمات الرعاية الصحية المنزلية
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, type: 'spring', stiffness: 200 }}
            >
              {activeOrdersCount > 0 ? (
                <Button
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm shrink-0 gap-2 font-bold shadow-lg shadow-black/10"
                  onClick={() => router.push('/beneficiary/orders')}
                >
                  <Clock className="w-3.5 h-3.5" />
                  طلبات نشطة
                  <span className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                    {toArabicNum(activeOrdersCount)}
                  </span>
                </Button>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur-sm">
                  <Heart className="w-7 h-7 text-white" />
                </div>
              )}
            </motion.div>
          </div>

          {/* Info bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ease: 'easeOut' as const }}
            className="flex items-center gap-2.5 bg-white/10 rounded-2xl px-4 py-3 border border-white/15 backdrop-blur-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            </div>
            <p className="text-xs font-semibold leading-relaxed">
              اختر الخدمات التي تحتاجها وأكمل طلبك في خطوات بسيطة
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SEARCH BAR                                                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, ease: 'easeOut' as const }}
      >
        <SearchInput placeholder="ابحث عن خدمة..." onChange={setSearchQuery} className="w-full" />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* COUPON BANNER - Shimmer with glass effect                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {activeCoupons.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {activeCoupons.map((coupon, idx) => (
              <motion.div
                key={coupon.code}
                initial={{ opacity: 0, x: -20, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{
                  delay: 0.2 + idx * 0.08,
                  duration: 0.4,
                  ease: 'easeOut' as const,
                }}
              >
                <GlassCard variant="beneficiary" className="relative overflow-hidden p-0">
                  {/* Shimmer overlay */}
                  <div className="absolute inset-0 animate-shimmer pointer-events-none" />
                  {/* Gradient accent bar */}
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-beneficiary to-purple-600 rounded-r-2xl" />

                  <div className="flex items-center gap-4 p-4 pr-5">
                    {/* Icon with glow */}
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-beneficiary/20 blur-xl rounded-2xl" />
                      <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-beneficiary to-purple-600 flex items-center justify-center shadow-lg shadow-beneficiary/30">
                        <Tag className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm">
                        خصم {toArabicNum(coupon.discountPercent)}٪
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        استخدم كود{' '}
                        <span
                          className="font-mono font-bold text-beneficiary bg-beneficiary/10 px-1.5 py-0.5 rounded-md"
                          dir="ltr"
                        >
                          {coupon.code}
                        </span>{' '}
                        عند الطلب
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-gradient-to-l from-beneficiary to-purple-600 hover:opacity-90 text-white shrink-0 shadow-md shadow-beneficiary/25 font-bold text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(coupon.code);
                      }}
                    >
                      نسخ الكود
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SERVICE CATEGORIES - Gradient pill chips                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={categoryStagger}
        initial="hidden"
        animate="show"
        className="relative"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 px-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.key;
            return (
              <motion.button
                key={cat.key}
                variants={categoryItem}
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.03 }}
                onClick={() => setActiveCategory(cat.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-300 shrink-0 whitespace-nowrap overflow-hidden ${
                  isActive
                    ? `bg-gradient-to-l text-white shadow-lg ${cat.color}`
                    : 'glass hover:bg-muted/50'
                }`}
              >
                {/* Background glow when active */}
                {isActive && (
                  <motion.div
                    layoutId="categoryGlow"
                    className="absolute inset-0 bg-white/10 blur-md"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{cat.label}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* POPULAR SERVICES - Horizontal scroll cards                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeCategory === 'all' && !searchQuery && popularServices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ease: 'easeOut' as const }}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Flame className="w-4.5 h-4.5 text-white" />
            </div>
            <h2 className="text-lg font-black">خدمات مميزة</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
            {popularServices.map((service, idx) => {
              const ServiceIcon = getServiceIcon(service.icon);
              const isSelected = selectedServices.has(service.id);
              const gradient =
                categoryGradients[service.category] || 'from-gray-400 to-gray-500';
              const glow =
                categoryGlowColors[service.category] || 'shadow-gray-500/20';
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, ease: 'easeOut' as const }}
                  whileTap={{ scale: 0.97 }}
                  className={`shrink-0 w-48 rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${
                    isSelected
                      ? 'border-beneficiary shadow-lg shadow-beneficiary/15'
                      : 'border-transparent shadow-md'
                  }`}
                  onClick={() => toggleService(service.id)}
                >
                  {/* Top gradient area */}
                  <div
                    className={`relative h-20 bg-gradient-to-br ${gradient} flex items-center justify-center`}
                  >
                    <ServiceIcon className="w-8 h-8 text-white drop-shadow-md" />
                    {/* Emergency tag */}
                    {service.isEmergency && (
                      <div className="absolute top-2 right-2">
                        <Badge
                          variant="destructive"
                          className="text-[9px] px-1.5 py-0 font-black shadow-sm"
                        >
                          طوارئ
                        </Badge>
                      </div>
                    )}
                    {/* Selection check */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center"
                      >
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </motion.div>
                    )}
                  </div>

                  <div
                    className={`p-3.5 space-y-2 ${
                      isSelected ? 'bg-beneficiary/5' : 'bg-card'
                    }`}
                  >
                    <h3 className="font-bold text-sm leading-tight line-clamp-2">
                      {service.nameAr}
                    </h3>
                    <div className="flex items-center justify-between">
                      <Currency amount={service.basePrice} className="text-sm font-black" />
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isSelected
                            ? 'bg-beneficiary text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ALL SERVICES GRID                                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} className="h-52" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="w-10 h-10 text-muted-foreground" />}
          title="لا توجد خدمات"
          description="لم يتم العثور على خدمات مطابقة لبحثك"
          variant="beneficiary"
          action={{
            label: 'مسح البحث',
            onClick: () => {
              setSearchQuery('');
              setActiveCategory('all');
            },
          }}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          <AnimatePresence mode="popLayout">
            {services.map((service) => {
              const ServiceIcon = getServiceIcon(service.icon);
              const isSelected = selectedServices.has(service.id);
              const gradient =
                categoryGradients[service.category] || 'from-gray-400 to-gray-500';
              const glow =
                categoryGlowColors[service.category] || 'shadow-gray-500/20';
              return (
                <motion.div
                  key={service.id}
                  layout
                  variants={staggerItem}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <GlassCard
                    variant="beneficiary"
                    className={`flex flex-col items-center text-center gap-3 h-full cursor-pointer transition-all duration-300 group relative rounded-2xl card-lift p-0 overflow-hidden ${
                      isSelected
                        ? 'ring-2 ring-beneficiary bg-beneficiary/5 shadow-lg shadow-beneficiary/10'
                        : ''
                    }`}
                    onClick={() => toggleService(service.id)}
                  >
                    {/* Top gradient area with icon */}
                    <div
                      className={`relative w-full h-20 bg-gradient-to-br ${gradient} flex items-center justify-center ${glow} shadow-lg`}
                    >
                      <ServiceIcon className="w-8 h-8 text-white drop-shadow-md group-hover:scale-110 transition-transform duration-300" />

                      {/* Selection indicator */}
                      <div
                        className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                          isSelected
                            ? 'border-white bg-white/30 backdrop-blur-sm scale-100'
                            : 'border-white/40 scale-90'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>

                      {/* Emergency badge */}
                      {service.isEmergency && (
                        <div className="absolute top-2 right-2">
                          <Badge
                            variant="destructive"
                            className="text-[9px] px-1.5 py-0 font-black shadow-sm"
                          >
                            طوارئ
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 px-3 pt-2 pb-1">
                      <h3 className="font-bold text-sm leading-tight line-clamp-2">
                        {service.nameAr}
                      </h3>
                    </div>

                    {/* Footer with price and action */}
                    <div className="flex items-center justify-between w-full px-3 pb-3 pt-1.5 gap-2">
                      <Currency amount={service.basePrice} className="text-xs font-black" />
                      <motion.div
                        whileTap={{ scale: 0.85 }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isSelected
                            ? 'bg-beneficiary text-beneficiary-foreground shadow-md shadow-beneficiary/25'
                            : 'bg-muted text-muted-foreground group-hover:bg-beneficiary/10 group-hover:text-beneficiary'
                        }`}
                      >
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </motion.div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* FLOATING BOTTOM BAR - Glassmorphism action bar               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedServices.size > 0 && (
          <motion.div
            variants={bottomBarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed left-0 right-0 z-40 md:bottom-0"
            style={{ bottom: '68px' }}
          >
            <div className="bg-background/70 backdrop-blur-2xl border-t border-beneficiary/20 shadow-2xl shadow-beneficiary/15 safe-bottom">
              {/* Selected services chips preview */}
              {selectedServicesList.length <= 3 && (
                <div className="max-w-2xl mx-auto px-4 pt-2.5">
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                    {selectedServicesList.map((s) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-beneficiary/10 text-beneficiary text-[11px] font-semibold shrink-0"
                      >
                        <span className="line-clamp-1">{s.nameAr}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleService(s.id);
                          }}
                          className="w-3.5 h-3.5 rounded-full bg-beneficiary/20 flex items-center justify-center hover:bg-beneficiary/30 transition-colors"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <div className="max-w-2xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        className="w-11 h-11 rounded-xl bg-gradient-to-br from-beneficiary to-purple-600 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-beneficiary/30"
                      >
                        {toArabicNum(selectedServices.size)}
                      </motion.div>
                      <div>
                        <p className="text-sm font-bold">
                          {selectedServices.size === 1
                            ? 'خدمة واحدة'
                            : `${toArabicNum(selectedServices.size)} خدمات`}
                        </p>
                        <Currency
                          amount={totalPrice}
                          className="text-lg text-beneficiary font-black -mt-0.5"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="gap-1 text-muted-foreground"
                    >
                      <X className="w-4 h-4" />
                      إلغاء
                    </Button>
                    <Button
                      className="bg-gradient-to-l from-beneficiary to-purple-600 hover:opacity-90 text-white gap-2 shadow-lg shadow-beneficiary/30 font-bold"
                      onClick={() => {
                        if (selectedServices.size === 1) {
                          router.push(
                            `/beneficiary/request/${Array.from(selectedServices)[0]}`
                          );
                        } else {
                          router.push(
                            `/beneficiary/request?ids=${Array.from(selectedServices).join(',')}`
                          );
                        }
                      }}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      إكمال الطلب
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* EMERGENCY FAB - Glass effect with pulse glow                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={fabVariants}
        initial="hidden"
        animate="visible"
        className="fixed bottom-24 md:bottom-8 left-6 z-30"
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => router.push('/beneficiary/emergency')}
          className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-2xl shadow-red-600/40 flex items-center justify-center emergency-float-btn backdrop-blur-sm"
        >
          <Ambulance className="w-7 h-7" />
          {/* Inner glow ring */}
          <div className="absolute inset-0 rounded-2xl ring-2 ring-white/20" />
          {/* Label on desktop */}
          <span className="absolute -bottom-7 text-[10px] font-black text-red-600 dark:text-red-400 whitespace-nowrap hidden md:block">
            طوارئ
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
}
