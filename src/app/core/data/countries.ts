export type SupportedLanguage = 'tr' | 'en' | 'ru' | 'nl' | 'fr';

export interface Country {
  /** ISO 3166-1 alpha-2. */
  code: string;
  /** Türkçe görünen ad (arayüz henüz seçilen dile geçmeden önce de okunabilir olsun diye). */
  name: string;
  /** Telefon çevirme kodu, "+" dahil. */
  dialCode: string;
  /** Bu ülke seçildiğinde arayüzün otomatik geçeceği dil — desteklenmeyenler için 'en'. */
  language: SupportedLanguage;
}

/**
 * Kayıt formundaki ülke/telefon-kodu seçici ve otomatik dil seçimi için tek
 * kaynak. ISO 3166-1'e göre pratikte karşılaşılan ülkelerin tamamına yakınını
 * kapsar; `language`, sadece §Kayıt formundaki 5 desteklenen dile
 * (tr/en/ru/nl/fr) eşlenir — bu beşin dışındaki her ülke 'en'e düşer.
 */
export const COUNTRIES: Country[] = [
  { code: 'TR', name: 'Türkiye', dialCode: '+90', language: 'tr' },
  { code: 'US', name: 'Amerika Birleşik Devletleri', dialCode: '+1', language: 'en' },
  { code: 'GB', name: 'Birleşik Krallık', dialCode: '+44', language: 'en' },
  { code: 'DE', name: 'Almanya', dialCode: '+49', language: 'en' },
  { code: 'FR', name: 'Fransa', dialCode: '+33', language: 'fr' },
  { code: 'NL', name: 'Hollanda', dialCode: '+31', language: 'nl' },
  { code: 'BE', name: 'Belçika', dialCode: '+32', language: 'nl' },
  { code: 'RU', name: 'Rusya', dialCode: '+7', language: 'ru' },
  { code: 'KZ', name: 'Kazakistan', dialCode: '+7', language: 'ru' },
  { code: 'BY', name: 'Belarus', dialCode: '+375', language: 'ru' },
  { code: 'UA', name: 'Ukrayna', dialCode: '+380', language: 'ru' },
  { code: 'AZ', name: 'Azerbaycan', dialCode: '+994', language: 'tr' },
  { code: 'CY', name: 'Kıbrıs', dialCode: '+357', language: 'tr' },
  { code: 'IT', name: 'İtalya', dialCode: '+39', language: 'en' },
  { code: 'ES', name: 'İspanya', dialCode: '+34', language: 'en' },
  { code: 'PT', name: 'Portekiz', dialCode: '+351', language: 'en' },
  { code: 'CH', name: 'İsviçre', dialCode: '+41', language: 'fr' },
  { code: 'AT', name: 'Avusturya', dialCode: '+43', language: 'en' },
  { code: 'LU', name: 'Lüksemburg', dialCode: '+352', language: 'fr' },
  { code: 'IE', name: 'İrlanda', dialCode: '+353', language: 'en' },
  { code: 'SE', name: 'İsveç', dialCode: '+46', language: 'en' },
  { code: 'NO', name: 'Norveç', dialCode: '+47', language: 'en' },
  { code: 'DK', name: 'Danimarka', dialCode: '+45', language: 'en' },
  { code: 'FI', name: 'Finlandiya', dialCode: '+358', language: 'en' },
  { code: 'PL', name: 'Polonya', dialCode: '+48', language: 'en' },
  { code: 'CZ', name: 'Çekya', dialCode: '+420', language: 'en' },
  { code: 'SK', name: 'Slovakya', dialCode: '+421', language: 'en' },
  { code: 'HU', name: 'Macaristan', dialCode: '+36', language: 'en' },
  { code: 'RO', name: 'Romanya', dialCode: '+40', language: 'en' },
  { code: 'BG', name: 'Bulgaristan', dialCode: '+359', language: 'en' },
  { code: 'GR', name: 'Yunanistan', dialCode: '+30', language: 'en' },
  { code: 'HR', name: 'Hırvatistan', dialCode: '+385', language: 'en' },
  { code: 'RS', name: 'Sırbistan', dialCode: '+381', language: 'en' },
  { code: 'AL', name: 'Arnavutluk', dialCode: '+355', language: 'en' },
  { code: 'BA', name: 'Bosna Hersek', dialCode: '+387', language: 'en' },
  { code: 'MK', name: 'Kuzey Makedonya', dialCode: '+389', language: 'en' },
  { code: 'SI', name: 'Slovenya', dialCode: '+386', language: 'en' },
  { code: 'EE', name: 'Estonya', dialCode: '+372', language: 'en' },
  { code: 'LV', name: 'Letonya', dialCode: '+371', language: 'ru' },
  { code: 'LT', name: 'Litvanya', dialCode: '+370', language: 'en' },
  { code: 'MD', name: 'Moldova', dialCode: '+373', language: 'ru' },
  { code: 'GE', name: 'Gürcistan', dialCode: '+995', language: 'ru' },
  { code: 'AM', name: 'Ermenistan', dialCode: '+374', language: 'ru' },
  { code: 'UZ', name: 'Özbekistan', dialCode: '+998', language: 'ru' },
  { code: 'TM', name: 'Türkmenistan', dialCode: '+993', language: 'ru' },
  { code: 'KG', name: 'Kırgızistan', dialCode: '+996', language: 'ru' },
  { code: 'TJ', name: 'Tacikistan', dialCode: '+992', language: 'ru' },
  { code: 'MC', name: 'Monako', dialCode: '+377', language: 'fr' },
  { code: 'MT', name: 'Malta', dialCode: '+356', language: 'en' },
  { code: 'IS', name: 'İzlanda', dialCode: '+354', language: 'en' },
  { code: 'CA', name: 'Kanada', dialCode: '+1', language: 'fr' },
  { code: 'MX', name: 'Meksika', dialCode: '+52', language: 'en' },
  { code: 'BR', name: 'Brezilya', dialCode: '+55', language: 'en' },
  { code: 'AR', name: 'Arjantin', dialCode: '+54', language: 'en' },
  { code: 'CL', name: 'Şili', dialCode: '+56', language: 'en' },
  { code: 'CO', name: 'Kolombiya', dialCode: '+57', language: 'en' },
  { code: 'PE', name: 'Peru', dialCode: '+51', language: 'en' },
  { code: 'UY', name: 'Uruguay', dialCode: '+598', language: 'en' },
  { code: 'AE', name: 'Birleşik Arap Emirlikleri', dialCode: '+971', language: 'en' },
  { code: 'SA', name: 'Suudi Arabistan', dialCode: '+966', language: 'en' },
  { code: 'QA', name: 'Katar', dialCode: '+974', language: 'en' },
  { code: 'KW', name: 'Kuveyt', dialCode: '+965', language: 'en' },
  { code: 'BH', name: 'Bahreyn', dialCode: '+973', language: 'en' },
  { code: 'OM', name: 'Umman', dialCode: '+968', language: 'en' },
  { code: 'JO', name: 'Ürdün', dialCode: '+962', language: 'en' },
  { code: 'LB', name: 'Lübnan', dialCode: '+961', language: 'fr' },
  { code: 'IQ', name: 'Irak', dialCode: '+964', language: 'en' },
  { code: 'IR', name: 'İran', dialCode: '+98', language: 'en' },
  { code: 'IL', name: 'İsrail', dialCode: '+972', language: 'en' },
  { code: 'EG', name: 'Mısır', dialCode: '+20', language: 'fr' },
  { code: 'MA', name: 'Fas', dialCode: '+212', language: 'fr' },
  { code: 'DZ', name: 'Cezayir', dialCode: '+213', language: 'fr' },
  { code: 'TN', name: 'Tunus', dialCode: '+216', language: 'fr' },
  { code: 'LY', name: 'Libya', dialCode: '+218', language: 'en' },
  { code: 'ZA', name: 'Güney Afrika', dialCode: '+27', language: 'en' },
  { code: 'NG', name: 'Nijerya', dialCode: '+234', language: 'en' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', language: 'en' },
  { code: 'GH', name: 'Gana', dialCode: '+233', language: 'en' },
  { code: 'SN', name: 'Senegal', dialCode: '+221', language: 'fr' },
  { code: 'CI', name: 'Fildişi Sahili', dialCode: '+225', language: 'fr' },
  { code: 'CM', name: 'Kamerun', dialCode: '+237', language: 'fr' },
  { code: 'CN', name: 'Çin', dialCode: '+86', language: 'en' },
  { code: 'JP', name: 'Japonya', dialCode: '+81', language: 'en' },
  { code: 'KR', name: 'Güney Kore', dialCode: '+82', language: 'en' },
  { code: 'IN', name: 'Hindistan', dialCode: '+91', language: 'en' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', language: 'en' },
  { code: 'BD', name: 'Bangladeş', dialCode: '+880', language: 'en' },
  { code: 'ID', name: 'Endonezya', dialCode: '+62', language: 'en' },
  { code: 'MY', name: 'Malezya', dialCode: '+60', language: 'en' },
  { code: 'SG', name: 'Singapur', dialCode: '+65', language: 'en' },
  { code: 'TH', name: 'Tayland', dialCode: '+66', language: 'en' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', language: 'en' },
  { code: 'PH', name: 'Filipinler', dialCode: '+63', language: 'en' },
  { code: 'AU', name: 'Avustralya', dialCode: '+61', language: 'en' },
  { code: 'NZ', name: 'Yeni Zelanda', dialCode: '+64', language: 'en' },
];

export const DEFAULT_COUNTRY_CODE = 'TR';

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function languageForCountry(code: string): SupportedLanguage {
  return findCountry(code)?.language ?? 'en';
}
