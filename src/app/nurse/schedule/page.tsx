'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Clock,
  MapPin,
  ChevronRight,
  ChevronLeft,
  UserRound,
  AlertTriangle,
  Syringe,
  HeartPulse,
  Baby,
  Activity,
  ClipboardList,
  CheckCircle2,
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

// ---- Constants ----

const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, ease: 'easeOut' as const } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' as const } },
} as const;

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
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

  useEffect(() => {
    if (!selectedDate) setSelectedDate(new Date());
  }, [selectedDate]);

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

  const currentDayClipboardLists = selectedDate ? scheduleData.assignments.filter((a) => {
    if (!a.request.scheduledAt) return false;
    return isSameDay(new Date(a.request.scheduledAt), selectedDate);
  }) : [];

  const currentDayEmergencies = selectedDate ? scheduleData.emergencyClipboardLists.filter((a) => {
    return isSameDay(new Date(a.assignedAt), selectedDate);
  }) : [];

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

  const totalAppointments = currentDayClipboardLists.length + currentDayEmergencies.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="الجدول الأسبوعي"
        description="إدارة مواعيدك وتوافرك الأسبوعي"
      />

      {/* ══════════════ Week Calendar Card ══════════════ */}
      <GlassCard variant="nurse" className="p-5">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-4">
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset((p) => p - 1)} className="rounded-xl h-9 w-9">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </motion.div>
          <div className="text-center">
            <p className="font-black text-sm">
              {weekOffset === 0 ? 'هذا الأسبوع' : weekOffset > 0 ? `بعد ${toArabicNum(weekOffset)} أسبوع` : `قبل ${toArabicNum(Math.abs(weekOffset))} أسبوع`}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium">
              {formatDateOnly(weekDates[0])} - {formatDateOnly(weekDates[6])}
            </p>
          </div>
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset((p) => p + 1)} className="rounded-xl h-9 w-9">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>

        {/* Day Selector */}
        <div className="grid grid-cols-7 gap-1.5">
          {weekDates.map((date, idx) => {
            const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
            const isTodayDate = isToday(date);
            const count = getClipboardListCountForDay(date);

            return (
              <motion.button
                key={idx}
                whileTap={{ scale: 0.92 }}
                onClick={() => setSelectedDate(date)}
                className={`relative flex flex-col items-center py-2.5 px-1 rounded-2xl transition-all ${
                  isSelected
                    ? 'bg-gradient-to-bl from-nurse to-sky-500 text-white shadow-lg shadow-nurse/25'
                    : isTodayDate
                    ? 'bg-nurse/10 text-nurse ring-1 ring-nurse/30'
                    : 'hover:bg-muted/50'
                }`}
              >
                <span className={`text-[9px] font-bold ${isSelected ? 'opacity-80' : ''}`}>{arabicDays[date.getDay()].slice(0, 3)}</span>
                <span className="text-lg font-black mt-0.5">{toArabicNum(date.getDate())}</span>
                {count > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`w-2 h-2 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-nurse'}`}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </GlassCard>

      {/* ══════════════ Day Availability Toggle ══════════════ */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={selectedDate && availableDays[selectedDate.getDay()] ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' as const }}
              className={`w-3 h-3 rounded-full ${selectedDate ? (availableDays[selectedDate.getDay()] ? 'bg-emerald-500' : 'bg-gray-400') : 'bg-gray-400'}`}
            />
            <div>
              <p className="text-sm font-bold">
                {selectedDate ? `${arabicDays[selectedDate.getDay()]} - ${formatDateOnly(selectedDate)}` : '...'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {selectedDate ? (availableDays[selectedDate.getDay()] ? 'متاح لاستقبال الطلبات' : 'غير متاح') : ''}
              </p>
            </div>
          </div>
          <Switch
            checked={selectedDate ? (availableDays[selectedDate.getDay()] ?? true) : true}
            onCheckedChange={() => selectedDate && handleAvailabilityToggle(selectedDate.getDay())}
            className="data-[state=checked]:bg-emerald-600"
          />
        </div>
      </GlassCard>

      {/* ══════════════ Appointments Summary ══════════════ */}
      {selectedDate && totalAppointments > 0 && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-nurse/10 border border-nurse/20">
            <CalendarDays className="w-3.5 h-3.5 text-nurse" />
            <span className="text-xs font-bold text-nurse">{toArabicNum(totalAppointments)} موعد</span>
          </div>
        </div>
      )}

      {/* ══════════════ Appointments List ══════════════ */}
      <PullToRefresh onRefresh={async () => { setIsLoading(true); await fetchSchedule(); }}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : currentDayClipboardLists.length === 0 && currentDayEmergencies.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="w-12 h-12 text-muted-foreground" />}
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
            {/* Regular Assignments */}
            {currentDayClipboardLists.map((assignment) => (
              <motion.div key={assignment.id} variants={itemVariants}>
                <GlassCard variant="nurse" className="p-4 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-1 h-full rounded-l-full bg-gradient-to-b from-nurse to-sky-400" />
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-bl from-nurse to-sky-400 flex items-center justify-center text-white shadow-md shadow-nurse/20 shrink-0">
                        <CalendarDays className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{assignment.request.service.nameAr}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          {assignment.request.scheduledAt && (
                            <span>{formatTimeOnly(new Date(assignment.request.scheduledAt))}</span>
                          )}
                          <span>•</span>
                          <span>{toArabicNum(assignment.request.service.duration)} دقيقة</span>
                        </div>
                      </div>
                    </div>
                    <BadgeStatus status={assignment.status} />
                  </div>

                  <div className="space-y-1.5 text-sm mt-3">
                    <div className="flex items-center gap-2">
                      <UserRound className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{assignment.request.beneficiary.name}</span>
                    </div>
                    {assignment.request.beneficiaryAddress && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="line-clamp-1 text-xs">{assignment.request.beneficiaryAddress}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <Currency amount={assignment.request.nursePayout} className="text-emerald-600 text-sm font-bold" />
                    {assignment.estimatedArrivalMinutes && (
                      <span className="text-[11px] text-muted-foreground">
                        ~{toArabicNum(assignment.estimatedArrivalMinutes)} دقيقة وصول
                      </span>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            ))}

            {/* Emergency Assignments */}
            {currentDayEmergencies.map((emergency) => (
              <motion.div key={emergency.id} variants={itemVariants}>
                <GlassCard variant="nurse" className="p-4 overflow-hidden relative border-2 border-red-300 dark:border-red-800/60 ring-1 ring-red-100 dark:ring-red-900/20">
                  <div className="absolute top-0 right-0 w-1 h-full rounded-l-full bg-gradient-to-b from-red-400 to-red-600" />
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' as const }}
                        className="w-10 h-10 rounded-2xl bg-gradient-to-bl from-red-400 to-red-600 flex items-center justify-center text-white shadow-md shadow-red-500/25 shrink-0"
                      >
                        <AlertTriangle className="w-5 h-5" />
                      </motion.div>
                      <div>
                        <h3 className="font-bold text-sm text-red-700 dark:text-red-400">حالة طوارئ</h3>
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
                      <span className="line-clamp-1 text-xs">{emergency.emergencyRequest.address}</span>
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
