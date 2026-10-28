import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CookieConsentRecord,
  CookiePreferences,
  DEFAULT_COOKIE_PREFERENCES,
  ESSENTIAL_ONLY_COOKIE_PREFERENCES,
} from '../models/cookie-consent.model';
import { ConsentModalService } from '../../shared/components/consent-modal/consent-modal.service';
import { ConsentText } from '../models/consent.model';

const STORAGE_KEY_CONSENT = 'odivongym_cookie_consent_v1';
const STORAGE_KEY_REMEMBERED_EMAIL = 'odivongym_remembered_email';
const STORAGE_KEY_REMEMBER_ME_PREF = 'odivongym_remember_me_pref';

export const DEFAULT_COOKIE_POLICY_TEXT: ConsentText = {
  type: 'cookie_policy',
  title: 'Çerez Politikası ve KVKK Aydınlatma Metni',
  version: '1.0',
  isRequired: false,
  isActive: true,
  contentHtml: `
    <div class="space-y-4">
      <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        OdivonGYM platformu olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") ve ilgili mevzuata uygun olarak, web sitemizin güvenli, hızlı ve işlevsel çalışabilmesi amacıyla çerezler (cookies) ve yerel depolama teknolojileri kullanmaktayız.
      </p>

      <div class="rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
        <h4 class="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1.5">
          1. Zorunlu Çerezler (Teknik & Güvenlik)
        </h4>
        <p class="text-xs text-slate-600 dark:text-slate-300 m-0 leading-relaxed">
          Platformun temel işlevlerinin çalışabilmesi, güvenli oturum açılması (Firebase Auth), CSRF koruması ve veri güvenliği için kesinlikle gereklidir. Bu çerezler sistemin çalışması için zorunludur ve kapatılamaz.
        </p>
      </div>

      <div class="rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
        <h4 class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5">
          2. İşlevsel Çerezler ("Beni Hatırla" & Kişiselleştirme)
        </h4>
        <p class="text-xs text-slate-600 dark:text-slate-300 m-0 leading-relaxed">
          Giriş ekranında "Beni Hatırla" işaretlendiğinde e-posta adresinizi ve oturumunuzu güvenle saklar. Ayrıca seçtiğiniz dil ve karanlık/aydınlık tema tercihlerinizi sonraki ziyaretleriniz için hafızada tutar.
        </p>
      </div>

      <div class="rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
        <h4 class="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1.5">
          3. Analitik ve Performans Çerezleri
        </h4>
        <p class="text-xs text-slate-600 dark:text-slate-300 m-0 leading-relaxed">
          Platform yanıt hızları, sayfa yüklenme süreleri ve hata kayıtlarını anonimleştirilmiş olarak değerlendirerek sistem performansını optimize etmemizi sağlar.
        </p>
      </div>

      <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">
        Çerez tercihlerinizi dilediğiniz zaman ekranın altındaki "Çerez Tercihleri" bağlantısından veya giriş ekranından güncelleyebilirsiniz.
      </p>
    </div>
  `.trim(),
};

@Injectable({ providedIn: 'root' })
export class CookieService {
  private readonly consentModal = inject(ConsentModalService);

  readonly consent = signal<CookieConsentRecord | null>(this.loadConsentFromStorage());
  readonly showBanner = signal<boolean>(this.shouldShowBannerInitial());
  readonly showSettingsModal = signal<boolean>(false);

  readonly hasConsented = computed(() => this.consent() !== null);
  readonly functionalAllowed = computed(() => {
    const c = this.consent();
    // Henüz onay seçilmemişse bile kullanıcı "Beni Hatırla"yı işaretleyerek onay verebilir
    return c === null ? true : !!c.preferences.functional;
  });

  readonly analyticsAllowed = computed(() => {
    const c = this.consent();
    return c === null ? false : !!c.preferences.analytics;
  });

  private loadConsentFromStorage(): CookieConsentRecord | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONSENT);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CookieConsentRecord;
      if (parsed && typeof parsed.accepted === 'boolean' && parsed.preferences) {
        return parsed;
      }
    } catch {
      // Storage bozuksa null dön
    }
    return null;
  }

  private shouldShowBannerInitial(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return localStorage.getItem(STORAGE_KEY_CONSENT) === null;
  }

  /** Tüm çerezleri (Zorunlu + İşlevsel + Analitik) kabul et */
  acceptAll(): void {
    const record: CookieConsentRecord = {
      accepted: true,
      preferences: { ...DEFAULT_COOKIE_PREFERENCES },
      consentedAt: new Date().toISOString(),
      version: '1.0',
    };
    this.saveConsentRecord(record);
  }

  /** Sadece zorunlu çerezleri kabul et */
  acceptEssentialOnly(): void {
    const record: CookieConsentRecord = {
      accepted: true,
      preferences: { ...ESSENTIAL_ONLY_COOKIE_PREFERENCES },
      consentedAt: new Date().toISOString(),
      version: '1.0',
    };
    this.saveConsentRecord(record);
    // İşlevsel çerezler reddedildiyse kayıtlı e-postayı temizle
    this.clearRememberedEmail();
  }

  /** Özel tercihleri kaydet */
  saveCustomPreferences(preferences: CookiePreferences): void {
    const record: CookieConsentRecord = {
      accepted: true,
      preferences: {
        essential: true, // Her zaman açık
        functional: !!preferences.functional,
        analytics: !!preferences.analytics,
      },
      consentedAt: new Date().toISOString(),
      version: '1.0',
    };
    this.saveConsentRecord(record);
    if (!record.preferences.functional) {
      this.clearRememberedEmail();
    }
    this.closeSettings();
  }

  private saveConsentRecord(record: CookieConsentRecord): void {
    this.consent.set(record);
    this.showBanner.set(false);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_CONSENT, JSON.stringify(record));
      } catch (err) {
        console.error('OdivonGYM: Çerez tercihi kaydedilemedi', err);
      }
    }
  }

  openSettings(): void {
    this.showSettingsModal.set(true);
  }

  closeSettings(): void {
    this.showSettingsModal.set(false);
  }

  openPolicyModal(): void {
    this.consentModal.open(DEFAULT_COOKIE_POLICY_TEXT);
  }

  // ==========================================
  // "Beni Hatırla" & E-posta Hafıza Metotları
  // ==========================================

  getRememberedEmail(): string {
    if (typeof window === 'undefined' || !window.localStorage) {
      return '';
    }
    try {
      return localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL) ?? '';
    } catch {
      return '';
    }
  }

  setRememberedEmail(email: string): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const clean = (email ?? '').trim();
    if (!clean) {
      this.clearRememberedEmail();
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_REMEMBERED_EMAIL, clean);
      localStorage.setItem(STORAGE_KEY_REMEMBER_ME_PREF, 'true');

      // Eğer henüz çerez onayı verilmemişse, Beni Hatırla tıklamasıyla işlevsel çerez onayı da otomatik verilir
      if (!this.hasConsented()) {
        this.acceptAll();
      } else {
        // Önceden sadece zorunlu seçilmişse, işlevsel çerezi aktif et
        const current = this.consent();
        if (current && !current.preferences.functional) {
          this.saveCustomPreferences({
            ...current.preferences,
            functional: true,
          });
        }
      }
    } catch (err) {
      console.error('OdivonGYM: E-posta hatırlama kaydedilemedi', err);
    }
  }

  clearRememberedEmail(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY_REMEMBERED_EMAIL);
      localStorage.setItem(STORAGE_KEY_REMEMBER_ME_PREF, 'false');
    } catch (err) {
      console.error('OdivonGYM: Hatırlanan e-posta silinemedi', err);
    }
  }

  isRememberMePreferred(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      const email = localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL);
      if (email && email.length > 0) return true;
      const pref = localStorage.getItem(STORAGE_KEY_REMEMBER_ME_PREF);
      return pref === 'true';
    } catch {
      return false;
    }
  }

  setRememberMePreferred(pref: boolean): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_REMEMBER_ME_PREF, pref ? 'true' : 'false');
      if (!pref) {
        localStorage.removeItem(STORAGE_KEY_REMEMBERED_EMAIL);
      }
    } catch {
      // storage unavailable
    }
  }
}
