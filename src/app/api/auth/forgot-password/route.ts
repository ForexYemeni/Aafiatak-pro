import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/mongoose';
import { AdminSettings } from '@/models/mongoose';
import { createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { name, phone } = await request.json();
    
    // Validate inputs
    if (!name || !phone) return createErrorResponse('الاسم ورقم الهاتف مطلوبان', 400, 'MISSING_FIELDS');
    
    // Normalize phone
    const digits = phone.replace(/\D/g, '');
    const normalizedPhone = digits.startsWith('967') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
    
    // Find user by phone first, then verify name matches
    const user = await User.findOne({ phone: normalizedPhone }).lean();
    if (!user || user.name.trim() !== name.trim()) {
      return createErrorResponse('لم يتم العثور على حساب بهذه البيانات', 404, 'NOT_FOUND');
    }
    
    // Get support contacts from admin settings
    let settings = await AdminSettings.findOne().lean();
    if (!settings) {
      settings = await AdminSettings.create({});
      settings = settings.toObject();
    }
    
    // Build support contacts list
    const contacts: { phone: string; isWhatsApp: boolean; label: string }[] = [];
    
    if (settings.supportWhatsApp) {
      contacts.push({ phone: settings.supportWhatsApp, isWhatsApp: true, label: 'دعم 1' });
    }
    if (settings.supportPhone && settings.supportPhone !== settings.supportWhatsApp) {
      contacts.push({ phone: settings.supportPhone, isWhatsApp: false, label: 'دعم 2' });
    }
    // Add additional WhatsApp numbers
    (settings.supportWhatsAppNumbers || []).forEach((num: string, i: number) => {
      if (num && !contacts.some(c => c.phone === num)) {
        contacts.push({ phone: num, isWhatsApp: true, label: `دعم ${contacts.length + 1}` });
      }
    });
    // Add additional support phones
    (settings.supportPhones || []).forEach((num: string, i: number) => {
      if (num && !contacts.some(c => c.phone === num)) {
        contacts.push({ phone: num, isWhatsApp: false, label: `دعم ${contacts.length + 1}` });
      }
    });
    
    return Response.json({ 
      success: true, 
      data: { 
        contacts,
        userName: user.name,
        userPhone: user.phone,
      }
    });
  } catch (error) {
    console.error('[FORGOT PASSWORD ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء معالجة الطلب', 500, 'INTERNAL_ERROR');
  }
}
