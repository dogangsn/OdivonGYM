import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { SupportedLanguage } from '../data/countries';

const STORAGE_KEY = 'odivongym-language';
const SUPPORTED: SupportedLanguage[] = ['tr', 'en', 'ru', 'nl', 'fr'];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  tr: 'Türkçe',
  en: 'English',
  ru: 'Русский',
  nl: 'Nederlands',
  fr: 'Français',
};

/**
 * Aktif arayüz dilini yönetir: `TranslocoService` üzerinden gerçek dil
 * değişimini tetikler, seçimi `localStorage`'da kalıcı hale getirir. Kayıt
 * formu, ülke seçilince `setLanguage`'ı çağırarak dili otomatik önerir;
 * kullanıcı `shell` üzerindeki dil seçiciyle bunu her zaman değiştirebilir.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);

  readonly current = signal<SupportedLanguage>(this.readStored() ?? this.detectBrowserLanguage());

  constructor() {
    this.transloco.setActiveLang(this.current());

    // Bileşenler (bkz. Dashboard) `TranslocoService.translate()`'i doğrudan,
    // senkron olarak `computed()` içinde çağırıyor — dil daha önce hiç
    // yüklenmediyse (lazy HTTP fetch tamamlanmadan) bu çağrı çeviriyi değil,
    // ham anahtarı döner ve `computed()` yükleme bitince kendiliğinden
    // yeniden çalışmaz (bu bir sinyal değişikliği değil). Uygulama açılır
    // açılmaz TÜM dilleri arka planda önceden yükleyip bu yarış durumunu
    // baştan ortadan kaldırıyoruz — sadece 5 küçük JSON dosyası.
    for (const lang of SUPPORTED) {
      this.transloco.load(lang).subscribe();
    }
  }

  setLanguage(lang: SupportedLanguage): void {
    this.current.set(lang);
    this.transloco.setActiveLang(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Gizli sekme / depolama engelli — dil hâlâ bu oturum için uygulanır.
    }
  }

  /** Kayıt formunda ülke seçildiğinde çağrılır — kullanıcı daha önce elle bir dil SEÇMEDİYSE öneriyi uygular. */
  suggestLanguage(lang: SupportedLanguage): void {
    if (!this.readStored()) {
      this.setLanguage(lang);
    }
  }

  private readStored(): SupportedLanguage | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored && (SUPPORTED as string[]).includes(stored) ? (stored as SupportedLanguage) : null;
    } catch {
      return null;
    }
  }

  private detectBrowserLanguage(): SupportedLanguage {
    const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'tr';
    return (SUPPORTED as string[]).includes(nav) ? (nav as SupportedLanguage) : 'tr';
  }
}
