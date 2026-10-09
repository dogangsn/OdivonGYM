import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ConsentModalService } from './consent-modal.service';

@Component({
  selector: 'app-consent-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (modalService.isOpen() && modalService.text(); as text) {
      <div
        class="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
        (click)="modalService.close()"
      >
        <div
          class="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative flex flex-col max-h-[85vh]"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                <mat-icon class="icon-size-5">verified_user</mat-icon>
              </div>
              <div>
                <span class="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Versiyon {{ text.version }} · 6698 Sayılı KVKK
                </span>
                <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white m-0 leading-snug">
                  {{ text.title }}
                </h3>
              </div>
            </div>

            <button
              type="button"
              class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors"
              (click)="modalService.close()"
            >
              <mat-icon class="icon-size-4">close</mat-icon>
            </button>
          </div>

          <!-- Body with HTML Legal Text -->
          <div class="p-6 sm:p-8 overflow-y-auto flex-1 prose dark:prose-invert max-w-none text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal"
               [innerHTML]="text.contentHtml">
          </div>

          <!-- Footer -->
          <div class="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
            <div class="text-xs text-slate-400 font-medium">
              Bu metin kanuni gereksinimler doğrultusunda düzenlenmiştir.
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors inline-flex items-center gap-1.5"
                (click)="printContent()"
              >
                <mat-icon class="icon-size-4 text-slate-400">print</mat-icon>
                Yazdır
              </button>
              <button
                type="button"
                class="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
                (click)="modalService.close()"
              >
                Anladım / Kapat
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConsentModal {
  protected readonly modalService = inject(ConsentModalService);

  printContent() {
    window.print();
  }
}
