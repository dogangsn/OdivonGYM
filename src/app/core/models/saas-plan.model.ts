export type SaasPlanId = 'starter' | 'pro' | 'enterprise';
export type SaasBillingCycle = 'monthly' | 'yearly';
export type SaasSubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export interface SaasPlanFeature {
  name: string;
  included: boolean;
  note?: string;
}

export interface SaasPlanLimits {
  /** İzin verilen maksimum şube sayısı (9999 = Sınırsız) */
  maxBranches: number;
  /** İzin verilen maksimum aktif üye sayısı (999999 = Sınırsız) */
  maxMembers: number;
  /** İzin verilen personel / antrenör hesabı (9999 = Sınırsız) */
  maxStaff: number;
}

export interface SaasPlanFeatureKeys {
  aiAssistant: boolean;
  eInvoiceUyumsoft: boolean;
  campaignsCrm: boolean;
  multiBranch: boolean;
  turnstileApi: boolean;
  trainingWizard: boolean;
}

export interface SaasPlan {
  id: SaasPlanId;
  name: string;
  badge: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  savingsAnnual: string;
  limits: SaasPlanLimits;
  featureKeys: SaasPlanFeatureKeys;
  features: SaasPlanFeature[];
  highlighted: boolean;
  ctaText: string;
}

export interface GymSaasSubscription {
  tenantId: string;
  planId: SaasPlanId;
  billingCycle: SaasBillingCycle;
  status: SaasSubscriptionStatus;
  trialStartedAt?: string;
  trialEndsAt?: string;
  currentPeriodStartsAt?: string;
  currentPeriodEndsAt?: string;
  updatedAt?: string;
}

export const SAAS_PLANS_CONFIG: Record<SaasPlanId, SaasPlan> = {
  starter: {
    id: 'starter',
    name: 'Başlangıç',
    badge: 'BUTİK & TEK ŞUBE',
    tagline: 'Yeni açılan veya butik tek salonlar için temel operasyonel araçlar.',
    priceMonthly: 1490,
    priceYearly: 14900,
    savingsAnnual: '2 Ay Ücretsiz',
    limits: {
      maxBranches: 1,
      maxMembers: 250,
      maxStaff: 2,
    },
    featureKeys: {
      aiAssistant: false,
      eInvoiceUyumsoft: false,
      campaignsCrm: false,
      multiBranch: false,
      turnstileApi: false,
      trainingWizard: true,
    },
    features: [
      { name: '1 Şube Yönetimi', included: true },
      { name: '250 Aktif Üye Kapasitesi', included: true },
      { name: '2 Personel / Antrenör Hesabı', included: true },
      { name: 'QR & Barkod Turnike Geçişi', included: true },
      { name: 'Kasa & Manuel Ön Muhasebe', included: true },
      { name: 'Eğitim & Tanımlama Sihirbazı', included: true },
      { name: 'Kampanyalar & Mini CRM (SMS/WhatsApp)', included: false, note: 'Pro pakette' },
      { name: 'Uyumsoft E-Fatura Entegrasyonu', included: false, note: 'Pro pakette' },
      { name: 'Yapay Zeka (AI) Salon Asistanı', included: false, note: 'Enterprise pakette' },
      { name: 'Çoklu Şube Değiştirici', included: false, note: 'Pro pakette' },
    ],
    highlighted: false,
    ctaText: 'Başlangıç Paketine Geç',
  },
  pro: {
    id: 'pro',
    name: 'Profesyonel',
    badge: 'EN POPÜLER / ÖNERİLEN',
    tagline: 'Büyüyen spor kulüpleri, zincir adayları ve tam otomasyon isteyen salonlar.',
    priceMonthly: 2990,
    priceYearly: 29900,
    savingsAnnual: '2 Ay Ücretsiz + Öncelikli Destek',
    limits: {
      maxBranches: 3,
      maxMembers: 1000,
      maxStaff: 10,
    },
    featureKeys: {
      aiAssistant: false,
      eInvoiceUyumsoft: true,
      campaignsCrm: true,
      multiBranch: true,
      turnstileApi: true,
      trainingWizard: true,
    },
    features: [
      { name: '3 Şubeye Kadar Çoklu Şube Yönetimi', included: true },
      { name: '1.000 Aktif Üye Kapasitesi', included: true },
      { name: '10 Personel & Rol Yönetimi (Antrenör, Resepsiyon)', included: true },
      { name: 'Kampanyalar & Mini CRM (Push, SMS, WhatsApp, E-posta)', included: true },
      { name: 'Uyumsoft E-Fatura & E-Arşiv Otomasyonu', included: true },
      { name: 'Turnike & Donanım Entegrasyonları', included: true },
      { name: 'Grup Ders Takvimi & PT Randevuları', included: true },
      { name: 'Eğitim & Tanımlama Sihirbazı', included: true },
      { name: 'Gelişmiş Gelir/Gider & Finans Analitiği', included: true },
      { name: 'Yapay Zeka (AI) Salon Asistanı', included: false, note: 'Enterprise pakette' },
    ],
    highlighted: true,
    ctaText: 'Profesyonel Paketi Seç',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    badge: 'LİMİTSİZ & YAPAY ZEKA',
    tagline: 'Büyük zincirler, franchise kulüpler ve sınır tanımayan spor kompleksleri.',
    priceMonthly: 5990,
    priceYearly: 59900,
    savingsAnnual: '2 Ay Ücretsiz + Özel Hesap Temsilcisi',
    limits: {
      maxBranches: 9999,
      maxMembers: 999999,
      maxStaff: 9999,
    },
    featureKeys: {
      aiAssistant: true,
      eInvoiceUyumsoft: true,
      campaignsCrm: true,
      multiBranch: true,
      turnstileApi: true,
      trainingWizard: true,
    },
    features: [
      { name: 'Sınırsız Şube Yönetimi', included: true },
      { name: 'Sınırsız Aktif Üye Kapasitesi', included: true },
      { name: 'Sınırsız Personel & Özel Yetkilendirme', included: true },
      { name: 'Odivon Yapay Zeka (AI) Salon Asistanı', included: true },
      { name: 'Kampanyalar & Çok Kanallı Otomatik CRM', included: true },
      { name: 'Uyumsoft E-Fatura & Mali Mühür Entegrasyonu', included: true },
      { name: 'Özel Turnike, Yüz Tanıma & Donanım API Erişimi', included: true },
      { name: 'Özel Veri İzolasyonu & Gelişmiş SLA (%99.9)', included: true },
      { name: '7/24 Özel Müşteri Temsilcisi & VIP Destek', included: true },
      { name: 'Şubeler Arası Finansal Konsolidasyon', included: true },
    ],
    highlighted: false,
    ctaText: 'Enterprise Paketi Başlat',
  },
};
