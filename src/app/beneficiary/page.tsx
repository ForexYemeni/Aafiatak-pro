'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Ambulance,
  Clock,
  Tag,
  Search,
  Sparkles,
  Heart,
  Baby,
  Activity,
  Brain,
  Pill,
  Syringe,
  Thermometer,
  Eye,
  Loader2,
  CheckCircle2,
  ShoppingCart,
  X,
  Star,
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

const categoryColors: Record<string, string> = {
  medical: 'from-blue-500 to-blue-600',
  nursing: 'from-rose-500 to-rose-600',
  physiotherapy: 'from-emerald-500 to-emerald-600',
  elderly_care: 'from-amber-500 to-amber-600',
  pediatric: 'from-violet-500 to-violet-600',
  post_surgery: 'from-orange-500 to-orange-600',
  lab: 'from-cyan-500 to-cyan-600',
  emergency: 'from-red-600 to-red-700',
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

export default function BeneficiaryHomePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [activeCoupons, setActiveCoupons] = useState<Array<{code: string; discountPercent: number; maxDiscountAmount?: number}>>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

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

  // Fetch active coupons
  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const res = await fetch('/api/admin/coupons?active=true&limit=3');
        const data = await res.json();
        if (data.success && data.data?.coupons) {
          setActiveCoupons(data.data.coupons.filter((c: any) => new Date(c.expiresAt) > new Date()));
        }
      } catch { /* silent */ }
    };
    fetchCoupons();
  }, []);

  const categories: { key: string; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'all', label: 'الكل', icon: Sparkles, color: 'from-gray-400 to-gray-500' },
    ...Object.entries(categoryLabels).map(([key, label]) => ({
      key,
      label,
      icon: categoryIcons[key] ?? Stethoscope,
      color: categoryColors[key] ?? 'from-gray-400 to-gray-500',
    })),
  ];

  const getServiceIcon = (iconName: string): React.ElementType => {
    return serviceIconMap[iconName] ?? Stethoscope;
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
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

  const selectedServicesList = services.filter(s => selectedServices.has(s.id));
  const totalPrice = selectedServicesList.reduce((sum, s) => sum + s.basePrice, 0);

  // Popular services (first 4 from each category or just top ones)
  const popularServices = services.filter(s => s.sortOrder <= 4).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-beneficiary to-teal-600 p-6 text-beneficiary-foreground"
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold">مرحباً {user?.name?.split(' ')[0] || ''} 👋</h1>
              <p className="text-sm opacity-90 mt-1">خدمات الرعاية الصحية المنزلية</p>
            </div>
            {activeOrdersCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 shrink-0"
                onClick={() => router.push('/beneficiary/orders')}
              >
                <Clock className="w-4 h-4" />
                طلبات نشطة
                <Badge variant="destructive" className="mr-1">{toArabicNum(activeOrdersCount)}</Badge>
              </Button>
            )}
          </div>
          <p className="text-xs opacity-80">اختر الخدمات التي تحتاجها وأكمل طلبك في خطوات بسيطة</p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute top-1/2 left-1/2 w-16 h-16 rounded-full bg-white/5" />
      </motion.div>

      {/* Search Bar */}
      <SearchInput
        placeholder="ابحث عن خدمة..."
        onChange={setSearchQuery}
        className="w-full"
      />

      {/* Coupon Banner */}
      {activeCoupons.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          {activeCoupons.map((coupon) => (
            <GlassCard key={coupon.code} variant="beneficiary" className="flex items-center gap-4 py-4">
              <div className="w-12 h-12 rounded-xl bg-beneficiary/10 flex items-center justify-center shrink-0">
                <Tag className="w-6 h-6 text-beneficiary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">خصم {toArabicNum(coupon.discountPercent)}٪</p>
                <p className="text-xs text-muted-foreground">استخدم كود {coupon.code} عند الطلب</p>
              </div>
              <Button
                size="sm"
                className="bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(coupon.code);
                }}
              >
                نسخ الكود
              </Button>
            </GlassCard>
          ))}
        </motion.div>
      )}

      {/* Service Categories Horizontal Scroll */}
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 px-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.key;
            return (
              <motion.button
                key={cat.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all shrink-0 whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-l text-white shadow-md ' + cat.color
                    : 'glass hover:bg-muted/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{cat.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Popular Services Section */}
      {activeCategory === 'all' && !searchQuery && popularServices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold">خدمات مميزة</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
            {popularServices.map((service) => {
              const ServiceIcon = getServiceIcon(service.icon);
              const isSelected = selectedServices.has(service.id);
              const gradient = categoryColors[service.category] || 'from-gray-400 to-gray-500';
              return (
                <motion.div
                  key={service.id}
                  whileTap={{ scale: 0.97 }}
                  className={`shrink-0 w-44 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                    isSelected ? 'border-beneficiary bg-beneficiary/5 shadow-md' : 'border-transparent bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5'
                  }`}
                  onClick={() => toggleService(service.id)}
                >
                  <div className="p-4 space-y-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
                      <ServiceIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2">{service.nameAr}</h3>
                      {service.isEmergency && (
                        <span className="text-[10px] text-red-500 font-medium mt-1 block">طوارئ</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <Currency amount={service.basePrice} className="text-sm font-bold" />
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5 text-beneficiary" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* All Services Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} className="h-52" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="w-10 h-10 text-muted-foreground" />}
          title="لا توجد خدمات"
          description="لم يتم العثور على خدمات مطابقة لبحثك"
          action={{
            label: 'مسح البحث',
            onClick: () => {
              setSearchQuery('');
              setActiveCategory('all');
            },
          }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {services.map((service, index) => {
              const ServiceIcon = getServiceIcon(service.icon);
              const isSelected = selectedServices.has(service.id);
              const gradient = categoryColors[service.category] || 'from-gray-400 to-gray-500';
              return (
                <motion.div
                  key={service.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <GlassCard
                    variant="beneficiary"
                    className={`flex flex-col items-center text-center gap-3 h-full cursor-pointer transition-all duration-200 group relative rounded-2xl ${
                      isSelected ? 'ring-2 ring-beneficiary bg-beneficiary/5 shadow-md' : 'hover:shadow-lg hover:-translate-y-0.5'
                    }`}
                    onClick={() => toggleService(service.id)}
                  >
                    {/* Selection indicator */}
                    <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                      isSelected ? 'border-beneficiary bg-beneficiary scale-100' : 'border-muted-foreground/30 scale-90'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-beneficiary-foreground" />}
                    </div>

                    {/* Emergency badge */}
                    {service.isEmergency && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0">طوارئ</Badge>
                      </div>
                    )}

                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-sm`}>
                      <ServiceIcon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                        {service.nameAr}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between w-full gap-2 pt-2 border-t border-border/30">
                      <Currency amount={service.basePrice} className="text-sm font-bold" />
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors duration-200 ${
                        isSelected
                          ? 'bg-beneficiary text-beneficiary-foreground'
                          : 'bg-muted text-muted-foreground group-hover:bg-beneficiary/10 group-hover:text-beneficiary'
                      }`}>
                        {isSelected ? 'محدد ✓' : 'اختر'}
                      </span>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Floating Bottom Bar for Selected Services */}
      <AnimatePresence>
        {selectedServices.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border shadow-2xl"
          >
            <div className="max-w-2xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-beneficiary flex items-center justify-center text-beneficiary-foreground text-sm font-bold">
                      {toArabicNum(selectedServices.size)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {selectedServices.size === 1 ? 'خدمة واحدة' : `${toArabicNum(selectedServices.size)} خدمات`}
                      </p>
                      <Currency amount={totalPrice} className="text-lg text-beneficiary font-bold -mt-0.5" />
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
                    className="bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground gap-2"
                    onClick={() => {
                      if (selectedServices.size === 1) {
                        router.push(`/beneficiary/request/${Array.from(selectedServices)[0]}`);
                      } else {
                        router.push(`/beneficiary/request?ids=${Array.from(selectedServices).join(',')}`);
                      }
                    }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    إكمال الطلب
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push('/beneficiary/emergency')}
        className="fixed bottom-24 md:bottom-8 left-6 z-30 w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-2xl flex items-center justify-center animate-pulse-glow"
        style={{ '--tw-pulse-color': 'rgba(220, 38, 38, 0.4)' } as React.CSSProperties}
      >
        <Ambulance className="w-7 h-7" />
      </motion.button>
    </div>
  );
}
