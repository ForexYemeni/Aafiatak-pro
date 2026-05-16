// ============================================================================
// عافيتك — Shared Constants
// ============================================================================

// ── Yemen Governorates (21 Governorates) ──────────────────────────────────

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
}

export const DEFAULT_SPECIALIZATIONS: Specialization[] = [
  // تمريض عام
  { id: 'general_nursing', label: 'ممرض عام', category: 'تمريض' },
  { id: 'emergency_nursing', label: 'ممرض طوارئ', category: 'تمريض' },
  { id: 'critical_care', label: 'ممرض عناية مركزة', category: 'تمريض' },
  { id: 'home_care_nursing', label: 'ممرض منزلي', category: 'تمريض' },
  { id: 'pediatric', label: 'ممرض أطفال', category: 'تمريض' },
  { id: 'surgery_nursing', label: 'ممرض عمليات', category: 'تمريض' },
  { id: 'anesthesia_nursing', label: 'ممرض تخدير', category: 'تمريض' },
  { id: 'dialysis', label: 'ممرض غسيل كلى', category: 'تمريض' },
  { id: 'cardiac_nursing', label: 'ممرض قلب', category: 'تمريض' },
  { id: 'oncology', label: 'ممرض أورام', category: 'تمريض' },
  { id: 'mental_health', label: 'ممرض نفسي', category: 'تمريض' },
  { id: 'elderly_care', label: 'ممرض كبار سن', category: 'تمريض' },
  { id: 'neonatal', label: 'ممرض حديثي الولادة', category: 'تمريض' },
  { id: 'iv_therapy', label: 'تركيب محاليل', category: 'تمريض' },
  { id: 'wound_care', label: 'رعاية جروح', category: 'تمريض' },
  { id: 'post_surgery', label: 'رعاية ما بعد الجراحة', category: 'تمريض' },
  // مختبر
  { id: 'lab_specialist', label: 'أخصائي مختبر', category: 'مختبر' },
  { id: 'lab_tech', label: 'فني مختبر', category: 'مختبر' },
  { id: 'blood_draw', label: 'سحب عينات', category: 'مختبر' },
  // أشعة
  { id: 'radiology_specialist', label: 'أخصائي أشعة', category: 'أشعة' },
  { id: 'radiology_tech', label: 'فني أشعة', category: 'أشعة' },
  // طبي
  { id: 'physician_assistant', label: 'مساعد طبيب', category: 'طبي' },
  { id: 'respiratory_specialist', label: 'أخصائي تنفسية', category: 'طبي' },
  // توليد
  { id: 'midwife', label: 'قابلة', category: 'توليد' },
  // علاج
  { id: 'physiotherapy', label: 'علاج طبيعي', category: 'علاج' },
  { id: 'nutrition_therapy', label: 'تغذية علاجية', category: 'علاج' },
  { id: 'respiratory_therapy', label: 'علاج تنفسي', category: 'علاج' },
  // طوارئ
  { id: 'paramedic', label: 'مسعف', category: 'طوارئ' },
  { id: 'emergency_tech', label: 'فني طوارئ', category: 'طوارئ' },
  // رعاية
  { id: 'home_care', label: 'رعاية منزلية', category: 'رعاية' },
  // أخرى
  { id: 'other', label: 'تخصصات أخرى', category: 'أخرى' },
];

// Helper: build a label map from the list
export const buildSpecializationMap = (list: Specialization[]): Record<string, string> =>
  Object.fromEntries(list.map((s) => [s.id, s.label]));

// Default label map (used when dynamic fetch is not available)
export const SPECIALIZATION_LABELS: Record<string, string> =
  buildSpecializationMap(DEFAULT_SPECIALIZATIONS);

// Unique categories in order
export const SPECIALIZATION_CATEGORIES: string[] = [
  'تمريض',
  'مختبر',
  'أشعة',
  'طبي',
  'توليد',
  'علاج',
  'طوارئ',
  'رعاية',
  'أخرى',
];
