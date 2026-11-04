import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { AdminMembersService } from '../../../admin/members/admin-members.service';
import { AdminPackagesService } from '../../../admin/packages/admin-packages.service';
import {
  addMonths,
  formatDay,
  gymToday,
  previewSchedule,
  receivableErrorMessage,
  toKurus,
  toTl,
} from '../../../admin/receivables/installment-math';
import { ReceivablesApi } from '../../../core/api/receivables.api';
import { GymPackage } from '../../../core/models/gym-package.model';
import { AlertService } from '../../../core/services/alert.service';
import {
  Receivable,
  RECEIVABLE_PAYMENT_LABELS,
  ReceivablePaymentMethod,
} from '../../../core/models/receivable.model';
import { UserProfile } from '../../../core/models/user-profile.model';
import { formatMoney } from '../../ui/ui-utils';

const COUNT_PRESETS = [2, 3, 4, 6, 9, 12];

/**
 * Paketi peşinat + aylık taksitle satar.
 * Arama özellikli modern müşteri/üye seçici ve canlı finansal ödeme planı sunar.
 */
@Component({
  selector: 'app-installment-sale-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity" (click)="onBackdropClick()"></div>

      <!-- Dialog Modal Container -->
      <div class="font-sans fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-none">
        <div
          class="pointer-events-auto w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden"
        >
          <!-- HEADER -->
          <div class="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3.5">
              <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
                <mat-icon class="icon-size-5.5">event_repeat</mat-icon>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="m-0 text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">Taksitli & Kısmi Ödemeli Satış</h3>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                    Otomatik Plan
                  </span>
                </div>
                <p class="m-0 text-xs text-slate-500 dark:text-slate-400 mt-0.5">Üyelik hemen başlar; kalan tutar aylık taksitlerle otomatik takip edilir.</p>
              </div>
            </div>
            <button type="button" class="odv-icon-btn hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer" (click)="close()" aria-label="Kapat">
              <mat-icon class="icon-size-5">close</mat-icon>
            </button>
          </div>

          <!-- BODY GRID -->
          <div class="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 custom-scroll">
            <!-- LEFT COLUMN: FORM ALANLARI (7 Kolon) -->
            <div class="lg:col-span-7 space-y-4.5">
              @if (error()) {
                <div class="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <mat-icon class="icon-size-4.5 text-rose-500 shrink-0">error</mat-icon>
                  <span>{{ error() }}</span>
                </div>
              }

              <!-- 1. MÜŞTERİ / ÜYE ARAMA & SEÇİMİ -->
              <div class="relative">
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <mat-icon class="icon-size-4 text-indigo-500">person_search</mat-icon>
                    <span>Müşteri / Üye Seçimi</span>
                    <span class="text-rose-500">*</span>
                  </label>
                  @if (selectedMember(); as m) {
                    <span class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <mat-icon class="icon-size-3.5">check_circle</mat-icon>
                      Üye Seçildi
                    </span>
                  }
                </div>

                @if (selectedMember(); as m) {
                  <!-- Seçilmiş Üye Kartı -->
                  <div class="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50/70 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-800/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between gap-3 shadow-xs">
                    <div class="flex items-center gap-3 min-w-0">
                      @if (m.photoURL) {
                        <img [src]="m.photoURL" class="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/20 shrink-0" alt="avatar" />
                      } @else {
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                          {{ (m.displayName || m.email || 'Ü').charAt(0).toUpperCase() }}
                        </div>
                      }
                      <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-sm font-black text-slate-900 dark:text-white truncate">
                            {{ m.displayName }}
                          </span>
                          <span class="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold border border-indigo-100 dark:border-indigo-900/60 shadow-2xs">
                            #{{ m.memberNumber || m.uid.slice(0, 6) }}
                          </span>
                        </div>
                        <div class="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          @if (m.phone) {
                            <span class="flex items-center gap-1">
                              <mat-icon class="icon-size-3 text-slate-400">phone</mat-icon>
                              {{ m.phone }}
                            </span>
                          }
                          @if (m.email) {
                            <span class="truncate max-w-[150px] hidden sm:inline">{{ m.email }}</span>
                          }
                        </div>
                      </div>
                    </div>

                    @if (!member()) {
                      <button
                        type="button"
                        (click)="clearSelectedMember()"
                        class="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-2xs"
                        title="Başka üye ara veya değiştir"
                      >
                        <mat-icon class="icon-size-3.5 text-indigo-500">sync_alt</mat-icon>
                        <span class="hidden sm:inline">Değiştir</span>
                      </button>
                    }
                  </div>
                } @else {
                  <!-- Arama Inputu & Dropdown Popover -->
                  <div class="relative">
                    <div class="relative flex items-center">
                      <mat-icon class="icon-size-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">search</mat-icon>
                      <input
                        type="text"
                        [ngModel]="memberSearchQuery()"
                        (ngModelChange)="onMemberSearchChange($event)"
                        (focus)="isMemberDropdownOpen.set(true)"
                        placeholder="Müşteri adı, telefon (05xx), üye no (#...) veya e-posta ara..."
                        class="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-xs"
                      />
                      @if (memberSearchQuery()) {
                        <button
                          type="button"
                          (click)="memberSearchQuery.set('')"
                          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer border-none bg-transparent"
                        >
                          <mat-icon class="icon-size-4">close</mat-icon>
                        </button>
                      }
                    </div>

                    <!-- Dropdown Popover List -->
                    @if (isMemberDropdownOpen()) {
                      <div class="fixed inset-0 z-30" (click)="isMemberDropdownOpen.set(false)"></div>
                      <div class="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scroll divide-y divide-slate-100 dark:divide-slate-800">
                        @for (mem of filteredMembers(); track mem.uid) {
                          <button
                            type="button"
                            (click)="selectMember(mem)"
                            class="w-full px-3.5 py-2.5 text-left hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                          >
                            <div class="flex items-center gap-2.5 min-w-0">
                              @if (mem.photoURL) {
                                <img [src]="mem.photoURL" class="w-8 h-8 rounded-xl object-cover shrink-0" alt="avatar" />
                              } @else {
                                <div class="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                  {{ (mem.displayName || mem.email || 'Ü').charAt(0).toUpperCase() }}
                                </div>
                              }
                              <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                  <span class="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {{ mem.displayName }}
                                  </span>
                                  <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                                    #{{ mem.memberNumber || mem.uid.slice(0, 5) }}
                                  </span>
                                </div>
                                <div class="text-[11px] text-slate-400 truncate">
                                  {{ mem.phone || mem.email || 'İletişim bilgisi yok' }}
                                </div>
                              </div>
                            </div>
                            <mat-icon class="icon-size-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0">
                              add_circle_outline
                            </mat-icon>
                          </button>
                        } @empty {
                          <div class="p-4 text-center text-xs text-slate-400">
                            <mat-icon class="icon-size-5 text-slate-300 dark:text-slate-600 mb-1 block mx-auto">search_off</mat-icon>
                            "{{ memberSearchQuery() }}" ile eşleşen üye bulunamadı.
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- 2. PAKET SEÇİMİ -->
              <div>
                <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <mat-icon class="icon-size-4 text-indigo-500">card_membership</mat-icon>
                  <span>Satılacak Paket</span>
                  <span class="text-rose-500">*</span>
                </label>
                @if (gymPackage(); as p) {
                  <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span class="text-sm font-black text-slate-900 dark:text-white">{{ p.name }}</span>
                      <span class="text-xs text-slate-400 block">{{ p.durationDays }} Günlük Üyelik</span>
                    </div>
                    <span class="text-sm font-black text-indigo-600 dark:text-indigo-400">{{ money(p.price) }}</span>
                  </div>
                } @else {
                  <select
                    class="odv-input w-full rounded-2xl py-2.5"
                    [ngModel]="packageId()"
                    (ngModelChange)="packageId.set($event)"
                    name="package"
                  >
                    <option value="">Paket seçiniz…</option>
                    @for (p of packages(); track p.id) {
                      <option [value]="p.id">
                        {{ p.name }} · {{ p.durationDays }} Gün ({{ money(p.price) }})
                      </option>
                    }
                  </select>
                }
              </div>

              <!-- 3. TUTAR & İNDİRİM & PEŞİNAT -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label class="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">İndirim (₺)</label>
                  <div class="relative flex items-center">
                    <span class="absolute left-3 text-slate-400 font-bold text-xs">₺</span>
                    <input
                      class="odv-input w-full pl-7 rounded-2xl"
                      type="number"
                      min="0"
                      step="0.01"
                      name="discount"
                      placeholder="0,00"
                      [ngModel]="discount()"
                      (ngModelChange)="discount.set(+$event || 0)"
                    />
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300">Peşinat Tutarı (₺)</label>
                    <div class="flex items-center gap-1">
                      <button type="button" (click)="setDownPaymentPreset(0)" class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer border-none bg-transparent">
                        Peşinatsız
                      </button>
                      <span class="text-slate-300 dark:text-slate-700">·</span>
                      <button type="button" (click)="setDownPaymentPreset(25)" class="text-[10px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer border-none bg-transparent">
                        %25
                      </button>
                      <span class="text-slate-300 dark:text-slate-700">·</span>
                      <button type="button" (click)="setDownPaymentPreset(50)" class="text-[10px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer border-none bg-transparent">
                        %50
                      </button>
                    </div>
                  </div>
                  <div class="relative flex items-center">
                    <span class="absolute left-3 text-slate-400 font-bold text-xs">₺</span>
                    <input
                      class="odv-input w-full pl-7 rounded-2xl"
                      type="number"
                      min="0"
                      step="0.01"
                      name="down"
                      placeholder="0,00"
                      [ngModel]="downPayment()"
                      (ngModelChange)="downPayment.set(+$event || 0)"
                    />
                  </div>
                </div>
              </div>

              <!-- 4. TAKSİT SAYISI PRESET BUTONLARI -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-xs font-bold text-slate-600 dark:text-slate-300">Taksit Sayısı (Ay)</label>
                  <span class="text-[11px] font-semibold text-slate-400">1 - 36 Ay Arası</span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  @for (n of countPresets; track n) {
                    <button
                      type="button"
                      (click)="installmentCount.set(n)"
                      class="px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all border"
                      [class]="installmentCount() === n
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-md shadow-indigo-500/25 scale-105'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'"
                    >
                      {{ n }} Taksit
                    </button>
                  }
                  <div class="flex items-center gap-1.5 ml-auto">
                    <span class="text-[11px] text-slate-400 font-semibold">Özel:</span>
                    <input
                      class="odv-input w-16 text-center font-bold text-xs rounded-xl py-1"
                      type="number"
                      min="1"
                      max="36"
                      name="count"
                      [ngModel]="installmentCount()"
                      (ngModelChange)="installmentCount.set(clampCount($event))"
                    />
                  </div>
                </div>
              </div>

              <!-- 5. İLK VADE & PEŞİNAT ÖDEME YÖNTEMİ -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300">İlk Taksit Vadesi</label>
                    <div class="flex items-center gap-1">
                      <button type="button" (click)="setDueDateHelper('oneMonth')" class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer border-none bg-transparent">
                        +1 Ay
                      </button>
                      <span class="text-slate-300 dark:text-slate-700">·</span>
                      <button type="button" (click)="setDueDateHelper('monthStart')" class="text-[10px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer border-none bg-transparent">
                        Ayın 1'i
                      </button>
                    </div>
                  </div>
                  <input
                    class="odv-input w-full rounded-2xl"
                    type="date"
                    name="firstDue"
                    [min]="today"
                    [ngModel]="firstDueDate()"
                    (ngModelChange)="firstDueDate.set($event)"
                  />
                </div>

                <div>
                  <label class="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Peşinat Ödeme Yöntemi</label>
                  <select
                    class="odv-input w-full rounded-2xl"
                    name="method"
                    [ngModel]="paymentMethod()"
                    (ngModelChange)="paymentMethod.set($event)"
                    [disabled]="toKurus(downPayment()) === 0"
                  >
                    @for (m of methods; track m) {
                      <option [value]="m">{{ methodLabels[m] }}</option>
                    }
                  </select>
                </div>
              </div>

              <!-- 6. NOT / SÖZLEŞME AÇIKLAMASI -->
              <div>
                <label class="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Sözleşme / Senet / Kefil Notu</label>
                <input
                  class="odv-input w-full rounded-2xl"
                  type="text"
                  maxlength="500"
                  name="notes"
                  [ngModel]="notes()"
                  (ngModelChange)="notes.set($event)"
                  placeholder="Örn: 2026/104 nolu senet düzenlendi, kefil: Mehmet Can..."
                />
              </div>
            </div>

            <!-- RIGHT COLUMN: CANLI PLAN VE FİNANSAL ÖZET (5 Kolon) -->
            <div class="lg:col-span-5 flex flex-col gap-4">
              <!-- ÖZET KARTI -->
              <div class="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3 shadow-xs">
                <div class="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Finansal Özet</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                    Canlı Hesap
                  </span>
                </div>

                <div class="space-y-2 text-xs">
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500 dark:text-slate-400">Paket Liste Fiyatı</span>
                    <span class="font-bold text-slate-800 dark:text-slate-200">{{ money(listPrice()) }}</span>
                  </div>
                  @if (toKurus(discount()) > 0) {
                    <div class="flex justify-between items-center">
                      <span class="text-slate-500 dark:text-slate-400">İndirim Tutarı</span>
                      <span class="font-bold text-rose-600 dark:text-rose-400">-{{ money(discount()) }}</span>
                    </div>
                  }
                  <div class="flex justify-between items-center pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span class="font-semibold text-slate-700 dark:text-slate-300">Net Satış Tutarı</span>
                    <span class="font-black text-slate-900 dark:text-white text-sm">{{ money(total()) }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-emerald-700 dark:text-emerald-400 font-semibold">Peşin Alınan</span>
                    <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ money(downPayment()) }}</span>
                  </div>
                  <div class="flex justify-between items-center pt-2 border-t-2 border-slate-200 dark:border-slate-700">
                    <span class="font-black text-slate-900 dark:text-white">Taksitlendirilen Borç</span>
                    <span class="font-black text-indigo-600 dark:text-indigo-400 text-base sm:text-lg">
                      {{ money(financed()) }}
                    </span>
                  </div>
                </div>

                @if (toKurus(financed()) > 0) {
                  <div class="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
                    <span class="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">Aylık Taksit Tutarı:</span>
                    <span class="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {{ installmentCount() }} × {{ money(schedule()[0]?.amount || 0) }} / ay
                    </span>
                  </div>
                }
              </div>

              <!-- TAKVİM VE VADE TABLOSU -->
              @if (schedule().length > 0) {
                <div class="flex-1 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 overflow-hidden flex flex-col shadow-xs">
                  <div class="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <mat-icon class="icon-size-4 text-indigo-500">calendar_today</mat-icon>
                      <span>Vade ve Taksit Takvimi</span>
                    </span>
                    <span class="text-[11px] font-semibold text-slate-400">Toplam {{ schedule().length }} Vade</span>
                  </div>
                  <div class="max-h-56 overflow-y-auto custom-scroll divide-y divide-slate-100 dark:divide-slate-800">
                    @for (row of schedule(); track row.no) {
                      <div class="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-xs">
                        <div class="flex items-center gap-2.5">
                          <span class="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] flex items-center justify-center">
                            {{ row.no }}
                          </span>
                          <div>
                            <span class="font-bold text-slate-800 dark:text-slate-200 block">{{ day(row.dueDate) }}</span>
                            <span class="text-[10px] text-slate-400">Vade Tarihi</span>
                          </div>
                        </div>
                        <div class="text-right">
                          <span class="font-black text-slate-900 dark:text-white block">{{ money(row.amount) }}</span>
                          <span class="text-[10px] font-bold text-amber-600 dark:text-amber-400">Planlandı</span>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <div class="flex-1 p-8 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700/80 flex flex-col items-center justify-center text-center">
                  <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mb-3">
                    <mat-icon class="icon-size-6">calculate</mat-icon>
                  </div>
                  <p class="text-xs font-bold text-slate-700 dark:text-slate-300 m-0">Ödeme Planı Bekleniyor</p>
                  <p class="text-[11px] text-slate-400 max-w-[220px] mt-1 m-0">Üye, paket ve taksit sayısını seçtiğinizde takvim burada otomatik oluşacaktır.</p>
                </div>
              }
            </div>
          </div>

          <!-- FOOTER -->
          <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <div class="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              @if (selectedMember(); as m) {
                <span class="font-bold text-slate-800 dark:text-slate-200">{{ m.displayName }}</span>
                <span>·</span>
              }
              <span>Kalan Borç: <strong class="text-indigo-600 dark:text-indigo-400">{{ money(financed()) }}</strong></span>
            </div>
            <div class="flex items-center gap-2.5 ml-auto">
              <button type="button" class="odv-btn-ghost cursor-pointer" (click)="close()">Vazgeç</button>
              <button
                type="button"
                class="odv-btn-primary flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20"
                [disabled]="!canSubmit() || saving()"
                (click)="submit()"
              >
                @if (saving()) {
                  <mat-icon class="icon-size-4 animate-spin">refresh</mat-icon>
                  <span>Kaydediliyor…</span>
                } @else {
                  <mat-icon class="icon-size-4">check_circle</mat-icon>
                  <span>Satışı Tamamla</span>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class InstallmentSaleDialog {
  private readonly api = inject(ReceivablesApi);
  private readonly membersService = inject(AdminMembersService);
  private readonly packagesService = inject(AdminPackagesService);
  private readonly alertService = inject(AlertService);

  /** Dışarıdan sabitlenen üye / paket; verilmezse diyalog içinde seçilir. */
  readonly open = input(false);
  readonly member = input<UserProfile | null>(null);
  readonly gymPackage = input<GymPackage | null>(null);
  readonly closed = output<void>();
  readonly completed = output<Receivable>();

  protected readonly money = formatMoney;
  protected readonly day = formatDay;
  protected readonly toKurus = toKurus;
  protected readonly countPresets = COUNT_PRESETS;
  protected readonly methods: ReceivablePaymentMethod[] = ['cash', 'card', 'transfer', 'wallet'];
  protected readonly methodLabels = RECEIVABLE_PAYMENT_LABELS;
  protected readonly today = gymToday();

  private readonly allMembers = toSignal(this.membersService.watchMembers(), { initialValue: [] as UserProfile[] });
  private readonly allPackages = toSignal(this.packagesService.watchPackages(), { initialValue: [] as GymPackage[] });
  protected readonly members = computed(() =>
    this.allMembers()
      .filter((m) => !m.isArchived)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr')),
  );
  protected readonly packages = computed(() => this.allPackages().filter((p) => p.status === 'active'));

  // Form Signals
  protected readonly memberId = signal('');
  protected readonly packageId = signal('');
  protected readonly discount = signal(0);
  protected readonly downPayment = signal(0);
  protected readonly installmentCount = signal(3);
  protected readonly firstDueDate = signal(addMonths(gymToday(), 1));
  protected readonly paymentMethod = signal<ReceivablePaymentMethod>('cash');
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  // Arama & Dropdown Durumu (Müşteri Arama)
  protected readonly memberSearchQuery = signal('');
  protected readonly isMemberDropdownOpen = signal(false);

  protected readonly filteredMembers = computed(() => {
    const q = this.memberSearchQuery().trim().toLocaleLowerCase('tr');
    const list = this.members();
    if (!q) return list.slice(0, 30);
    return list
      .filter((m) => {
        const name = (m.displayName || '').toLocaleLowerCase('tr');
        const phone = (m.phone || '').toLocaleLowerCase('tr');
        const no = String(m.memberNumber || '').toLocaleLowerCase('tr');
        const email = (m.email || '').toLocaleLowerCase('tr');
        return name.includes(q) || phone.includes(q) || no.includes(q) || email.includes(q);
      })
      .slice(0, 30);
  });

  protected readonly selectedPackage = computed(
    () => this.gymPackage() ?? this.packages().find((p) => p.id === this.packageId()) ?? null,
  );
  protected readonly selectedMember = computed(
    () => this.member() ?? this.members().find((m) => m.uid === this.memberId()) ?? null,
  );
  private readonly selectedMemberId = computed(() => this.selectedMember()?.uid ?? '');

  protected readonly listPrice = computed(() => this.selectedPackage()?.price ?? 0);
  protected readonly total = computed(() => toTl(Math.max(0, toKurus(this.listPrice()) - toKurus(this.discount()))));
  protected readonly financed = computed(() => toTl(Math.max(0, toKurus(this.total()) - toKurus(this.downPayment()))));
  protected readonly schedule = computed(() =>
    previewSchedule(this.financed(), this.installmentCount(), this.firstDueDate()),
  );
  protected readonly canSubmit = computed(
    () =>
      !!this.selectedMemberId() &&
      !!this.selectedPackage() &&
      toKurus(this.financed()) > 0 &&
      this.firstDueDate() >= this.today &&
      this.installmentCount() >= 1 &&
      this.installmentCount() <= 36,
  );

  constructor() {
    // Her açılışta formu sıfırla.
    effect(() => {
      if (!this.open()) return;
      this.memberId.set('');
      this.packageId.set('');
      this.discount.set(0);
      this.downPayment.set(0);
      this.installmentCount.set(3);
      this.firstDueDate.set(addMonths(gymToday(), 1));
      this.paymentMethod.set('cash');
      this.notes.set('');
      this.error.set('');
      this.memberSearchQuery.set('');
      this.isMemberDropdownOpen.set(false);
    });
  }

  protected onMemberSearchChange(val: string): void {
    this.memberSearchQuery.set(val ?? '');
    this.isMemberDropdownOpen.set(true);
  }

  protected selectMember(mem: UserProfile): void {
    this.memberId.set(mem.uid);
    this.isMemberDropdownOpen.set(false);
    this.memberSearchQuery.set('');
  }

  protected clearSelectedMember(): void {
    this.memberId.set('');
    this.isMemberDropdownOpen.set(true);
    this.memberSearchQuery.set('');
  }

  protected setDownPaymentPreset(percent: number): void {
    const tot = this.total();
    if (percent === 0) {
      this.downPayment.set(0);
    } else {
      const calc = Math.round((tot * percent) / 100);
      this.downPayment.set(calc);
    }
  }

  protected setDueDateHelper(preset: 'oneMonth' | 'halfMonth' | 'monthStart' | 'monthMid'): void {
    const todayStr = gymToday();
    const [y, m] = todayStr.split('-').map(Number);
    if (preset === 'oneMonth') {
      this.firstDueDate.set(addMonths(todayStr, 1));
    } else if (preset === 'halfMonth') {
      const dt = new Date(Date.now() + 15 * 86400000);
      this.firstDueDate.set(dt.toISOString().slice(0, 10));
    } else if (preset === 'monthStart') {
      const nextMonthYear = m === 12 ? y + 1 : y;
      const nextMonth = m === 12 ? 1 : m + 1;
      this.firstDueDate.set(`${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`);
    } else if (preset === 'monthMid') {
      const nextMonthYear = m === 12 ? y + 1 : y;
      const nextMonth = m === 12 ? 1 : m + 1;
      this.firstDueDate.set(`${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-15`);
    }
  }

  protected clampCount(value: unknown): number {
    const n = Math.trunc(Number(value) || 1);
    return Math.min(36, Math.max(1, n));
  }

  protected close(): void {
    if (!this.saving()) this.closed.emit();
  }

  protected async submit(): Promise<void> {
    const pkg = this.selectedPackage();
    const userId = this.selectedMemberId();
    if (!pkg || !userId || !this.canSubmit()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const plan = await firstValueFrom(
        this.api.createSale({
          userId,
          packageId: pkg.id,
          downPayment: this.downPayment(),
          installmentCount: this.installmentCount(),
          firstDueDate: this.firstDueDate(),
          discount: toKurus(this.discount()) > 0 ? this.discount() : undefined,
          paymentMethod: this.paymentMethod(),
          notes: this.notes().trim() || undefined,
        }),
      );
      this.completed.emit(plan);
    } catch (err) {
      this.error.set(receivableErrorMessage(err, 'Taksitli satış kaydedilemedi.'));
    } finally {
      this.saving.set(false);
    }
  }

  async onBackdropClick(): Promise<void> {
    if (!this.selectedMemberId() && !this.selectedPackage() && this.downPayment() === 0) {
      this.close();
      return;
    }
    const confirmed = await this.alertService.confirm({
      title: 'Kaydetmeden Çıkmak İstiyor Musunuz?',
      message: 'Girdiğiniz satış ve taksit bilgileri kaydedilmeyecektir. Çıkmak istediğinize emin misiniz?',
      icon: 'warning',
      confirmText: 'Evet, Çık',
      cancelText: 'Vazgeç',
      isDestructive: false,
    });
    if (confirmed) {
      this.close();
    }
  }
}
