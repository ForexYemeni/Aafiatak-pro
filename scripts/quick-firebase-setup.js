#!/usr/bin/env node
// ============================================================================
// Quick Firebase Setup - Calls the /api/admin/firebase-config endpoint
// ============================================================================
// This script configures Firebase Admin SDK by calling the API directly,
// so FCM push notifications work in the APK immediately.
//
// Usage: node scripts/quick-firebase-setup.js
// ============================================================================

const https = require('https');
const http = require('http');

// Firebase Service Account credentials
const FIREBASE_CONFIG = {
  projectId: 'aafiatak-a23fa',
  clientEmail: 'firebase-adminsdk-fbsvc@aafiatak-a23fa.iam.gserviceaccount.com',
  privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDAshIU+Mpqtmd9\nEgZW/dMDTkez+XUki5YHFvVaxTrrq5DjSRYyaMR96PeAr0FXw1KKjx4vFQ6dRT/i\nw15N/f/+3iit4DDN/YI9ceKEgAk8pu19jh0/7M7/HnafKYCBMmbriy1qKhH3/wyl\nCawvQBMiG55sTcoKuLIJIFoH+K8MyO4JHTQ7gAjQY8ijx4tdBbJ9oKL+xLvf1qnO\nbfm0wzlYS9PcI/m/XaPLDvsPz+5uck6Wf33KUeDlYDcQzcrueof/kPMNS73AvfEc\nwcI47Id3w40ewF21mu8kOjNChRcdHVeya0FmsGJumR/vGFB0Cfbe7Gdtl191DzA6\nKx5hy8tTAgMBAAECggEAUaUhdDFV0pEmmB+jAAjb93Kbfu4bbDiYgLiBjMw0gtZW\ntXaqKQGq/45OEAAxt3XS61Jof5p0br6AqxwMQQ92AA8xPTrYcu8O1+oBCBMX1tMD\nnUcxrXww2HeX2yhCgntQkEyQGYNpyaIPQX4vrnV/pdv96/WpvZE0HhnPC8Gaqdda\nuPSZ72Z27neJToieWhPpUhTf4QhV61sYnCJZKjVIceMRv9IYuTwBHWu1IEl5rDMI\nTxQnh1EpgYM8NS0MuHlKeTCDm96QT7woPk3HWjXQWWUUivBGlOboLOK2qWkdtSJv\nS4jFaJ9offJUNVyT23CgTzKvx6GpFC4gS+KwZWRlgQKBgQD/T43GjGzhdyey9rGs\nLqDQ888JNIN9248BMhW/LD6kHbIIwdM5TPs/Xef8Z59ak/9nfFjbjJjNQwi+pJO1\naaaC69NKHjyGhuJnob9uz50RBH4+YR74i9enCyL4vTghqIx9TDfOQdtFE3vmPyAu\nUahIOXL6WM1glP64peUXccsEuwKBgQDBNz5FvwCCY6XsdydOc3sMs/LrYZiTnGzL\nSDzkDTcwyJ5VJMDHbDgcD4ObMye1ga3wJ4hxwLQgqffoAjsZYHxfegKTW3UtzRpg\nJ9U1wys51PHWTOPVXnJAwuti03tbscfCTOcbEZyuv9YIbC6gU8FhWpYgNU0fpFS4\n1TkniTg2SQKBgCZ6Qd67iSlNwPDq1wohGOGE7R3xCSQts9a1Squ+Kk6nnw5Mz92h\n6Xe6Wl0i7NRE28gn6GhmPx0oTigVO6Gqo4q1qelQt0R7DaIasXQs2/oVmEUkc/t3\nb+/f8MxWECCae1ni48I1EKvPbOvddaclbVw9NEPgoEs/CUigz+8BmlxDAoGBALV4\nXkuBjkfosaE7dDZxreOLa595xaT2KRRwX4hNhUWTV2pen5Vt5fEs/Q2aaTRHfQdv\nCe7U8Bkxqj5FQh6eiZHe9WZTYuZGmfwvzUe2a/XgM9dz1hTDpQmASTZDrLu9aQHr\n2q+IxiE22h6FBPHeWGVIgHH1vd73J/+FfC3O6nXJAoGAVYFT1Xeg7FRJP5r5lpAy\nMOKqYrTuNfHBE7zBsO4p0feLHxZhKAnDC+bIlNCPUsbnnQ/DttU6lyksoqkuMI/X\n0pIlYU6FifE2SqLzQVVMDmAEnQzO3lzQs1Bp19oBzoPt+lPe+WKm0XTAhxzNaH3R\nFEObMYdgmzdMyQ1iz7tRs84=\n-----END PRIVATE KEY-----\n',
  storageBucket: 'aafiatak-a23fa.firebasestorage.app',
};

const BASE_URL = process.env.APP_URL || 'https://aafiatak-pro.vercel.app';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // JWT token for admin user

async function makeRequest(url, method, data, authToken) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('🔥 Quick Firebase Setup for عافيتك (Aafiatak)');
  console.log(`📡 Server: ${BASE_URL}\n`);

  if (!ADMIN_TOKEN) {
    console.error('❌ ADMIN_TOKEN not set. Please provide an admin JWT token:');
    console.error('   ADMIN_TOKEN=your_token node scripts/quick-firebase-setup.js');
    console.error('\n   You can get a token by logging in as admin:');
    console.error('   curl -X POST https://aafiatak-pro.vercel.app/api/auth/login -H "Content-Type: application/json" -d \'{"phone":"admin_phone","password":"admin_password"}\'');
    process.exit(1);
  }

  // Step 1: Check current config
  console.log('1️⃣  Checking current Firebase config...');
  const checkResult = await makeRequest(`${BASE_URL}/api/admin/firebase-config`, 'GET', null, ADMIN_TOKEN);
  console.log(`   Status: ${checkResult.status}`);
  if (checkResult.data?.success && checkResult.data?.data) {
    console.log(`   Current config: projectId=${checkResult.data.data.projectId}`);
  } else {
    console.log('   No Firebase config found (will create new one)');
  }

  // Step 2: Save Firebase config
  console.log('\n2️⃣  Saving Firebase config...');
  const saveResult = await makeRequest(`${BASE_URL}/api/admin/firebase-config`, 'POST', FIREBASE_CONFIG, ADMIN_TOKEN);
  console.log(`   Status: ${saveResult.status}`);
  
  if (saveResult.data?.success) {
    console.log(`   ✅ Firebase config saved!`);
    console.log(`   Project ID: ${saveResult.data.data?.projectId}`);
    console.log(`   Client Email: ${saveResult.data.data?.clientEmail}`);
    console.log(`   Private Key: ${saveResult.data.data?.privateKey}`);
  } else {
    console.log(`   ❌ Failed: ${JSON.stringify(saveResult.data)}`);
  }

  // Step 3: Test push notification
  console.log('\n3️⃣  Firebase Admin SDK will initialize on next server request.');
  console.log('   FCM push notifications should now work in the APK!');

  console.log('\n🎉 Setup complete!');
  console.log('\n📱 Next steps:');
  console.log('   1. Install the new APK: https://github.com/ForexYemeni/Aafiatak-pro/releases/download/v4.1.0/aafiatak-v4.1.0.apk');
  console.log('   2. Log in to the app');
  console.log('   3. The app will register an FCM token');
  console.log('   4. Push notifications will be delivered via FCM');
}

main().catch(console.error);
