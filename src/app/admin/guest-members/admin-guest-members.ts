import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { firstError } from '../../shared/ui/ui-utils';
import { AdminGuestMembersService } from './admin-guest-members.service';
import { GuestMember } from '../../core/models/guest-member.model';
import { BranchContextService } from '../../core/services/branch-context.service';

const STATUS_LABEL: Record<GuestMember['status'], string> = {
  visited: 'Ziyaret Etti',
  called: 'Telefonla Görüşüldü',
  converted: 'Üyeye Dönüştü',
  lost: 'İlgilenmiyor / İptal',
};

const STATUS_CLASS: Record<GuestMember['status'], string> = {
  visited: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
  called: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  converted: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  lost: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

const INTEREST_CATEGORIES = [
  'Genel Fitness & Gym',
  'Kilo Verme & İncelme',
  'Pilates & Reformer',
  'Özel Ders (Personal Training)',
  'Havuz & Spa',
  'Vücut Geliştirme (Hipertrofi)',
  'Boks & Kickboks',
  'Grup Seansları',
];

const VISIT_REASONS = [
  'Salonu Gezme / Bilgi Alma',
  'Fiyat & Kampanya Bilgisi',
  'Ücretsiz Deneme Antrenmanı',
  'Arkadaş / Üye Tavsiyesi',
  'Doktor / Sağlık Yönlendirmesi',
];

@Component({
  selector: 'app-admin-guest-members',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header
        title="Misafir Üye & Ziyaretçi Takibi"
        icon="contact_support"
        description="Salonu gezmeye gelen potansiyel üyelerin anket, ilgi ve takip süreçlerini tek panelden yönetin."
      >
        <button actions type="button" class="odv-btn-primary" (click)="openForm()">
          <mat-icon class="icon-size-4.5">person_add</mat-icon>
          Yeni Misafir Kaydı
        </button>
      </app-page-header>

      <!-- KPI ÖZET KARTLARI -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="odv-card p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 m-0">Toplam Ziyaretçi</p>
          <h3 class="text-xl font-black text-slate-900 dark:text-white mt-1 mb-0">{{ guestList().length }}</h3>
        </div>
        <div class="odv-card p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-indigo-500 m-0">Bekleyen Ziyaret</p>
          <h3 class="text-xl font-black text-indigo-600 mt-1 mb-0">{{ countByStatus('visited') }}</h3>
        </div>
        <div class="odv-card p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-amber-500 m-0">Görüşülen / Aranacak</p>
          <h3 class="text-xl font-black text-amber-600 mt-1 mb-0">{{ countByStatus('called') }}</h3>
        </div>
        <div class="odv-card p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-emerald-500 m-0">Üyeye Dönüşen</p>
          <h3 class="text-xl font-black text-emerald-600 mt-1 mb-0">{{ countByStatus('converted') }}</h3>
        </div>
      </div>

      <!-- LİSTELEME TABLOSU -->
      <div class="odv-card overflow-hidden">
        @if (loading()) {
          <p class="py-16 text-center text-sm text-slate-500 m-0">Yükleniyor…</p>
        } @else if (guestList().length === 0) {
          <div class="py-16 text-center">
            <mat-icon class="icon-size-12 text-slate-300">people_outline</mat-icon>
            <p class="text-sm font-bold text-slate-700 dark:text-slate-300 mt-2 mb-1">Henüz misafir kaydı bulunmuyor</p>
            <p class="text-xs text-slate-500 m-0 mb-4">Salonu gezmeye gelen potansiyel üyelerinizi kaydederek takibe başlayın.</p>
            <button type="button" class="odv-btn-soft" (click)="openForm()">+ Misafir Kaydı Oluştur</button>
          </div>
        } @else {
          <div class="overflow-x-auto custom-scroll">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  <th class="odv-th">Misafir</th>
                  <th class="odv-th">İlgi Alanı & Neden</th>
                  <th class="odv-th">Anket & Notlar</th>
                  <th class="odv-th">Takip Tarihi</th>
                  <th class="odv-th">Durum</th>
                  <th class="odv-th text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                @for (g of guestList(); track g.id) {
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="odv-td">
                      <p class="font-bold text-slate-900 dark:text-white m-0">{{ g.fullName }}</p>
                      <p class="text-[11px] text-slate-500 m-0 flex items-center gap-1.5 mt-0.5">
                        <span>{{ g.phone }}</span>
                        @if (g.email) {
                          <span>•</span>
                          <span>{{ g.email }}</span>
                        }
                      </p>
                    </td>
                    <td class="odv-td">
                      <span class="inline-flex items-center text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {{ g.interestCategory }}
                      </span>
                      <p class="text-[11px] text-slate-500 m-0 mt-0.5">{{ g.visitReason }}</p>
                    </td>
                    <td class="odv-td max-w-xs">
                      <p class="text-xs text-slate-700 dark:text-slate-300 truncate m-0">
                        {{ g.surveyNotes || '—' }}
                      </p>
                      @if (g.budgetRange) {
                        <span class="text-[10px] text-slate-400">Bütçe: {{ g.budgetRange }}</span>
                      }
                    </td>
                    <td class="odv-td text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {{ formatDate(g.followUpDate) }}
                    </td>
                    <td class="odv-td whitespace-nowrap">
                      <span class="odv-badge" [class]="statusClass[g.status]">
                        {{ statusLabel[g.status] }}
                      </span>
                    </td>
                    <td class="odv-td text-right whitespace-nowrap">
                      @if (g.status !== 'converted') {
                        <button
                          type="button"
                          class="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all mr-1 cursor-pointer"
                          title="Üyeye Dönüştür"
                          (click)="convertToMember(g)"
                        >
                          Üyeye Dönüştür
                        </button>
                      }
                      <button type="button" class="odv-icon-btn" title="Düzenle" (click)="openForm(g)">
                        <mat-icon class="icon-size-4">edit</mat-icon>
                      </button>
                      <button type="button" class="odv-icon-btn odv-icon-btn-danger ml-1" title="Sil" (click)="remove(g)">
                        <mat-icon class="icon-size-4">delete</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <!-- KAYIT / DÜZENLEME SLIDE-OVER -->
    <app-slide-over
      [open]="drawerOpen()"
      [title]="editing() ? 'Misafir Bilgisini Düzenle' : 'Yeni Misafir Ziyaretçi Kaydı'"
      [submitLabel]="editing() ? 'Değişiklikleri Kaydet' : 'Misafiri Kaydet'"
      [submitting]="submitting()"
      [errorMessage]="errorMessage()"
      (closed)="close()"
      (submitted)="submit()"
    >
      <div [formGroup]="form" class="space-y-4 font-sans">
        <app-field label="Misafir Ad Soyad" [required]="true" [error]="err('fullName', { required: 'Ad soyad gerekli.' })">
          <input type="text" formControlName="fullName" class="odv-input" placeholder="Örn: Mehmet Can" />
        </app-field>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <app-field label="Telefon" [required]="true" [error]="err('phone', { required: 'Telefon gerekli.' })">
            <input type="tel" formControlName="phone" class="odv-input" placeholder="05xx xxx xx xx" />
          </app-field>

          <app-field label="E-posta">
            <input type="email" formControlName="email" class="odv-input" placeholder="ornek@mail.com" />
          </app-field>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <app-field label="Cinsiyet">
            <select formControlName="gender" class="odv-input">
              <option value="unspecified">Belirtilmedi</option>
              <option value="female">Kadın</option>
              <option value="male">Erkek</option>
            </select>
          </app-field>

          <app-field label="İlgilendiği Alan / Kategori">
            <select formControlName="interestCategory" class="odv-input">
              @for (cat of categories; track cat) {
                <option [value]="cat">{{ cat }}</option>
              }
            </select>
          </app-field>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <app-field label="Ziyaret Nedeni">
            <select formControlName="visitReason" class="odv-input">
              @for (r of visitReasons; track r) {
                <option [value]="r">{{ r }}</option>
              }
            </select>
          </app-field>

          <app-field label="Bütçe Beklentisi">
            <input type="text" formControlName="budgetRange" class="odv-input" placeholder="Örn: 1.000 - 2.000 ₺ / Ay" />
          </app-field>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <app-field label="Takip / Arama Tarihi">
            <input type="date" formControlName="followUpDate" class="odv-input" />
          </app-field>

          <app-field label="Durum">
            <select formControlName="status" class="odv-input font-bold">
              <option value="visited">Ziyaret Etti</option>
              <option value="called">Telefonla Görüşüldü</option>
              <option value="converted">Üyeye Dönüştü</option>
              <option value="lost">İlgilenmiyor / İptal</option>
            </select>
          </app-field>
        </div>

        <app-field label="Anket, İlgi & Görüşme Notları" hint="Hedefleri, spor geçmişi ve görüşülen konuları yazın.">
          <textarea formControlName="surveyNotes" rows="3" class="odv-input resize-none" placeholder="Daha önce fitness yaptı, haftada 3 gün gelebilir, kilo vermek istiyor."></textarea>
        </app-field>
      </div>
    </app-slide-over>
  `,
})
export class AdminGuestMembers {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminGuestMembersService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);
  protected readonly branchContext = inject(BranchContextService);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusClass = STATUS_CLASS;
  protected readonly categories = INTEREST_CATEGORIES;
  protected readonly visitReasons = VISIT_REASONS;

  private readonly data = toSignal(this.service.watchGuestMembers(), { initialValue: null });
  protected readonly loading = computed(() => this.data() === null);
  protected readonly guestList = computed(() => [...(this.data() ?? [])].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)));

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<GuestMember | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required]],
    email: [''],
    gender: ['unspecified' as 'female' | 'male' | 'unspecified'],
    interestCategory: ['Genel Fitness & Gym'],
    visitReason: ['Salonu Gezme / Bilgi Alma'],
    budgetRange: [''],
    followUpDate: [''],
    status: ['visited' as GuestMember['status']],
    surveyNotes: [''],
  });

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  protected countByStatus(status: GuestMember['status']): number {
    return this.guestList().filter((g) => g.status === status).length;
  }

  protected formatDate(ts?: any): string {
    if (!ts) return '—';
    if (ts.toDate) {
      return ts.toDate().toLocaleDateString('tr-TR');
    }
    return new Date(ts).toLocaleDateString('tr-TR');
  }

  protected openForm(guest: GuestMember | null = null): void {
    this.editing.set(guest);
    this.errorMessage.set('');

    let followUp = '';
    if (guest?.followUpDate) {
      const d = guest.followUpDate.toDate();
      followUp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    this.form.reset({
      fullName: guest?.fullName ?? '',
      phone: guest?.phone ?? '',
      email: guest?.email ?? '',
      gender: guest?.gender ?? 'unspecified',
      interestCategory: guest?.interestCategory ?? 'Genel Fitness & Gym',
      visitReason: guest?.visitReason ?? 'Salonu Gezme / Bilgi Alma',
      budgetRange: guest?.budgetRange ?? '',
      followUpDate: followUp,
      status: guest?.status ?? 'visited',
      surveyNotes: guest?.surveyNotes ?? '',
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
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const v = this.form.getRawValue();
      const payload = {
        fullName: v.fullName.trim(),
        phone: v.phone.trim(),
        email: v.email.trim(),
        gender: v.gender,
        interestCategory: v.interestCategory,
        visitReason: v.visitReason,
        budgetRange: v.budgetRange.trim(),
        followUpDate: v.followUpDate ? new Date(v.followUpDate) : null,
        status: v.status,
        surveyNotes: v.surveyNotes.trim(),
      };
      const current = this.editing();
      if (current) {
        await this.service.updateGuestMember(current.id, payload);
      } else {
        await this.service.addGuestMember(payload);
      }
      this.snackBar.open(current ? 'Misafir kaydı güncellendi.' : 'Yeni misafir kaydedildi.', 'Kapat', { duration: 3000 });
      this.close();
    } catch {
      this.errorMessage.set('Kaydedilemedi, lütfen tekrar deneyin.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async convertToMember(guest: GuestMember): Promise<void> {
    if (
      !(await this.alertService.actionConfirm(
        'Üyeye Dönüştür',
        `"${guest.fullName}" misafiri üye olarak sisteme aktarılsın ve durumu 'Üyeye Dönüştü' yapılsın mı?`,
        'Evet, Üye Yap',
      ))
    ) {
      return;
    }

    try {
      await this.service.updateGuestMember(guest.id, { status: 'converted' });
      this.alertService.toastSuccess('Misafir durumu güncellendi. Üye kayıt ekranına yönlendiriliyorsunuz.');
      void this.router.navigate(['/admin/members']);
    } catch {
      this.alertService.toastError('İşlem tamamlanamadı.');
    }
  }

  protected async remove(guest: GuestMember): Promise<void> {
    if (!(await this.alertService.deleteConfirm(guest.fullName))) return;
    try {
      await this.service.deleteGuestMember(guest.id);
      this.alertService.toastSuccess('Misafir kaydı silindi.');
    } catch {
      this.alertService.toastError('Silme işlemi başarısız.');
    }
  }
}
