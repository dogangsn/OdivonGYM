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

async function show() {
  const p = await db.collection(`tenants/${tenantId}/gymPackages`).get();
  console.log('PACKAGES:');
  p.forEach(d => console.log(`  - [${d.id}] ${d.data().name} | Fiyat: ${d.data().price} TL | Gün: ${d.data().durationDays}`));

  const b = await db.collection(`tenants/${tenantId}/gymBranches`).get();
  console.log('BRANCHES:');
  b.forEach(d => console.log(`  - [${d.id}] ${d.data().name}`));

  const d = await db.collection(`tenants/${tenantId}/gymDisciplines`).get();
  console.log('DISCIPLINES:');
  d.forEach(doc => console.log(`  - [${doc.id}] ${doc.data().name}`));
}

show().catch(console.error);
