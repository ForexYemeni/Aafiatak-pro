// POST /api/seed - Initialize database with default data
// Creates default admin, services, and settings
// This endpoint should be called once after setting up a new database

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, Nurse, Beneficiary } from '@/models/mongoose';
import { Service } from '@/models/mongoose/Service';
import { AdminSettings } from '@/models/mongoose/AdminSettings';
import { hashPassword, generateReferralCode } from '@/lib/auth';

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

    // 2. Create Default Services
    const defaultServices = [
      {
        nameAr: 'تمريض عام',
        nameEn: 'General Nursing',
        descriptionAr: 'خدمات تمريض عامة تشمل الفحوصات والحقن والضمادات',
        category: 'nursing',
        basePrice: 5000,
        duration: 60,
        icon: 'stethoscope',
        isActive: true,
        isEmergency: false,
        sortOrder: 1,
        requirements: [],
        includedItems: [],
      },
      {
        nameAr: 'رعاية المسنين',
        nameEn: 'Elderly Care',
        descriptionAr: 'رعاية صحية متخصصة لكبار السن في المنزل',
        category: 'nursing',
        basePrice: 6000,
        duration: 90,
        icon: 'heart',
        isActive: true,
        isEmergency: false,
        sortOrder: 2,
        requirements: [],
        includedItems: [],
      },
      {
        nameAr: 'طب الأطفال',
        nameEn: 'Pediatric Care',
        descriptionAr: 'رعاية صحية متخصصة للأطفال في المنزل',
        category: 'nursing',
        basePrice: 6000,
        duration: 60,
        icon: 'baby',
        isActive: true,
        isEmergency: false,
        sortOrder: 3,
        requirements: [],
        includedItems: [],
      },
      {
        nameAr: 'العلاج الطبيعي',
        nameEn: 'Physiotherapy',
        descriptionAr: 'جلسات علاج طبيعي وإعادة تأهيل في المنزل',
        category: 'therapy',
        basePrice: 7000,
        duration: 60,
        icon: 'activity',
        isActive: true,
        isEmergency: false,
        sortOrder: 4,
        requirements: [],
        includedItems: [],
      },
      {
        nameAr: 'علاج الجروح',
        nameEn: 'Wound Care',
        descriptionAr: 'تنظيف وضماد الجروح وتغيير الضمادات',
        category: 'nursing',
        basePrice: 4000,
        duration: 45,
        icon: 'bandage',
        isActive: true,
        isEmergency: false,
        sortOrder: 5,
        requirements: [],
        includedItems: [],
      },
      {
        nameAr: 'العلاج الوريدي',
        nameEn: 'IV Therapy',
        descriptionAr: 'حقن المحاليل الوريدية والعلاجات بالتقطير',
        category: 'nursing',
        basePrice: 5000,
        duration: 60,
        icon: 'droplet',
        isActive: true,
        isEmergency: false,
        sortOrder: 6,
        requirements: [],
        includedItems: [],
      },
      {
        nameAr: 'رعاية ما بعد الجراحة',
        nameEn: 'Post-Surgery Care',
        descriptionAr: 'رعاية متخصصة بعد العمليات الجراحية',
        category: 'nursing',
        basePrice: 8000,
        duration: 90,
        icon: 'clipboard',
        isActive: true,
        isEmergency: false,
        sortOrder: 7,
        requirements: [],
        includedItems: [],
      },
      {
        nameAr: 'الطوارئ المنزلية',
        nameEn: 'Home Emergency',
        descriptionAr: 'خدمة طوارئ منزلية على مدار الساعة',
        category: 'emergency',
        basePrice: 10000,
        duration: 60,
        icon: 'alert-triangle',
        isActive: true,
        isEmergency: true,
        sortOrder: 8,
        requirements: [],
        includedItems: [],
      },
      {
        nameAr: 'الصحة النفسية',
        nameEn: 'Mental Health',
        descriptionAr: 'استشارات ورعاية الصحة النفسية',
        category: 'therapy',
        basePrice: 7000,
        duration: 60,
        icon: 'brain',
        isActive: true,
        isEmergency: false,
        sortOrder: 9,
        requirements: [],
        includedItems: [],
      },
      {
        nameAr: 'قياسات حيوية',
        nameEn: 'Vital Signs',
        descriptionAr: 'قياس الضغط والسكر والحرارة والأكسجين',
        category: 'nursing',
        basePrice: 3000,
        duration: 30,
        icon: 'thermometer',
        isActive: true,
        isEmergency: false,
        sortOrder: 10,
        requirements: [],
        includedItems: [],
      },
    ];

    for (const service of defaultServices) {
      const exists = await Service.findOne({ nameAr: service.nameAr });
      if (!exists) {
        await Service.create(service);
      }
    }
    results.push('تم إنشاء الخدمات الافتراضية');

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
        minOrderAmount: 2000,
        loyaltyPointsPerOrder: 10,
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
