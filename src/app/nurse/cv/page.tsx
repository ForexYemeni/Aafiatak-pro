'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, User, Sparkles, Briefcase, Award, Globe, Star, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { toast as sonnerToast } from 'sonner';
import {
  ProfileHeader,
  BioSection,
  SkillsSection,
  ExperienceSection,
  CertificatesSection,
  LanguagesSection,
  ReviewsSection,
  StatisticsSection,
  ProfileCompleteness,
  SkillEditor,
  ExperienceEditor,
  CertificateEditor,
  LanguageEditor,
} from '@/components/nurse-cv';
import type { NurseProfileData } from '@/components/nurse-cv/profile-header';
import type { SkillData } from '@/components/nurse-cv/skills-section';
import type { ExperienceData } from '@/components/nurse-cv/experience-section';
import type { CertificateData } from '@/components/nurse-cv/certificates-section';
import type { LanguageData } from '@/components/nurse-cv/languages-section';

// ---- Navigation tabs ----
const tabs = [
  { id: 'about', label: 'نبذة', icon: User },
  { id: 'skills', label: 'مهارات', icon: Sparkles },
  { id: 'experience', label: 'خبرات', icon: Briefcase },
  { id: 'certificates', label: 'شهادات', icon: Award },
  { id: 'languages', label: 'لغات', icon: Globe },
  { id: 'reviews', label: 'تقييمات', icon: Star },
];

// ---- Compute profile completeness ----
function computeCompleteness(nurse: NurseProfileData): { percent: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;
  const total = 8;

  if (nurse.bio && nurse.bio.trim()) filled++; else missing.push('أضف نبذة مهنية');
  if (nurse.skills && nurse.skills.length > 0) filled++; else missing.push('أضف مهارات');
  if (nurse.experiences && nurse.experiences.length > 0) filled++; else missing.push('أضف خبرة عملية');
  if (nurse.certificates && nurse.certificates.length > 0) filled++; else missing.push('أضف شهادة أو دورة');
  if (nurse.languages && nurse.languages.length > 0) filled++; else missing.push('أضف لغة');
  if (nurse.professionalTitle && nurse.professionalTitle.trim()) filled++; else missing.push('أضف مسمى وظيفي');
  if (nurse.specialization && nurse.specialization.length > 0) filled++; else missing.push('أضف تخصص');
  if (nurse.experience > 0) filled++; else missing.push('أضف سنوات الخبرة');

  return { percent: Math.round((filled / total) * 100), missing };
}

type EditingSection = 'skills' | 'experiences' | 'certificates' | 'languages' | null;

export default function NurseCVPage() {
  const [nurse, setNurse] = useState<NurseProfileData | null>(null);
  const [fullProfile, setFullProfile] = useState<{ name: string; avatar: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewAsBeneficiary, setViewAsBeneficiary] = useState(false);
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [activeTab, setActiveTab] = useState('about');

  const authFetch = useAuthFetch();

  const fetchCV = useCallback(async () => {
    try {
      const res = await authFetch('/api/nurse/profile');
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data;
        setFullProfile({ name: p.name, avatar: p.avatar || null });
        setNurse({
          id: p._id?.toString() || p.id,
          name: p.name?.split(' ')[0] || 'ممرض',
          avatar: p.avatar || null,
          professionalTitle: p.professionalTitle || '',
          specialization: p.specialization || [],
          experience: p.experience || 0,
          governorate: p.governorate || '',
          district: p.district || '',
          bio: p.bio || '',
          skills: p.skills || [],
          experiences: p.experiences || [],
          certificates: p.certificates || [],
          languages: p.languages || [],
          rating: p.rating || 0,
          reviewCount: p.reviewCount || 0,
          completedJobs: p.completedJobs || 0,
          emergencyCases: p.emergencyCases || 0,
          responseRate: p.responseRate || 0,
          complianceRate: p.complianceRate || 0,
          verificationStatus: p.verificationStatus || 'unverified',
          isAvailable: p.isAvailable || false,
          isOnline: p.isOnline || false,
        });
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchCV();
  }, [fetchCV]);

  // ---- Save handlers ----
  const handleSaveBio = async (bio: string) => {
    const res = await authFetch('/api/nurse/cv', {
      method: 'PATCH',
      body: JSON.stringify({ bio }),
    });
    const data = await res.json();
    if (data.success) {
      setNurse(prev => prev ? { ...prev, bio } : null);
      sonnerToast.success('تم تحديث النبذة المهنية');
    } else {
      sonnerToast.error('فشل تحديث النبذة');
    }
  };

  const handleSaveSkills = async (skills: SkillData[]) => {
    const res = await authFetch('/api/nurse/cv', {
      method: 'PATCH',
      body: JSON.stringify({ skills }),
    });
    const data = await res.json();
    if (data.success) {
      setNurse(prev => prev ? { ...prev, skills: data.data.skills || skills } : null);
      setEditingSection(null);
      sonnerToast.success('تم تحديث المهارات');
    } else {
      sonnerToast.error('فشل تحديث المهارات');
    }
  };

  const handleSaveExperiences = async (experiences: ExperienceData[]) => {
    const res = await authFetch('/api/nurse/cv', {
      method: 'PATCH',
      body: JSON.stringify({ experiences }),
    });
    const data = await res.json();
    if (data.success) {
      setNurse(prev => prev ? { ...prev, experiences: data.data.experiences || experiences } : null);
      setEditingSection(null);
      sonnerToast.success('تم تحديث الخبرات');
    } else {
      sonnerToast.error('فشل تحديث الخبرات');
    }
  };

  const handleSaveCertificates = async (certificates: CertificateData[]) => {
    const res = await authFetch('/api/nurse/cv', {
      method: 'PATCH',
      body: JSON.stringify({ certificates }),
    });
    const data = await res.json();
    if (data.success) {
      setNurse(prev => prev ? { ...prev, certificates: data.data.certificates || certificates } : null);
      setEditingSection(null);
      sonnerToast.success('تم تحديث الشهادات');
    } else {
      sonnerToast.error('فشل تحديث الشهادات');
    }
  };

  const handleSaveLanguages = async (languages: LanguageData[]) => {
    const res = await authFetch('/api/nurse/cv', {
      method: 'PATCH',
      body: JSON.stringify({ languages }),
    });
    const data = await res.json();
    if (data.success) {
      setNurse(prev => prev ? { ...prev, languages: data.data.languages || languages } : null);
      setEditingSection(null);
      sonnerToast.success('تم تحديث اللغات');
    } else {
      sonnerToast.error('فشل تحديث اللغات');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="السيرة الذاتية" />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!nurse) {
    return (
      <div className="space-y-4">
        <PageHeader title="السيرة الذاتية" />
        <div className="text-center py-12">
          <p className="text-muted-foreground">لم يتم العثور على بيانات السيرة الذاتية</p>
        </div>
      </div>
    );
  }

  const completeness = computeCompleteness(nurse);

  return (
    <div className="space-y-4">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <PageHeader title="السيرة الذاتية" className="flex-1 mb-0" />
        <div className="flex items-center gap-2 shrink-0">
          <Label htmlFor="view-toggle" className="text-xs text-muted-foreground flex items-center gap-1">
            {viewAsBeneficiary ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {viewAsBeneficiary ? 'عرض المستفيد' : 'عرض الممرض'}
          </Label>
          <Switch
            id="view-toggle"
            checked={viewAsBeneficiary}
            onCheckedChange={setViewAsBeneficiary}
          />
        </div>
      </div>

      {/* Profile Completeness (only own view) */}
      {!viewAsBeneficiary && (
        <ProfileCompleteness completeness={completeness.percent} missingItems={completeness.missing} />
      )}

      {/* Profile Header */}
      <ProfileHeader
        nurse={nurse}
        isOwnView={!viewAsBeneficiary}
        fullName={fullProfile?.name}
        profileCompleteness={completeness.percent}
      />

      {/* Statistics */}
      <StatisticsSection
        completedJobs={nurse.completedJobs}
        emergencyCases={nurse.emergencyCases}
        experience={nurse.experience}
        rating={nurse.rating}
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

      {/* Bio Section */}
      <div id="section-about">
        <BioSection
          bio={nurse.bio}
          isOwnView={!viewAsBeneficiary}
          onSave={handleSaveBio}
        />
      </div>

      {/* Skills Section */}
      <div id="section-skills">
        <AnimatePresence mode="wait">
          {editingSection === 'skills' ? (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SkillEditor
                skills={nurse.skills}
                onSave={handleSaveSkills}
                onCancel={() => setEditingSection(null)}
              />
            </motion.div>
          ) : (
            <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SkillsSection
                skills={nurse.skills}
                isOwnView={!viewAsBeneficiary}
                onEdit={() => setEditingSection('skills')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Experience Section */}
      <div id="section-experience">
        <AnimatePresence mode="wait">
          {editingSection === 'experiences' ? (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ExperienceEditor
                experiences={nurse.experiences}
                onSave={handleSaveExperiences}
                onCancel={() => setEditingSection(null)}
              />
            </motion.div>
          ) : (
            <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ExperienceSection
                experiences={nurse.experiences}
                isOwnView={!viewAsBeneficiary}
                onEdit={() => setEditingSection('experiences')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Certificates Section */}
      <div id="section-certificates">
        <AnimatePresence mode="wait">
          {editingSection === 'certificates' ? (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CertificateEditor
                certificates={nurse.certificates}
                onSave={handleSaveCertificates}
                onCancel={() => setEditingSection(null)}
              />
            </motion.div>
          ) : (
            <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CertificatesSection
                certificates={nurse.certificates}
                isOwnView={!viewAsBeneficiary}
                onEdit={() => setEditingSection('certificates')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Languages Section */}
      <div id="section-languages">
        <AnimatePresence mode="wait">
          {editingSection === 'languages' ? (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LanguageEditor
                languages={nurse.languages}
                onSave={handleSaveLanguages}
                onCancel={() => setEditingSection(null)}
              />
            </motion.div>
          ) : (
            <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LanguagesSection
                languages={nurse.languages}
                isOwnView={!viewAsBeneficiary}
                onEdit={() => setEditingSection('languages')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reviews Section */}
      <div id="section-reviews">
        <ReviewsSection
          rating={nurse.rating}
          reviewCount={nurse.reviewCount}
          complianceRate={nurse.complianceRate}
          responseRate={nurse.responseRate}
        />
      </div>
    </div>
  );
}
