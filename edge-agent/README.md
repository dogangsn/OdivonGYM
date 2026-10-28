# OdivonGYM Edge Agent v2

Salondaki geçiş cihazlarıyla (turnike, kart okuyucu) **yerel ağda** konuşan, MainApi'ye
yalnızca **giden HTTPS** isteğiyle bağlanan köprü servisi. Firebase'e bağlanmaz;
Firebase Admin anahtarına ihtiyaç duymaz.

```
GYM admin paneli ─► MainApi ◄──HTTPS── Edge Agent ──LAN──► YT cihazı
```

Sözleşme ve veri modeli: [`docs/access-agent-contract.md`](../docs/access-agent-contract.md)

## Ne yapar?

- Her cihazı **5 saniyede bir** tarar, tüm log sayfalarını okur, yeni kayıtları yerel
  SQLite kuyruğuna (`data/agent.db`) alır; yeni geçiş olunca 5 sn toplanıp tek pakette MainApi'ye
  gönderilir (olay yoksa istek atılmaz). İnternet
  kesilirse kayıtlar kuyrukta bekler, bağlantı gelince gönderilir; tekrarlar hem
  yerelde hem MainApi'de ayıklanır.
- MainApi'ye yeni iş olup olmadığını sunucunun önerdiği aralıkla sorar (boştayken 30 sn).
- MainApi'deki **istenen yetki durumunu** (üye numarası, kart, bitiş günü, açık/kapalı)
  cihaza uygular, cihazdan **geri okuyup doğrular**; doğrulanmadan "uygulandı" demez.
- 60 saniyede bir heartbeat gönderir; paneldeki "çevrimiçi" bilgisi buradan gelir.
- Cihazın bildirmediği "izin verildi / reddedildi" sonucunu tahmin etmez.
- `192.168.1.2` üzerindeki `K4E_2Y1Kbc011_2.9` firmware'inin geçiş logunda kart numarası
  ayrı bir alan olarak yoktur. 24.10.2026 tarihinde tanımsız test kartı reddedildiğinde
  `GetLogDataPage` toplamı 42 olarak kaldı; bu cihazın mevcut API'si reddedilen kartın
  numarasını vermedi. Kartı resepsiyondaki USB okuyucuyla okutun veya üreticinin ayrı
  bir ham kart okuma protokolü/SDK'sını doğrulayın.
- Kimliği reddedilirse (agent iptal edildi ya da başka bir kopya eşleştirildi) durmaz: pencerede
  çalışıyorsa yeni eşleştirme kodunu sorar; arka planda çalışıyorsa kodu agent klasöründeki
  `eslestirme-kodu.txt` dosyasına yazmanızı bekler. Eşleşince kaldığı yerden devam eder.
  Kodu bilerek değiştirmek için `yeniden-eslestir.bat` çalıştırın.
- Uzaktan kapı açma YT için kapalıdır (`SetDoorStatus=open` kalıcı açık kalabilir).

## Desteklenen protokoller

| Protokol | Durum |
| --- | --- |
| `yt-http-digest` | Olay okuma + kart/üye no/bitiş günü senkronu. **Donanım testi gerekli.** |
| `zk-tcp-4370` | Geçmiş + gerçek zamanlı olay okuma. Üye/kart yazma kapalı; donanım testi gerekli. |
| `vendor-sdk` | Tanımlı, henüz eklenmedi. |

## Kurulum (Windows)

1. **Node.js 22.13 veya üzeri** kurun ([nodejs.org](https://nodejs.org)).
2. Bu klasörü salon bilgisayarına kopyalayın. `baslat.bat` gerekli npm paketlerini
   ilk çalıştırmada otomatik kurar (`npm ci --omit=dev`).
3. `config.sample.json` dosyasını `config.json` olarak kopyalayın ve cihaz bilgilerini girin:
   ```json
   {
     "mainApiUrl": "https://mainapi.odivon.com/api/v1",
     "agentName": "Resepsiyon PC",
      "credentials": {
        "192.168.1.201": { "username": "admin", "password": "CIHAZ_PAROLASI" },
        "192.168.1.202": {
          "commKey": 0,
          "directionByState": { "0": "in", "1": "out" }
        }
      }
   }
   ```
   Cihaz parolası yalnızca bu bilgisayarda durur; MainApi'ye gönderilmez. ZK cihazında
   `CommKey` kapalıysa `0` kullanın. Cihazın `state` değerleri gerçekten giriş/çıkış
   yönünü ifade ediyorsa `directionByState` ile eşleyin; iki ayrı okuyucu varsa yönü
   panelde cihaz bazında **Giriş** / **Çıkış** seçmek daha güvenlidir.
4. Admin panelinde **Geçiş Kontrol → Cihazlar**'da cihazı ekleyin (YT için `YT HTTP Digest`,
   ZKTeco için `ZK TCP / 4370` ve cihazın yerel IP adresi), ardından **Agent eşleştir**
   ile tek kullanımlık kodu alın (10 dk geçerli).
5. `baslat.bat` dosyasına çift tıklayın; ilk açılışta kodu sorar. Komut satırından:
   ```cmd
   npm run enroll -- KOD
   npm start
   ```

Agent kimliği `data/identity.json` dosyasındadır; bu dosyayı paylaşmayın. Agent panelden
iptal edilirse çalışmayı durdurur, yeni kodla yeniden eşleştirilmesi gerekir.

### Otomatik başlatma

`baslat.bat` eşleştirmeden sonra `servis-kur.bat` dosyasını kendisi çalıştırır (yönetici izni ister).
Bu, Windows Görev Zamanlayıcı'da **"Odivon Edge Agent"** görevini kurar:

- Bilgisayar açılınca, kimse oturum açmasa bile agent arka planda başlar.
- Agent kapanırsa 1 dakika içinde yeniden başlatılır.
- Prizdeyken uyku / hazırda bekleme kapatılır.

Kurulumdan sonra `baslat.bat` yalnızca görevi çalıştırır; pencere açık kalmak zorunda değildir.
Yönetici izni verilmezse agent eskisi gibi pencerede çalışır. Kaldırmak için: `servis-kur.bat kaldir`.

### Durdurma

`durdur.bat` dosyasına çift tıklayın (yönetici izni ister). Agent'ı kapatır ve "Odivon Edge Agent"
görevini siler; bilgisayar açılınca artık kendiliğinden başlamaz. `data/` klasörü (eşleştirme kimliği,
bekleyen kayıtlar) silinmez; yeniden başlatmak için `baslat.bat` yeterlidir.

## Eski agent'tan geçiş

Eski sürüm Firestore'a doğrudan yazıyordu. Yeni agent doğrulandıktan sonra:

1. Eski agent'ı durdurun ve başlangıç kısayolunu/PM2 kaydını kaldırın.
2. Bilgisayardaki `serviceAccountKey.json` dosyasını silin.
3. Firebase Console → Project settings → Service accounts → ilgili anahtarı **iptal edin**.

## Geliştirme

```bash
npm test
```

Testler sahte bir YT cihazı (HTTP Digest + `/bin/cmd`) ve bellek içi MainApi ile
sayfalama, geri okuma doğrulaması, çevrimdışı kuyruk, tekrar ayıklama ve iptal
senaryolarını çalıştırır. YT tel biçimi `src/adapters/yt-wire.js` dosyasında tek yerde
tanımlıdır.
