import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * CRUD ekranlarının ortak "slide-over" paneli. İçerik (alanlar) `ng-content`
 * ile gelir; alanlar `[formGroup]` taşıyan bir `<div>` içinde olmalı — panelin
 * kendi `<form>`'u Enter ile göndermeyi ve Kaydet butonunu yönetir.
 */
@Component({
  selector: 'app-slide-over',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50" (click)="onCancel()"></div>
      <div
        class="font-sans fixed inset-y-0 right-0 max-w-lg w-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800"
      >
        <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white m-0">{{ title() }}</h3>
          <button
            type="button"
            (click)="onCancel()"
            class="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center cursor-pointer border-none bg-transparent"
          >
            <mat-icon class="icon-size-5">close</mat-icon>
          </button>
        </div>

        <form (submit)="onSubmit($event)" class="flex-1 flex flex-col min-h-0">
          <div class="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll">
            @if (errorMessage()) {
              <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {{ errorMessage() }}
              </div>
            }
            <ng-content />
          </div>
          <div
            class="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3"
          >
            <button type="button" (click)="onCancel()" class="odv-btn-ghost">Vazgeç</button>
            <button type="submit" [disabled]="submitting()" class="odv-btn-primary">
              {{ submitting() ? 'Kaydediliyor…' : submitLabel() }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class SlideOver {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly submitLabel = input('Kaydet');
  readonly submitting = input(false);
  readonly errorMessage = input('');

  // Support both closed/close and submitted/save outputs
  readonly closed = output<void>();
  readonly close = output<void>();
  readonly submitted = output<void>();
  readonly save = output<void>();

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submitted.emit();
    this.save.emit();
  }

  protected onCancel(): void {
    this.closed.emit();
    this.close.emit();
  }
}
