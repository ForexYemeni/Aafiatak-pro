#!/usr/bin/env node
// ============================================================================
// Setup Firebase Config in MongoDB Database
// ============================================================================
// This script directly inserts the Firebase Admin SDK credentials into
// the MongoDB database so FCM push notifications work without setting
// Vercel environment variables.
//
// Usage: node scripts/setup-firebase-db.js
// ============================================================================

const { MongoClient } = require('mongodb');
const readline = require('readline');

// Firebase Service Account credentials
const FIREBASE_CONFIG = {
  projectId: 'aafiatak-a23fa',
  clientEmail: 'firebase-adminsdk-fbsvc@aafiatak-a23fa.iam.gserviceaccount.com',
  privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDAshIU+Mpqtmd9\nEgZW/dMDTkez+XUki5YHFvVaxTrrq5DjSRYyaMR96PeAr0FXw1KKjx4vFQ6dRT/i\nw15N/f/+3iit4DDN/YI9ceKEgAk8pu19jh0/7M7/HnafKYCBMmbriy1qKhH3/wyl\nCawvQBMiG55sTcoKuLIJIFoH+K8MyO4JHTQ7gAjQY8ijx4tdBbJ9oKL+xLvf1qnO\nbfm0wzlYS9PcI/m/XaPLDvsPz+5uck6Wf33KUeDlYDcQzcrueof/kPMNS73AvfEc\nwcI47Id3w40ewF21mu8kOjNChRcdHVeya0FmsGJumR/vGFB0Cfbe7Gdtl191DzA6\nKx5hy8tTAgMBAAECggEAUaUhdDFV0pEmmB+jAAjb93Kbfu4bbDiYgLiBjMw0gtZW\ntXaqKQGq/45OEAAxt3XS61Jof5p0br6AqxwMQQ92AA8xPTrYcu8O1+oBCBMX1tMD\nnUcxrXww2HeX2yhCgntQkEyQGYNpyaIPQX4vrnV/pdv96/WpvZE0HhnPC8Gaqdda\nuPSZ72Z27neJToieWhPpUhTf4QhV61sYnCJZKjVIceMRv9IYuTwBHWu1IEl5rDMI\nTxQnh1EpgYM8NS0MuHlKeTCDm96QT7woPk3HWjXQWWUUivBGlOboLOK2qWkdtSJv\nS4jFaJ9offJUNVyT23CgTzKvx6GpFC4gS+KwZWRlgQKBgQD/T43GjGzhdyey9rGs\nLqDQ888JNIN9248BMhW/LD6kHbIIwdM5TPs/Xef8Z59ak/9nfFjbjJjNQwi+pJO1\naaaC69NKHjyGhuJnob9uz50RBH4+YR74i9enCyL4vTghqIx9TDfOQdtFE3vmPyAu\nUahIOXL6WM1glP64peUXccsEuwKBgQDBNz5FvwCCY6XsdydOc3sMs/LrYZiTnGzL\nSDzkDTcwyJ5VJMDHbDgcD4ObMye1ga3wJ4hxwLQgqffoAjsZYHxfegKTW3UtzRpg\nJ9U1wys51PHWTOPVXnJAwuti03tbscfCTOcbEZyuv9YIbC6gU8FhWpYgNU0fpFS4\n1TkniTg2SQKBgCZ6Qd67iSlNwPDq1wohGOGE7R3xCSQts9a1Squ+Kk6nnw5Mz92h\n6Xe6Wl0i7NRE28gn6GhmPx0oTigVO6Gqo4q1qelQt0R7DaIasXQs2/oVmEUkc/t3\nb+/f8MxWECCae1ni48I1EKvPbOvddaclbVw9NEPgoEs/CUigz+8BmlxDAoGBALV4\nXkuBjkfosaE7dDZxreOLa595xaT2KRRwX4hNhUWTV2pen5Vt5fEs/Q2aaTRHfQdv\nCe7U8Bkxqj5FQh6eiZHe9WZTYuZGmfwvzUe2a/XgM9dz1hTDpQmASTZDrLu9aQHr\n2q+IxiE22h6FBPHeWGVIgHH1vd73J/+FfC3O6nXJAoGAVYFT1Xeg7FRJP5r5lpAy\nMOKqYrTuNfHBE7zBsO4p0feLHxZhKAnDC+bIlNCPUsbnnQ/DttU6lyksoqkuMI/X\n0pIlYU6FifE2SqLzQVVMDmAEnQzO3lzQs1Bp19oBzoPt+lPe+WKm0XTAhxzNaH3R\nFEObMYdgmzdMyQ1iz7tRs84=\n-----END PRIVATE KEY-----\n',
  storageBucket: 'aafiatak-a23fa.firebasestorage.app',
};

async function main() {
  console.log('🔥 Setting up Firebase Admin SDK configuration in MongoDB...\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable is not set.');
    console.error('Please set it before running this script:');
    console.error('  export MONGODB_URI="mongodb+srv://..."');
    console.error('  node scripts/setup-firebase-db.js');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const collection = db.collection('firebaseconfigs');

    // Deactivate any existing active configs
    const deactivateResult = await collection.updateMany(
      { isActive: true },
      { $set: { isActive: false } }
    );
    console.log(`📋 Deactivated ${deactivateResult.modifiedCount} existing config(s)`);

    // Insert new config
    const config = {
      projectId: FIREBASE_CONFIG.projectId,
      clientEmail: FIREBASE_CONFIG.clientEmail,
      privateKey: FIREBASE_CONFIG.privateKey,
      storageBucket: FIREBASE_CONFIG.storageBucket,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await collection.insertOne(config);
    console.log(`✅ Firebase config inserted with ID: ${insertResult.insertedId}`);

    // Verify
    const activeConfig = await collection.findOne({ isActive: true });
    if (activeConfig) {
      console.log('\n🎉 Firebase Admin SDK configuration is now active!');
      console.log(`   Project ID: ${activeConfig.projectId}`);
      console.log(`   Client Email: ${activeConfig.clientEmail}`);
      console.log(`   Storage Bucket: ${activeConfig.storageBucket}`);
      console.log(`   Private Key: ${activeConfig.privateKey.substring(0, 30)}...`);
      console.log('\n📱 FCM push notifications should now work in the APK.');
      console.log('   The server will read these credentials from the database.');
      console.log('   Make sure to redeploy on Vercel for changes to take effect.');
    } else {
      console.error('❌ Failed to verify the inserted config');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n👋 Database connection closed.');
  }
}

main();
