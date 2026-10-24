import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(resolve('C:/Users/dogan/Documents/Private/Project/OdivonMainApi/package.json'));
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
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

const auth = getAuth(app);
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

const tenantId = '7psa7t1zruezYak2nbVf';
const branchId = 'L1MzHCLIFQuwWq9RNuox';
const branchName = 'Merkez Şube';

const packages = [
  { id: '10NzTbCwij4fvwCXixJJ', name: '1 Yıllık VIP Sınırsız', price: 9900, days: 365 },
  { id: 'XtBKDbjx1uC7JJphJFuA', name: '3 Aylık Avantajlı Paket', price: 3200, days: 90 },
  { id: 'pzUjOmtUA8Lqt2W78RUo', name: '1 Aylık Standart Üyelik', price: 1250, days: 30 }
];

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];

const memberSeedNames = [
  { name: 'Ahmet Yılmaz', gender: 'male' },
  { name: 'Ayşe Kaya', gender: 'female' },
  { name: 'Mehmet Demir', gender: 'male' },
  { name: 'Zeynep Çelik', gender: 'female' },
  { name: 'Mustafa Şahin', gender: 'male' },
  { name: 'Fatma Yıldız', gender: 'female' },
  { name: 'Ali Öztürk', gender: 'male' },
  { name: 'Emine Aydın', gender: 'female' },
  { name: 'Hüseyin Özdemir', gender: 'male' },
  { name: 'Merve Arslan', gender: 'female' },
  { name: 'Burak Doğan', gender: 'male' },
  { name: 'Gamze Kılıç', gender: 'female' },
  { name: 'Kerem Aslan', gender: 'male' },
  { name: 'Büşra Çetin', gender: 'female' },
  { name: 'Onur Kara', gender: 'male' },
  { name: 'Seda Koç', gender: 'female' },
  { name: 'Serkan Kurt', gender: 'male' },
  { name: 'Elif Özkan', gender: 'female' },
  { name: 'Tolga Şimşek', gender: 'male' },
  { name: 'Derya Polat', gender: 'female' },
  { name: 'Kaan Erdoğan', gender: 'male' },
  { name: 'Esra Korkmaz', gender: 'female' },
  { name: 'Cihan Aksoy', gender: 'male' },
  { name: 'Cansu Yavuz', gender: 'female' },
  { name: 'Batuhan Taş', gender: 'male' },
  { name: 'Gizem Uzun', gender: 'female' },
  { name: 'Emre Güler', gender: 'male' },
  { name: 'Sinem Bulut', gender: 'female' },
  { name: 'Berkay Keskin', gender: 'male' },
  { name: 'İpek Güneş', gender: 'female' },
  { name: 'Furkan Karataş', gender: 'male' },
  { name: 'Hazal Yalçın', gender: 'female' },
  { name: 'Oğuzhan Dinç', gender: 'male' },
  { name: 'Selin Ekinci', gender: 'female' },
  { name: 'Eren Avcı', gender: 'male' },
  { name: 'Tuğba Koçak', gender: 'female' },
  { name: 'Berk Coşkun', gender: 'male' },
  { name: 'Melisa Tekin', gender: 'female' },
  { name: 'Ozan Güven', gender: 'male' },
  { name: 'Deniz Aktaş', gender: 'female' },
  { name: 'Mert Can', gender: 'male' },
  { name: 'Ceren Sönmez', gender: 'female' },
  { name: 'Utku Eroğlu', gender: 'male' },
  { name: 'Damla Sarı', gender: 'female' },
  { name: 'Volkan Gül', gender: 'male' },
  { name: 'Yağmur Kaplan', gender: 'female' },
  { name: 'Arda Çakır', gender: 'male' },
  { name: 'Aslıhan Çiçek', gender: 'female' },
  { name: 'Taylan Erdem', gender: 'male' },
  { name: 'Pınar Tunç', gender: 'female' },
];

function generateTc(index) {
  const base = 100000000 + index * 17923;
  return `${base}11`;
}

async function getOrCreateAuthUser(email, password, displayName, role, accountType) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, {
      displayName,
      emailVerified: true,
      password,
    });
    const claims = {
      tenantId,
      role,
      modules: ['gym'],
      ...(accountType ? { accountType } : {})
    };
    await auth.setCustomUserClaims(existing.uid, claims);
    return existing.uid;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const u = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
      });
      const claims = {
        tenantId,
        role,
        modules: ['gym'],
        ...(accountType ? { accountType } : {})
      };
      await auth.setCustomUserClaims(u.uid, claims);
      return u.uid;
    }
    throw err;
  }
}

async function seed() {
  console.log('🚀 Starting demo data generation for Gunes Gym (tenantId: ' + tenantId + ')...');

  const nowIso = new Date().toISOString();
  const today = new Date();

  // 1. Staff creation for Role & Permission Testing
  console.log('\n--- 1. Creating Role Testing Staff Accounts ---');
  const staffList = [
    {
      email: 'admin.gunes@odivon.com',
      displayName: 'Hakan Demir',
      role: 'admin',
      title: 'Genel Müdür / Kulüp Yöneticisi',
      phone: '05325550001',
      monthlySalary: 55000,
      specialties: ['Tesis Yönetimi', 'Operasyon', 'Bütçe']
    },
    {
      email: 'trainer.gunes@odivon.com',
      displayName: 'Serdar Keskin',
      role: 'trainer',
      title: 'Kıdemli Fitness Antrenörü & PT',
      phone: '05325550002',
      monthlySalary: 38000,
      commissionRate: 25,
      specialties: ['Fitness & Vücut Geliştirme', 'Kuvvet & Kondisyon', 'Kilo Verme & Hipertrofi']
    },
    {
      email: 'reception.gunes@odivon.com',
      displayName: 'Melis Kaya',
      role: 'receptionist',
      title: 'Resepsiyon & Müşteri Hizmetleri',
      phone: '05325550003',
      monthlySalary: 30000,
      specialties: ['Üye Kabul', 'Kasa & POS Satış', 'Turnike Geçiş']
    },
    {
      email: 'sporcu.gunes@odivon.com',
      displayName: 'Barış Özkan',
      role: 'user',
      title: 'Sporcu / Üye',
      phone: '05325550004',
      monthlySalary: 0,
      specialties: []
    }
  ];

  const createdStaffUids = {};
  for (const s of staffList) {
    const uid = await getOrCreateAuthUser(s.email, '123654Dg', s.displayName, s.role, s.role === 'user' ? 'gym_member' : undefined);
    createdStaffUids[s.role] = { uid, ...s };

    // Update Firestore User Profile
    await db.collection('users').doc(uid).set({
      uid,
      tenantId,
      role: s.role,
      accountType: s.role === 'user' ? 'gym_member' : undefined,
      modules: ['gym'],
      email: s.email,
      displayName: s.displayName,
      phone: s.phone,
      status: 'active',
      membershipStatus: 'active',
      emailVerified: true,
      trialStartedAt: nowIso,
      trialEndsAt: new Date(today.getTime() + 365*24*3600*1000).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso
    }, { merge: true });

    // If staff (not user), add to gymStaff collection
    if (s.role !== 'user') {
      const staffDocRef = db.collection(`tenants/${tenantId}/gymStaff`).doc(uid);
      await staffDocRef.set({
        id: uid,
        uid,
        displayName: s.displayName,
        email: s.email,
        phone: s.phone,
        role: s.role,
        title: s.title,
        branchId,
        branchName,
        branchIds: [branchId],
        branchNames: [branchName],
        specialties: s.specialties,
        customPermissions: [],
        status: 'active',
        hireDate: '2026-01-15',
        monthlySalary: s.monthlySalary,
        commissionRate: s.commissionRate || 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        deletedAt: null
      }, { merge: true });
    }

    console.log(`✅ Staff/User ready: [${s.role.toUpperCase()}] ${s.displayName} (${s.email})`);
  }

  // 2. Vitamin Bar & POS Products
  console.log('\n--- 2. Creating Shop & POS Products ---');
  const products = [
    { name: 'Whey Isolate Protein (2000g)', sku: 'PRD-WHEY-2KG', price: 1850, stock: 24, category: 'Protein Tozu', cost: 1200, minStock: 5 },
    { name: 'BCAA 4:1:1 Karpuz Aromalı (400g)', sku: 'PRD-BCAA-WTR', price: 650, stock: 18, category: 'Amino Asit & BCAA', cost: 380, minStock: 5 },
    { name: 'Kreatin Monohidrat Saf (300g)', sku: 'PRD-CREA-300G', price: 450, stock: 35, category: 'Performans & Güç', cost: 260, minStock: 10 },
    { name: 'Pre-Workout Enerji Shot (60ml)', sku: 'PRD-PRE-SHOT', price: 75, stock: 120, category: 'İçecek & Enerji', cost: 35, minStock: 25 },
    { name: 'Doğal Kaynak Suyu (0.5L)', sku: 'PRD-WATER-500', price: 15, stock: 250, category: 'İçecek & Su', cost: 5, minStock: 50 },
    { name: 'Protein Bar Çikolatalı (60g)', sku: 'PRD-BAR-CHOC', price: 60, stock: 85, category: 'Atıştırmalık', cost: 32, minStock: 20 },
    { name: 'Odivon Mikrofiber Sporcu Havlusu', sku: 'PRD-TOWEL-GYM', price: 180, stock: 40, category: 'Ekipman & Aksesuar', cost: 85, minStock: 10 },
    { name: 'Odivon Paslanmaz Çelik Shaker (700ml)', sku: 'PRD-SHAKE-700', price: 150, stock: 60, category: 'Ekipman & Aksesuar', cost: 70, minStock: 15 },
  ];

  const productCategories = ['Protein Tozu', 'Amino Asit & BCAA', 'Performans & Güç', 'İçecek & Enerji', 'İçecek & Su', 'Atıştırmalık', 'Ekipman & Aksesuar'];
  for (const cat of productCategories) {
    await db.collection(`tenants/${tenantId}/gymProductCategories`).doc(cat).set({
      id: cat,
      name: cat,
      createdAt: nowIso,
      updatedAt: nowIso
    }, { merge: true });
  }

  for (const prd of products) {
    const docRef = db.collection(`tenants/${tenantId}/gymProducts`).doc(prd.sku);
    await docRef.set({
      id: prd.sku,
      tenantId,
      ...prd,
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }, { merge: true });
  }
  console.log(`✅ ${products.length} POS & Market products created.`);

  // 3. Create 50 Demo Members
  console.log('\n--- 3. Creating 50 Demo Gym Members ---');
  const createdMembers = [];

  for (let i = 0; i < memberSeedNames.length; i++) {
    const seedItem = memberSeedNames[i];
    const memberNo = (2001 + i).toString();
    const rfid = `RFID-90${201 + i}`;
    const tcNo = generateTc(i + 1);
    const email = `uye.${i + 1}.${seedItem.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@odivongym.app`;
    const phone = `0532${(1000000 + i * 18451).toString().slice(0, 7)}`;

    // Distribution of statuses:
    // i 0..35 => active (36 members)
    // i 36..42 => expired (7 members)
    // i 43..46 => frozen (4 members)
    // i 47..49 => trial/pending (3 members)
    let status = 'active';
    let startDaysAgo = 30 + (i % 60);
    let durationDays = 90;
    let pkg = packages[1]; // default 3 month

    if (i % 3 === 0) {
      pkg = packages[0]; // 1 year VIP
      durationDays = 365;
    } else if (i % 3 === 2) {
      pkg = packages[2]; // 1 month
      durationDays = 30;
    }

    if (i >= 36 && i <= 42) {
      status = 'expired';
      startDaysAgo = durationDays + 15 + (i - 36) * 5; // ended in past
    } else if (i >= 43 && i <= 46) {
      status = 'active'; // frozen is active membership with notes/freeze
    } else if (i >= 47) {
      status = 'trial';
      startDaysAgo = 2;
      durationDays = 14;
      pkg = { id: 'trial', name: '14 Günlük Deneme Üyeliği', price: 0, days: 14 };
    }

    const startDate = new Date(today.getTime() - startDaysAgo * 24 * 3600 * 1000);
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 3600 * 1000);

    // Wallets: some 0, some positive, some negative (receivable debt)
    let walletBalance = 0;
    if (i % 7 === 0) walletBalance = 250; // positive balance for shake/water
    else if (i % 9 === 0) walletBalance = -750; // remaining debt for package
    else if (i % 11 === 0) walletBalance = -1200;

    const memberDocId = `gym_member_${memberNo}`;

    const memberData = {
      id: memberDocId,
      uid: memberDocId,
      memberNumber: memberNo,
      displayName: seedItem.name,
      email,
      phone,
      nationalId: tcNo,
      gender: seedItem.gender,
      birthDate: new Date(1990 + (i % 15), (i % 12), 1 + (i % 28)).toISOString(),
      membershipStatus: status,
      membershipStartsAt: startDate.toISOString(),
      membershipEndsAt: endDate.toISOString(),
      packageLabel: pkg.name,
      packagePrice: pkg.price,
      notes: i >= 43 && i <= 46 ? 'Üyelik 15 gün süreyle dondurulmuştur (Yurt dışı seyahati).' : 'Düzenli sporcu, haftada 3-4 gün katılım.',
      country: 'TR',
      language: 'tr',
      walletBalance,
      branchId,
      branchName,
      trainerId: createdStaffUids['trainer']?.uid || null,
      trainerName: createdStaffUids['trainer']?.displayName || 'Serdar Keskin',
      emergencyContactName: seedItem.gender === 'female' ? 'Murat ' + seedItem.name.split(' ')[1] : 'Fatma ' + seedItem.name.split(' ')[1],
      emergencyContactPhone: '0542' + (2000000 + i * 12345).toString().slice(0, 7),
      emergencyContactRelation: seedItem.gender === 'female' ? 'Eşi' : 'Annesi',
      bloodGroup: bloodGroups[i % bloodGroups.length],
      allergies: i % 10 === 0 ? 'Fıstık alerjisi' : null,
      chronicDiseases: i % 15 === 0 ? 'Hafif astım' : null,
      specialInfo: i % 5 === 0 ? 'PT özel ders paketi mevcut.' : null,
      rfidCardNumber: rfid,
      cardDepositFee: 150,
      cardDepositPaid: true,
      isArchived: false,
      archivedAt: null,
      classCreditsTotal: pkg.days > 30 ? 24 : 8,
      classCreditsUsed: i % 7,
      kvkkConsent: true,
      kvkkConsentAt: startDate.toISOString(),
      commercialConsent: true,
      commercialConsentAt: startDate.toISOString(),
      healthConsent: true,
      healthConsentAt: startDate.toISOString(),
      createdAt: startDate.toISOString(),
      updatedAt: nowIso,
      deletedAt: null
    };

    // Save to tenants/{tenantId}/gymMembers
    await db.collection(`tenants/${tenantId}/gymMembers`).doc(memberDocId).set(memberData);

    // Save to root users collection with emailVerified: true!
    await db.collection('users').doc(memberDocId).set({
      uid: memberDocId,
      tenantId,
      role: 'user',
      accountType: 'gym_member',
      modules: ['gym'],
      email,
      displayName: seedItem.name,
      phone,
      nationalId: tcNo,
      gender: seedItem.gender,
      birthDate: memberData.birthDate,
      status: 'active',
      membershipStatus: status,
      emailVerified: true, // Mail doğrulama zorunlu değil!
      walletBalance,
      branchId,
      branchName,
      memberNumber: memberNo,
      trainerId: memberData.trainerId,
      trainerName: memberData.trainerName,
      rfidCardNumber: rfid,
      packageLabel: pkg.name,
      membershipStartsAt: memberData.membershipStartsAt,
      membershipEndsAt: memberData.membershipEndsAt,
      createdAt: startDate.toISOString(),
      updatedAt: nowIso
    });

    createdMembers.push(memberData);
  }
  console.log(`✅ Successfully seeded ${createdMembers.length} demo members!`);

  // 4. Receivables / Taksit & Borç Takibi
  console.log('\n--- 4. Creating Receivables (Installment Plans) ---');
  const debtMembers = createdMembers.filter(m => m.walletBalance < 0);
  for (const m of debtMembers) {
    const debtAmount = Math.abs(m.walletBalance);
    const recId = `rec_${m.memberNumber}`;
    await db.collection(`tenants/${tenantId}/gymReceivables`).doc(recId).set({
      id: recId,
      createdAt: m.membershipStartsAt,
      updatedAt: nowIso,
      deletedAt: null,
      tenantId,
      userId: m.uid,
      memberName: m.displayName,
      memberNumber: m.memberNumber,
      memberPhone: m.phone,
      packageId: packages[1].id,
      packageName: m.packageLabel,
      listPrice: m.packagePrice,
      discount: 0,
      totalAmount: m.packagePrice,
      downPayment: m.packagePrice - debtAmount,
      financedAmount: debtAmount,
      installmentCount: 2,
      installments: [
        {
          no: 1,
          dueDate: new Date(today.getTime() + 15 * 24 * 3600 * 1000).toISOString().slice(0, 10),
          amount: Math.round(debtAmount / 2),
          paidAmount: 0,
          paidAt: null,
          status: 'pending',
          remainingAmount: Math.round(debtAmount / 2),
          overdue: false,
          daysLate: 0
        },
        {
          no: 2,
          dueDate: new Date(today.getTime() + 45 * 24 * 3600 * 1000).toISOString().slice(0, 10),
          amount: debtAmount - Math.round(debtAmount / 2),
          paidAmount: 0,
          paidAt: null,
          status: 'pending',
          remainingAmount: debtAmount - Math.round(debtAmount / 2),
          overdue: false,
          daysLate: 0
        }
      ],
      paidAmount: m.packagePrice - debtAmount,
      remainingAmount: debtAmount,
      status: 'open',
      saleDate: m.membershipStartsAt,
      notes: 'Kayıt esnasında taksitlendirilmiş kalan üyelik bedeli',
      walletLinked: true,
      overdueAmount: 0,
      overdueCount: 0,
      maxDaysLate: 0,
      nextDueDate: new Date(today.getTime() + 15 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      nextDueAmount: Math.round(debtAmount / 2)
    }, { merge: true });
  }
  console.log(`✅ Created ${debtMembers.length} receivable installment records.`);

  // 5. Turnstile / Access Logs (Geçiş Kontrolü)
  console.log('\n--- 5. Generating Turnstile Access Logs ---');
  const gateName = 'ANA KAPI (Giriş & Çıkış)';
  const recentLogs = [];
  // Today's entries
  for (let j = 0; j < 18; j++) {
    const mem = createdMembers[j];
    const hoursAgo = Math.floor(Math.random() * 8) + 1;
    const logTime = new Date(today.getTime() - hoursAgo * 3600 * 1000);
    const logId = `acc_log_${j + 101}`;

    const logData = {
      id: logId,
      tenantId,
      userId: mem.uid,
      userName: mem.displayName,
      userPhoto: null,
      direction: j % 3 === 0 ? 'out' : 'in',
      method: j % 2 === 0 ? 'rfid' : 'qr',
      status: 'granted',
      gateName,
      card: mem.rfidCardNumber,
      source: 'agent',
      notes: 'Turnike geçiş onaylandı.',
      timestamp: Timestamp.fromDate(logTime)
    };
    await db.collection(`tenants/${tenantId}/gymAccessLogs`).doc(logId).set(logData);
    recentLogs.push(logData);
  }
  console.log(`✅ Created ${recentLogs.length} turnstile access logs.`);

  // 6. Accounting Entries (Gelir / Gider Kayıtları)
  console.log('\n--- 6. Creating Accounting Entries ---');
  const accountingEntries = [
    { type: 'income', amount: 9900, category: 'membership', description: '1 Yıllık VIP Sınırsız Üyelik Satışı', paymentMethod: 'card' },
    { type: 'income', amount: 3200, category: 'membership', description: '3 Aylık Avantajlı Paket Satışı', paymentMethod: 'transfer' },
    { type: 'income', amount: 1250, category: 'membership', description: '1 Aylık Standart Üyelik Tahsilatı', paymentMethod: 'cash' },
    { type: 'income', amount: 1850, category: 'product', description: 'Vitamin Bar - Whey Protein Satışı', paymentMethod: 'card' },
    { type: 'income', amount: 650, category: 'product', description: 'Vitamin Bar - BCAA Satışı', paymentMethod: 'cash' },
    { type: 'expense', amount: 32000, category: 'rent', description: 'Ekim 2026 Salon Kira Ödemesi', paymentMethod: 'transfer' },
    { type: 'expense', amount: 14500, category: 'utilities', description: 'Elektrik & Havalandırma Faturası', paymentMethod: 'transfer' },
    { type: 'expense', amount: 6800, category: 'supplements', description: 'Toptan Protein Tozu ve Su Tedariği', paymentMethod: 'transfer' },
  ];

  for (let k = 0; k < accountingEntries.length; k++) {
    const entry = accountingEntries[k];
    const accId = `acc_entry_${k + 101}`;
    await db.collection(`tenants/${tenantId}/gymAccountingEntries`).doc(accId).set({
      id: accId,
      tenantId,
      ...entry,
      entryDate: Timestamp.fromDate(new Date(today.getTime() - (k + 1) * 24 * 3600 * 1000)),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  }
  console.log(`✅ Created ${accountingEntries.length} accounting entries.`);

  // 7. Lockers (Dolap Takibi)
  console.log('\n--- 7. Creating Gym Lockers ---');
  for (let l = 1; l <= 30; l++) {
    const lockerId = `locker_${l}`;
    const isOccupied = l <= 12;
    const assignedMember = isOccupied ? createdMembers[l - 1] : null;

    await db.collection(`tenants/${tenantId}/gymLockers`).doc(lockerId).set({
      id: lockerId,
      number: l.toString().padStart(2, '0'),
      gender: l <= 15 ? 'male' : 'female',
      status: isOccupied ? 'occupied' : 'available',
      memberId: assignedMember ? assignedMember.uid : null,
      memberName: assignedMember ? assignedMember.displayName : null,
      memberNumber: assignedMember ? assignedMember.memberNumber : null,
      updatedAt: nowIso
    });
  }
  console.log(`✅ Created 30 gym lockers.`);

  console.log('\n🎉 ALL DEMO DATA GENERATION COMPLETED SUCCESSFULLY!');
}

seed().catch(console.error);
