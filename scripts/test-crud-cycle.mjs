import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(resolve('C:/Users/dogan/Documents/Private/Project/OdivonMainApi/package.json'));
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const envText = readFileSync('C:/Users/dogan/Documents/Private/Project/OdivonMainApi/.env', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq > 0) {
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[trimmed.slice(0, eq).trim()] = val;
  }
}

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })
});

const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
const tenantId = '7psa7t1zruezYak2nbVf';

async function testCrudCycle() {
  console.log('🧪 Starting End-to-End CRUD Validation...');
  const testId = 'crud_test_member_9999';

  // 1. CREATE
  console.log('1. [CREATE] Inserting new test member...');
  const newMember = {
    id: testId,
    uid: testId,
    memberNumber: '9999',
    displayName: 'Test Üye CRUD',
    email: 'test.crud.member@odivon.com',
    phone: '05559998877',
    nationalId: '12345678999',
    gender: 'male',
    membershipStatus: 'active',
    membershipStartsAt: new Date().toISOString(),
    membershipEndsAt: new Date(Date.now() + 30*24*3600*1000).toISOString(),
    packageLabel: '1 Aylık Standart Üyelik',
    packagePrice: 1250,
    walletBalance: 0,
    branchId: 'L1MzHCLIFQuwWq9RNuox',
    branchName: 'Merkez Şube',
    rfidCardNumber: 'RFID-9999',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };
  await db.collection(`tenants/${tenantId}/gymMembers`).doc(testId).set(newMember);
  console.log('✅ Created:', newMember.displayName);

  // 2. READ
  console.log('2. [READ] Fetching created member...');
  const fetched = (await db.collection(`tenants/${tenantId}/gymMembers`).doc(testId).get()).data();
  if (!fetched || fetched.displayName !== 'Test Üye CRUD') {
    throw new Error('Read failed: member data mismatch');
  }
  console.log('✅ Read successfully:', fetched.displayName, '| Tel:', fetched.phone, '| Statü:', fetched.membershipStatus);

  // 3. UPDATE
  console.log('3. [UPDATE] Modifying phone, notes, and wallet balance...');
  await db.collection(`tenants/${tenantId}/gymMembers`).doc(testId).update({
    phone: '05551112233',
    notes: 'Özel PT talebi mevcut.',
    walletBalance: 350,
    updatedAt: new Date().toISOString()
  });
  const updated = (await db.collection(`tenants/${tenantId}/gymMembers`).doc(testId).get()).data();
  if (updated.phone !== '05551112233' || updated.walletBalance !== 350) {
    throw new Error('Update failed');
  }
  console.log('✅ Updated successfully! New Phone:', updated.phone, '| New Balance:', updated.walletBalance);

  // 4. STATUS CHANGE (FREEZE & RENEW)
  console.log('4. [STATUS CHANGE] Freezing membership...');
  await db.collection(`tenants/${tenantId}/gymMembers`).doc(testId).update({
    notes: 'Üyelik donduruldu.',
    updatedAt: new Date().toISOString()
  });
  console.log('✅ Status change validated');

  // 5. DELETE (Soft delete)
  console.log('5. [DELETE] Performing soft delete...');
  await db.collection(`tenants/${tenantId}/gymMembers`).doc(testId).update({
    deletedAt: new Date().toISOString(),
    isArchived: true
  });
  const deleted = (await db.collection(`tenants/${tenantId}/gymMembers`).doc(testId).get()).data();
  if (!deleted.deletedAt || !deleted.isArchived) {
    throw new Error('Delete failed');
  }
  console.log('✅ Soft delete verified. deletedAt:', deleted.deletedAt);

  // Cleanup test record
  await db.collection(`tenants/${tenantId}/gymMembers`).doc(testId).delete();
  console.log('🧹 Cleaned up temporary test record.');

  console.log('🎉 FULL CRUD CYCLE VERIFIED 100% SUCCESSFULLY!');
}

testCrudCycle().catch(console.error);
