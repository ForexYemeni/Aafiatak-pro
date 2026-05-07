'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Clock,
  MapPin,
  ChevronRight,
  ChevronLeft,
  UserRound,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from '@/components/common/glass-card';
import { Currency } from '@/components/common/currency';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { PullToRefresh } from '@/components/common/pull-to-refresh';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { toArabicNum, formatDateOnly, formatTimeOnly } from '@/components/common/date-formatter';

// ---- Types ----

interface ScheduleService {
  id: string;
  nameAr: string;
  duration: number;
}

interface ScheduleBeneficiary {
  id: string;
  name: string;
  phone: string;
  address?: string;
}

interface ScheduleClipboardList {
  id: string;
  requestId: string;
  nurseId: string;
  status: string;
  assignedAt: string;
  estimatedArrivalMinutes: number | null;
  request: {
    id: string;
    status: string;
    scheduledAt: string | null;
    beneficiaryAddress: string | null;
    basePrice: number;
    nursePayout: number;
    isEmergency: boolean;
    service: ScheduleService;
    beneficiary: ScheduleBeneficiary;
  };
}

interface ScheduleEmergency {
  id: string;
  nurseId: string;
  status: string;
  assignedAt: string;
  estimatedArrivalMinutes: number | null;
  emergencyRequest: {
    id: string;
    type: string;
    description: string;
    address: string | null;
    status: string;
    beneficiary: ScheduleBeneficiary;
  };
}

interface DaySchedule {
  date: Date;
  dayName: string;
  assignments: ScheduleClipboardList[];
  emergencies: ScheduleEmergency[];
}

// ---- Constants ----

const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// ---- Helpers ----

function getWeekDates(referenceDate: Date): Date[] {
  const startOfWeek = new Date(referenceDate);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

// ---- Component ----

export default function NurseSchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [scheduleData, setScheduleData] = useState<{
    assignments: ScheduleClipboardList[];
    emergencyClipboardLists: ScheduleEmergency[];
  }>({ assignments: [], emergencyClipboardLists: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [availableDays, setAvailableDays] = useState<Record<number, boolean>>({
    0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true,
  });
  const authFetch = useAuthFetch();

  const referenceDate = new Date();
  referenceDate.setDate(referenceDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(referenceDate);

  const fetchSchedule = useCallback(async () => {
    try {
      const weekStart = weekDates[0].toISOString().split('T')[0];
      const res = await authFetch(`/api/nurse/schedule?weekStart=${weekStart}`);
      const data = await res.json();
      if (data.success && data.data) {
        setScheduleData({
          assignments: (data.data.assignments ?? []) as ScheduleClipboardList[],
          emergencyClipboardLists: (data.data.emergencyClipboardLists ?? []) as ScheduleEmergency[],
        });
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, weekDates]);

  useEffect(() => {
    setIsLoading(true);
    fetchSchedule();
  }, [fetchSchedule]);

  const currentDayClipboardLists = scheduleData.assignments.filter((a) => {
    if (!a.request.scheduledAt) return false;
    return isSameDay(new Date(a.request.scheduledAt), selectedDate);
  });

  const currentDayEmergencies = scheduleData.emergencyClipboardLists.filter((a) => {
    return isSameDay(new Date(a.assignedAt), selectedDate);
  });

  const getClipboardListCountForDay = (date: Date): number => {
    const count = scheduleData.assignments.filter((a) => {
      if (!a.request.scheduledAt) return false;
      return isSameDay(new Date(a.request.scheduledAt), date);
    }).length;
    const emCount = scheduleData.emergencyClipboardLists.filter((a) => {
      return isSameDay(new Date(a.assignedAt), date);
    }).length;
    return count + emCount;
  };

  const handleAvailabilityToggle = (dayIndex: number) => {
    setAvailableDays((prev) => ({ ...prev, [dayIndex]: !prev[dayIndex] }));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="الجدول الأسبوعي"
        description="إدارة مواعيدك وتوافرك الأسبوعي"
      />

      {/* Week Navigation */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset((p) => p - 1)}>
            <ChevronRight className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <p className="font-semibold text-sm">
              {weekOffset === 0 ? 'هذا الأسبوع' : weekOffset > 0 ? `بعد ${toArabicNum(weekOffset)} أسبوع` : `قبل ${toArabicNum(Math.abs(weekOffset))} أسبوع`}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateOnly(weekDates[0])} - {formatDateOnly(weekDates[6])}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset((p) => p + 1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>

        {/* Day Selector */}
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, idx) => {
            const isSelected = isSameDay(date, selectedDate);
            const isTodayDate = isToday(date);
            const count = getClipboardListCountForDay(date);

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-nurse text-nurse-foreground shadow-md'
                    : isTodayDate
                    ? 'bg-nurse/10 text-nurse'
                    : 'hover:bg-muted'
                }`}
              >
                <span className="text-[10px] font-medium">{arabicDays[date.getDay()].slice(0, 3)}</span>
                <span className="text-lg font-bold">{toArabicNum(date.getDate())}</span>
                {count > 0 && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-nurse'}`} />
                )}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Day Availability Toggle */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-nurse" />
            <div>
              <p className="text-sm font-semibold">
                {arabicDays[selectedDate.getDay()]} - {formatDateOnly(selectedDate)}
              </p>
              <p className="text-xs text-muted-foreground">
                {availableDays[selectedDate.getDay()] ? 'متاح لاستقبال الطلبات' : 'غير متاح'}
              </p>
            </div>
          </div>
          <Switch
            checked={availableDays[selectedDate.getDay()] ?? true}
            onCheckedChange={() => handleAvailabilityToggle(selectedDate.getDay())}
          />
        </div>
      </GlassCard>

      {/* Appointments List */}
      <PullToRefresh onRefresh={async () => { setIsLoading(true); await fetchSchedule(); }}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : currentDayClipboardLists.length === 0 && currentDayEmergencies.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="w-10 h-10 text-muted-foreground" />}
            title="لا توجد مواعيد"
            description="لا توجد مواعيد مجدولة في هذا اليوم"
          />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {/* Regular ClipboardLists */}
            {currentDayClipboardLists.map((assignment) => (
              <motion.div key={assignment.id} variants={itemVariants}>
                <GlassCard variant="nurse" className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-sm">{assignment.request.service.nameAr}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Clock className="w-3.5 h-3.5" />
                        {assignment.request.scheduledAt && (
                          <span>{formatTimeOnly(new Date(assignment.request.scheduledAt))}</span>
                        )}
                        <span>•</span>
                        <span>{toArabicNum(assignment.request.service.duration)} دقيقة</span>
                      </div>
                    </div>
                    <BadgeStatus status={assignment.status} />
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <UserRound className="w-4 h-4 text-muted-foreground" />
                      <span>{assignment.request.beneficiary.name}</span>
                    </div>
                    {assignment.request.beneficiaryAddress && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="line-clamp-1">{assignment.request.beneficiaryAddress}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <Currency amount={assignment.request.nursePayout} className="text-green-600 text-sm" />
                    {assignment.estimatedArrivalMinutes && (
                      <span className="text-xs text-muted-foreground">
                        ~{toArabicNum(assignment.estimatedArrivalMinutes)} دقيقة وصول
                      </span>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            ))}

            {/* Emergency ClipboardLists */}
            {currentDayEmergencies.map((emergency) => (
              <motion.div key={emergency.id} variants={itemVariants}>
                <GlassCard variant="nurse" className="p-4 border-l-4 border-l-red-500">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <div>
                        <h3 className="font-semibold text-sm text-red-700 dark:text-red-400">حالة طوارئ</h3>
                        <p className="text-xs text-muted-foreground">{emergency.emergencyRequest.type}</p>
                      </div>
                    </div>
                    <BadgeStatus status={emergency.status} />
                  </div>

                  <p className="text-sm mb-2">{emergency.emergencyRequest.description}</p>

                  <div className="flex items-center gap-2 text-sm">
                    <UserRound className="w-4 h-4 text-muted-foreground" />
                    <span>{emergency.emergencyRequest.beneficiary.name}</span>
                  </div>

                  {emergency.emergencyRequest.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="line-clamp-1">{emergency.emergencyRequest.address}</span>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        )}
      </PullToRefresh>
    </div>
  );
}
