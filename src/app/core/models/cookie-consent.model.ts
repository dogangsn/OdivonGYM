export interface CookiePreferences {
  /** Zorunlu Çerezler: Oturum yönetimi, kimlik doğrulama, CSRF ve API güvenliği. Kapatılamaz. */
  essential: boolean;
  /** İşlevsel Çerezler: "Beni Hatırla" özelliği, e-posta hafızası, tema ve dil tercihleri. */
  functional: boolean;
  /** Analitik Çerezler: Sistem performans takibi, hata izleme ve yanıt süresi optimizasyonu. */
  analytics: boolean;
}

export interface CookieConsentRecord {
  /** Kullanıcı en az bir tercih setini kaydetti mi? */
  accepted: boolean;
  /** Detaylı çerez izin matrisi */
  preferences: CookiePreferences;
  /** Onay tarihi (ISO 8601) */
  consentedAt: string;
  /** Politika metin versiyonu */
  version: string;
}

export const DEFAULT_COOKIE_PREFERENCES: CookiePreferences = {
  essential: true,
  functional: true,
  analytics: true,
};

export const ESSENTIAL_ONLY_COOKIE_PREFERENCES: CookiePreferences = {
  essential: true,
  functional: false,
  analytics: false,
};
