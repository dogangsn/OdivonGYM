import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(resolve('C:/Users/dogan/Documents/Private/Project/OdivonMainApi/package.json'));
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

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

const auth = getAuth(app);
const db = getFirestore(app);

const testAccounts = [
  'infogym@odivon.com',
  'admin.gunes@odivon.com',
  'trainer.gunes@odivon.com',
  'reception.gunes@odivon.com',
  'sporcu.gunes@odivon.com'
];

async function verifyAllRoles() {
  console.log('Verifying Role & Auth Status:');
  for (const email of testAccounts) {
    const user = await auth.getUserByEmail(email);
    const profile = (await db.collection('users').doc(user.uid).get()).data();
    console.log(`\nEmail: ${email}`);
    console.log(`  UID: ${user.uid}`);
    console.log(`  EmailVerified: ${user.emailVerified} (Auth) / ${profile?.emailVerified} (Profile)`);
    console.log(`  Role: ${user.customClaims?.role} | Claims:`, user.customClaims);
    console.log(`  Profile Role: ${profile?.role} | AccountType: ${profile?.accountType}`);
  }
}

verifyAllRoles().catch(console.error);
