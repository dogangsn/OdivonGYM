import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(resolve('C:/Users/dogan/Documents/Private/Project/OdivonMainApi/package.json'));
const { cert, getApps, initializeApp } = require('firebase-admin/app');
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

const db = getFirestore(app);
const tenantId = '7psa7t1zruezYak2nbVf';

async function inspectTenant() {
  const tDoc = await db.collection('tenants').doc(tenantId).get();
  console.log('Tenant:', tDoc.data());

  // Collections under tenant:
  // e.g. tenants/{tenantId}/gym_members, gym_packages, gym_branches, gym_products, etc.
  const collections = [
    'gym_members',
    'gym_packages',
    'gym_branches',
    'gym_disciplines',
    'gym_products',
    'gym_staff',
    'gym_classes',
    'gym_access_logs',
    'gym_accounting',
    'gym_lockers'
  ];

  for (const c of collections) {
    const snap = await db.collection('tenants').doc(tenantId).collection(c).get();
    console.log(`Subcollection ${c}: ${snap.size} documents`);
    if (snap.size > 0 && snap.size <= 3) {
      snap.forEach(d => console.log(`  - ${d.id}:`, JSON.stringify(d.data()).slice(0, 100)));
    }
  }
}

inspectTenant().catch(console.error);
