import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GuideCategory, GuideService, GuideTopic } from '../../../core/services/guide.service';

export interface CategoryMeta {
  key: GuideCategory;
  title: string;
  icon: string;
  badge?: string;
  badgeColor?: string;
}

export const GUIDE_CATEGORIES: CategoryMeta[] = [
  { key: 'quickstart', title: 'Hızlı Başlangıç', icon: 'rocket_launch', badge: '3 Adım', badgeColor: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  { key: 'overview', title: 'Genel Bakış & Telemetri', icon: 'space_dashboard', badge: 'Canlı Radar', badgeColor: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  { key: 'members', title: 'Üye Yönetimi & Kayıt', icon: 'groups', badge: 'Turnike & RFID', badgeColor: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  { key: 'subscriptions', title: 'Abonelik & Üyelikler', icon: 'card_membership' },
  { key: 'packages', title: 'Paket & Fiyatlandırma', icon: 'sell', badge: 'Tarifeler', badgeColor: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  { key: 'accounting', title: 'Ön Muhasebe & Kasa', icon: 'account_balance', badge: 'Gelir/Gider', badgeColor: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  { key: 'receivables', title: 'Taksit & Borç Takibi', icon: 'event_repeat', badge: 'Tahsilat', badgeColor: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  { key: 'pos', title: 'Hızlı Satış / Kantin POS', icon: 'point_of_sale', badge: 'Barkod', badgeColor: 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30' },
  { key: 'products', title: 'Ürün & Fiyat Yönetimi', icon: 'inventory_2' },
  { key: 'stock', title: 'Stok & Depo Hareketleri', icon: 'fact_check', badge: 'Kritik Stok', badgeColor: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  { key: 'suppliers', title: 'Tedarikçiler & Sipariş', icon: 'local_shipping', badge: 'Onay Akışı', badgeColor: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  { key: 'staff', title: 'Personel & Antrenörler', icon: 'badge', badge: 'PT Primleri', badgeColor: 'bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30' },
  { key: 'access-control', title: 'Turnike & Geçiş Kontrolü', icon: 'door_front', badge: 'NFC / QR', badgeColor: 'bg-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-500/30' },
  { key: 'e-invoice', title: 'E-Fatura & E-Arşiv', icon: 'receipt_long', badge: 'GİB Onaylı', badgeColor: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  { key: 'campaigns', title: 'Kampanyalar & İndirimler', icon: 'local_offer' },
  { key: 'reports', title: 'Raporlar & Analitik', icon: 'bar_chart', badge: 'Ciro & Büyüme', badgeColor: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  { key: 'reminders', title: 'Hatırlatıcılar & SMS', icon: 'notifications_active' },
  { key: 'branches', title: 'Şube & Tesis Ayarları', icon: 'storefront' },
  { key: 'wizard', title: 'Antrenman Sihirbazı', icon: 'auto_awesome', badge: 'Şablonlar', badgeColor: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  { key: 'faq', title: 'Püf Noktaları & SSS', icon: 'help_outline', badge: 'Kısayollar', badgeColor: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30' },
];

export const GUIDE_TOPICS: GuideTopic[] = [
  // ── QUICKSTART ──
  {
    id: 'qs-1',
    category: 'quickstart',
    title: 'Adım 1: Paket & Üyelik Tarifelerini Tanımlayın',
    badge: '1. Adım',
    summary: 'Üyelerinize sunacağınız salon geneli üyelikleri (aylık, yıllık) veya antrenörlere özel seanslı PT paketlerini belirleyin.',
    steps: [
      {
        title: 'Paket & Fiyatlandırma Sayfasına Gidin',
        description: 'Sol menüden "Paketler" sekmesini açın veya aşağıdaki hızlı erişim butonuna tıklayın.',
        tip: 'Yeni Paket Ekle butonu ile süre (gün sayısı), fiyat ve seans sınırını girin.',
      },
      {
        title: 'Salon Geneli vs Personele Özel Paket Ayrımı',
        description: 'Salon üyeliği ise "Salon Geneli", kişisel antrenör dersi ise "Personele Özel" seçerek antrenör komisyon/prim oranını belirleyin.',
        tip: 'Ders başı hakediş yüzdesi otomatik olarak antrenörün hakediş cüzdanına işlenir.',
      },
    ],
    actionLink: { label: 'Paket Yönetimine Git →', route: '/admin/packages', icon: 'sell' },
  },
  {
    id: 'qs-2',
    category: 'quickstart',
    title: 'Adım 2: İlk Üyenizi Ekleyin ve Turnike Kartı Eşleştirin',
    badge: '2. Adım',
    summary: 'Yeni üye kaydı oluştururken T.C. kimlik, paket seçimi, peşinat/taksitlendirme ve RFID turnike kartını tek ekrandan tanımlayın.',
    steps: [
      {
        title: 'Üye Kayıt Formunu Açın',
        description: 'Üye Yönetimi ekranında "Yeni Üye Kaydı" butonuna tıklayın.',
        tip: '11 haneli T.C. kimlik numarası girildiğinde sistem mükerrer kayıt kontrolünü anında yapar.',
      },
      {
        title: 'Paket Bedeli & Tahsil Edilen Tutarı Girin',
        description: 'Tahsil edilen rakam paket bedelinden küçükse kalan tutar üyenin borç cüzdanına otomatik taksitlendirilir.',
      },
      {
        title: 'Turnike Kartını Tanımlayın',
        description: 'Turnikeye okutulan kartı "Turnikeden Getir" butonuyla saniyeler içinde üyeye atayın.',
        tip: 'Üye artık kartını okuttuğu anda turnike otomatik olarak açılır ve salondaki canlı sayaç artar.',
      },
    ],
    actionLink: { label: 'Üye Yönetimini Aç →', route: '/admin/members', icon: 'groups' },
  },
  {
    id: 'qs-3',
    category: 'quickstart',
    title: 'Adım 3: Kasa, POS Satışı & Günlük Raporları İnceleyin',
    badge: '3. Adım',
    summary: 'Yapılan her tahsilat, kantin harcaması ve gider kalemi otomatik olarak ön muhasebe ve analitik paneline yansır.',
    steps: [
      {
        title: 'Ön Muhasebe Ekranını İnceleyin',
        description: 'Kasa & Banka sekmesinden günlük net nakit akışını ve tahsilat kalemlerini takip edin.',
        tip: 'Her tahsilat kaydından "Faturalandır" butonu ile Uyumsoft GİB e-fatura oluşturabilirsiniz.',
      },
      {
        title: 'Kantin POS ile Hızlı Satış Yapın',
        description: 'Kantin/bar satışında barkod okutarak su, protein bar veya takviye gıdaları nakit/kart veya üyenin bakiyesinden tahsil edin.',
      },
    ],
    actionLink: { label: 'Ön Muhasebeyi Aç →', route: '/admin/accounting', icon: 'account_balance' },
  },

  // ── OVERVIEW ──
  {
    id: 'ov-1',
    category: 'overview',
    title: 'Genel Bakış & Canlı Salon Telemetrisi',
    badge: 'Dashboard',
    summary: 'Salonun o anki doluluk oranını, aktif sporcuları, günlük ciroyu ve acil aksiyon bekleyen işlemleri tek bakışta izleyin.',
    steps: [
      {
        title: 'Canlı Turnike & Doluluk Radarı',
        description: 'Turnikeden giriş yapmış ve içeride bulunan sporcu sayısı anlık güncellenir. Maksimum kapasite doluluk oranını takip edebilirsiniz.',
        tip: 'Akşam yoğun saatlerde turnike geçiş hızı ve içerideki sporcu sayısı grafiksel olarak gösterilir.',
      },
      {
        title: 'Finansal KPI Kartları',
        description: 'Bugünün kasaya giren nakit/kart cirosu, vadesi gelen taksit alacakları ve yeni kayıt sayılarını görün.',
      },
      {
        title: 'Onay Bekleyen İşlemler',
        description: 'Personelden gelen tedarik siparişi talepleri veya sporculardan gelen antrenman istekleri en üstte uyarı olarak listelenir.',
      },
    ],
    actionLink: { label: 'Genel Bakışa Git →', route: '/admin/overview', icon: 'space_dashboard' },
  },

  // ── MEMBERS ──
  {
    id: 'mem-1',
    category: 'members',
    title: 'Kapsamlı Üye Yönetimi & Kayıt Süreci',
    badge: 'Kritik',
    summary: 'Üye profili, 5 haneli üye takip kodu, sorumlu antrenör, tahsilat, taksit planı, RFID kart ve sağlık/KVKK verileri.',
    steps: [
      {
        title: 'Kişisel Bilgiler & Mükerrer Kontrolü',
        description: 'Ad, soyad, telefon ve 11 haneli T.C. Kimlik No girilir. Sistem aynı T.C. ile daha önce kayıt varsa anında uyarır.',
        tip: 'Profil fotoğrafını sürükleyip bırakarak yükleyebilirsiniz (Maks. 5 MB).',
      },
      {
        title: 'Sorumlu Antrenör & Şube Ataması',
        description: 'Üyeyle ilgilenecek kişisel antrenör veya sorumlu fitness eğitmeni atanır.',
      },
      {
        title: 'Paket Seçimi & Kasa Entegrasyonu',
        description: 'Seçilen paketin bedeli ve üyeden tahsil edilen tutar girilir. Fark varsa sistem otomatik olarak cüzdana borç yazar ve taksit planı açar.',
      },
      {
        title: 'Turnike RFID Kartı & Depozito',
        description: 'Mifare / 125kHz RFID turnike kart numarası girilir. Kart için alınan depozito kasaya işlenir.',
        tip: '"Turnikeden Getir" butonu turnikeye okutulmuş en son tanımsız kart numarasını otomatik olarak çeker.',
      },
      {
        title: 'Sağlık, Acil Durum & 6698 KVKK Onayları',
        description: 'Acil durumda aranacak yakının bilgileri, alerjiler, kronik hastalıklar ve KVKK/Ticari ileti onayları kaydedilir.',
      },
    ],
    actionLink: { label: 'Üyeler Ekranını Aç →', route: '/admin/members', icon: 'groups' },
  },

  // ── SUBSCRIPTIONS ──
  {
    id: 'sub-1',
    category: 'subscriptions',
    title: 'Abonelik & Üyelik Süre Takibi',
    badge: 'Otomasyon',
    summary: 'Aktif, dondurulmuş ve süresi dolan üyelikleri filtreleyin; süre uzatma, paket dondurma ve iptal işlemlerini yönetin.',
    steps: [
      {
        title: 'Süresi Yaklaşan Üyelikler',
        description: 'Paket bitimine 3, 7 veya 15 gün kalan üyeleri tek tıkla listeleyin.',
        tip: 'Otomatik SMS/WhatsApp hatırlatıcıları ile üyeye yenileme teklifi gönderilebilir.',
      },
      {
        title: 'Üyelik Dondurma (Freeze)',
        description: 'Sağlık raporu veya seyahat sebebiyle üyelik belirlenen gün kadar dondurulur; bitiş tarihi otomatik ertelenir.',
      },
    ],
    actionLink: { label: 'Abonelikleri İncele →', route: '/admin/subscriptions', icon: 'card_membership' },
  },

  // ── PACKAGES ──
  {
    id: 'pkg-1',
    category: 'packages',
    title: 'Paket & Fiyatlandırma Yönetimi',
    badge: 'Tarife',
    summary: 'Salon geneli üyelikler ile personele/eğitmene özel seans paketlerini, prim oranlarını ve çoklu şube kurallarını yönetin.',
    steps: [
      {
        title: 'Paket Türü & Süre',
        description: 'Paketin geçerlilik süresi (örn. 30 gün, 90 gün, 365 gün) ve seans hakkı (örn. Sınırsız veya 10 Ders) belirlenir.',
      },
      {
        title: 'Hakediş & Prim Oranları',
        description: 'Eğitmene özel PT paketlerinde satış fiyatı üzerinden antrenöre ödenecek net tutar veya prim yüzdesi tanımlanır.',
        tip: 'Böylece muhasebede antrenörün aylık hak ettiği primler otomatik toplanır.',
      },
    ],
    actionLink: { label: 'Paketleri Düzenle →', route: '/admin/packages', icon: 'sell' },
  },

  // ── ACCOUNTING ──
  {
    id: 'acc-1',
    category: 'accounting',
    title: 'Ön Muhasebe, Kasa & Faturalandırma',
    badge: 'Finans',
    summary: 'Nakit, POS, Havale/EFT hareketleri, gelir/gider kayıtları, faturalandırma kısayolu ve günlük kasa mutabakatı.',
    steps: [
      {
        title: 'Kasa & Banka Bakiyesi',
        description: 'Tüm nakit ve kartlı tahsilatlar kasada toplanır. Günlük net ciro anlık hesaplanır.',
      },
      {
        title: 'Gider ve Masraf Kaydı',
        description: 'Kira, elektrik, personel avansı, temizlik malzemesi gibi gider kalemleri fatura/fiş eklenerek işlenir.',
      },
      {
        title: 'Faturalandırma Kısayolu ile Kayıt Oluşturma',
        description: 'Herhangi bir tahsilat kaydının yanındaki "Faturalandır" butonu ile tek tıkla vergi dairesi/GİB onaylı e-arşiv faturası kesilir.',
        tip: 'Müşteri T.C./VKN ve tutar otomatik aktarılır; manuel veri girişi gerekmez.',
      },
    ],
    actionLink: { label: 'Ön Muhasebeye Git →', route: '/admin/accounting', icon: 'account_balance' },
  },

  // ── RECEIVABLES ──
  {
    id: 'rec-1',
    category: 'receivables',
    title: 'Taksit & Borç Takibi (Alacaklar)',
    badge: 'Tahsilat',
    summary: 'Üyelerin kalan paket borçları, taksit vadeleri, geciken ödemeler ve tek tıkla borç kapama.',
    steps: [
      {
        title: 'Vade Planı İnceleme',
        description: 'Hangi üyenin hangi tarihte ne kadar borcu olduğunu ve vadesi geçen tutarları kronolojik olarak inceleyin.',
      },
      {
        title: 'Tek Tıkla Tahsilat Alma',
        description: 'Üye salona geldiğinde borcun tamamını veya bir kısmını Nakit/Kart ile tahsil edip cüzdan borcunu güncelleyin.',
        tip: 'Tahsilat alındığı an otomatik olarak Ön Muhasebe kasasına gelir kaydı olarak düşer.',
      },
    ],
    actionLink: { label: 'Taksit & Borç Ekranını Aç →', route: '/admin/receivables', icon: 'event_repeat' },
  },

  // ── POS ──
  {
    id: 'pos-1',
    category: 'pos',
    title: 'Hızlı Satış & Kantin/Bar POS',
    badge: 'Barkod',
    summary: 'Spor salonu kantini, barı ve mağazasındaki ürünlerin barkodla hızlı satışı ve anlık tahsilatı.',
    steps: [
      {
        title: 'Barkod Okutarak Sepete Ekleme',
        description: 'Su, maden suyu, protein tozu, protein bar veya havlu gibi ürünlerin barkodunu okutun.',
      },
      {
        title: 'Ödeme Alma ve Fiş Dökümü',
        description: 'Ödemeyi Nakit, Kredi Kartı veya üyenin bakiyesinden tahsil ederek satışı tamamlayın.',
        tip: 'Satış yapıldığında ürün stoğu otomatik düşer; kritik seviyenin altına indiğinde yöneticiye bildirim gider.',
      },
    ],
    actionLink: { label: 'Kantin POS Ekranını Aç →', route: '/admin/shop', icon: 'point_of_sale' },
  },

  // ── PRODUCTS & STOCK ──
  {
    id: 'stk-1',
    category: 'products',
    title: 'Ürün & Hizmet Kataloğu Tanımlama',
    badge: 'Envanter',
    summary: 'Salonda satılan kantin ürünleri, içecekler, spor ekipmanları ve seans dışı ek hizmetlerin katalog yönetimi.',
    steps: [
      {
        title: 'Yeni Ürün Tanımlama',
        description: 'Ürün adı, barkod, kategori, birim alış fiyatı ve satış fiyatı girilir.',
        tip: 'Kritik stok uyarısı eşiği (örn. 5 adet) belirlendiğinde sistem stok azaldığında uyarı verir.',
      },
    ],
    actionLink: { label: 'Ürün Yönetimine Git →', route: '/admin/products', icon: 'inventory_2' },
  },
  {
    id: 'stk-2',
    category: 'stock',
    title: 'Stok Hareketleri, Sayım & Depo Girişi',
    badge: 'Depo',
    summary: 'Tedarikçiden gelen malların kabulü, depo giriş/çıkış fişleri, zayi kayıtları ve periyodik sayım mutabakatı.',
    steps: [
      {
        title: 'Mal Kabul ve Stok Girişi',
        description: 'Tedarikçiden gelen ürün faturasına göre adet ve birim maliyet kaydedilir; stok miktarı artırılır.',
      },
      {
        title: 'Stok Sayımı ve Düzeltme',
        description: 'Haftalık veya aylık fiziksel sayım ile sistem stoğu arasındaki farklar sayım fişiyle eşitlenir.',
      },
    ],
    actionLink: { label: 'Stok Yönetimine Git →', route: '/admin/stock', icon: 'fact_check' },
  },

  // ── SUPPLIERS ──
  {
    id: 'sup-1',
    category: 'suppliers',
    title: 'Tedarikçi Yönetimi & Sipariş Onay Süreci',
    badge: 'Sipariş',
    summary: 'Tedarikçi cari kartları, personel (PT/sekreter) ürün talep sistemi, patron onay mekanizması ve sipariş süreci.',
    steps: [
      {
        title: 'Personel Ürün Talebi Açma',
        description: 'Eğitmen veya resepsiyon personeli tükenen protein tozu, havlu veya temizlik maddesi için sistemden talep oluşturur.',
      },
      {
        title: 'Patron / Yönetici Onayı',
        description: 'Talep yönetici onay paneline düşer. Yönetici talep edilen miktarı ve tahmini maliyeti inceleyip tek tıkla onaylar.',
        tip: 'Onaylanan talepler doğrudan tedarikçiye resmi satın alma siparişi olarak iletilir.',
      },
      {
        title: 'Mal Kabul & Faturanın Muhasebeye İşlenmesi',
        description: 'Sipariş ulaştığında mal kabul yapılır ve fatura otomatik olarak Ön Muhasebe giderlerine yansıtılır.',
      },
    ],
    actionLink: { label: 'Tedarikçileri İncele →', route: '/admin/suppliers', icon: 'local_shipping' },
  },

  // ── STAFF ──
  {
    id: 'stf-1',
    category: 'staff',
    title: 'Personel, Antrenör & PT Prim Yönetimi',
    badge: 'İnsan Kaynakları',
    summary: 'Salon eğitmenleri, resepsiyon kadrosu, özel ders hakediş primleri, çalışma takvimi ve yetkilendirme.',
    steps: [
      {
        title: 'Personel Kartı ve Rol Tanımlama',
        description: 'Antrenör, Resepsiyon, Muhasebe veya Şube Müdürü rolleri belirlenerek yetki kısıtlamaları atanır.',
      },
      {
        title: 'Ders Başı ve Satış Başı Prim Oranları',
        description: 'Eğitmenin girdiği birebir PT seansı başına veya sattığı üyelik paketinden alacağı yüzde tanımlanır.',
        tip: 'Ay sonunda antrenörün verdiği toplam dersler ve hak ettiği prim bordrosu tek tıkla hesaplanır.',
      },
    ],
    actionLink: { label: 'Personel Yönetimine Git →', route: '/admin/staff', icon: 'badge' },
  },

  // ── ACCESS CONTROL ──
  {
    id: 'acc-ctrl-1',
    category: 'access-control',
    title: 'Turnike & Geçiş Kontrol Otomasyonu',
    badge: 'Donanım',
    summary: 'NFC/RFID kart okuyucuları, turnike röle kontrolü, dijital QR kod geçişi ve kaçak giriş engelleme.',
    steps: [
      {
        title: 'Turnike Kart Okutma',
        description: 'Sporcu kartını okuttuğunda sistem üyeliğin aktifliğini ve borç durumunu milisaniyeler içinde kontrol eder.',
      },
      {
        title: 'Kural Tabanlı Geçiş İzni',
        description: 'Üyeliği bitmiş veya gecikmiş borcu olan üyelerin geçişi engellenir; ekranda uyarı mesajı gösterilir.',
        tip: 'Yöneticiler acil durumlarda ekran üzerinden "Turnikeyi Aç" butonuyla röleyi uzaktan tetikleyebilir.',
      },
    ],
    actionLink: { label: 'Turnike Panelini Aç →', route: '/admin/access-control', icon: 'door_front' },
  },

  // ── E-INVOICE ──
  {
    id: 'einv-1',
    category: 'e-invoice',
    title: 'E-Fatura & E-Arşiv (Uyumsoft / GİB)',
    badge: 'Mevzuat',
    summary: 'Gelir İdaresi Başkanlığı (GİB) onaylı resmi e-fatura ve e-arşiv fatura kesimi, PDF indirme ve e-posta gönderimi.',
    steps: [
      {
        title: 'Uyumsoft Entegrasyonu',
        description: 'Kullanıcı adı ve API şifresi girilerek fatura serisi ve şablonu sisteme bağlanır.',
      },
      {
        title: 'Tek Tıkla Fatura Kesme',
        description: 'Üye paket satışından veya ön muhasebeden vergi/KDV oranları otomatik hesaplanarak anında faturalandırılır.',
        tip: 'Fatura oluşturulduğu anda müşterinin kayıtlı e-posta adresine PDF olarak otomatik iletilir.',
      },
    ],
    actionLink: { label: 'E-Fatura Ekranına Git →', route: '/admin/e-invoice', icon: 'receipt_long' },
  },

  // ── CAMPAIGNS ──
  {
    id: 'cmp-1',
    category: 'campaigns',
    title: 'Kampanyalar, İndirim Kodları & Sadakat',
    badge: 'Pazarlama',
    summary: 'Erken kayıt avantajları, arkadaşını getir kampanyaları ve dönemsel indirim kuponlarının yönetimi.',
    steps: [
      {
        title: 'İndirim Kuponu Oluşturma',
        description: 'Yüzdesel (örn. %20) veya sabit tutar (örn. 500 ₺) indirim kodu tanımlanarak geçerlilik tarihi belirlenir.',
      },
    ],
    actionLink: { label: 'Kampanyaları Yönet →', route: '/admin/campaigns', icon: 'local_offer' },
  },

  // ── REPORTS ──
  {
    id: 'rep-1',
    category: 'reports',
    title: 'Raporlar, Analitik & Ciro İstatistikleri',
    badge: 'Analiz',
    summary: 'Aylık ciro grafikleri, üye büyüme ve kayıp (churn) oranları, antrenör ders performansları ve Excel dışa aktarma.',
    steps: [
      {
        title: 'Gelir & Ciro Dağılımı',
        description: 'Paket satışları, kantin harcamaları ve özel ders gelirleri grafiksel olarak karşılaştırılır.',
      },
      {
        title: 'Popüler Saatler & Salon Yoğunluğu',
        description: 'Haftanın hangi gün ve saatlerinde salonun daha yoğun olduğu analiz edilerek personel vardiyaları düzenlenir.',
        tip: 'Tüm raporlar Excel ve PDF formatında tek tıkla dışa aktarılabilir.',
      },
    ],
    actionLink: { label: 'Raporlar Ekranını Aç →', route: '/admin/reports', icon: 'bar_chart' },
  },

  // ── REMINDERS ──
  {
    id: 'rem-1',
    category: 'reminders',
    title: 'Otomatik Hatırlatıcılar & SMS Bildirimleri',
    badge: 'İletişim',
    summary: 'Üyelik bitiş uyarısı, taksit vadesi hatırlatması ve salona gelmeyen üyelere özel motivasyon SMS şablonları.',
    steps: [
      {
        title: 'Şablon Tanımlama',
        description: 'Netgsm, İletiMerkezi gibi SMS sağlayıcıları ile entegre dinamik mesaj şablonları hazırlanır.',
      },
    ],
    actionLink: { label: 'Hatırlatıcıları Yönet →', route: '/admin/reminders', icon: 'notifications_active' },
  },

  // ── BRANCHES ──
  {
    id: 'brn-1',
    category: 'branches',
    title: 'Şube & Çoklu Tesis Yönetimi',
    badge: 'Çoklu Şube',
    summary: 'Zincir spor salonları ve birden fazla şubesi olan kulüpler için merkezi yönetim ve şubeler arası geçiş.',
    steps: [
      {
        title: 'Üst Bar Şube Değiştirici',
        description: 'Üst menüdeki şube rozetine tıklayarak anında Kadıköy, Beşiktaş veya Merkez şubenin verilerine geçiş yapabilirsiniz.',
        tip: 'Yetkili kullanıcılar tüm şubelerin cirosunu ve üye sayılarını tek ekranda konsolide görebilir.',
      },
    ],
    actionLink: { label: 'Şubeleri Yönet →', route: '/admin/branches', icon: 'storefront' },
  },

  // ── WIZARD ──
  {
    id: 'wiz-1',
    category: 'wizard',
    title: 'Antrenman & Program Sihirbazı',
    badge: 'Antrenman',
    summary: 'Sporcunun hedefine, seviyesine ve haftalık gün sayısına göre 3 adımda kişiselleştirilmiş program hazırlama.',
    steps: [
      {
        title: 'Hedef ve Seviye Seçimi',
        description: 'Kilo verme, hipertrofi (kas kazanımı), kuvvet veya kondisyon hedeflerine göre egzersiz şablonları yüklenir.',
      },
      {
        title: 'Günlük Egzersiz & Set/Tekrar Ayarı',
        description: 'Göğüs, Sırt, Omuz, Bacak ve Kol bölgeleri için katalogdan egzersizler sürüklenip bırakılır.',
        tip: 'Hazırlanan program anında sporcunun mobil uygulamasına düşer ve sporcu salonda seansını takip edebilir.',
      },
    ],
    actionLink: { label: 'Program Sihirbazını Aç →', route: '/admin/wizard', icon: 'auto_awesome' },
  },

  // ── FAQ ──
  {
    id: 'faq-1',
    category: 'faq',
    title: 'Klavye Kısayolları ve Hızlı Erişim',
    badge: 'Pratik',
    summary: 'Klavyeden elinizi kaldırmadan sistemi ışık hızında kullanmanızı sağlayan global kısayollar.',
    steps: [
      {
        title: 'Alt + 1 ... 9 ile Sayfa Kısayolları',
        description: 'Üst menüdeki şimşek simgesinden kendi en çok kullandığınız ekranları kaydedip Alt+1, Alt+2 gibi tuşlarla anında açabilirsiniz.',
      },
      {
        title: '⌘K veya Ctrl+K ile Hızlı Arama',
        description: 'İstediğiniz üyeyi, paketi veya ekranı klavyeden birkaç harf yazarak anında bulun.',
      },
      {
        title: 'Uygulama Ekran Kilidi (PIN)',
        description: 'Resepsiyondan veya masadan kalktığınızda üst bardaki kilit simgesine basarak ekranı 4 haneli PIN ile kilitleyebilirsiniz.',
        tip: 'Karanlık (Dark) ve Aydınlık (Light) tema tercihi her cihaz için yerel olarak hatırlanır.',
      },
    ],
  },
];

@Component({
  selector: 'app-guide-modal',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (guide.isOpen()) {
      <div
        class="font-sans fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 transition-all animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        (click)="onBackdropClick($event)"
      >
        <div
          class="w-full max-w-5xl h-[95vh] max-h-[880px] bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl shadow-indigo-500/10 dark:shadow-black/70 border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden relative transition-all animate-in zoom-in-95 duration-200"
          (click)="$event.stopPropagation()"
        >
          <!-- Top Ambient Gradient Bar -->
          <div class="h-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 shrink-0"></div>

          <!-- Header Strip -->
          <div class="p-3.5 sm:p-5 pb-3 sm:pb-4 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3 sm:gap-4 shrink-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
            <div class="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/25">
                <mat-icon class="icon-size-5 sm:icon-size-6">menu_book</mat-icon>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 id="guide-title" class="m-0 text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                    OdivonGYM Kullanım Kılavuzu
                  </h2>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-2xs">
                    EĞİTİM
                  </span>
                  <span class="hidden md:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    Ekran Anlatımı & Özellikler
                  </span>
                </div>
                <p class="mt-0.5 mb-0 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                  Salonunuzun tüm ekranlarını, özelliklerini ve iş akışlarını en verimli şekilde yönetin
                </p>
              </div>
            </div>

            <!-- Search Bar + Close Button -->
            <div class="flex items-center gap-2 shrink-0">
              <div class="relative w-40 sm:w-64 hidden sm:block">
                <mat-icon class="absolute left-3 top-1/2 -translate-y-1/2 icon-size-4 text-slate-400 pointer-events-none">search</mat-icon>
                <input
                  type="search"
                  [value]="guide.searchQuery()"
                  (input)="onSearchInput($event)"
                  placeholder="Kılavuzda veya ekranda ara… (örn. kasa, taksit, rfid)"
                  class="w-full h-9 pl-9 pr-3 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <button
                type="button"
                (click)="guide.close()"
                class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-200/50 dark:border-slate-700/60"
                title="Kılavuzu Kapat (Esc)"
                aria-label="Kapat"
              >
                <mat-icon class="icon-size-4.5">close</mat-icon>
              </button>
            </div>
          </div>

          <!-- Mobile Search Bar (Only visible on mobile screens) -->
          <div class="sm:hidden px-3 pt-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800/80 shrink-0">
            <div class="relative w-full">
              <mat-icon class="absolute left-3 top-1/2 -translate-y-1/2 icon-size-4 text-slate-400 pointer-events-none">search</mat-icon>
              <input
                type="search"
                [value]="guide.searchQuery()"
                (input)="onSearchInput($event)"
                placeholder="Konu, ekran veya özellik ara…"
                class="w-full h-8 pl-9 pr-3 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <!-- Body: Two Column Layout (Sidebar Navigation + Content Area) -->
          <div class="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            <!-- Left Category Menu -->
            <nav
              class="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800/80 p-2 sm:p-2.5 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-1 shrink-0 custom-scroll bg-slate-50/60 dark:bg-slate-900/40"
              aria-label="Kılavuz kategorileri"
            >
              @for (cat of categories; track cat.key) {
                @let isCurrent = guide.activeCategory() === cat.key && !guide.searchQuery().trim();
                <button
                  type="button"
                  (click)="selectCategory(cat.key)"
                  class="flex items-center gap-2 px-2.5 py-2 sm:py-2.5 rounded-xl text-left text-xs font-bold transition-all shrink-0 cursor-pointer border border-transparent"
                  [class]="
                    isCurrent
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/80'
                  "
                >
                  <mat-icon class="icon-size-4 shrink-0" [class]="isCurrent ? 'text-white' : 'text-slate-400 dark:text-slate-500'">{{ cat.icon }}</mat-icon>
                  <span class="flex-1 whitespace-nowrap truncate">{{ cat.title }}</span>
                  @if (cat.badge) {
                    <span
                      class="px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase tracking-wider border shrink-0"
                      [class]="isCurrent ? 'bg-white/20 text-white border-white/30' : (cat.badgeColor || 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400')"
                    >
                      {{ cat.badge }}
                    </span>
                  }
                </button>
              }
            </nav>

            <!-- Right Content Area -->
            <main class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-7 custom-scroll bg-slate-50/80 dark:bg-[#0b1120]">
              <!-- Active Category Header -->
              <div class="mb-5 sm:mb-6 flex flex-wrap items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-200/80 dark:border-slate-800">
                <div class="flex items-center gap-3">
                  <span class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <mat-icon class="icon-size-5">{{ currentCategoryMeta().icon }}</mat-icon>
                  </span>
                  <div>
                    <h3 class="m-0 text-sm sm:text-base lg:text-lg font-black text-slate-900 dark:text-white">
                      {{ guide.searchQuery().trim() ? 'Arama Sonuçları' : currentCategoryMeta().title }}
                    </h3>
                    <p class="m-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {{ guide.searchQuery().trim() ? ('"' + guide.searchQuery() + '" ile eşleşen ekran özellikleri') : 'Ekran detayları, pratik kullanım adımları ve ipuçları' }}
                    </p>
                  </div>
                </div>

                @if (guide.searchQuery().trim()) {
                  <button
                    type="button"
                    (click)="clearSearch()"
                    class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer bg-transparent border-none p-0"
                  >
                    Aramayı Temizle ×
                  </button>
                }
              </div>

              <!-- Topic Cards Grid -->
              <div class="space-y-4 sm:space-y-6">
                @for (topic of filteredTopics(); track topic.id) {
                  <article class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
                    <div class="flex flex-wrap items-start justify-between gap-2.5 mb-2.5">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h4 class="m-0 text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                          {{ topic.title }}
                        </h4>
                        @if (topic.badge) {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {{ topic.badge }}
                          </span>
                        }
                      </div>

                      @if (topic.actionLink) {
                        <a
                          [routerLink]="topic.actionLink.route"
                          (click)="guide.close()"
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors no-underline shadow-2xs cursor-pointer"
                        >
                          <mat-icon class="icon-size-3.5">{{ topic.actionLink.icon }}</mat-icon>
                          <span>{{ topic.actionLink.label }}</span>
                        </a>
                      }
                    </div>

                    <p class="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-3.5">
                      {{ topic.summary }}
                    </p>

                    <!-- Steps List -->
                    <div class="space-y-2.5 pt-1">
                      @for (step of topic.steps; track step.title; let idx = $index) {
                        <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                          <span class="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                            {{ idx + 1 }}
                          </span>
                          <div class="min-w-0 flex-1">
                            <div class="text-xs font-bold text-slate-900 dark:text-white mb-0.5">
                              {{ step.title }}
                            </div>
                            <p class="m-0 text-xs text-slate-600 dark:text-slate-300 leading-normal">
                              {{ step.description }}
                            </p>
                            @if (step.tip) {
                              <div class="mt-2 flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                <mat-icon class="icon-size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">lightbulb</mat-icon>
                                <span>{{ step.tip }}</span>
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </article>
                } @empty {
                  <div class="p-10 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <mat-icon class="icon-size-10 text-slate-300 dark:text-slate-600">search_off</mat-icon>
                    <div class="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                      "{{ guide.searchQuery() }}" ile ilgili bir konu bulunamadı
                    </div>
                    <p class="mt-1 text-xs text-slate-500">
                      Farklı bir anahtar kelime deneyin veya sol menüden ilgili ekran kategorisini seçin.
                    </p>
                    <button
                      type="button"
                      (click)="clearSearch()"
                      class="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer border-none"
                    >
                      Aramayı Temizle
                    </button>
                  </div>
                }
              </div>

              <!-- Quick Assistance Footer Note -->
              <div class="mt-7 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-sky-500/10 border border-indigo-200/80 dark:border-indigo-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <mat-icon class="icon-size-4.5">support_agent</mat-icon>
                  </div>
                  <div>
                    <div class="text-xs font-bold text-slate-900 dark:text-white">Ekstra Yardıma veya Eğitime mi İhtiyacınız Var?</div>
                    <div class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">OdivonGYM Destek ekibimiz salonunuzun yanındadır.</div>
                  </div>
                </div>
                <a
                  href="mailto:destek@odivon.com?subject=OdivonGYM%20Destek%20ve%20Egitim%20Talebi"
                  class="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors no-underline shadow-2xs shrink-0"
                >
                  Destek Ekibine Yazın
                </a>
              </div>
            </main>
          </div>
        </div>
      </div>
    }
  `,
})
export class GuideModal {
  protected readonly guide = inject(GuideService);
  protected readonly categories = GUIDE_CATEGORIES;
  private readonly router = inject(Router);

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.guide.close();
    }
  }

  protected onSearchInput(event: Event): void {
    this.guide.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.guide.searchQuery.set('');
  }

  protected selectCategory(category: GuideCategory): void {
    this.guide.selectCategory(category);
    this.guide.searchQuery.set('');
  }

  protected readonly currentCategoryMeta = computed(() => {
    return GUIDE_CATEGORIES.find((c) => c.key === this.guide.activeCategory()) ?? GUIDE_CATEGORIES[0];
  });

  protected readonly filteredTopics = computed(() => {
    const q = this.guide.searchQuery().trim().toLocaleLowerCase('tr');
    if (q) {
      return GUIDE_TOPICS.filter(
        (t) =>
          t.title.toLocaleLowerCase('tr').includes(q) ||
          t.summary.toLocaleLowerCase('tr').includes(q) ||
          t.steps.some(
            (s) =>
              s.title.toLocaleLowerCase('tr').includes(q) ||
              s.description.toLocaleLowerCase('tr').includes(q) ||
              (s.tip && s.tip.toLocaleLowerCase('tr').includes(q)),
          ),
      );
    }
    return GUIDE_TOPICS.filter((t) => t.category === this.guide.activeCategory());
  });
}
