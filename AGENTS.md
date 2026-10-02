# OdivonGYM Geliştirme ve Mimari Kuralları

## 1. Backend / API Katmanı Entegrasyonu
- **Backend Proje Konumu:** `C:\Users\dogan\Documents\Private\Project\OdivonMainApi`
- Bu proje (`OdivonGYM`), Odivon SaaS platformunun Angular frontend katmanıdır.
- `OdivonMainApi` projesi ise NestJS tabanlı ana API ve backend servis katmanıdır (Firebase Firestore, Worker ve REST API modülleri).

### Zorunlu Kural (Hatırlatma Gerekmeksizin):
- Frontend tarafında (`OdivonGYM`) yeni bir model, servis çağrısı, form alanı, API kontratı veya backend ile haberleşen herhangi bir özellik eklendiğinde/değiştirildiğinde:
  1. **Otomatik Kontrol:** Doğrudan `C:\Users\dogan\Documents\Private\Project\OdivonMainApi` dizini altındaki ilgili modüller (`src/modules/gym`, `src/modules/tenant`, `src/modules/identity`, vb.), controller'lar, DTO'lar ve servisler kontrol edilecektir.
  2. **Senkronizasyon:** İhtiyaç duyulan yeni endpoint'ler, veri alanları, validasyonlar veya DTO güncellemeleri `OdivonMainApi` projesinde de yapılacaktır.
  3. **Veri Modeli Uyumu:** Frontend modelleri (`src/app/core/models/*`) ile API DTO'ları ve Firestore veri yapıları tutarlı ve eksiksiz tutulacaktır.
  4. Kullanıcının bunu her seferinde tekrar hatırlatmasına gerek yoktur; backend bağımlılığı olan tüm işlemlerde `OdivonMainApi` projesi proaktif olarak incelenecek ve güncellenecektir.
