'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Zap, Clock, Star } from 'lucide-react';
import { GlassCard } from '@/components/common/glass-card';
import { toArabicNum } from '@/components/common/date-formatter';
import { cn } from '@/lib/utils';

interface StatisticsSectionProps {
  completedJobs: number;
  emergencyCases: number;
  experience: number;
  rating: number;
}

// ---- Count-up animation hook ----
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startValue + (target - startValue) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

// ---- Stat card sub-component ----
function StatItem({
  icon,
  value,
  label,
  color,
  delay,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  delay: number;
}) {
  const countedValue = useCountUp(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative rounded-2xl overflow-hidden"
    >
      <GlassCard variant="nurse" noPadding className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
            {icon}
          </div>
          <div>
            <p className="text-xl font-bold">{toArabicNum(countedValue)}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

export function StatisticsSection({ completedJobs, emergencyCases, experience, rating }: StatisticsSectionProps) {
  const stats = [
    {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      value: completedJobs,
      label: 'خدمة مكتملة',
      color: 'bg-emerald-500/15',
      delay: 0.05,
    },
    {
      icon: <Zap className="w-5 h-5 text-red-600 dark:text-red-400" />,
      value: emergencyCases,
      label: 'حالة طوارئ',
      color: 'bg-red-500/15',
      delay: 0.1,
    },
    {
      icon: <Clock className="w-5 h-5 text-nurse" />,
      value: experience,
      label: 'سنة خبرة',
      color: 'bg-nurse/15',
      delay: 0.15,
    },
    {
      icon: <Star className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      value: Math.round(rating * 10), // show as x10 to make it a whole number
      label: rating.toFixed(1) + ' تقييم',
      color: 'bg-amber-500/15',
      delay: 0.2,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <StatItem
          key={stat.label}
          icon={stat.icon}
          value={stat.value}
          label={stat.label}
          color={stat.color}
          delay={stat.delay}
        />
      ))}
    </div>
  );
}
