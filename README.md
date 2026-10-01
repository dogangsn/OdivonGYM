# OdivonGYM

Spor salonu yönetim paneli ve üye arayüzü. Angular 20 (standalone, signals, zoneless),
Angular Material + Tailwind CSS, PWA (service worker).

## Mimari

```
Tarayıcı (bu proje) ──HTTPS──► MainApi (NestJS, Cloudflare Worker) ──► Firestore
        │                         mainapi.odivon.com/api/v1
        └── Firebase Auth (yalnızca oturum açma / ID token)

Edge Agent (salondaki PC) ──HTTPS──► MainApi      Turnike/kart okuyucu ◄──LAN── Edge Agent
```

- **Tüm veri MainApi üzerinden okunur ve yazılır.** Panel, Firebase Auth'tan aldığı ID
  token'ı `Authorization` başlığıyla gönderir (`core/http/auth.interceptor.ts`). Yetki
  kontrolü (rol, izin, modül, kiracı) sunucuda yapılır; paneldeki menü gizleme yalnızca
  görünümdür.
- Firebase projesi: `odivon-main-api-a2095` (Vet client ve MainApi ile ortak). Ayarlar
  `src/environments/` altında.
- Cloud Functions **kullanılmıyor**. Zamanlanmış işler (hatırlatmalar, geçmiş ders
  seanslarının kapanması) MainApi Worker'ının cron tetikleyicisinde çalışır.
- Turnike entegrasyonu: `edge-agent/` (ayrı Node servisi, bkz. `edge-agent/README.md` ve
  `docs/access-agent-contract.md`).

## Klasör yapısı

```
src/app/
├── core/
│   ├── api/        # MainApi uç noktaları için ince istemciler (*.api.ts)
│   ├── http/       # ApiClient + interceptor'lar (auth, istemci sürümü, hata, yükleniyor)
│   ├── auth/       # Firebase Auth oturumu, guard'lar
│   ├── version/    # Sürüm kimliği ve zorunlu güncelleme (VersionService)
│   ├── models/ services/ i18n/ config/ data/
├── admin/          # Personel paneli: üyeler, paketler, taksit/borç, raporlar, dersler,
│                   #   misafir üyeler (aday hunisi, tavsiye programı), hatırlatmalar,
│                   #   turnike, muhasebe, mağaza/POS, işlem kaydı …
├── features/       # Üye ve ortak ekranlar: giriş, panel, dersler, randevular, cüzdan,
│                   #   antrenman, ölçümler, su takibi, profil
└── shared/         # Shell, sidebar, ortak UI bileşenleri
scripts/write-version.mjs   # Her build/serve/test öncesi sürüm kimliğini üretir
release.json                # Sürüm notu ve zorunlu güncelleme bayrakları (elle düzenlenir)
firestore.rules, storage.rules, firestore.indexes.json
```

## Geliştirme

```bash
npm install
npm start
```

`http://localhost:4200`. `ng serve`, `/api` ve `/health` isteklerini
`src/proxy.conf.json`'daki hedefe yönlendirir. **Bu dosya şu an canlı MainApi'yi
gösteriyor**: yerelde yapılan her kayıt gerçek veriye yazılır. Yerel MainApi ile çalışmak
için hedefi `http://localhost:3000` yap (dosyadaki yorum satırı).

```bash
npm test          # birim testleri (Karma)
npm run build     # production build → dist/odivongym/browser
npm run test:agent
```

## Sürümler ve oturum

- `scripts/write-version.mjs`, `package.json` sürümü + git commit + build zamanından bir
  build kimliği üretir; bunu uygulamaya derler ve `public/version.json` olarak yayınlar.
- Yeni sürüm yayınlandığında açık sekmeler bunu fark eder ve kapatılamayan bir
  "Güncelle" penceresi gösterir: güncelleme çıkış yaptırır, önbelleği ve yerel depolamayı
  temizler, kullanıcı yeniden giriş yapar.
- Sürüm yükseltmek: `npm run release:patch` (veya `release:minor`).
- Oturum en fazla 30 gün geçerlidir (MainApi tarafında zorlanır).

## Yayın

master'a her push GitHub Actions ile test edilir, build alınır ve Cloudflare'e (Worker `odivon-gym-client`) yayınlanır (`.github/workflows/deploy.yml`; repo secret'ları: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID). Elle yayın:

```bash
npm run deploy:hosting   # build + Firebase Hosting
npm run deploy:rules     # Firestore ve Storage kuralları
```

Firestore index'leri `firestore.indexes.json`'da tutulur; `firebase deploy --only
firestore:indexes` ile ayrıca yayınlanır. MainApi kendi deposundan yayınlanır.
