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
const demoTenantId = 'UszZtqxfGJNNGgA1VHwP';

async function checkDemoTenant() {
  const collections = [
    'gymMembers',
    'gymPackages',
    'gymBranches',
    'gymDisciplines',
    'gymProducts',
    'gymStaff',
    'gymTurnstileGates',
    'gymAccessLogs',
    'gymAccountingEntries',
    'gymReceivables'
  ];

  for (const c of collections) {
    const snap = await db.collection(`tenants/${demoTenantId}/${c}`).limit(2).get();
    console.log(`Collection ${c}: ${snap.size} docs`);
    if (snap.size > 0) {
      console.log(`Sample doc ${c} [${snap.docs[0].id}]:`, JSON.stringify(snap.docs[0].data(), null, 2));
    }
  }
}

checkDemoTenant().catch(console.error);
