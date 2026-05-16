// ============================================================================
// عافيتك — Shared Constants
// ============================================================================

// ── Yemen Governorates (22 Governorates + Secretariat) ────────────────────

export const YEMEN_GOVERNORATES: string[] = [
  'أمانة العاصمة',
  'صنعاء',
  'عدن',
  'تعز',
  'الحديدة',
  'إب',
  'حضرموت',
  'مأرب',
  'الجوف',
  'صعدة',
  'عمران',
  'ذمار',
  'البيضاء',
  'لحج',
  'أبين',
  'شبوة',
  'المهرة',
  'المحويت',
  'حجة',
  'ريمة',
  'الضالع',
  'سقطرى',
];

// ── Nurse / Medical Specializations ───────────────────────────────────────

export interface Specialization {
  id: string;
  label: string;
  category: string;
  order: number;
  icon?: string;
  description?: string;
}

export const DEFAULT_SPECIALIZATIONS: Specialization[] = [
  // ═══ تمريض (Nursing) ═══
  { id: 'general_nursing', label: 'ممرض عام', category: 'تمريض', order: 1 },
  { id: 'home_care_nursing', label: 'ممرض منزلي', category: 'تمريض', order: 2 },
  { id: 'emergency_nursing', label: 'ممرض طوارئ', category: 'تمريض', order: 3 },
  { id: 'critical_care', label: 'ممرض عناية مركزة', category: 'تمريض', order: 4 },
  { id: 'pediatric', label: 'ممرض أطفال', category: 'تمريض', order: 5 },
  { id: 'neonatal', label: 'ممرض حديثي الولادة', category: 'تمريض', order: 6 },
  { id: 'elderly_care', label: 'ممرض كبار سن', category: 'تمريض', order: 7 },
  { id: 'surgery_nursing', label: 'ممرض عمليات', category: 'تمريض', order: 8 },
  { id: 'anesthesia_nursing', label: 'ممرض تخدير', category: 'تمريض', order: 9 },
  { id: 'cardiac_nursing', label: 'ممرض قلب', category: 'تمريض', order: 10 },
  { id: 'dialysis', label: 'ممرض غسيل كلى', category: 'تمريض', order: 11 },
  { id: 'oncology', label: 'ممرض أورام', category: 'تمريض', order: 12 },
  { id: 'mental_health', label: 'ممرض نفسي', category: 'تمريض', order: 13 },
  { id: 'iv_therapy', label: 'تركيب محاليل', category: 'تمريض', order: 14 },
  { id: 'wound_care', label: 'رعاية جروح', category: 'تمريض', order: 15 },
  { id: 'post_surgery', label: 'رعاية ما بعد الجراحة', category: 'تمريض', order: 16 },

  // ═══ مختبر (Laboratory) ═══
  { id: 'lab_specialist', label: 'أخصائي مختبر', category: 'مختبر', order: 101 },
  { id: 'lab_tech', label: 'فني مختبر', category: 'مختبر', order: 102 },
  { id: 'blood_draw', label: 'سحب عينات دم', category: 'مختبر', order: 103 },

  // ═══ أشعة (Radiology) ═══
  { id: 'radiology_specialist', label: 'أخصائي أشعة', category: 'أشعة', order: 201 },
  { id: 'radiology_tech', label: 'فني أشعة', category: 'أشعة', order: 202 },

  // ═══ طبي (Medical) ═══
  { id: 'physician_assistant', label: 'مساعد طبيب', category: 'طبي', order: 301 },
  { id: 'respiratory_specialist', label: 'أخصائي تنفسية', category: 'طبي', order: 302 },

  // ═══ توليد (Obstetrics) ═══
  { id: 'midwife', label: 'قابلة', category: 'توليد', order: 401 },

  // ═══ علاج (Therapy) ═══
  { id: 'physiotherapy', label: 'علاج طبيعي', category: 'علاج', order: 501 },
  { id: 'nutrition_therapy', label: 'تغذية علاجية', category: 'علاج', order: 502 },
  { id: 'respiratory_therapy', label: 'علاج تنفسي', category: 'علاج', order: 503 },

  // ═══ طوارئ (Emergency) ═══
  { id: 'paramedic', label: 'مسعف', category: 'طوارئ', order: 601 },
  { id: 'emergency_tech', label: 'فني طوارئ', category: 'طوارئ', order: 602 },

  // ═══ رعاية (Care) ═══
  { id: 'home_care', label: 'رعاية منزلية', category: 'رعاية', order: 701 },

  // ═══ أخرى (Other) ═══
  { id: 'other', label: 'تخصصات أخرى', category: 'أخرى', order: 901 },
];

// Helper: build a label map from the list
export const buildSpecializationMap = (list: Specialization[]): Record<string, string> =>
  Object.fromEntries(list.map((s) => [s.id, s.label]));

// Default label map (used when dynamic fetch is not available)
export const SPECIALIZATION_LABELS: Record<string, string> =
  buildSpecializationMap(DEFAULT_SPECIALIZATIONS);

// Category metadata with icons, colors, and descriptions
export interface CategoryMeta {
  id: string;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  order: number;
}

export const SPECIALIZATION_CATEGORIES_META: CategoryMeta[] = [
  {
    id: 'تمريض',
    label: 'تمريض',
    icon: '🩺',
    color: 'text-teal-700 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    borderColor: 'border-teal-200 dark:border-teal-800',
    description: 'خدمات التمريض المتنوعة',
    order: 1,
  },
  {
    id: 'مختبر',
    label: 'مختبر',
    icon: '🔬',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    description: 'تحاليل وفحوصات مختبرية',
    order: 2,
  },
  {
    id: 'أشعة',
    label: 'أشعة',
    icon: '📡',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    description: 'تصوير وتحليل أشعة',
    order: 3,
  },
  {
    id: 'طبي',
    label: 'طبي',
    icon: '⚕️',
    color: 'text-indigo-700 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    description: 'مساعدة طبية متخصصة',
    order: 4,
  },
  {
    id: 'توليد',
    label: 'توليد',
    icon: '👶',
    color: 'text-pink-700 dark:text-pink-400',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    borderColor: 'border-pink-200 dark:border-pink-800',
    description: 'رعاية الأمومة والولادة',
    order: 5,
  },
  {
    id: 'علاج',
    label: 'علاج',
    icon: '💊',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    description: 'علاج طبيعي وتأهيل',
    order: 6,
  },
  {
    id: 'طوارئ',
    label: 'طوارئ',
    icon: '🚑',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    description: 'إسعاف وطوارئ طبية',
    order: 7,
  },
  {
    id: 'رعاية',
    label: 'رعاية',
    icon: '🏠',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    description: 'رعاية منزلية ومتابعة',
    order: 8,
  },
  {
    id: 'أخرى',
    label: 'أخرى',
    icon: '📋',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
    description: 'تخصصات طبية أخرى',
    order: 9,
  },
];

// Unique categories in order (backward compatible)
export const SPECIALIZATION_CATEGORIES: string[] =
  SPECIALIZATION_CATEGORIES_META.map((c) => c.id);

// Get category metadata by id
export function getCategoryMeta(categoryId: string): CategoryMeta | undefined {
  return SPECIALIZATION_CATEGORIES_META.find((c) => c.id === categoryId);
}
