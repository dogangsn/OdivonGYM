# OdivonGYM

Modern, mobil öncelikli spor salonu yönetim ve üyelik uygulaması. Angular 20
(standalone + signals + zoneless) + Angular Material (M3) + Tailwind CSS 4 +
Firebase (Auth, Firestore, Storage, Cloud Functions) + PWA.

> **Bu Faz 1'dir:** proje iskeleti + authentication + 14 günlük ücretsiz
> deneme sistemi. Dashboard, paket satın alma akışı, ders/randevu takvimi ve
> admin paneli şimdilik placeholder ("Yakında") ekranlar — sıradaki fazlarda
> `features/` ve `admin/` altına eklenecekler.

## Gereksinimler

- Node.js 20+ (bu proje Node 26 üzerinde geliştirildi, ancak Cloud Functions
  runtime'ı Node 20'yi hedefler)
- Bir Firebase projesi ([console.firebase.google.com](https://console.firebase.google.com))
- (Opsiyonel, deploy için) `firebase-tools`: `npm install -g firebase-tools`

## 1. Firebase projesini hazırla

Firebase Console'da:

1. **Authentication** → Sign-in method → **E-posta/Şifre** ve **Google**
   sağlayıcılarını etkinleştir.
2. **Firestore Database** → veritabanı oluştur (production mode).
3. **Storage** → varsayılan bucket'ı etkinleştir.
4. **Project settings → General → Your apps** altında bir **Web app**
   ekle, açılan config nesnesini kopyala.

## 2. Config değerlerini yapıştır

`src/environments/environment.ts` **ve** `src/environments/environment.development.ts`
içindeki `firebase` alanını kendi projenin değerleriyle doldur:

```ts
firebase: {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...',
},
```

`.firebaserc` içindeki `TODO_PROJECT_ID`'yi de gerçek Firebase proje ID'n ile
değiştir (CLI komutlarının hangi projeye gideceğini belirler).

## 3. Kurulum ve çalıştırma

```bash
npm install
npm start
```

`http://localhost:4200` — kayıt ol, 14 günlük deneme otomatik başlar
(`users/{uid}` dokümanı `trial` durumuyla oluşturulur).

## 4. Cloud Functions

`createUserProfile` (kayıt anında trial profili oluşturur) ve `expireTrials`
(her gün 03:00 TR saatiyle süresi geçen denemeleri `expired` yapar) fonksiyonları
`functions/` altında.

```bash
cd functions
npm install
npm run build
```

Yerel test (emulator, gerçek Firebase projesine dokunmadan):

```bash
firebase emulators:start --only auth,firestore,functions
```

`src/environments/environment.development.ts` içinde `useEmulators: true`
yaparsan `ng serve` da otomatik olarak emulator'lara bağlanır.

Gerçek projeye deploy:

```bash
firebase deploy --only functions,firestore:rules,storage
```

## 5. Neden client + Cloud Function birlikte?

`AuthService`, kayıt olur olmaz `users/{uid}` dokümanını client'tan da
oluşturmayı dener (`createTrialProfileIfMissing`) — ama sadece doküman henüz
yoksa. Bu, Cloud Function henüz deploy edilmemişse (örn. bu adımı henüz
yapmadıysan) uygulamanın yine de çalışmasını sağlayan bir güvenlik ağıdır.
`firestore.rules`, bu client yazımını sıkı şekilde sınırlar: sadece kendi
`uid`'ine, sadece `role: 'user'` + `membershipStatus: 'trial'` şekliyle ve en
fazla 15 günlük bir `trialEndsAt` ile. `role`/`membershipStatus` alanlarının
**güncellenmesi** ise tamamen kapalı — bunu yalnızca Cloud Functions / admin
paneli (Admin SDK) yapabilir.

## Klasör yapısı

```
src/app/
├── core/           # AuthService, guard'lar, Firestore servisi, modeller
├── shared/         # Shell, bottom-nav, trial-badge, loading-spinner
├── features/       # auth (login/register), onboarding, dashboard
├── admin/          # Admin paneli (placeholder)
└── app.routes.ts

functions/src/
├── auth/create-user-profile.ts   # onCreate → trial profili
└── trial/expire-trials.ts        # scheduled → süresi geçenleri expired yap
```

## Sırada ne var?

- Paket satın alma (Stripe/Iyzico) → `/onboarding/trial-expired` şu an sadece
  placeholder kartlar gösteriyor.
- Dashboard'daki QR kod, e-cüzdan, antrenman özeti, su takibi, vücut ölçümleri.
- Ders/PT randevu takvimi.
- Admin paneli: üye listesi, paket yönetimi, gelir raporları.
