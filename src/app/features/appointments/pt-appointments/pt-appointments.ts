import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PtAppointment } from '../../../core/models/pt-appointment.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Field } from '../../../shared/ui/field';
import { SlideOver } from '../../../shared/ui/slide-over';
import { firstError, formatDateTime, sortAsc, sortDesc, toDateTimeInput } from '../../../shared/ui/ui-utils';
import { AppointmentsService } from '../appointments.service';

const STATUS_LABEL: Record<PtAppointment['status'], string> = {
  booked: 'Planlandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  'no-show': 'Gelinmedi',
};

const STATUS_CLASS: Record<PtAppointment['status'], string> = {
  booked: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/40',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  'no-show': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/40',
};

@Component({
  selector: 'app-pt-appointments',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header
        title="PT Randevu"
        icon="event_available"
        description="Personal trainer'ınla randevu al, randevularını düzenle veya iptal et."
      >
        <button actions type="button" class="odv-btn-primary" (click)="openForm()">
          <mat-icon class="icon-size-4.5">add</mat-icon>
          Randevu Al
        </button>
      </app-page-header>

      @if (appointments() === null) {
        <p class="py-16 text-center text-sm text-slate-500 dark:text-slate-400 m-0">Yükleniyor…</p>
      } @else if (appointments()!.length === 0) {
        <div class="odv-card py-16 text-center">
          <p class="text-sm text-slate-500 dark:text-slate-400 m-0">Henüz randevun yok.</p>
          <button type="button" class="odv-btn-soft mt-4" (click)="openForm()">+ İlk Randevunu Al</button>
        </div>
      } @else {
        <div class="space-y-6">
          <section>
            <h2 class="m-0 mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Yaklaşan Randevular</h2>
            <div class="odv-card divide-y divide-slate-100 dark:divide-slate-800/80">
              @for (a of upcoming(); track a.id) {
                <div class="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                  <div class="flex-1 min-w-[12rem]">
                    <p class="m-0 font-bold text-slate-900 dark:text-white">{{ dateTime(a.appointmentTime) }}</p>
                    <p class="m-0 text-xs text-slate-400">{{ a.trainerName }} · {{ a.duration }} dk</p>
                    @if (a.notes) {
                      <p class="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">{{ a.notes }}</p>
                    }
                  </div>
                  <div class="flex items-center gap-1 ml-auto">
                    <button type="button" class="odv-icon-btn" title="Düzenle" (click)="openForm(a)">
                      <mat-icon class="icon-size-4" [svgIcon]="'heroicons_outline:pencil'"></mat-icon>
                    </button>
                    <button type="button" class="odv-btn-ghost" (click)="cancel(a)">İptal Et</button>
                  </div>
                </div>
              } @empty {
                <p class="m-0 p-6 text-center text-sm text-slate-500 dark:text-slate-400">Yaklaşan randevun yok.</p>
              }
            </div>
          </section>

          @if (past().length > 0) {
            <section>
              <h2 class="m-0 mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Geçmiş</h2>
              <div class="odv-card divide-y divide-slate-100 dark:divide-slate-800/80">
                @for (a of past(); track a.id) {
                  <div class="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                    <div class="flex-1 min-w-[12rem]">
                      <p class="m-0 font-semibold text-slate-700 dark:text-slate-200">{{ dateTime(a.appointmentTime) }}</p>
                      <p class="m-0 text-xs text-slate-400">{{ a.trainerName }} · {{ a.duration }} dk</p>
                    </div>
                    <span class="odv-badge" [class]="statusClass[a.status]">{{ statusLabel[a.status] }}</span>
                    <button type="button" class="odv-icon-btn odv-icon-btn-danger" title="Kaydı sil" (click)="remove(a)">
                      <mat-icon class="icon-size-4">delete</mat-icon>
                    </button>
                  </div>
                }
              </div>
            </section>
          }
        </div>
      }
    </div>

    <app-slide-over
      [open]="drawerOpen()"
      [title]="editing() ? 'Randevuyu Düzenle' : 'Randevu Al'"
      [submitLabel]="editing() ? 'Değişiklikleri Kaydet' : 'Randevuyu Kaydet'"
      [submitting]="submitting()"
      [errorMessage]="errorMessage()"
      (closed)="close()"
      (submitted)="submit()"
    >
      <div [formGroup]="form" class="space-y-4">
        <app-field label="Antrenör" [required]="true" [error]="err('trainerName', { required: 'Antrenör adı gerekli.' })">
          <input type="text" formControlName="trainerName" class="odv-input" />
        </app-field>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <app-field label="Tarih & Saat" [required]="true" [error]="err('appointmentTime', { required: 'Tarih ve saat gerekli.' })">
            <input type="datetime-local" formControlName="appointmentTime" class="odv-input" />
          </app-field>
          <app-field label="Süre">
            <select formControlName="duration" class="odv-input">
              @for (d of durations; track d) {
                <option [ngValue]="d">{{ d }} dakika</option>
              }
            </select>
          </app-field>
        </div>
        <app-field label="Not">
          <textarea formControlName="notes" rows="3" class="odv-input resize-none" placeholder="Çalışmak istediğin bölge, hedef…"></textarea>
        </app-field>
      </div>
    </app-slide-over>
  `,
})
export class PtAppointments {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AppointmentsService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly durations = [30, 45, 60, 90];
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusClass = STATUS_CLASS;
  protected readonly dateTime = formatDateTime;

  protected readonly appointments = toSignal(this.service.watchAppointments(), { initialValue: null });

  private isUpcoming(a: PtAppointment): boolean {
    return a.status === 'booked' && (a.appointmentTime?.toMillis?.() ?? 0) >= Date.now();
  }

  protected readonly upcoming = computed(() =>
    sortAsc((this.appointments() ?? []).filter((a) => this.isUpcoming(a)), (a) => a.appointmentTime),
  );
  protected readonly past = computed(() =>
    sortDesc((this.appointments() ?? []).filter((a) => !this.isUpcoming(a)), (a) => a.appointmentTime),
  );

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<PtAppointment | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.nonNullable.group({
    trainerName: ['', [Validators.required]],
    appointmentTime: ['', [Validators.required]],
    duration: [60],
    notes: [''],
  });

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  protected openForm(appointment: PtAppointment | null = null): void {
    this.editing.set(appointment);
    this.errorMessage.set('');
    this.form.reset({
      trainerName: appointment?.trainerName ?? '',
      appointmentTime: appointment ? toDateTimeInput(appointment.appointmentTime) : '',
      duration: appointment?.duration ?? 60,
      notes: appointment?.notes ?? '',
    });
    this.drawerOpen.set(true);
  }

  protected close(): void {
    this.drawerOpen.set(false);
    this.editing.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const when = new Date(v.appointmentTime);
    if (when.getTime() <= Date.now()) {
      this.errorMessage.set('Randevu zamanı gelecekte olmalı.');
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const payload = {
        trainerName: v.trainerName.trim(),
        appointmentTime: when,
        duration: v.duration,
        notes: v.notes.trim(),
      };
      const current = this.editing();
      if (current) {
        await this.service.updateAppointment(current.id, payload);
      } else {
        await this.service.bookAppointment({ ...payload, trainerId: '' });
      }
      this.snackBar.open(current ? 'Randevu güncellendi.' : 'Randevu alındı.', 'Kapat', { duration: 3000 });
      this.close();
    } catch {
      this.errorMessage.set('Kaydedilemedi, tekrar dene.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async cancel(appointment: PtAppointment): Promise<void> {
    if (!confirm('Bu randevuyu iptal etmek istediğine emin misin?')) return;
    try {
      await this.service.cancelAppointment(appointment.id);
      this.snackBar.open('Randevu iptal edildi.', 'Kapat', { duration: 2500 });
    } catch {
      this.snackBar.open('İptal edilemedi, tekrar dene.', 'Kapat', { duration: 3000 });
    }
  }

  protected async remove(appointment: PtAppointment): Promise<void> {
    if (!confirm('Bu randevu kaydını silmek istediğine emin misin?')) return;
    try {
      await this.service.deleteAppointment(appointment.id);
      this.snackBar.open('Kayıt silindi.', 'Kapat', { duration: 2500 });
    } catch {
      this.snackBar.open('Kayıt silinemedi, tekrar dene.', 'Kapat', { duration: 3000 });
    }
  }
}
