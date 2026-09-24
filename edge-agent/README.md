# OdivonGYM — Perkotek YT-32 Turnike Edge Agent (Yerel Köprü)

Bu servis, spor salonunuzun resepsiyon veya sunucu bilgisayarında (Windows / Linux / Raspberry Pi) çalışan, **Perkotek YT-32** cihazı ile **OdivonGYM Bulut Sistemi (Firebase)** arasında 7/24 çift yönlü köprü kuran resmi yerel ajandır.

---

## 🎯 Ne İşe Yarar?

1. **5 Saniyede Bir Canlı Geçiş Çekme:** Perkotek YT-32 turnikesinden geçen üyelerin kart/yüz/parmak izi okuma kayıtlarını her 5 saniyede bir otomatik çeker ve OdivonGYM `admin/access-control` ekranındaki **Canlı Geçiş Kayıtları** tablosuna anında yansıtır.
2. **Otomatik Geçiş Engelleme & Yetki Senkronizasyonu:** Bir üyenin aboneliği bittiğinde veya dondurulduğunda, buluttan gelen sinyalle Perkotek cihazındaki yetkisi kapatılır; abonelik yenilendiğinde ise geçişi anında tekrar açılır.
3. **Buluttan Manuel Kapı Açma:** Resepsiyon panelindeki *"Manuel Kapı Aç"* butonuna basıldığında turnikenin rölesini tetikler (4 saniye serbest geçiş verir).

---

## 📋 Gereksinimler

1. Salon ağında Perkotek YT-32 ile aynı yerel ağa (aynı modem / switch) bağlı bir bilgisayar (Windows 10/11 önerilir).
2. Bilgisayarda **Node.js** (v18, v20 veya üzeri) kurulu olmalıdır. (İndir: [nodejs.org](https://nodejs.org))
3. Perkotek YT-32 cihazının Ethernet kablosu modeme/switch'e takılı olmalıdır.

---

## 🚀 Adım Adım Kurulum Kılavuzu

### 1. Adım: Perkotek YT-32 Cihaz IP Ayarı
1. Perkotek YT-32 menüsüne girin (`M/OK` tuşuna basılı tutun > Yönetici girişi).
2. **İletişim (Comm.) > Ağ (Ethernet)** sekmesine gidin.
3. Cihaza salon ağınızda boşta olan bir statik IP verin:
   - **IP Adresi:** `192.168.1.201` *(veya ağınıza uygun IP)*
   - **Alt Ağ Maskesi:** `255.255.255.0`
   - **Ağ Geçidi:** `192.168.1.1` *(Modem IP'si)*
   - **Port:** `4370` *(Varsayılan)*
4. Bilgisayarınızdan komut satırını açıp cihazı test edin:
   ```cmd
   ping 192.168.1.201
   ```
   *(Cevap geliyorsa ağ bağlantısı tamamdır.)*

---

### 2. Adım: Firebase Yetki Anahtarını (Service Account) Alma
1. [Firebase Console](https://console.firebase.google.com/) adresine girin ve OdivonGYM projenizi seçin.
2. Sol üstteki dişli simgesine ⚙️ tıklayıp **Project Settings (Proje Ayarları)** sayfasına gidin.
3. **Service Accounts (Hizmet Hesapları)** sekmesine tıklayın.
4. **"Generate new private key" (Yeni özel anahtar oluştur)** butonuna basın.
5. İndirilen `.json` dosyasının adını `serviceAccountKey.json` olarak değiştirin ve bu `edge-agent/` klasörünün içine yapıştırın.

---

### 3. Adım: Ayar Dosyasını (config.json) Hazırlama
Klasördeki `config.sample.json` dosyasını kopyalayıp aynı yerde adını `config.json` yapın:
```json
{
  "tenantId": "SENIN_SALON_KODUN",
  "device": {
    "ip": "192.168.1.201",
    "port": 4370,
    "timeout": 5000,
    "gateName": "Turnike 1 - Ana Giriş",
    "direction": "in"
  },
  "polling": {
    "intervalSeconds": 5,
    "stateFilePath": "./state.json"
  },
  "firebase": {
    "serviceAccountKeyPath": "./serviceAccountKey.json"
  }
}
```
* **tenantId:** OdivonGYM'deki işletmenizin kimlik kodu. (Admin panelinde sol alttaki profilinizden veya veritabanından alabilirsiniz.)
* **ip:** Perkotek cihazının 1. adımda belirlediğiniz IP adresi.

---

### 4. Adım: Başlatma & Test

#### A. Çift Tıklayarak Başlatma (Windows için En Kolayı):
Klasördeki **`baslat.bat`** dosyasına çift tıklayın!
* Gerekli npm paketlerini kendisi yükler,
* Ayarları kontrol eder,
* Cihaza bağlanıp dinlemeye başlar.

#### B. Komut Satırından Başlatma:
```bash
cd edge-agent
npm install
npm start
```

Ekranda şu çıktıyı gördüğünüzde sistem hazırdır:
```
====================================================
   ODIVON GYM - PERKOTEK YT-32 EDGE AGENT v1.0.0    
====================================================
🏢 Salon (Tenant ID) : salon_123
🚪 Kapı / Turnike Adı: Turnike 1 - Ana Giriş
🌐 Cihaz IP Adresi   : 192.168.1.201:4370
⏱️ Log Çekme Aralığı : Her 5 saniyede bir
----------------------------------------------------
📡 Cihaz senkronizasyon kuyruğu dinleniyor (device_sync_queue)...
📡 Anlık komut kuyruğu dinleniyor (device_commands)...
🔌 Perkotek YT-32 cihazına bağlanılıyor: 192.168.1.201:4370...
✨ [BAĞLANDI] Perkotek YT-32 cihazı aktif.
```

---

## 🔄 Bilgisayar Açıldığında Otomatik Başlamasını Sağlama (7/24 Çalışma)

Resepsiyon bilgisayarı her açıldığında veya yeniden başladığında servisin arka planda otomatik çalışması için:

### Yöntem 1: PM2 ile Servis Yapma (Tavsiye Edilen)
1. Komut satırında PM2 yükleyin:
   ```cmd
   npm install -g pm2
   npm install -g pm2-windows-startup
   pm2-startup install
   ```
2. Edge agent klasöründe servisi başlatın:
   ```cmd
   cd edge-agent
   pm2 start agent.js --name "odivon-turnike"
   pm2 save
   ```
Artık bilgisayar yeniden başlasa bile servis arka planda sessizce çalışmaya devam eder.

### Yöntem 2: Windows Başlangıç Klasörü (Kolay Alternatif)
1. Klavyeden `Windows + R` tuşlarına basın.
2. `shell:startup` yazıp Enter'a basın (Başlangıç klasörü açılır).
3. `baslat.bat` dosyasına sağ tıklayıp **"Kısayol Oluştur"** deyin ve oluşan kısayolu bu Başlangıç klasörüne atın.
