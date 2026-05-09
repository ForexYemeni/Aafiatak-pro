// POST /api/seed - Initialize database with default data
// Creates default admin, services, and settings
// This endpoint should be called once after setting up a new database

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, Nurse, Beneficiary } from '@/models/mongoose';
import { Service } from '@/models/mongoose/Service';
import { AdminSettings } from '@/models/mongoose/AdminSettings';
import { hashPassword, generateReferralCode } from '@/lib/auth';

const defaultServices = [
  // medical (15 services)
  { nameAr: 'فحص طبي عام', nameEn: 'General Medical Checkup', descriptionAr: 'فحص طبي شامل يشمل جميع القياسات الحيوية', category: 'medical', basePrice: 5000, duration: 60, icon: 'Stethoscope', isActive: true, isEmergency: false, sortOrder: 1, requirements: [], includedItems: [] },
  { nameAr: 'استشارة طبية عن بعد', nameEn: 'Remote Medical Consultation', descriptionAr: 'استشارة طبية عبر الاتصال المرئي أو الصوتي', category: 'medical', basePrice: 3000, duration: 30, icon: 'Stethoscope', isActive: true, isEmergency: false, sortOrder: 2, requirements: [], includedItems: [] },
  { nameAr: 'فحص ضغط الدم', nameEn: 'Blood Pressure Check', descriptionAr: 'قياس ومتابعة ضغط الدم في المنزل', category: 'medical', basePrice: 2000, duration: 20, icon: 'Stethoscope', isActive: true, isEmergency: false, sortOrder: 3, requirements: [], includedItems: [] },
  { nameAr: 'فحص السكر التراكمي', nameEn: 'HbA1c Test', descriptionAr: 'فحص مستوى السكر التراكمي في الدم', category: 'medical', basePrice: 3500, duration: 30, icon: 'Stethoscope', isActive: true, isEmergency: false, sortOrder: 4, requirements: [], includedItems: [] },
  { nameAr: 'تحليل الدم المنزلي', nameEn: 'Home Blood Test', descriptionAr: 'أخذ عينة دم وتحليلها في المنزل', category: 'medical', basePrice: 4000, duration: 45, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 5, requirements: [], includedItems: [] },
  { nameAr: 'تخطيط القلب المنزلي', nameEn: 'Home ECG', descriptionAr: 'تخطيط كهربائية القلب في المنزل', category: 'medical', basePrice: 6000, duration: 30, icon: 'Stethoscope', isActive: true, isEmergency: false, sortOrder: 6, requirements: [], includedItems: [] },
  { nameAr: 'فحص وظائف الكبد', nameEn: 'Liver Function Test', descriptionAr: 'فحص شامل لوظائف الكبد', category: 'medical', basePrice: 4500, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 7, requirements: [], includedItems: [] },
  { nameAr: 'فحص وظائف الكلى', nameEn: 'Kidney Function Test', descriptionAr: 'فحص شامل لوظائف الكلى', category: 'medical', basePrice: 4500, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 8, requirements: [], includedItems: [] },
  { nameAr: 'فحص الغدة الدرقية', nameEn: 'Thyroid Test', descriptionAr: 'فحص هرمونات الغدة الدرقية', category: 'medical', basePrice: 5000, duration: 30, icon: 'Stethoscope', isActive: true, isEmergency: false, sortOrder: 9, requirements: [], includedItems: [] },
  { nameAr: 'فحص البول المنزلي', nameEn: 'Home Urine Test', descriptionAr: 'تحليل البول في المنزل', category: 'medical', basePrice: 2500, duration: 20, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 10, requirements: [], includedItems: [] },
  { nameAr: 'فحص الدم الكامل', nameEn: 'Complete Blood Count', descriptionAr: 'فحص شامل لخلايا الدم', category: 'medical', basePrice: 4000, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 11, requirements: [], includedItems: [] },
  { nameAr: 'تحليل الدهون والكوليسترول', nameEn: 'Lipid Profile', descriptionAr: 'فحص مستوى الدهون والكوليسترول في الدم', category: 'medical', basePrice: 3500, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 12, requirements: [], includedItems: [] },
  { nameAr: 'فحص فيتامين د', nameEn: 'Vitamin D Test', descriptionAr: 'قياس مستوى فيتامين د في الدم', category: 'medical', basePrice: 4000, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 13, requirements: [], includedItems: [] },
  { nameAr: 'فحص الحديد والأنيميا', nameEn: 'Iron & Anemia Test', descriptionAr: 'فحص مستوى الحديد وفقر الدم', category: 'medical', basePrice: 3500, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 14, requirements: [], includedItems: [] },
  { nameAr: 'فحص الأكسجين في الدم', nameEn: 'Blood Oxygen Test', descriptionAr: 'قياس مستوى الأكسجين في الدم', category: 'medical', basePrice: 2500, duration: 20, icon: 'Stethoscope', isActive: true, isEmergency: false, sortOrder: 15, requirements: [], includedItems: [] },

  // nursing (18 services)
  { nameAr: 'تمريض عام', nameEn: 'General Nursing', descriptionAr: 'خدمات تمريض عامة في المنزل', category: 'nursing', basePrice: 5000, duration: 60, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 16, requirements: [], includedItems: [] },
  { nameAr: 'حقن عضلية', nameEn: 'Intramuscular Injection', descriptionAr: 'حقن دوائي في العضل', category: 'nursing', basePrice: 2000, duration: 15, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 17, requirements: [], includedItems: [] },
  { nameAr: 'حقن وريدية', nameEn: 'Intravenous Injection', descriptionAr: 'حقن دوائي في الوريد', category: 'nursing', basePrice: 2500, duration: 20, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 18, requirements: [], includedItems: [] },
  { nameAr: 'محاليل وريدية', nameEn: 'IV Fluids', descriptionAr: 'توصيل محاليل وريدية في المنزل', category: 'nursing', basePrice: 4000, duration: 60, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 19, requirements: [], includedItems: [] },
  { nameAr: 'تغيير ضمادات', nameEn: 'Dressing Change', descriptionAr: 'تغيير وتعقيم الضمادات', category: 'nursing', basePrice: 2500, duration: 30, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 20, requirements: [], includedItems: [] },
  { nameAr: 'تركيب قسطرة بولية', nameEn: 'Urinary Catheter Insertion', descriptionAr: 'تركيب وتغيير القسطرة البولية', category: 'nursing', basePrice: 5000, duration: 45, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 21, requirements: [], includedItems: [] },
  { nameAr: 'سحب دم للتحليل', nameEn: 'Blood Draw for Analysis', descriptionAr: 'سحب عينة دم للفحوصات المخبرية', category: 'nursing', basePrice: 2000, duration: 20, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 22, requirements: [], includedItems: [] },
  { nameAr: 'تغيير قسطرة وريدية', nameEn: 'IV Catheter Change', descriptionAr: 'تغيير القسطرة الوريدية', category: 'nursing', basePrice: 3000, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 23, requirements: [], includedItems: [] },
  { nameAr: 'غسيل جروح', nameEn: 'Wound Irrigation', descriptionAr: 'تنظيف وغسيل الجروح', category: 'nursing', basePrice: 3000, duration: 40, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 24, requirements: [], includedItems: [] },
  { nameAr: 'إزالة غرز', nameEn: 'Suture Removal', descriptionAr: 'إزالة الغرز الجراحية', category: 'nursing', basePrice: 2000, duration: 20, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 25, requirements: [], includedItems: [] },
  { nameAr: 'تركيب مغذية', nameEn: 'Feeding Tube Insertion', descriptionAr: 'تركيب أنبوب تغذية', category: 'nursing', basePrice: 4500, duration: 45, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 26, requirements: [], includedItems: [] },
  { nameAr: 'عناية بجروح الحروق', nameEn: 'Burn Wound Care', descriptionAr: 'تنظيف وضماد جروح الحروق', category: 'nursing', basePrice: 4000, duration: 45, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 27, requirements: [], includedItems: [] },
  { nameAr: 'حقن تحت الجلد', nameEn: 'Subcutaneous Injection', descriptionAr: 'حقن دوائي تحت الجلد', category: 'nursing', basePrice: 2000, duration: 15, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 28, requirements: [], includedItems: [] },
  { nameAr: 'تركيب كانيولا', nameEn: 'Cannula Insertion', descriptionAr: 'تركيب كانيولا وريدية', category: 'nursing', basePrice: 3000, duration: 25, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 29, requirements: [], includedItems: [] },
  { nameAr: 'إعطاء أدوية عن طريق الفم', nameEn: 'Oral Medication Administration', descriptionAr: 'إعطاء الأدوية عن طريق الفم مع المتابعة', category: 'nursing', basePrice: 1500, duration: 15, icon: 'Pill', isActive: true, isEmergency: false, sortOrder: 30, requirements: [], includedItems: [] },
  { nameAr: 'تمريض جروح ما بعد الجراحة', nameEn: 'Post-Surgery Wound Nursing', descriptionAr: 'عناية تمريضية متخصصة لجروح ما بعد العملية', category: 'nursing', basePrice: 4000, duration: 45, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 31, requirements: [], includedItems: [] },
  { nameAr: 'تنظيف وتعقيم الجروح', nameEn: 'Wound Cleaning & Disinfection', descriptionAr: 'تنظيف وتعقيم الجروح المفتوحة', category: 'nursing', basePrice: 2500, duration: 30, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 32, requirements: [], includedItems: [] },
  { nameAr: 'حقن المفاصل', nameEn: 'Joint Injection', descriptionAr: 'حقن دوائي في المفاصل', category: 'nursing', basePrice: 5000, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 33, requirements: [], includedItems: [] },

  // physiotherapy (12 services)
  { nameAr: 'علاج طبيعي عام', nameEn: 'General Physiotherapy', descriptionAr: 'جلسة علاج طبيعي شاملة', category: 'physiotherapy', basePrice: 7000, duration: 60, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 34, requirements: [], includedItems: [] },
  { nameAr: 'إعادة تأهيل بعد إصابة', nameEn: 'Post-Injury Rehabilitation', descriptionAr: 'برنامج تأهيلي بعد الإصابات', category: 'physiotherapy', basePrice: 8000, duration: 60, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 35, requirements: [], includedItems: [] },
  { nameAr: 'علاج آلام الظهر', nameEn: 'Back Pain Treatment', descriptionAr: 'جلسات علاج طبيعي لآلام الظهر', category: 'physiotherapy', basePrice: 6000, duration: 45, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 36, requirements: [], includedItems: [] },
  { nameAr: 'علاج آلام الرقبة', nameEn: 'Neck Pain Treatment', descriptionAr: 'جلسات علاج طبيعي لآلام الرقبة', category: 'physiotherapy', basePrice: 6000, duration: 45, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 37, requirements: [], includedItems: [] },
  { nameAr: 'علاج آلام المفاصل', nameEn: 'Joint Pain Treatment', descriptionAr: 'جلسات علاج طبيعي لآلام المفاصل', category: 'physiotherapy', basePrice: 6000, duration: 45, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 38, requirements: [], includedItems: [] },
  { nameAr: 'تأهيل بعد كسور', nameEn: 'Post-Fracture Rehabilitation', descriptionAr: 'برنامج تأهيلي بعد الكسور', category: 'physiotherapy', basePrice: 7000, duration: 60, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 39, requirements: [], includedItems: [] },
  { nameAr: 'تمارين تقوية العضلات', nameEn: 'Muscle Strengthening Exercises', descriptionAr: 'تمارين متخصصة لتقوية العضلات', category: 'physiotherapy', basePrice: 5000, duration: 45, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 40, requirements: [], includedItems: [] },
  { nameAr: 'علاج الانزلاق الغضروفي', nameEn: 'Herniated Disc Treatment', descriptionAr: 'علاج طبيعي للانزلاق الغضروفي', category: 'physiotherapy', basePrice: 8000, duration: 60, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 41, requirements: [], includedItems: [] },
  { nameAr: 'تأهيل ما بعد السكتة الدماغية', nameEn: 'Post-Stroke Rehabilitation', descriptionAr: 'برنامج تأهيلي شامل بعد السكتة الدماغية', category: 'physiotherapy', basePrice: 9000, duration: 90, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 42, requirements: [], includedItems: [] },
  { nameAr: 'علاج تشنجات العضلات', nameEn: 'Muscle Spasm Treatment', descriptionAr: 'علاج طبيعي لتشنجات العضلات', category: 'physiotherapy', basePrice: 5000, duration: 45, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 43, requirements: [], includedItems: [] },
  { nameAr: 'علاج آلام الركبة', nameEn: 'Knee Pain Treatment', descriptionAr: 'جلسات علاج طبيعي لآلام الركبة', category: 'physiotherapy', basePrice: 6000, duration: 45, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 44, requirements: [], includedItems: [] },
  { nameAr: 'تأهيل ما بعد إصابات الرياضة', nameEn: 'Sports Injury Rehabilitation', descriptionAr: 'برنامج تأهيلي للإصابات الرياضية', category: 'physiotherapy', basePrice: 7000, duration: 60, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 45, requirements: [], includedItems: [] },

  // elderly_care (12 services)
  { nameAr: 'رعاية المسنين', nameEn: 'Elderly Care', descriptionAr: 'رعاية شاملة لكبار السن في المنزل', category: 'elderly_care', basePrice: 6000, duration: 90, icon: 'Brain', isActive: true, isEmergency: false, sortOrder: 46, requirements: [], includedItems: [] },
  { nameAr: 'متابعة كبار السن', nameEn: 'Elderly Follow-up', descriptionAr: 'متابعة صحية دورية لكبار السن', category: 'elderly_care', basePrice: 4000, duration: 60, icon: 'Brain', isActive: true, isEmergency: false, sortOrder: 47, requirements: [], includedItems: [] },
  { nameAr: 'تمرين تأهيلي لكبار السن', nameEn: 'Elderly Rehabilitation Exercises', descriptionAr: 'تمارين تأهيلية مناسبة لكبار السن', category: 'elderly_care', basePrice: 5000, duration: 45, icon: 'Brain', isActive: true, isEmergency: false, sortOrder: 48, requirements: [], includedItems: [] },
  { nameAr: 'رعاية مرضى الزهايمر', nameEn: 'Alzheimer Care', descriptionAr: 'رعاية متخصصة لمرضى الزهايمر', category: 'elderly_care', basePrice: 7000, duration: 90, icon: 'Brain', isActive: true, isEmergency: false, sortOrder: 49, requirements: [], includedItems: [] },
  { nameAr: 'رعاية مرضى الشلل الرعاش', nameEn: 'Parkinson Care', descriptionAr: 'رعاية متخصصة لمرضى الشلل الرعاش', category: 'elderly_care', basePrice: 7000, duration: 90, icon: 'Brain', isActive: true, isEmergency: false, sortOrder: 50, requirements: [], includedItems: [] },
  { nameAr: 'رعاية مرضى السكري المسنين', nameEn: 'Diabetic Elderly Care', descriptionAr: 'رعاية متخصصة لكبار السن المصابين بالسكري', category: 'elderly_care', basePrice: 5000, duration: 60, icon: 'Brain', isActive: true, isEmergency: false, sortOrder: 51, requirements: [], includedItems: [] },
  { nameAr: 'متابعة أدوية المسنين', nameEn: 'Elderly Medication Management', descriptionAr: 'متابعة وتنظيم أدوية كبار السن', category: 'elderly_care', basePrice: 3000, duration: 30, icon: 'Pill', isActive: true, isEmergency: false, sortOrder: 52, requirements: [], includedItems: [] },
  { nameAr: 'تغذية كبار السن', nameEn: 'Elderly Nutrition', descriptionAr: 'استشارات وإعداد خطط تغذية لكبار السن', category: 'elderly_care', basePrice: 4000, duration: 45, icon: 'Brain', isActive: true, isEmergency: false, sortOrder: 53, requirements: [], includedItems: [] },
  { nameAr: 'عناية بمرضى طريح الفراش', nameEn: 'Bedridden Patient Care', descriptionAr: 'رعاية شاملة لمرضى طريح الفراش', category: 'elderly_care', basePrice: 6000, duration: 90, icon: 'Brain', isActive: true, isEmergency: false, sortOrder: 54, requirements: [], includedItems: [] },
  { nameAr: 'تمريض منزلي للمسن', nameEn: 'Home Nursing for Elderly', descriptionAr: 'خدمة تمريض منزلي مخصصة لكبار السن', category: 'elderly_care', basePrice: 6000, duration: 60, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 55, requirements: [], includedItems: [] },
  { nameAr: 'فحص دوري لكبار السن', nameEn: 'Elderly Periodic Checkup', descriptionAr: 'فحص صحي شامل دوري لكبار السن', category: 'elderly_care', basePrice: 5000, duration: 45, icon: 'Stethoscope', isActive: true, isEmergency: false, sortOrder: 56, requirements: [], includedItems: [] },
  { nameAr: 'علاج طبيعي للمسنين', nameEn: 'Elderly Physiotherapy', descriptionAr: 'جلسات علاج طبيعي مخصصة لكبار السن', category: 'elderly_care', basePrice: 5500, duration: 60, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 57, requirements: [], includedItems: [] },

  // pediatric (12 services)
  { nameAr: 'طب الأطفال', nameEn: 'Pediatric Care', descriptionAr: 'رعاية صحية متخصصة للأطفال في المنزل', category: 'pediatric', basePrice: 6000, duration: 60, icon: 'Baby', isActive: true, isEmergency: false, sortOrder: 58, requirements: [], includedItems: [] },
  { nameAr: 'تطعيمات أطفال', nameEn: 'Child Vaccinations', descriptionAr: 'تطعيمات الأطفال في المنزل', category: 'pediatric', basePrice: 3000, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 59, requirements: [], includedItems: [] },
  { nameAr: 'فحص نمو الطفل', nameEn: 'Child Growth Checkup', descriptionAr: 'فحص ومتابعة نمو الطفل', category: 'pediatric', basePrice: 3000, duration: 30, icon: 'Baby', isActive: true, isEmergency: false, sortOrder: 60, requirements: [], includedItems: [] },
  { nameAr: 'علاج جفاف الأطفال', nameEn: 'Child Dehydration Treatment', descriptionAr: 'علاج الجفاف عند الأطفال', category: 'pediatric', basePrice: 4000, duration: 45, icon: 'Baby', isActive: true, isEmergency: false, sortOrder: 61, requirements: [], includedItems: [] },
  { nameAr: 'تمريض حديثي الولادة', nameEn: 'Newborn Nursing', descriptionAr: 'رعاية تمريضية متخصصة لحديثي الولادة', category: 'pediatric', basePrice: 7000, duration: 90, icon: 'Baby', isActive: true, isEmergency: false, sortOrder: 62, requirements: [], includedItems: [] },
  { nameAr: 'رعاية الخدج', nameEn: 'Premature Baby Care', descriptionAr: 'رعاية متخصصة للأطفال الخدج', category: 'pediatric', basePrice: 8000, duration: 90, icon: 'Baby', isActive: true, isEmergency: false, sortOrder: 63, requirements: [], includedItems: [] },
  { nameAr: 'قياسات نمو الطفل', nameEn: 'Child Growth Measurements', descriptionAr: 'قياسات الطول والوزن ومحيط الرأس', category: 'pediatric', basePrice: 2000, duration: 20, icon: 'Baby', isActive: true, isEmergency: false, sortOrder: 64, requirements: [], includedItems: [] },
  { nameAr: 'استشارة تغذية أطفال', nameEn: 'Child Nutrition Consultation', descriptionAr: 'استشارة تغذية متخصصة للأطفال', category: 'pediatric', basePrice: 4000, duration: 45, icon: 'Baby', isActive: true, isEmergency: false, sortOrder: 65, requirements: [], includedItems: [] },
  { nameAr: 'علاج حمى الأطفال', nameEn: 'Child Fever Treatment', descriptionAr: 'علاج ومتابعة حمى الأطفال', category: 'pediatric', basePrice: 3000, duration: 30, icon: 'Baby', isActive: true, isEmergency: false, sortOrder: 66, requirements: [], includedItems: [] },
  { nameAr: 'رعاية الأطفال ذوي الاحتياجات الخاصة', nameEn: 'Special Needs Child Care', descriptionAr: 'رعاية متخصصة للأطفال ذوي الاحتياجات الخاصة', category: 'pediatric', basePrice: 7000, duration: 90, icon: 'Baby', isActive: true, isEmergency: false, sortOrder: 67, requirements: [], includedItems: [] },
  { nameAr: 'فحص سمع الأطفال', nameEn: 'Child Hearing Test', descriptionAr: 'فحص السمع للأطفال', category: 'pediatric', basePrice: 3500, duration: 30, icon: 'Baby', isActive: true, isEmergency: false, sortOrder: 68, requirements: [], includedItems: [] },
  { nameAr: 'تطعيمات مدرسية', nameEn: 'School Vaccinations', descriptionAr: 'تطعيمات الأطفال المدرسية', category: 'pediatric', basePrice: 2500, duration: 20, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 69, requirements: [], includedItems: [] },

  // post_surgery (12 services)
  { nameAr: 'رعاية ما بعد الجراحة', nameEn: 'Post-Surgery Care', descriptionAr: 'رعاية شاملة بعد العمليات الجراحية', category: 'post_surgery', basePrice: 8000, duration: 90, icon: 'Pill', isActive: true, isEmergency: false, sortOrder: 70, requirements: [], includedItems: [] },
  { nameAr: 'متابعة جراحة العظام', nameEn: 'Orthopedic Surgery Follow-up', descriptionAr: 'متابعة ما بعد جراحة العظام', category: 'post_surgery', basePrice: 7000, duration: 60, icon: 'Pill', isActive: true, isEmergency: false, sortOrder: 71, requirements: [], includedItems: [] },
  { nameAr: 'تغيير جبيرة', nameEn: 'Cast Change', descriptionAr: 'تغيير الجبيرة والضمادات', category: 'post_surgery', basePrice: 3000, duration: 30, icon: 'Pill', isActive: true, isEmergency: false, sortOrder: 72, requirements: [], includedItems: [] },
  { nameAr: 'عناية بجرح العملية', nameEn: 'Surgical Wound Care', descriptionAr: 'عناية وتعقيم جرح العملية الجراحية', category: 'post_surgery', basePrice: 4000, duration: 45, icon: 'Pill', isActive: true, isEmergency: false, sortOrder: 73, requirements: [], includedItems: [] },
  { nameAr: 'تأهيل ما بعد العمليات', nameEn: 'Post-Surgery Rehabilitation', descriptionAr: 'برنامج تأهيلي شامل بعد العمليات', category: 'post_surgery', basePrice: 7000, duration: 60, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 74, requirements: [], includedItems: [] },
  { nameAr: 'تمريض ما بعد القسطرة القلبية', nameEn: 'Post-Cardiac Catheterization Nursing', descriptionAr: 'رعاية تمريضية متخصصة بعد القسطرة القلبية', category: 'post_surgery', basePrice: 8000, duration: 90, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 75, requirements: [], includedItems: [] },
  { nameAr: 'رعاية ما بعد الولادة القيصرية', nameEn: 'Post-Cesarean Care', descriptionAr: 'رعاية متخصصة بعد الولادة القيصرية', category: 'post_surgery', basePrice: 7000, duration: 90, icon: 'Heart', isActive: true, isEmergency: false, sortOrder: 76, requirements: [], includedItems: [] },
  { nameAr: 'متابعة ما بعد استئصال المرارة', nameEn: 'Post-Cholecystectomy Follow-up', descriptionAr: 'متابعة ما بعد استئصال المرارة', category: 'post_surgery', basePrice: 6000, duration: 60, icon: 'Pill', isActive: true, isEmergency: false, sortOrder: 77, requirements: [], includedItems: [] },
  { nameAr: 'تمريض ما بعد جراحة العين', nameEn: 'Post-Eye Surgery Nursing', descriptionAr: 'رعاية تمريضية بعد جراحات العين', category: 'post_surgery', basePrice: 6000, duration: 60, icon: 'Pill', isActive: true, isEmergency: false, sortOrder: 78, requirements: [], includedItems: [] },
  { nameAr: 'رعاية ما بعد البواسير', nameEn: 'Post-Hemorrhoid Care', descriptionAr: 'رعاية متخصصة بعد عمليات البواسير', category: 'post_surgery', basePrice: 5000, duration: 45, icon: 'Pill', isActive: true, isEmergency: false, sortOrder: 79, requirements: [], includedItems: [] },
  { nameAr: 'تأهيل ما بعد استبدال المفاصل', nameEn: 'Post-Joint Replacement Rehabilitation', descriptionAr: 'برنامج تأهيلي بعد استبدال المفاصل', category: 'post_surgery', basePrice: 8000, duration: 60, icon: 'Activity', isActive: true, isEmergency: false, sortOrder: 80, requirements: [], includedItems: [] },
  { nameAr: 'تمريض ما بعد جراحة الانف والاذن', nameEn: 'Post-ENT Surgery Nursing', descriptionAr: 'رعاية تمريضية بعد جراحات الأنف والأذن', category: 'post_surgery', basePrice: 5500, duration: 60, icon: 'Pill', isActive: true, isEmergency: false, sortOrder: 81, requirements: [], includedItems: [] },

  // lab (15 services)
  { nameAr: 'تحليل دم كامل', nameEn: 'Complete Blood Count', descriptionAr: 'تحليل شامل لخلايا الدم في المنزل', category: 'lab', basePrice: 4000, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 82, requirements: [], includedItems: [] },
  { nameAr: 'تحليل بول', nameEn: 'Urine Analysis', descriptionAr: 'تحليل البول في المنزل', category: 'lab', basePrice: 2500, duration: 20, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 83, requirements: [], includedItems: [] },
  { nameAr: 'تحليل براز', nameEn: 'Stool Analysis', descriptionAr: 'تحليل البراز في المنزل', category: 'lab', basePrice: 2000, duration: 20, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 84, requirements: [], includedItems: [] },
  { nameAr: 'تحليل سكر صائم', nameEn: 'Fasting Blood Sugar', descriptionAr: 'تحليل السكر الصائم في المنزل', category: 'lab', basePrice: 2500, duration: 20, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 85, requirements: [], includedItems: [] },
  { nameAr: 'تحليل سكر عشوائي', nameEn: 'Random Blood Sugar', descriptionAr: 'تحليل السكر العشوائي في المنزل', category: 'lab', basePrice: 2000, duration: 15, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 86, requirements: [], includedItems: [] },
  { nameAr: 'تحليل دهون', nameEn: 'Lipid Profile', descriptionAr: 'تحليل مستوى الدهون في الدم', category: 'lab', basePrice: 3500, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 87, requirements: [], includedItems: [] },
  { nameAr: 'تحليل وظائف كبد', nameEn: 'Liver Function Test', descriptionAr: 'تحليل شامل لوظائف الكبد', category: 'lab', basePrice: 4000, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 88, requirements: [], includedItems: [] },
  { nameAr: 'تحليل وظائف كلى', nameEn: 'Kidney Function Test', descriptionAr: 'تحليل شامل لوظائف الكلى', category: 'lab', basePrice: 4000, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 89, requirements: [], includedItems: [] },
  { nameAr: 'تحليل غدة درقية', nameEn: 'Thyroid Function Test', descriptionAr: 'تحليل هرمونات الغدة الدرقية', category: 'lab', basePrice: 4500, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 90, requirements: [], includedItems: [] },
  { nameAr: 'تحليل فيتامينات', nameEn: 'Vitamins Test', descriptionAr: 'تحليل مستوى الفيتامينات في الدم', category: 'lab', basePrice: 4000, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 91, requirements: [], includedItems: [] },
  { nameAr: 'تحليل هرمونات', nameEn: 'Hormones Test', descriptionAr: 'تحليل مستوى الهرمونات في الدم', category: 'lab', basePrice: 5000, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 92, requirements: [], includedItems: [] },
  { nameAr: 'تحليل عدوى', nameEn: 'Infection Test', descriptionAr: 'تحليل للكشف عن العدوى', category: 'lab', basePrice: 3500, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 93, requirements: [], includedItems: [] },
  { nameAr: 'تحليل كوفيد', nameEn: 'COVID-19 Test', descriptionAr: 'تحليل الكشف عن فيروس كورونا', category: 'lab', basePrice: 3000, duration: 20, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 94, requirements: [], includedItems: [] },
  { nameAr: 'تحليل التهاب كبد', nameEn: 'Hepatitis Test', descriptionAr: 'تحليل الكشف عن التهاب الكبد', category: 'lab', basePrice: 4500, duration: 30, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 95, requirements: [], includedItems: [] },
  { nameAr: 'تحليل فصيلة الدم', nameEn: 'Blood Type Test', descriptionAr: 'تحليل لمعرفة فصيلة الدم', category: 'lab', basePrice: 1500, duration: 15, icon: 'Syringe', isActive: true, isEmergency: false, sortOrder: 96, requirements: [], includedItems: [] },

  // emergency (10 services)
  { nameAr: 'طوارئ منزلية', nameEn: 'Home Emergency', descriptionAr: 'خدمة طوارئ منزلية على مدار الساعة', category: 'emergency', basePrice: 10000, duration: 60, icon: 'Ambulance', isActive: true, isEmergency: true, sortOrder: 97, requirements: [], includedItems: [] },
  { nameAr: 'إسعافات أولية', nameEn: 'First Aid', descriptionAr: 'خدمة إسعافات أولية منزلية', category: 'emergency', basePrice: 5000, duration: 45, icon: 'Ambulance', isActive: true, isEmergency: true, sortOrder: 98, requirements: [], includedItems: [] },
  { nameAr: 'طوارئ قلبية', nameEn: 'Cardiac Emergency', descriptionAr: 'استجابة طوارئ لحالات القلب', category: 'emergency', basePrice: 12000, duration: 60, icon: 'Ambulance', isActive: true, isEmergency: true, sortOrder: 99, requirements: [], includedItems: [] },
  { nameAr: 'طوارئ تنفسية', nameEn: 'Respiratory Emergency', descriptionAr: 'استجابة طوارئ لحالات التنفس', category: 'emergency', basePrice: 12000, duration: 60, icon: 'Ambulance', isActive: true, isEmergency: true, sortOrder: 100, requirements: [], includedItems: [] },
  { nameAr: 'طوارئ سكر', nameEn: 'Diabetic Emergency', descriptionAr: 'استجابة طوارئ لحالات السكر الحادة', category: 'emergency', basePrice: 8000, duration: 45, icon: 'Ambulance', isActive: true, isEmergency: true, sortOrder: 101, requirements: [], includedItems: [] },
  { nameAr: 'طوارئ كسور', nameEn: 'Fracture Emergency', descriptionAr: 'إسعاف أولي لحالات الكسور', category: 'emergency', basePrice: 8000, duration: 45, icon: 'Ambulance', isActive: true, isEmergency: true, sortOrder: 102, requirements: [], includedItems: [] },
  { nameAr: 'طوارئ حروق', nameEn: 'Burn Emergency', descriptionAr: 'إسعاف أولي لحالات الحروق', category: 'emergency', basePrice: 10000, duration: 60, icon: 'Ambulance', isActive: true, isEmergency: true, sortOrder: 103, requirements: [], includedItems: [] },
  { nameAr: 'طوارئ ولادة', nameEn: 'Childbirth Emergency', descriptionAr: 'استجابة طوارئ لحالات الولادة', category: 'emergency', basePrice: 15000, duration: 90, icon: 'Ambulance', isActive: true, isEmergency: true, sortOrder: 104, requirements: [], includedItems: [] },
  { nameAr: 'طوارئ تسمم', nameEn: 'Poisoning Emergency', descriptionAr: 'استجابة طوارئ لحالات التسمم', category: 'emergency', basePrice: 10000, duration: 60, icon: 'Ambulance', isActive: true, isEmergency: true, sortOrder: 105, requirements: [], includedItems: [] },
  { nameAr: 'نقل طبي إسعافي', nameEn: 'Medical Ambulance Transport', descriptionAr: 'نقل طبي إسعافي من وإلى المستشفى', category: 'emergency', basePrice: 15000, duration: 60, icon: 'Ambulance', isActive: true, isEmergency: true, sortOrder: 106, requirements: [], includedItems: [] },
];

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const results: string[] = [];

    // 1. Create Default Admin
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (!existingAdmin) {
      const hashedPassword = await hashPassword('Admin@123');
      await User.create({
        name: 'مدير النظام',
        phone: '700000000',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
      });
      results.push('تم إنشاء حساب المدير الافتراضي (700000000 / Admin@123)');
    } else {
      results.push('حساب المدير موجود بالفعل');
    }

    // 2. Create Default Services (106 services)
    let createdCount = 0;
    let skippedCount = 0;
    for (const service of defaultServices) {
      const exists = await Service.findOne({ nameAr: service.nameAr });
      if (!exists) {
        await Service.create(service);
        createdCount++;
      } else {
        skippedCount++;
      }
    }
    results.push(`تم إنشاء ${createdCount} خدمة جديدة (${skippedCount} موجودة بالفعل)`);

    // 3. Create Default Admin Settings
    const existingSettings = await AdminSettings.findOne();
    if (!existingSettings) {
      await AdminSettings.create({
        commissionRate: 15,
        emergencyFee: 5000,
        nightFeePercent: 30,
        fridayFeePercent: 20,
        nightStartHour: 22,
        nightEndHour: 6,
        nightFeeEnabled: true,
        fridayFeeEnabled: true,
        minOrderAmount: 2000,
        loyaltyPointsPerOrder: 10,
        loyaltyRedemptionRate: 10,
        loyaltyRedemptionThreshold: 100,
        referralReward: 50,
        maxNurseAssignmentRadius: 20,
        autoAssignEnabled: false,
        emergencyAutoDispatch: true,
        maintenanceMode: false,
        supportPhone: '+967123456789',
        supportWhatsApp: '+967123456789',
      });
      results.push('تم إنشاء إعدادات النظام');
    } else {
      results.push('إعدادات النظام موجودة بالفعل');
    }

    // 4. Create Demo Nurse
    const existingDemoNurse = await Nurse.findOne({ phone: '711111111' });
    if (!existingDemoNurse) {
      const hashedPassword = await hashPassword('Nurse@123');
      await Nurse.create({
        name: 'أحمد الممرض',
        phone: '711111111',
        password: hashedPassword,
        role: 'nurse',
        isActive: true,
        specialization: ['general_nursing', 'wound_care'],
        verificationStatus: 'verified',
        isAvailable: true,
        isOnline: true,
        lat: 15.3694,
        lng: 44.191,
        rating: 4.5,
        reviewCount: 12,
        completedJobs: 45,
        totalEarnings: 225000,
        availableBalance: 50000,
        experience: 5,
        governorate: 'sanaa',
        bio: 'ممرض معتمد بخبرة ٥ سنوات في التمريض المنزلي',
      });
      results.push('تم إنشاء حساب ممرض تجريبي (711111111 / Nurse@123)');
    }

    // 5. Create Demo Beneficiary
    const existingDemoBeneficiary = await Beneficiary.findOne({ phone: '722222222' });
    if (!existingDemoBeneficiary) {
      const hashedPassword = await hashPassword('Benef@123');
      const referralCode = generateReferralCode();
      await Beneficiary.create({
        name: 'محمد المستفيد',
        phone: '722222222',
        password: hashedPassword,
        role: 'beneficiary',
        isActive: true,
        governorate: 'sanaa',
        address: 'صنعاء - شارع الزبيري',
        referralCode,
        loyaltyPoints: 100,
      });
      results.push('تم إنشاء حساب مستفيد تجريبي (722222222 / Benef@123)');
    }

    return Response.json({
      success: true,
      message: 'تم تهيئة قاعدة البيانات بنجاح',
      data: { results },
    });
  } catch (error) {
    console.error('[SEED ERROR]', error);
    return Response.json(
      { success: false, error: { message: 'حدث خطأ أثناء تهيئة قاعدة البيانات', code: 'SEED_ERROR' } },
      { status: 500 }
    );
  }
}
