import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'odivongym-theme';

/**
 * `<html>` üzerine `.light` / `.dark` class'ı ekler — hem Angular Material'ın
 * `color-scheme` tabanlı M3 tokenlarını (bkz. styles.scss) hem de Tailwind'in
 * `dark:` variant'ını (bkz. tailwind.css) aynı anahtardan tetikler. "system"
 * modunda da bu class'lardan biri uygulanır (OS tercihine göre çözülüp canlı
 * takip edilir) — aksi halde Material `prefers-color-scheme` ile otomatik
 * koyulaşırken, class-tabanlı Tailwind `dark:` stilleri tetiklenmez.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.readStoredMode());

  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.applyToDocument(this.mode());
    this.media.addEventListener('change', () => {
      if (this.mode() === 'system') {
        this.applyToDocument('system');
      }
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Gizli sekme / depolama engelli — tema hâlâ bu oturum için uygulanır.
    }
    this.applyToDocument(mode);
  }

  toggle(): void {
    this.setMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  private readStoredMode(): ThemeMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    } catch {
      return 'system';
    }
  }

  private applyToDocument(mode: ThemeMode): void {
    const resolved = mode === 'system' ? (this.media.matches ? 'dark' : 'light') : mode;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
  }
}
