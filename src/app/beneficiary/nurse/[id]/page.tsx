'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, User, Sparkles, Briefcase, Award, Globe, Star,
  Phone, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { ContactGuard } from '@/components/nurse-cv/contact-guard';
import type { NurseProfileData } from '@/components/nurse-cv/profile-header';
import {
  ProfileHeader,
  BioSection,
  SkillsSection,
  ExperienceSection,
  CertificatesSection,
  LanguagesSection,
  ReviewsSection,
  StatisticsSection,
} from '@/components/nurse-cv';

// ---- Navigation tabs ----
const tabs = [
  { id: 'about', label: 'نبذة', icon: User },
  { id: 'skills', label: 'مهارات', icon: Sparkles },
  { id: 'experience', label: 'خبرات', icon: Briefcase },
  { id: 'certificates', label: 'شهادات', icon: Award },
  { id: 'languages', label: 'لغات', icon: Globe },
  { id: 'reviews', label: 'تقييمات', icon: Star },
];

export default function BeneficiaryNurseProfilePage() {
  const params = useParams();
  const router = useRouter();
  const nurseId = params.id as string;

  const [nurse, setNurse] = useState<NurseProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('about');

  const fetchNurse = useCallback(async () => {
    try {
      const res = await fetch(`/api/nurse/${nurseId}/profile`);
      const data = await res.json();
      if (data.success && data.data) {
        setNurse(data.data);
      } else {
        setError(data.error?.message || 'لم يتم العثور على الممرض');
      }
    } catch {
      setError('حدث خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  }, [nurseId]);

  useEffect(() => {
    fetchNurse();
  }, [fetchNurse]);

  const handleRequestService = () => {
    router.push(`/beneficiary/request`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="الملف المهني" />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error || !nurse) {
    return (
      <div className="space-y-4">
        <PageHeader title="الملف المهني" />
        <div className="text-center py-12">
          <p className="text-muted-foreground">{error || 'لم يتم العثور على الممرض'}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            العودة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Profile Header */}
      <ProfileHeader nurse={nurse} />

      {/* Statistics */}
      <StatisticsSection
        completedJobs={nurse.completedJobs}
        emergencyCases={nurse.emergencyCases}
        experience={nurse.experience}
        rating={nurse.rating}
      />

      {/* Contact Guard */}
      <ContactGuard
        onAction={handleRequestService}
        actionLabel="طلب خدمة"
      />

      {/* Navigation Tabs */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/80 backdrop-blur-lg border-b border-border/40">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  const el = document.getElementById(`section-${tab.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-nurse/15 text-nurse'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections */}
      <div id="section-about">
        <BioSection bio={nurse.bio} />
      </div>

      <div id="section-skills">
        <SkillsSection skills={nurse.skills} />
      </div>

      <div id="section-experience">
        <ExperienceSection experiences={nurse.experiences} />
      </div>

      <div id="section-certificates">
        <CertificatesSection certificates={nurse.certificates} />
      </div>

      <div id="section-languages">
        <LanguagesSection languages={nurse.languages} />
      </div>

      <div id="section-reviews">
        <ReviewsSection
          rating={nurse.rating}
          reviewCount={nurse.reviewCount}
          complianceRate={nurse.complianceRate}
          responseRate={nurse.responseRate}
        />
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-20 left-4 right-4 z-30 sm:left-auto sm:right-6 sm:w-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            className="w-full sm:w-auto bg-nurse hover:bg-nurse/90 h-12 rounded-xl shadow-lg gap-2 text-base"
            onClick={handleRequestService}
          >
            <Phone className="w-5 h-5" />
            طلب خدمة
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
