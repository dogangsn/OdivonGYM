/**
 * ============================================================================
 * ODIVON GYM - PERKOTEK YT-32 EDGE AGENT (YEREL KÖPRÜ SERVİSİ)
 * ============================================================================
 * Bu servis, spor salonundaki yerel ağda (LAN) çalışan ve Perkotek YT-32
 * turnike / yüz tanıma / RFID cihazı ile OdivonGYM Bulut Sistemi (Firebase)
 * arasında çift yönlü veri akışını sağlayan hafif bir yerel ajandır.
 *
 * GÖREVLERİ:
 * 1. Perkotek YT-32 cihazından 5 saniyede bir yeni geçiş kayıtlarını çeker.
 * 2. Yeni geçişleri anında Firestore 'access_logs' koleksiyonuna işler.
 * 3. Buluttaki 'device_sync_queue' kuyruğunu gerçek zamanlı dinler; süresi biten
 *    veya engellenen üyeleri cihazdan siler/engeller, yenilenenleri cihaza yükler.
 * 4. Buluttan gelen 'device_commands' (kapı aç, log çek vb.) anlık komutları uygular.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const ZKLib = require('node-zklib');

// 1. Ayar Dosyasını Oku
const configPath = path.resolve(__dirname, 'config.json');
const sampleConfigPath = path.resolve(__dirname, 'config.sample.json');

if (!fs.existsSync(configPath)) {
  console.error('\n❌ [HATA] config.json dosyası bulunamadı!');
  console.log('👉 Lütfen config.sample.json dosyasını config.json olarak kopyalayıp salon bilgilerinizi doldurun:');
  console.log('   copy config.sample.json config.json\n');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!config.tenantId || config.tenantId === 'SALON_TENANT_ID_BURAYA') {
  console.error('\n❌ [HATA] config.json içindeki "tenantId" alanı doldurulmalıdır.');
  console.log('👉 OdivonGYM admin panelinizden Salon Kimliği (Tenant ID) bilginizi alıp yazın.\n');
  process.exit(1);
}

// 2. Firebase Admin SDK Başlat
const saPath = path.resolve(__dirname, config.firebase?.serviceAccountKeyPath || './serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
  console.error(`\n❌ [HATA] Firebase anahtar dosyası bulunamadı: ${saPath}`);
  console.log('👉 Firebase Console > Project Settings > Service Accounts ekranından bir özel anahtar (Private Key JSON) indirin.');
  console.log(`👉 İndirdiğiniz dosyayı "${saPath}" olarak bu klasöre kaydedin.\n`);
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin SDK bağlantısı başarılı.');
} catch (err) {
  console.error('❌ Firebase başlatılırken hata oluştu:', err.message);
  process.exit(1);
}

const db = admin.firestore();

// 3. Yerel Durum Yönetimi (Son okunan log zamanı vb.)
const stateFilePath = path.resolve(__dirname, config.polling?.stateFilePath || './state.json');
let localState = {
  lastLogTimestamp: null,
  processedLogIds: [],
};

if (fs.existsSync(stateFilePath)) {
  try {
    localState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
  } catch (err) {
    console.warn('⚠️ state.json okunamadı, varsayılan sıfırlanıyor.');
  }
}

function saveState() {
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(localState, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ state.json kaydedilemedi:', err.message);
  }
}

// 4. Üye Önbelleği (Sürekli Firestore'a tek tek okuma maliyetini önler)
let memberCache = new Map(); // key: memberNumber veya rfidCard, value: UserProfile
let lastMemberCacheFetch = 0;

async function refreshMemberCache() {
  const now = Date.now();
  if (now - lastMemberCacheFetch < 60000 && memberCache.size > 0) {
    return; // 1 dakikada bir güncelle
  }

  try {
    const snap = await db
      .collection('users')
      .where('tenantId', '==', config.tenantId)
      .get();

    const newCache = new Map();
    snap.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      if (data.memberNumber) {
        newCache.set(String(data.memberNumber).trim(), data);
      }
      if (data.rfidCardNumber) {
        newCache.set(String(data.rfidCardNumber).trim(), data);
      }
      newCache.set(doc.id, data);
    });

    memberCache = newCache;
    lastMemberCacheFetch = now;
  } catch (err) {
    console.warn('⚠️ Üye önbelleği yenilenirken hata:', err.message);
  }
}

// 5. Perkotek YT-32 Cihaz Bağlantısı
const deviceIp = config.device?.ip || '192.168.1.201';
const devicePort = config.device?.port || 4370;
const pollIntervalSec = config.polling?.intervalSeconds || 5;
const gateName = config.device?.gateName || 'Perkotek YT-32 Turnike';

let zkInstance = null;
let isConnected = false;
let isPolling = false;

async function connectDevice() {
  if (isConnected && zkInstance) return zkInstance;

  try {
    console.log(`🔌 Perkotek YT-32 cihazına bağlanılıyor: ${deviceIp}:${devicePort}...`);
    zkInstance = new ZKLib(deviceIp, devicePort, config.device?.timeout || 5000, 4000);
    await zkInstance.createSocket();
    isConnected = true;
    console.log(`✨ [BAĞLANDI] Perkotek YT-32 cihazı aktif (${deviceIp}:${devicePort}).`);
    return zkInstance;
  } catch (err) {
    isConnected = false;
    zkInstance = null;
    console.warn(`⚠️ Cihaz bağlantı hatası (${deviceIp}): ${err.message}. 10 saniye sonra tekrar denenecek.`);
    return null;
  }
}

// 6. Turnikeden Canlı Geçiş Kayıtlarını Çekme (Poll Attendances)
async function pollDeviceAttendances() {
  if (isPolling) return;
  isPolling = true;

  try {
    const zk = await connectDevice();
    if (!zk) {
      isPolling = false;
      return;
    }

    await refreshMemberCache();

    // Cihazdaki geçiş kayıtlarını al
    const logs = await zk.getAttendances();

    if (logs && logs.data && Array.isArray(logs.data)) {
      const allRecords = logs.data;
      let newCount = 0;

      // Son log tarihini kontrol et
      const lastTs = localState.lastLogTimestamp ? new Date(localState.lastLogTimestamp).getTime() : 0;
      let highestTs = lastTs;

      for (const record of allRecords) {
        const recordTime = new Date(record.recordTime).getTime();
        const recordKey = `${record.deviceUserId}_${recordTime}`;

        // Zaten işlenmiş veya eski log mu?
        if (recordTime <= lastTs || localState.processedLogIds.includes(recordKey)) {
          continue;
        }

        // Üyeyi eşle (memberNumber veya RFID kart no ile)
        const deviceUid = String(record.deviceUserId).trim();
        const member = memberCache.get(deviceUid);

        // Yön belirleme: 0 = Giriş, 1 = Çıkış (cihaz durumuna göre)
        const direction = record.state === 1 ? 'out' : 'in';

        // Firestore 'access_logs' koleksiyonuna ekle
        await db.collection('access_logs').add({
          tenantId: config.tenantId,
          userId: member?.id || null,
          userName: member?.displayName || `Kart / No: #${deviceUid}`,
          userPhoto: member?.photoURL || null,
          direction: direction,
          method: 'rfid',
          status: 'granted',
          gateName: gateName,
          notes: `Perkotek YT-32 Donanım Geçişi (No: ${deviceUid})`,
          timestamp: admin.firestore.Timestamp.fromDate(new Date(record.recordTime)),
        });

        // Durumu güncelle
        localState.processedLogIds.push(recordKey);
        if (localState.processedLogIds.length > 500) {
          localState.processedLogIds.shift(); // Hafıza şişmesini önle
        }

        if (recordTime > highestTs) {
          highestTs = recordTime;
        }
        newCount++;
      }

      if (highestTs > lastTs) {
        localState.lastLogTimestamp = new Date(highestTs).toISOString();
        saveState();
      }

      if (newCount > 0) {
        console.log(`📥 [${new Date().toLocaleTimeString('tr-TR')}] ${newCount} yeni geçiş kaydı OdivonGYM bulutuna aktarıldı.`);
      }
    }
  } catch (err) {
    console.error('❌ Geçiş kayıtları çekilirken hata:', err.message);
    // Soket koptuysa yeniden bağlanmak için sıfırla
    isConnected = false;
    if (zkInstance) {
      try { await zkInstance.disconnect(); } catch (_) {}
      zkInstance = null;
    }
  } finally {
    isPolling = false;
  }
}

// 7. Cihaz Senkronizasyon Kuyruğunu Dinle (device_sync_queue)
// Üye abonelik bitişi güncellendiğinde veya kart tanımlandığında Perkotek'e yazar
function listenSyncQueue() {
  console.log('📡 Cihaz senkronizasyon kuyruğu dinleniyor (device_sync_queue)...');

  db.collection('device_sync_queue')
    .where('tenantId', '==', config.tenantId)
    .where('status', '==', 'pending')
    .onSnapshot(
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            const docId = change.doc.id;

            console.log(`🔄 [SENKRONİZASYON] İşlem alınıyor: ${data.action} -> Üye: ${data.displayName || data.userId}`);

            try {
              const zk = await connectDevice();
              if (zk) {
                const pin = data.cardNo || data.userId.slice(-6); // YT-32 PIN / Kart No

                if (data.action === 'DISABLE') {
                  // Cihazdan sil veya erişimini engelle
                  try {
                    await zk.deleteUser(pin);
                    console.log(`🚫 Üyenin turnike geçiş yetkisi cihazda iptal edildi (PIN: ${pin}).`);
                  } catch (delErr) {
                    console.warn(`Uyarı: Cihazdan silinemedi:`, delErr.message);
                  }
                } else {
                  // ENABLE veya UPDATE_EXPIRY
                  // Cihaza kullanıcı bilgilerini kaydet
                  try {
                    // setUser(uid, userid, name, password, role, cardno)
                    await zk.setUser(
                      pin,
                      pin,
                      data.displayName || 'Uye',
                      '',
                      0,
                      data.cardNo ? parseInt(data.cardNo, 10) : 0
                    );
                    console.log(`✅ Üye bilgileri Perkotek cihazına aktarıldı (PIN: ${pin}, İsim: ${data.displayName}).`);
                  } catch (setErr) {
                    console.warn(`Uyarı: Kullanıcı cihaza yazılamadı:`, setErr.message);
                  }
                }

                // Kuyruk durumunu tamamlandı yap
                await change.doc.ref.update({
                  status: 'completed',
                  syncedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
            } catch (err) {
              console.error(`❌ Senkronizasyon hatası (${docId}):`, err.message);
              await change.doc.ref.update({
                status: 'error',
                errorMessage: err.message,
              });
            }
          }
        }
      },
      (error) => {
        console.error('❌ device_sync_queue dinlenirken hata:', error.message);
      }
    );
}

// 8. Anlık Yönetici Komutlarını Dinle (device_commands)
// Örn: Buluttan manuel kapı açma veya zorla log çekme
function listenDeviceCommands() {
  console.log('📡 Anlık komut kuyruğu dinleniyor (device_commands)...');

  db.collection('device_commands')
    .where('tenantId', '==', config.tenantId)
    .where('status', '==', 'pending')
    .onSnapshot(
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const data = change.doc.data();
            const docId = change.doc.id;

            console.log(`⚡ [KOMUT ALINDI] ${data.command} (${docId})`);

            try {
              if (data.command === 'PULL_LOGS_NOW') {
                await pollDeviceAttendances();
              } else if (data.command === 'UNLOCK_DOOR') {
                const zk = await connectDevice();
                if (zk) {
                  if (typeof zk.unlockDoor === 'function') {
                    await zk.unlockDoor(4);
                  } else {
                    await zk.executeCmd(31, ''); // CMD_UNLOCK
                  }
                  console.log('🔓 [KAPI AÇILDI] Perkotek turnike rölesi tetiklendi.');
                }
              }

              await change.doc.ref.update({
                status: 'completed',
                executedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            } catch (err) {
              console.error(`❌ Komut işleme hatası (${data.command}):`, err.message);
              await change.doc.ref.update({
                status: 'error',
                errorMessage: err.message,
              });
            }
          }
        }
      },
      (error) => {
        console.error('❌ device_commands dinlenirken hata:', error.message);
      }
    );
}

// 9. Ana Döngü ve Başlangıç
async function startAgent() {
  console.log('====================================================');
  console.log('   ODIVON GYM - PERKOTEK YT-32 EDGE AGENT v1.0.0    ');
  console.log('====================================================');
  console.log(`🏢 Salon (Tenant ID) : ${config.tenantId}`);
  console.log(`🚪 Kapı / Turnike Adı: ${gateName}`);
  console.log(`🌐 Cihaz IP Adresi   : ${deviceIp}:${devicePort}`);
  console.log(`⏱️ Log Çekme Aralığı : Her ${pollIntervalSec} saniyede bir`);
  console.log('----------------------------------------------------');

  // Kuyrukları dinlemeye başla
  listenSyncQueue();
  listenDeviceCommands();

  // İlk bağlantıyı ve log çekimini başlat
  await pollDeviceAttendances();

  // Periyodik log çekme döngüsü
  setInterval(async () => {
    await pollDeviceAttendances();
  }, pollIntervalSec * 1000);
}

// Güvenli Kapanma
process.on('SIGINT', async () => {
  console.log('\n🛑 Edge Agent kapatılıyor...');
  if (zkInstance) {
    try {
      await zkInstance.disconnect();
    } catch (_) {}
  }
  process.exit(0);
});

startAgent();
