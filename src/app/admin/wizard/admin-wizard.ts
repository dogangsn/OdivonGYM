import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PageHeader } from '../../shared/components/page-header/page-header';
import { TrainingWizardService } from '../../core/services/training-wizard.service';
import { AdminDisciplinesService } from '../disciplines/admin-disciplines.service';
import { AdminMembersService } from '../members/admin-members.service';
import { BranchContextService } from '../../core/services/branch-context.service';

@Component({
  selector: 'app-admin-wizard',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <!-- 1. Page Header -->
      <app-page-header
        title="Eğitim & Tanımlama Sihirbazı"
        icon="auto_awesome"
        description="Sporculara özel antrenman programları hazırlayın veya tüm branş, tesis ve cihazları zincirleme olarak tanımlayın."
      >
        <div actions class="flex items-center gap-2">
          <button
            type="button"
            (click)="wizard.open('setup')"
            class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <mat-icon class="icon-size-4">account_tree</mat-icon>
            <span>Zincirleme Tanımla</span>
          </button>
          <button
            type="button"
            (click)="wizard.open('workout')"
            class="odv-btn-primary text-xs"
          >
            <mat-icon class="icon-size-4">fitness_center</mat-icon>
            <span>+ Antrenman Programı Başlat</span>
          </button>
        </div>
      </app-page-header>

      <!-- 2. Hero Launchpad Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Card 1: Sporcu Antrenman Sihirbazı -->
        <div
          (click)="wizard.open('workout')"
          class="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden flex flex-col justify-between cursor-pointer group hover:scale-[1.01] transition-all"
        >
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                <mat-icon class="icon-size-6">fitness_center</mat-icon>
              </div>
              <span class="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/30">
                Üyeye Özel
              </span>
            </div>

            <h3 class="text-xl sm:text-2xl font-black text-white tracking-tight m-0">
              Sporcu Eğitim & Antrenman Sihirbazı
            </h3>
            <p class="text-xs sm:text-sm text-indigo-100 mt-2 mb-0 leading-relaxed max-w-md">
              Salondaki bir üyeyi seçin, spor branşı (Fitness, Boks, Reformer), hedef kas grupları ve salondaki tanımlı cihazlara göre set/tekrar/dinlenme direktiflerini adım adım belirleyin.
            </p>
          </div>

          <div class="mt-6 pt-4 border-t border-white/20 flex items-center justify-between text-xs font-bold text-white">
            <span>{{ membersCount() }} Kayıtlı Üye</span>
            <span class="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Sihirbazı Başlat →
            </span>
          </div>
        </div>

        <!-- Card 2: Zincirleme Sistem Tanımlama Sihirbazı -->
        <div
          (click)="wizard.open('setup')"
          class="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl relative overflow-hidden flex flex-col justify-between cursor-pointer group hover:scale-[1.01] transition-all"
        >
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                <mat-icon class="icon-size-6">account_tree</mat-icon>
              </div>
              <span class="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-white/10 text-slate-300 border border-white/20">
                Zincirleme Tanım
              </span>
            </div>

            <h3 class="text-xl sm:text-2xl font-black text-white tracking-tight m-0">
              Sistem & Donanım Tanımlama Sihirbazı
            </h3>
            <p class="text-xs sm:text-sm text-slate-300 mt-2 mb-0 leading-relaxed max-w-md">
              "Sistem üzerinde ne eklersek tanımlamalı olarak devam etsin" kuralıyla; yeni bir branş, antrenman alanı, cihaz envanteri ve bölgesel egzersiz kütüphanesini sırayla birbirine bağlayarak kurun.
            </p>
          </div>

          <div class="mt-6 pt-4 border-t border-slate-700/80 flex items-center justify-between text-xs font-bold text-slate-300">
            <span>{{ disciplinesCount() }} Branş • {{ equipmentCount() }} Ekipman</span>
            <span class="inline-flex items-center gap-1 text-indigo-400 group-hover:translate-x-1 transition-transform">
              Tanımlamayı Başlat →
            </span>
          </div>
        </div>
      </div>

      <!-- 3. Sistem Envanter Özeti (4 KPI Kartı) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Tanımlı Branşlar</span>
          <div class="text-2xl font-black text-slate-900">{{ disciplinesCount() }}</div>
          <span class="text-[11px] font-semibold text-indigo-600">Fitness, Boks, Reformer...</span>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Salon Alanları</span>
          <div class="text-2xl font-black text-slate-900">{{ facilitiesCount() }}</div>
          <span class="text-[11px] font-semibold text-emerald-600">Stüdyo ve Katlar</span>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cihaz & Ekipman</span>
          <div class="text-2xl font-black text-slate-900">{{ equipmentCount() }}</div>
          <span class="text-[11px] font-semibold text-amber-600">Envanterdeki Makineler</span>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Aktif Şube</span>
          <div class="text-base sm:text-lg font-black text-slate-900 truncate">{{ branchContext.activeBranchName() }}</div>
          <span class="text-[11px] font-semibold text-slate-400">Çalışma Lokasyonu</span>
        </div>
      </div>
    </div>
  `,
})
export class AdminWizard {
  protected readonly wizard = inject(TrainingWizardService);
  protected readonly branchContext = inject(BranchContextService);
  private readonly membersService = inject(AdminMembersService);
  private readonly disciplinesService = inject(AdminDisciplinesService);

  private readonly members = toSignal(this.membersService.watchMembers(), { initialValue: [] });
  private readonly disciplines = toSignal(this.disciplinesService.watchDisciplines(), { initialValue: [] });
  private readonly facilities = toSignal(this.disciplinesService.watchFacilities(), { initialValue: [] });
  private readonly equipment = toSignal(this.disciplinesService.watchEquipment(), { initialValue: [] });

  protected readonly membersCount = computed(() => this.members().length);
  protected readonly disciplinesCount = computed(() => this.disciplines().length);
  protected readonly facilitiesCount = computed(() => this.facilities().length);
  protected readonly equipmentCount = computed(() => this.equipment().length);
}
