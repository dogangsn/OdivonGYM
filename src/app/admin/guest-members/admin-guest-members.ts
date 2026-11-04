import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { firstError, formatDate, fromDateInput, toDateInput, todayInput, toMillis } from '../../shared/ui/ui-utils';
import { firstValueFrom } from 'rxjs';
import { LeadsApi } from '../../core/api/leads.api';
import { PermissionService } from '../../core/services/permission.service';
import { toAppError } from '../../shared/models/app-error.model';
import { AdminMembersService } from '../members/admin-members.service';
import { UserProfile } from '../../core/models/user-profile.model';
import { LeadFunnelReport } from './lead-funnel';
import { ReferralProgram } from './referral-program';
import { SOURCES, sourceLabel, STAGE_CLASS, STAGE_LABEL } from './lead-labels';
import { AdminGuestMembersService } from './admin-guest-members.service';
import { GuestMember, LeadSource, LeadStage } from '../../core/models/guest-member.model';
import { BranchContextService } from '../../core/services/branch-context.service';

type Tab = 'list' | 'funnel' | 'referrals';

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

import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-admin-guest-members',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, MatIconModule, PageHeader, SlideOver, Field, LeadFunnelReport, ReferralProgram, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header
        title="guestMembers.title"
        icon="contact_support"
        description="guestMembers.subtitle"
      >
        <button actions type="button" class="odv-btn-primary" (click)="openForm()">
          <mat-icon class="icon-size-4.5">person_add</mat-icon>
          {{ 'guestMembers.newGuest' | transloco }}
        </button>
      </app-page-header>

      <div class="flex flex-wrap gap-2 mb-5">
        <button type="button" class="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer" [class]="tabClass('list')" (click)="tab.set('list')">Adaylar</button>
        <button type="button" class="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer" [class]="tabClass('funnel')" (click)="tab.set('funnel')">Huni Raporu</button>
        @if (permissions.isAdmin()) {
          <button type="button" class="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer" [class]="tabClass('referrals')" (click)="tab.set('referrals')">Tavsiye Programı</button>
        }
      </div>

      @if (tab() === 'funnel') {
        <app-lead-funnel />
      } @else if (tab() === 'referrals') {
        <app-referral-program [allMembers]="members()" />
      } @else {
      <!-- KPI ÖZET KARTLARI -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
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
          <p class="text-[11px] font-bold uppercase tracking-wider text-sky-500 m-0">Deneme Antrenmanı</p>
          <h3 class="text-xl font-black text-sky-600 mt-1 mb-0">{{ countByStatus('trial') }}</h3>
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
                      @if (g.source || g.referrerName) {
                        <p class="text-[10px] text-slate-400 m-0 mt-0.5">
                          {{ source(g.source) }}@if (g.referrerName) { · Tavsiye: {{ g.referrerName }} }
                        </p>
                      }
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
                      <span class="odv-badge" [class]="statusClassOf(g.status)">
                        {{ statusLabelOf(g.status) }}
                      </span>
                      @if (g.status === 'lost' && g.lostReason) {
                        <p class="text-[10px] text-slate-400 m-0 mt-0.5">{{ g.lostReason }}</p>
                      }
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
      }
    </div>

    <!-- ÜYEYE DÖNÜŞTÜRME -->
    <app-slide-over
      [open]="!!converting()"
      title="Üyeye Dönüştür"
      submitLabel="Üyeye Bağla"
      [submitting]="submitting()"
      [errorMessage]="convertError()"
      [confirmOnBackdrop]="false"
      (closed)="converting.set(null)"
      (submitted)="confirmConvert()"
    >
      @if (converting(); as c) {
        <div class="space-y-4 font-sans">
          <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
            <b>{{ c.fullName }}</b> adayını kayıtlı bir üyeye bağlayın. Önce üye kaydını oluşturduysanız listeden seçin.
            @if (c.referrerName) {
              Tavsiye eden <b>{{ c.referrerName }}</b>; tavsiye programı açıksa ödülü otomatik tanımlanır.
            }
          </p>
          <app-field label="Üye" [required]="true">
            <select class="odv-input" [ngModel]="convertMemberId()" (ngModelChange)="convertMemberId.set($event)">
              <option value="">Üye seçin</option>
              @for (m of members(); track m.uid) {
                <option [value]="m.uid">{{ m.displayName }}{{ m.phone ? ' · ' + m.phone : '' }}</option>
              }
            </select>
          </app-field>
          <button type="button" class="odv-btn-soft" (click)="goCreateMember()">
            <mat-icon class="icon-size-4">person_add</mat-icon>
            Yeni üye kaydı oluştur
          </button>
        </div>
      }
    </app-slide-over>

    <!-- KAYIT / DÜZENLEME SLIDE-OVER -->
    <app-slide-over
      [open]="drawerOpen()"
      [title]="editing() ? 'Misafir Bilgisini Düzenle' : 'Yeni Misafir Ziyaretçi Kaydı'"
      [subtitle]="editing() ? 'Aday bilgisi, görüşme notları ve takip planını güncelleyin.' : 'Salonu ziyaret eden potansiyel misafiri kaydedin ve satış sürecini başlatın.'"
      [submitLabel]="editing() ? 'Değişiklikleri Kaydet' : 'Misafiri Kaydet'"
      [submitting]="submitting()"
      [errorMessage]="errorMessage()"
      width="xl"
      (closed)="close()"
      (submitted)="submit()"
    >
      <div [formGroup]="form" class="space-y-4 font-sans">
        <!-- Bilgilendirme Hero Kutusu -->
        <div class="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-indigo-50/30 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900 border border-indigo-100/80 dark:border-indigo-900/50 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
            <mat-icon class="icon-size-5">{{ editing() ? 'edit_note' : 'person_add' }}</mat-icon>
          </div>
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider m-0">
              {{ editing() ? 'Misafir & Satış Kaydı' : 'Yeni Potansiyel Misafir' }}
            </h4>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">
              İletişim, ilgi alanları ve takip randevusunu eksiksiz belirleyin.
            </p>
          </div>
        </div>

        <!-- Bölüm 1: Kişisel & İletişim Bilgileri -->
        <div class="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div class="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <mat-icon class="icon-size-3.5">badge</mat-icon>
            </span>
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Kişisel & İletişim Bilgileri</span>
          </div>

          <app-field label="Misafir Ad Soyad" [required]="true" [error]="err('fullName', { required: 'Ad soyad gerekli.' })">
            <div class="relative">
              <input type="text" formControlName="fullName" class="odv-input pl-9" placeholder="Örn: Mehmet Can" />
              <mat-icon class="icon-size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">person</mat-icon>
            </div>
          </app-field>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <app-field label="Telefon" [required]="true" [error]="err('phone', { required: 'Telefon gerekli.' })">
              <div class="relative">
                <input type="tel" formControlName="phone" class="odv-input pl-9" placeholder="05xx xxx xx xx" />
                <mat-icon class="icon-size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">phone</mat-icon>
              </div>
            </app-field>

            <app-field label="E-posta">
              <div class="relative">
                <input type="email" formControlName="email" class="odv-input pl-9" placeholder="ornek@mail.com" />
                <mat-icon class="icon-size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">mail</mat-icon>
              </div>
            </app-field>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <app-field label="Cinsiyet">
              <select formControlName="gender" class="odv-input">
                <option value="unspecified">Belirtilmedi</option>
                <option value="female">Kadın</option>
                <option value="male">Erkek</option>
              </select>
            </app-field>

            <app-field label="İlgilendiği Alan / Kategori">
              <select formControlName="interestCategory" class="odv-input font-medium">
                @for (cat of categories; track cat) {
                  <option [value]="cat">{{ cat }}</option>
                }
              </select>
            </app-field>
          </div>
        </div>

        <!-- Bölüm 2: Ziyaret & Bütçe Beklentisi -->
        <div class="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div class="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span class="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <mat-icon class="icon-size-3.5">fitness_center</mat-icon>
            </span>
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Ziyaret Nedeni & Bütçe</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <app-field label="Ziyaret Nedeni">
              <select formControlName="visitReason" class="odv-input">
                @for (r of visitReasons; track r) {
                  <option [value]="r">{{ r }}</option>
                }
              </select>
            </app-field>

            <app-field label="Bütçe Beklentisi">
              <div class="relative">
                <input type="text" formControlName="budgetRange" class="odv-input pl-9" placeholder="Örn: 2.000 - 3.500 ₺ / Ay" />
                <mat-icon class="icon-size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">payments</mat-icon>
              </div>
            </app-field>
          </div>

          <!-- Hızlı Bütçe Seçimi -->
          <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span class="text-[10px] font-bold uppercase text-slate-400 mr-0.5">Hızlı Bütçe:</span>
            <button
              type="button"
              class="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
              (click)="setBudget('1.000 - 2.000 ₺ / Ay')"
            >
              1.000 - 2.000 ₺
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
              (click)="setBudget('2.000 - 3.500 ₺ / Ay')"
            >
              2.000 - 3.500 ₺
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
              (click)="setBudget('3.500 ₺+ / Ay')"
            >
              3.500 ₺+
            </button>
          </div>
        </div>

        <!-- Bölüm 3: Takip Tarihi & Satış Durumu -->
        <div class="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/25 border border-indigo-200/80 dark:border-indigo-900/50 space-y-3.5">
          <div class="flex items-center justify-between pb-2 border-b border-indigo-200/60 dark:border-indigo-900/60">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <mat-icon class="icon-size-3.5">event_available</mat-icon>
              </span>
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Takip Tarihi & Satış Durumu</span>
            </div>
            <span class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 shadow-2xs">
              {{ followUpDateDisplay() }}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <app-field label="Takip / Arama Tarihi" hint="Misafiri arayacağınız veya salona davet edeceğiniz tarih">
                <div class="relative">
                  <input type="date" formControlName="followUpDate" class="odv-input pl-9" />
                  <mat-icon class="icon-size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">calendar_month</mat-icon>
                </div>
              </app-field>

              <!-- Hızlı Tarih Seçim Butonları -->
              <div class="flex items-center gap-1.5 flex-wrap mt-2">
                <span class="text-[10px] font-bold uppercase text-slate-400 mr-0.5">Hızlı:</span>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                  [class]="isDateSelected(0) ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'"
                  (click)="setQuickDate(0)"
                >
                  ⚡ Bugün
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                  [class]="isDateSelected(1) ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'"
                  (click)="setQuickDate(1)"
                >
                  📅 Yarın
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                  [class]="isDateSelected(3) ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'"
                  (click)="setQuickDate(3)"
                >
                  🕒 3 Gün
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                  [class]="isDateSelected(7) ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'"
                  (click)="setQuickDate(7)"
                >
                  🗓️ 1 Hafta
                </button>
                @if (form.controls.followUpDate.value) {
                  <button
                    type="button"
                    class="px-1.5 py-0.5 rounded-lg text-[10px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                    title="Tarihi temizle"
                    (click)="clearFollowUpDate()"
                  >
                    ✕ Temizle
                  </button>
                }
              </div>
            </div>

            <app-field label="Satış Durumu / Aşama">
              <select formControlName="status" class="odv-input font-bold" [class]="statusSelectClass()">
                <option value="visited">🚶 Ziyaret Etti</option>
                <option value="called">📞 Telefonla Görüşüldü</option>
                <option value="trial">🏋️ Deneme Antrenmanı</option>
                @if (editing()?.status === 'converted') {
                  <option value="converted">✅ Üyeye Dönüştü</option>
                }
                <option value="lost">❌ İlgilenmiyor / İptal</option>
              </select>
            </app-field>
          </div>

          @if (form.controls.status.value === 'lost') {
            <div class="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2">
              <app-field label="Kaybedilme Nedeni" [required]="true">
                <input type="text" formControlName="lostReason" class="odv-input" placeholder="Örn: Fiyat yüksek, salon uzak, rakip tercihi" />
              </app-field>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 mr-1">Hızlı Seçim:</span>
                <button type="button" class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer" (click)="setLostReason('Fiyat beklentisi yüksek geldi')">Fiyat Yüksek</button>
                <button type="button" class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer" (click)="setLostReason('Salon / Lokasyon uzak kaldı')">Lokasyon Uzak</button>
                <button type="button" class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer" (click)="setLostReason('Başka bir spor kulübü tercih etti')">Rakip Tercih</button>
                <button type="button" class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer" (click)="setLostReason('Zaman yetersizliği / Vazgeçti')">Zaman Yetersiz</button>
              </div>
            </div>
          }
        </div>

        <!-- Bölüm 4: Kaynak & Personel -->
        <div class="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div class="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span class="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <mat-icon class="icon-size-3.5">share</mat-icon>
            </span>
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Kaynak & Personel</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <app-field label="Geliş Kaynağı">
              <select formControlName="source" class="odv-input">
                <option value="">Belirtilmedi</option>
                @for (s of sources; track s) {
                  <option [value]="s">{{ source(s) }}</option>
                }
              </select>
            </app-field>

            <app-field label="Tavsiye Eden Üye" hint="Tavsiye programı ödülü için">
              <select formControlName="referrerMemberId" class="odv-input">
                <option value="">Yok / Doğrudan Başvuru</option>
                @for (m of members(); track m.uid) {
                  <option [value]="m.uid">{{ m.displayName }}</option>
                }
              </select>
            </app-field>
          </div>

          <app-field label="Takip Eden Satış Personeli" hint="Adayla ilgilenen satış danışmanı veya antrenör">
            <div class="relative">
              <input type="text" formControlName="assignedStaffName" class="odv-input pl-9" placeholder="Örn: Ayşe Yılmaz (Satış Danışmanı)" />
              <mat-icon class="icon-size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">support_agent</mat-icon>
            </div>
          </app-field>
        </div>

        <!-- Bölüm 5: Görüşme & Hedef Notları -->
        <div class="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div class="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span class="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <mat-icon class="icon-size-3.5">speaker_notes</mat-icon>
            </span>
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Görüşme & Hedef Notları</span>
          </div>

          <app-field label="Anket & Görüşme Notları" hint="Hedefleri, spor geçmişi ve görüşülen konuları yazın">
            <textarea
              formControlName="surveyNotes"
              rows="3"
              class="odv-input resize-none"
              placeholder="Daha önce fitness yaptı, haftada 3 gün gelebilir, kilo vermek & sıkılaşmak istiyor."
            ></textarea>
          </app-field>
        </div>
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
  protected readonly permissions = inject(PermissionService);
  private readonly leadsApi = inject(LeadsApi);
  private readonly membersService = inject(AdminMembersService);

  protected readonly sources = SOURCES;
  protected readonly source = sourceLabel;
  protected readonly tab = signal<Tab>('list');
  protected readonly members = toSignal(this.membersService.watchMembers(), { initialValue: [] as UserProfile[] });
  protected readonly converting = signal<GuestMember | null>(null);
  protected readonly convertMemberId = signal('');
  protected readonly convertError = signal('');
  protected readonly categories = INTEREST_CATEGORIES;
  protected readonly visitReasons = VISIT_REASONS;

  private readonly data = toSignal(this.service.watchGuestMembers(), { initialValue: null });
  protected readonly loading = computed(() => this.data() === null);
  protected readonly guestList = computed(() => [...(this.data() ?? [])].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)));

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
    status: ['visited' as LeadStage],
    surveyNotes: [''],
    source: ['' as LeadSource | ''],
    referrerMemberId: [''],
    assignedStaffName: [''],
    lostReason: [''],
  });

  /** Eski veya bilinmeyen durumlar için de güvenli etiket. */
  protected statusLabelOf(status: string): string {
    return (STAGE_LABEL as Record<string, string>)[status] ?? status;
  }

  protected statusClassOf(status: string): string {
    return (STAGE_CLASS as Record<string, string>)[status] ?? STAGE_CLASS.visited;
  }

  protected tabClass(tab: Tab): string {
    return this.tab() === tab
      ? 'bg-indigo-600 text-white'
      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800';
  }

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  protected countByStatus(status: GuestMember['status']): number {
    return this.guestList().filter((g) => g.status === status).length;
  }

  protected formatDate(ts?: string | null): string {
    return formatDate(ts);
  }

  protected openForm(guest: GuestMember | null = null): void {
    this.editing.set(guest);
    this.errorMessage.set('');

    const followUp = guest?.followUpDate ? toDateInput(guest.followUpDate) : todayInput();

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
      source: guest?.source ?? '',
      referrerMemberId: guest?.referrerMemberId ?? '',
      assignedStaffName: guest?.assignedStaffName ?? '',
      lostReason: guest?.lostReason ?? '',
    });
    this.drawerOpen.set(true);
  }

  protected isDateSelected(days: number): boolean {
    const val = this.form.controls.followUpDate.value;
    if (!val) return false;
    if (days === 0) return val === todayInput();
    const d = new Date();
    d.setDate(d.getDate() + days);
    return val === toDateInput(d);
  }

  protected setQuickDate(days: number): void {
    if (days === 0) {
      this.form.controls.followUpDate.setValue(todayInput());
    } else {
      const d = new Date();
      d.setDate(d.getDate() + days);
      this.form.controls.followUpDate.setValue(toDateInput(d));
    }
  }

  protected clearFollowUpDate(): void {
    this.form.controls.followUpDate.setValue('');
  }

  protected followUpDateDisplay(): string {
    const val = this.form.controls.followUpDate.value;
    if (!val) return 'Tarih seçilmedi';
    const today = todayInput();
    if (val === today) return `Bugün (${formatDate(val)})`;
    const d = fromDateInput(val);
    const now = new Date();
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetZero = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((targetZero.getTime() - todayZero.getTime()) / 86400000);
    if (diffDays === 1) return `Yarın (${formatDate(val)})`;
    if (diffDays === -1) return `Dün (${formatDate(val)})`;
    if (diffDays > 1 && diffDays <= 14) return `${diffDays} gün sonra (${formatDate(val)})`;
    if (diffDays < -1) return `${Math.abs(diffDays)} gün önce (${formatDate(val)})`;
    return formatDate(val);
  }

  protected statusSelectClass(): string {
    const s = this.form.controls.status.value;
    switch (s) {
      case 'visited':
        return 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300';
      case 'called':
        return 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300';
      case 'trial':
        return 'border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300';
      case 'converted':
        return 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300';
      case 'lost':
        return 'border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300';
      default:
        return '';
    }
  }

  protected setBudget(value: string): void {
    this.form.controls.budgetRange.setValue(value);
  }

  protected setLostReason(reason: string): void {
    this.form.controls.lostReason.setValue(reason);
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
        followUpDate: v.followUpDate ? fromDateInput(v.followUpDate) : null,
        status: v.status,
        surveyNotes: v.surveyNotes.trim(),
        source: v.source || (v.referrerMemberId ? 'referral' : null),
        referrerMemberId: v.referrerMemberId || null,
        referrerName: this.members().find((m) => m.uid === v.referrerMemberId)?.displayName ?? null,
        assignedStaffName: v.assignedStaffName.trim(),
        lostReason: v.status === 'lost' ? v.lostReason.trim() || null : null,
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

  /** Adayı kayıtlı bir üyeye bağlar; sunucu aşamayı "Üyeye Dönüştü" yapar ve tavsiye ödülünü (açıksa) verir. */
  protected convertToMember(guest: GuestMember): void {
    const phone = guest.phone?.replace(/\D/g, '').slice(-10);
    const match = phone ? this.members().find((m) => m.phone?.replace(/\D/g, '').slice(-10) === phone) : undefined;
    this.convertMemberId.set(match?.uid ?? '');
    this.convertError.set('');
    this.converting.set(guest);
  }

  protected async confirmConvert(): Promise<void> {
    const guest = this.converting();
    if (!guest || this.submitting()) return;
    if (!this.convertMemberId()) {
      this.convertError.set('Bir üye seçin.');
      return;
    }
    this.submitting.set(true);
    try {
      const result = await firstValueFrom(this.leadsApi.convert(guest.id, this.convertMemberId()));
      this.alertService.toastSuccess(result.reward ? 'Aday üyeye bağlandı, tavsiye ödülü tanımlandı.' : 'Aday üyeye bağlandı.');
      this.converting.set(null);
      this.service.reload();
    } catch (err) {
      this.convertError.set(toAppError(err).message || 'İşlem tamamlanamadı.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected goCreateMember(): void {
    this.converting.set(null);
    void this.router.navigate(['/admin/members']);
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
