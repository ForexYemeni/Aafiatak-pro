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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/common/glass-card';
import { Currency } from '@/components/common/currency';
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
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [activeCoupons, setActiveCoupons] = useState<Array<{code: string; discountPercent: number; maxDiscountAmount?: number}>>([]);

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
        setServices(data.data);
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

  const categories: { key: string; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: 'الكل', icon: Sparkles },
    ...Object.entries(categoryLabels).map(([key, label]) => ({
      key,
      label,
      icon: categoryIcons[key] ?? Stethoscope,
    })),
  ];

  const getServiceIcon = (iconName: string): React.ElementType => {
    return serviceIconMap[iconName] ?? Stethoscope;
  };

  return (
    <div className="space-y-6">
      {/* Header with greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-beneficiary">عافيتك</h1>
          <p className="text-sm text-muted-foreground">خدمات الرعاية الصحية المنزلية</p>
        </div>
        {activeOrdersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-beneficiary/30 text-beneficiary"
            onClick={() => router.push('/beneficiary/orders')}
          >
            <Clock className="w-4 h-4" />
            طلبات نشطة
            <Badge variant="destructive" className="mr-1">{activeOrdersCount}</Badge>
          </Button>
        )}
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
        <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.key;
            return (
              <motion.button
                key={cat.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl min-w-[72px] transition-all shrink-0 ${
                  isActive
                    ? 'bg-beneficiary text-beneficiary-foreground shadow-md'
                    : 'glass hover:bg-beneficiary/10'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium whitespace-nowrap">{cat.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Services Grid */}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {services.map((service, index) => {
              const ServiceIcon = getServiceIcon(service.icon);
              return (
                <motion.div
                  key={service.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <GlassCard
                    variant="beneficiary"
                    className="flex flex-col items-center text-center gap-3 h-full cursor-pointer hover:shadow-lg transition-shadow group"
                    onClick={() => router.push(`/beneficiary/request/${service.id}`)}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-beneficiary/10 flex items-center justify-center group-hover:bg-beneficiary/20 transition-colors">
                      <ServiceIcon className="w-7 h-7 text-beneficiary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight mb-1 line-clamp-2">
                        {service.nameAr}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {service.duration ? `${service.duration} دقيقة` : ''}
                      </p>
                    </div>
                    <div className="flex items-center justify-between w-full gap-2">
                      <Currency amount={service.basePrice} className="text-sm text-beneficiary" />
                      <Button
                        size="sm"
                        className="bg-beneficiary/90 hover:bg-beneficiary text-beneficiary-foreground text-xs h-8 px-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/beneficiary/request/${service.id}`);
                        }}
                      >
                        طلب
                      </Button>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

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
