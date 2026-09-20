import { Injectable, signal } from '@angular/core';

export type WizardMode = 'workout' | 'setup';

@Injectable({ providedIn: 'root' })
export class TrainingWizardService {
  readonly isOpen = signal(false);
  readonly currentMode = signal<WizardMode>('workout');
  readonly initialMemberId = signal<string | null>(null);

  constructor() {
    // ⌘K (Mac) veya Ctrl+K (Windows) ile her ekrandan sihirbazı anında açma/kapatma
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          this.toggle();
        }
      });
    }
  }

  open(mode: WizardMode = 'workout', memberId?: string): void {
    this.currentMode.set(mode);
    this.initialMemberId.set(memberId || null);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.initialMemberId.set(null);
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  setMode(mode: WizardMode): void {
    this.currentMode.set(mode);
  }
}
