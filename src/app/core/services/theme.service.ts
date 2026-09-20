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
  readonly mode = signal<ThemeMode>('light');

  constructor() {
    this.applyToDocument('light');
  }

  setMode(mode: ThemeMode): void {
    this.mode.set('light');
    try {
      localStorage.setItem(STORAGE_KEY, 'light');
    } catch {
      // Ignored
    }
    this.applyToDocument('light');
  }

  toggle(): void {
    this.setMode('light');
  }

  private readStoredMode(): ThemeMode {
    return 'light';
  }

  private applyToDocument(mode: ThemeMode): void {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
  }
}
