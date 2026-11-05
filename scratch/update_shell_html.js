const fs = require('fs');
const path = 'C:/Users/dogan/Documents/Private/Project/OdivonGYM/src/app/shared/layout/shell/shell.html';
let code = fs.readFileSync(path, 'utf8');

const target = `          <div class="hidden lg:flex flex-col text-left leading-tight pointer-events-none">
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[110px]">
              {{ auth.profile()?.displayName || 'admin' }}
            </span>
            <span class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              {{ permissions.roleDefinition().badge }}
            </span>
          </div>
          <mat-icon class="text-slate-400 text-[18px] w-4.5 h-4.5 pointer-events-none hidden sm:block">expand_more</mat-icon>
        </button>

        <mat-menu #userProfileMenu="matMenu" xPosition="before">
          <div class="px-4 py-2.5 border-b border-slate-100 text-xs">
            <p class="font-bold text-slate-900 m-0">{{ auth.profile()?.displayName || 'admin' }}</p>
            <p class="text-slate-500 text-[11px] m-0">{{ auth.profile()?.email }}</p>
            <div class="mt-1 flex items-center gap-1.5 flex-wrap">
              <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold border" [ngClass]="permissions.roleDefinition().badgeClass">
                {{ permissions.roleDefinition().name }}
              </span>
              @if (permissions.previewRole()) {
                <span class="inline-block px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800">
                  ({{ 'shell.simulation' | transloco }})
                </span>
              }
            </div>
          </div>
          <button mat-menu-item (click)="openQrModal()">`;

const replacement = `          <div class="hidden lg:flex flex-col text-left leading-tight pointer-events-none">
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
              {{ auth.profile()?.displayName || 'admin' }}
            </span>
            <div class="flex items-center gap-1">
              <span class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {{ permissions.roleDefinition().badge }}
              </span>
              <span class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                · {{ saasSub.activePlan().name }}
              </span>
            </div>
          </div>
          <mat-icon class="text-slate-400 text-[18px] w-4.5 h-4.5 pointer-events-none hidden sm:block">expand_more</mat-icon>
        </button>

        <mat-menu #userProfileMenu="matMenu" xPosition="before">
          <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-xs min-w-[260px]">
            <p class="font-black text-slate-900 dark:text-white m-0 text-sm tracking-tight">{{ auth.profile()?.displayName || 'admin' }}</p>
            <p class="text-slate-500 dark:text-slate-400 text-[11px] m-0">{{ auth.profile()?.email }}</p>
            <div class="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold border" [ngClass]="permissions.roleDefinition().badgeClass">
                {{ permissions.roleDefinition().name }}
              </span>
              @if (permissions.previewRole()) {
                <span class="inline-block px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800">
                  ({{ 'shell.simulation' | transloco }})
                </span>
              }
            </div>

            <!-- SaaS ABONE & PAKET BİLGİSİ KARTI -->
            <div class="mt-2.5 p-2.5 rounded-xl bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-slate-50 dark:from-indigo-950/50 dark:via-purple-950/30 dark:to-slate-800/60 border border-indigo-100/90 dark:border-indigo-900/60 shadow-xs">
              <div class="flex items-center justify-between gap-1.5">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <mat-icon class="icon-size-3.5">verified</mat-icon>
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-black text-slate-900 dark:text-white truncate">
                        {{ saasSub.activePlan().name }}
                      </span>
                      <span class="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300">
                        {{ saasSub.isTrial() ? 'Deneme' : (saasSub.billingCycle() === 'yearly' ? 'Yıllık' : 'Aylık') }}
                      </span>
                    </div>
                  </div>
                </div>

                @if (permissions.isAdmin()) {
                  <a
                    routerLink="/admin/subscription"
                    class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 flex items-center gap-0.5 no-underline shrink-0"
                    title="Abonelik Paketini Yönet"
                  >
                    <span>Yönet</span>
                    <mat-icon class="icon-size-3">chevron_right</mat-icon>
                  </a>
                }
              </div>

              <!-- Durum & Kalan Süre -->
              <div class="mt-1.5 pt-1.5 border-t border-indigo-100/70 dark:border-indigo-900/50 flex items-center justify-between text-[10px]">
                <span class="text-slate-600 dark:text-slate-300 flex items-center gap-1 font-semibold">
                  @if (saasSub.isTrial()) {
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                    <span>{{ saasSub.trialDaysLeft() }} gün deneme süresi</span>
                  } @else if (saasSub.isActive()) {
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span class="text-emerald-700 dark:text-emerald-400 font-semibold">Aktif Abonelik</span>
                  } @else {
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                    <span class="text-rose-600 font-semibold">Süresi Doldu</span>
                  }
                </span>

                <span class="text-slate-400 text-[10px] font-mono">
                  SaaS Paket
                </span>
              </div>
            </div>
          </div>

          <!-- MENÜ LİSTESİ -->
          @if (permissions.isAdmin()) {
            <button mat-menu-item routerLink="/admin/subscription">
              <mat-icon class="text-indigo-600">card_membership</mat-icon>
              <span class="flex items-center justify-between flex-1 gap-2">
                <span>Abonelik & SaaS Paketi</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                  {{ saasSub.activePlan().name }}
                </span>
              </span>
            </button>
          }
          <button mat-menu-item (click)="openQrModal()">`;

let normCode = code.replace(/\r\n/g, '\n');
let normTarget = target.replace(/\r\n/g, '\n');
let normRep = replacement.replace(/\r\n/g, '\n');

if (!normCode.includes(normTarget)) {
  console.error('Target not found in shell.html!');
  process.exit(1);
}

normCode = normCode.replace(normTarget, normRep);
fs.writeFileSync(path, normCode.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully updated shell.html with SaaS subscription card!');

