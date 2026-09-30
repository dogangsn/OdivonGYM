import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-gym-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col items-center justify-center text-center select-none"
      [class.p-2]="inline()"
      [class.p-6]="!inline()"
      [class.sm:p-8]="!inline()"
    >
      <!-- Spor Aletleri Sahnesi (Barbell + Dumbbell + Kettlebell) -->
      <div class="relative flex items-center justify-center mb-3">
        <!-- Arka Plan Neon Işık Halkası -->
        <div class="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-indigo-500/25 via-purple-500/25 to-pink-500/25 blur-2xl animate-pulse pointer-events-none"></div>

        <svg
          viewBox="0 0 320 180"
          [class]="size() === 'sm' ? 'w-52 h-28' : size() === 'lg' ? 'w-84 h-48 sm:w-96 sm:h-52' : 'w-68 h-36 sm:w-76 sm:h-40'"
          class="overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <!-- Barbell Krom Metalik Gradyan -->
            <linearGradient id="barbellBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#f1f5f9"/>
              <stop offset="35%" stop-color="#ffffff"/>
              <stop offset="60%" stop-color="#94a3b8"/>
              <stop offset="100%" stop-color="#475569"/>
            </linearGradient>

            <!-- Kırmızı Plaka (25 KG) -->
            <linearGradient id="plateRedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#dc2626"/>
              <stop offset="40%" stop-color="#ef4444"/>
              <stop offset="100%" stop-color="#991b1b"/>
            </linearGradient>

            <!-- Mavi Plaka (20 KG) -->
            <linearGradient id="plateBlueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#2563eb"/>
              <stop offset="40%" stop-color="#3b82f6"/>
              <stop offset="100%" stop-color="#1e40af"/>
            </linearGradient>

            <!-- Sarı Plaka (15 KG) -->
            <linearGradient id="plateYellowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#eab308"/>
              <stop offset="40%" stop-color="#facc15"/>
              <stop offset="100%" stop-color="#a16207"/>
            </linearGradient>

            <!-- Dambıl Döküm Çelik Gradyan -->
            <linearGradient id="dumbbellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#475569"/>
              <stop offset="50%" stop-color="#334155"/>
              <stop offset="100%" stop-color="#0f172a"/>
            </linearGradient>

            <!-- Girya / Kettlebell Gövde Gradyanı -->
            <radialGradient id="kettlebellGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stop-color="#818cf8"/>
              <stop offset="30%" stop-color="#6366f1"/>
              <stop offset="75%" stop-color="#4338ca"/>
              <stop offset="100%" stop-color="#312e81"/>
            </radialGradient>

            <!-- EKG Nabız Neon Gradyanı -->
            <linearGradient id="ekgNeonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#6366f1" stop-opacity="0.15"/>
              <stop offset="35%" stop-color="#38bdf8"/>
              <stop offset="65%" stop-color="#818cf8"/>
              <stop offset="100%" stop-color="#ec4899" stop-opacity="0.15"/>
            </linearGradient>
          </defs>

          <!-- Taban Gölge Animasyonları -->
          <g class="gym-shadows">
            <!-- Halter Taban Gölgesi -->
            <ellipse cx="160" cy="154" rx="52" ry="6" class="barbell-shadow fill-black/60" />
            <!-- Sol Dambıl Gölgesi -->
            <ellipse cx="56" cy="148" rx="20" ry="4.5" class="dumbbell-shadow fill-black/60" />
            <!-- Sağ Girya Gölgesi -->
            <ellipse cx="264" cy="148" rx="19" ry="4.5" class="kettlebell-shadow fill-black/60" />
          </g>

          <!-- 1. SOL: DİNAMİK DAMBIL (Biceps Curl Hareketi) -->
          <g class="animated-dumbbell">
            <!-- Tutma Barı / Tırtıklı Sap -->
            <rect x="44" y="96" width="24" height="6" rx="2" fill="url(#barbellBarGrad)" />
            <line x1="50" y1="97" x2="50" y2="101" stroke="#64748b" stroke-width="0.8" />
            <line x1="56" y1="97" x2="56" y2="101" stroke="#64748b" stroke-width="0.8" />
            <line x1="62" y1="97" x2="62" y2="101" stroke="#64748b" stroke-width="0.8" />

            <!-- Sol Ağırlık Başlığı (Hexagon) -->
            <polygon points="36,83 44,88 44,110 36,115 28,110 28,88" fill="url(#dumbbellGrad)" stroke="#6366f1" stroke-width="1.2" />
            <!-- Sağ Ağırlık Başlığı (Hexagon) -->
            <polygon points="76,83 84,88 84,110 76,115 68,110 68,88" fill="url(#dumbbellGrad)" stroke="#6366f1" stroke-width="1.2" />

            <!-- Ağırlık Plakası Parlaması -->
            <circle cx="36" cy="99" r="3" fill="#818cf8" opacity="0.6" />
            <circle cx="76" cy="99" r="3" fill="#818cf8" opacity="0.6" />
          </g>

          <!-- 2. SAĞ: DİNAMİK GİRYA (Kettlebell Swing Hareketi) -->
          <g class="animated-kettlebell">
            <!-- Girya Kulpu -->
            <path d="M252 92 C252 75, 276 75, 276 92" fill="none" stroke="url(#barbellBarGrad)" stroke-width="5" stroke-linecap="round" />
            <!-- Girya Yuvarlak Gövdesi -->
            <circle cx="264" cy="107" r="18" fill="url(#kettlebellGrad)" />
            <!-- Gövde Yazı Çemberi -->
            <circle cx="264" cy="107" r="11" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-dasharray="2 2" />
            <text x="264" y="110.5" font-size="7.5" font-weight="900" font-family="monospace" text-anchor="middle" fill="#ffffff" opacity="0.95">16KG</text>
            <!-- Yüzey Parlama Işığı -->
            <ellipse cx="258" cy="100" rx="3.5" ry="1.8" fill="#ffffff" opacity="0.45" transform="rotate(-30 258 100)" />
          </g>

          <!-- 3. MERKEZ: OLİMPİK HALTER (Bench Press / Overhead Lift Hareketi) -->
          <g class="animated-barbell">
            <!-- Krom Halter Mili -->
            <rect x="94" y="76" width="132" height="6.5" rx="2" fill="url(#barbellBarGrad)" />

            <!-- Barbell Knurling / Tutuş Dokusu Çizgileri -->
            <line x1="126" y1="77" x2="126" y2="81.5" stroke="#475569" stroke-width="1" />
            <line x1="136" y1="77" x2="136" y2="81.5" stroke="#475569" stroke-width="1" />
            <line x1="184" y1="77" x2="184" y2="81.5" stroke="#475569" stroke-width="1" />
            <line x1="194" y1="77" x2="194" y2="81.5" stroke="#475569" stroke-width="1" />

            <!-- SOL PLAKALAR -->
            <!-- 25 KG Kırmızı Plaka -->
            <rect x="108" y="49" width="7.5" height="60.5" rx="2.5" fill="url(#plateRedGrad)" stroke="#7f1d1d" stroke-width="0.8" />
            <!-- 20 KG Mavi Plaka -->
            <rect x="100" y="54" width="6.5" height="50.5" rx="2" fill="url(#plateBlueGrad)" stroke="#1e3a8a" stroke-width="0.8" />
            <!-- 15 KG Sarı Plaka -->
            <rect x="94" y="60" width="5" height="38.5" rx="1.5" fill="url(#plateYellowGrad)" stroke="#713f12" stroke-width="0.8" />
            <!-- Sol Güvenlik Mandalı (Collar) -->
            <rect x="117" y="73" width="4.5" height="12.5" rx="1" fill="#334155" />

            <!-- SAĞ PLAKALAR -->
            <!-- 25 KG Kırmızı Plaka -->
            <rect x="204.5" y="49" width="7.5" height="60.5" rx="2.5" fill="url(#plateRedGrad)" stroke="#7f1d1d" stroke-width="0.8" />
            <!-- 20 KG Mavi Plaka -->
            <rect x="213.5" y="54" width="6.5" height="50.5" rx="2" fill="url(#plateBlueGrad)" stroke="#1e3a8a" stroke-width="0.8" />
            <!-- 15 KG Sarı Plaka -->
            <rect x="221" y="60" width="5" height="38.5" rx="1.5" fill="url(#plateYellowGrad)" stroke="#713f12" stroke-width="0.8" />
            <!-- Sağ Güvenlik Mandalı (Collar) -->
            <rect x="198.5" y="73" width="4.5" height="12.5" rx="1" fill="#334155" />

            <!-- Enerji / Kaldırma Kıvılcımları -->
            <circle cx="160" cy="74" r="1.5" fill="#a855f7" class="spark spark-1" />
            <circle cx="138" cy="65" r="1" fill="#6366f1" class="spark spark-2" />
            <circle cx="182" cy="65" r="1" fill="#ec4899" class="spark spark-3" />
          </g>

          <!-- Alt EKG / Nabız & Güç Çizgisi -->
          <path
            d="M50 162 L115 162 L125 152 L135 170 L145 146 L155 174 L165 156 L175 162 L270 162"
            fill="none"
            stroke="url(#ekgNeonGrad)"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="ekg-line"
            filter="drop-shadow(0 0 5px rgba(56, 189, 248, 0.6))"
          />
        </svg>
      </div>

      <!-- Bilgi Rozeti (Neon Glow) -->
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold tracking-widest uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-400/30 shadow-[0_0_15px_rgba(99,102,241,0.25)] mb-2.5">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
        </span>
        <span>ODIVON GYM</span>
      </div>

      <!-- Dinamik Başlık & Yükleme İpucu (Net Beyaz Başlık) -->
      <h4 class="text-sm sm:text-base font-extrabold text-white tracking-tight drop-shadow-sm m-0 transition-all duration-300">
        {{ message() || 'Veriler Yükleniyor…' }}
      </h4>

      @if (submessage()) {
        <p class="text-xs text-slate-300 mt-1 mb-0 font-medium tracking-normal">
          {{ submessage() }}
        </p>
      }

      <!-- İnce Akıcı Neon İlerleme Çubuğu -->
      <div class="w-48 sm:w-56 h-1.5 bg-white/10 rounded-full overflow-hidden mt-3.5 relative border border-white/10 shadow-inner">
        <div class="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-sky-400 to-pink-500 rounded-full shadow-[0_0_14px_rgba(56,189,248,0.7)] animate-gym-progress"></div>
      </div>
    </div>
  `,
  styleUrl: './gym-loader.scss',
})
export class GymLoader {
  readonly message = input<string>('Veriler Yükleniyor…');
  readonly submessage = input<string>('');
  readonly inline = input<boolean>(false);
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly dark = input<boolean>(true);
}
