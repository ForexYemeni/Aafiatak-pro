'use client';

import { motion } from 'framer-motion';
import { MapPin, Clock, ShieldCheck, Zap, Star, Activity } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/common/glass-card';
import { VerifiedBadge } from '@/components/common/verified-badge';
import { toArabicNum } from '@/components/common/date-formatter';
import { cn } from '@/lib/utils';

// ---- Specialization labels ----
const specializationLabels: Record<string, string> = {
  general_nursing: 'تمريض عام',
  critical_care: 'رعاية حرجة',
  pediatric: 'تمريض أطفال',
  elderly_care: 'رعاية المسنين',
  physiotherapy: 'علاج طبيعي',
  wound_care: 'عناية بالجروح',
  iv_therapy: 'علاج وريدي',
  mental_health: 'صحة نفسية',
  post_surgery: 'رعاية ما بعد الجراحة',
  emergency: 'طوارئ',
};

export interface NurseProfileData {
  id: string;
  name: string;
  avatar: string | null;
  professionalTitle: string;
  specialization: string[];
  experience: number;
  governorate: string;
  district: string;
  bio: string;
  skills: { name: string; level: string; order: number }[];
  experiences: { facility?: string; title?: string; duration?: string; description?: string; casesType?: string; startDate?: string; endDate?: string; order: number }[];
  certificates: { name: string; issuer?: string; date?: string; type: string; verified: boolean; order: number }[];
  languages: { name: string; level: string }[];
  rating: number;
  reviewCount: number;
  completedJobs: number;
  emergencyCases: number;
  responseRate: number;
  complianceRate: number;
  verificationStatus: string;
  isAvailable: boolean;
  isOnline: boolean;
}

interface ProfileHeaderProps {
  nurse: NurseProfileData;
  isOwnView?: boolean;
  fullName?: string;
  profileCompleteness?: number;
}

// ---- Animation variants ----
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
} as const;

export function ProfileHeader({ nurse, isOwnView, fullName, profileCompleteness }: ProfileHeaderProps) {
  const displayName = isOwnView && fullName ? fullName : nurse.name;
  const initials = displayName?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'م';

  // Professional badges
  const badges: { label: string; icon: React.ReactNode; active: boolean; color: string }[] = [
    { label: 'موثّق', icon: <ShieldCheck className="w-3 h-3" />, active: nurse.verificationStatus === 'verified', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    { label: 'طوارئ', icon: <Zap className="w-3 h-3" />, active: nurse.emergencyCases > 0, color: 'bg-red-500/15 text-red-600 dark:text-red-400' },
    { label: 'أعلى تقييم', icon: <Star className="w-3 h-3" />, active: nurse.rating >= 4.5, color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
    { label: 'استجابة سريعة', icon: <Activity className="w-3 h-3" />, active: nurse.responseRate >= 80, color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  ];

  return (
    <GlassCard variant="nurse" className="p-0 overflow-hidden">
      {/* Gradient header background */}
      <div className="relative h-28 bg-gradient-to-l from-nurse/30 via-nurse/15 to-transparent">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(14,165,233,0.2),transparent_70%)]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative px-5 pb-5 -mt-14"
      >
        {/* Avatar */}
        <motion.div variants={itemVariants} className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="rounded-full p-[3px] bg-gradient-to-br from-nurse via-sky-400 to-nurse/60">
              <Avatar className="w-24 h-24 text-2xl border-4 border-background">
                {nurse.avatar ? (
                  <AvatarImage src={nurse.avatar} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-nurse/10 text-nurse text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Online/Offline indicator */}
            <div className={cn(
              'absolute bottom-1 left-1 w-5 h-5 rounded-full border-[3px] border-background flex items-center justify-center',
              nurse.isOnline && nurse.isAvailable ? 'bg-green-500' : 'bg-gray-400'
            )}>
              {nurse.isOnline && nurse.isAvailable && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 animate-ping opacity-50" />
              )}
            </div>
          </div>
        </motion.div>

        {/* Name + Title */}
        <motion.div variants={itemVariants} className="text-center mb-3">
          <h1 className="text-xl font-bold flex items-center justify-center gap-1.5">
            {displayName}
            {nurse.verificationStatus === 'verified' && <VerifiedBadge size="md" showText={false} />}
          </h1>
          {nurse.professionalTitle && (
            <p className="text-sm text-nurse font-medium mt-0.5">{nurse.professionalTitle}</p>
          )}
        </motion.div>

        {/* Specialization badges */}
        {nurse.specialization?.length > 0 && (
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-1.5 mb-3">
            {nurse.specialization.map((spec) => (
              <Badge
                key={spec}
                variant="secondary"
                className="bg-nurse/10 text-nurse hover:bg-nurse/20 text-[11px] px-2 py-0.5"
              >
                {specializationLabels[spec] ?? spec}
              </Badge>
            ))}
          </motion.div>
        )}

        {/* Location + Experience */}
        <motion.div variants={itemVariants} className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-3">
          {(nurse.governorate || nurse.district) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-nurse/70" />
              {[nurse.district, nurse.governorate].filter(Boolean).join('، ')}
            </span>
          )}
          {nurse.experience > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-nurse/70" />
              {toArabicNum(nurse.experience)} سنة خبرة
            </span>
          )}
        </motion.div>

        {/* Professional badges row */}
        <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-1.5 mb-3">
          {badges.filter(b => b.active).map((badge) => (
            <span
              key={badge.label}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                badge.color
              )}
            >
              {badge.icon}
              {badge.label}
            </span>
          ))}
        </motion.div>

        {/* Profile completeness bar (only for own view) */}
        {isOwnView && profileCompleteness !== undefined && (
          <motion.div variants={itemVariants} className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">اكتمال الملف</span>
              <span className="font-semibold text-nurse">{toArabicNum(profileCompleteness)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-l from-nurse to-sky-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${profileCompleteness}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
              />
            </div>
          </motion.div>
        )}
      </motion.div>
    </GlassCard>
  );
}
