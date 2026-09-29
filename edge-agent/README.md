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
  SQLite kuyruğuna (`data/agent.db`) alır ve MainApi'ye toplu gönderir. İnternet
  kesilirse kayıtlar kuyrukta bekler, bağlantı gelince gönderilir; tekrarlar hem
  yerelde hem MainApi'de ayıklanır.
- MainApi'deki **istenen yetki durumunu** (üye numarası, kart, bitiş günü, açık/kapalı)
  cihaza uygular, cihazdan **geri okuyup doğrular**; doğrulanmadan "uygulandı" demez.
- 15 saniyede bir heartbeat gönderir; paneldeki "çevrimiçi" bilgisi buradan gelir.
- Cihazın bildirmediği "izin verildi / reddedildi" sonucunu tahmin etmez.
- Uzaktan kapı açma YT için kapalıdır (`SetDoorStatus=open` kalıcı açık kalabilir).

## Desteklenen protokoller

| Protokol | Durum |
| --- | --- |
| `yt-http-digest` | Olay okuma + kart/üye no/bitiş günü senkronu. **Donanım testi gerekli.** |
| `zk-tcp-4370` | Tanımlı, henüz doğrulanmadı (cihaza hiçbir şey yazmaz). |
| `vendor-sdk` | Tanımlı, henüz eklenmedi. |

## Kurulum (Windows)

1. **Node.js 22.13 veya üzeri** kurun ([nodejs.org](https://nodejs.org)). Ek paket gerekmez.
2. Bu klasörü salon bilgisayarına kopyalayın.
3. `config.sample.json` dosyasını `config.json` olarak kopyalayın ve cihaz bilgilerini girin:
   ```json
   {
     "mainApiUrl": "https://mainapi.odivon.com/api/v1",
     "agentName": "Resepsiyon PC",
     "credentials": {
       "192.168.1.201": { "username": "admin", "password": "CIHAZ_PAROLASI" }
     }
   }
   ```
   Cihaz parolası yalnızca bu bilgisayarda durur; MainApi'ye gönderilmez.
4. Admin panelinde **Geçiş Kontrol → Cihazlar**'da cihazı ekleyin (protokol: YT HTTP Digest,
   IP adresi), ardından **Agent eşleştir** ile tek kullanımlık kodu alın (10 dk geçerli).
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
