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

async function run() {
  const tenants = await db.collection('tenants').get();
  console.log(`Found ${tenants.size} tenants:`);
  for (const doc of tenants.docs) {
    const data = doc.data();
    console.log(`- ID: ${doc.id}, Name: ${data.name || data.displayName || data.title}, Modules: ${JSON.stringify(data.modules)}`);
  }

  // Find Ilayda Ars to see her exact tenantId and gym_members collection path
  const users = await db.collection('users').get();
  console.log(`\nFound ${users.size} users total. Searching for gym members...`);
  for (const u of users.docs) {
    const d = u.data();
    if (d.displayName?.includes('İlayda') || d.displayName?.includes('Ilayda') || d.accountType === 'gym_member' || d.role === 'owner') {
      console.log(`User: ${d.displayName}, email: ${d.email}, role: ${d.role}, tenantId: ${d.tenantId}, accountType: ${d.accountType}`);
    }
  }
}

run().catch(console.error);
