import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  SAAS_PLANS_CONFIG,
  SaasBillingCycle,
  SaasPlan,
  SaasPlanId,
} from '../../core/models/saas-plan.model';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-admin-subscription',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-subscription.html',
  styleUrl: './admin-subscription.scss',
})
export class AdminSubscription {
  protected readonly subService = inject(SaasSubscriptionService);

  // Fatura Döngüsü (Aylık / Yıllık)
  readonly selectedCycle = signal<SaasBillingCycle>('yearly'); // Default to yearly to show value

  // Planlar listesi
  readonly plans = computed<SaasPlan[]>(() => [
    SAAS_PLANS_CONFIG.starter,
    SAAS_PLANS_CONFIG.pro,
    SAAS_PLANS_CONFIG.enterprise,
  ]);

  // Aktif plan
  readonly activePlan = computed(() => this.subService.activePlan());

  // Yükseltme modalı durumu
  readonly upgradeModalOpen = signal(false);
  readonly selectedTargetPlan = signal<SaasPlan | null>(null);
  readonly upgrading = signal(false);

  // FAQ Accordion State
  readonly openFaqIndex = signal<number | null>(0);

  readonly faqs: FaqItem[] = [
    {
      question: 'Deneme sürem bittiğinde salonumdaki veriler veya üye kayıtları silinir mi?',
      answer:
        'Kesinlikle hayır. Deneme süreniz sona erse dahi tüm şube, üye, turnike geçiş ve muhasebe kayıtlarınız güvenli bulut ortamımızda şifrelenmiş olarak saklanır. Paket seçimi yaptığınız anda sisteminiz kaldığı yerden kesintisiz açılır.',
    },
    {
      question: 'İstediğim zaman paketler arasında geçiş veya yükseltme yapabilir miyim?',
      answer:
        'Evet! Kulübünüz büyüdükçe veya yeni bir şube açtığınızda tek tıkla üst pakete geçebilirsiniz. Yıllık veya aylık paket farkı gün bazlı olarak oransal (prorated) hesaplanır, hiçbir kaybınız olmaz.',
    },
    {
      question: 'Yıllık ödeme seçtiğimde avantajım nedir?',
      answer:
        'Yıllık ödeme planında 12 ay yerine yalnızca 10 ay ücreti ödersiniz (2 ay tamamen OdivonGYM hediyesidir) ve %17 net nakit tasarruf sağlarsınız. Ayrıca yıllık lisanslarda öncelikli teknik destek ve donanım kurulum rehberliği ücretsiz verilir.',
    },
    {
      question: 'Uyumsoft E-Fatura ve Mali Mühür entegrasyonu nasıl çalışır?',
      answer:
        'Profesyonel ve Enterprise paketlerimizde Uyumsoft API entegrasyonu yerleşik olarak gelir. Salonunuzun VKN ve portal bilgilerini girdikten sonra, paket veya market satışlarında tek tıkla e-Arşiv ve e-Fatura kesebilir, mali müşavirinize tek tıkla döküm iletebilirsiniz.',
    },
    {
      question: 'Fiziksel turnike, QR ve kart okuyucu donanımlarını nasıl bağlıyoruz?',
      answer:
        'OdivonGYM; röle kontrol kartları, USB/Network barkod okuyucular, RFID proximity kartlar ve mobil turnike QR kodlarıyla tam uyumludur. Gerekli API ve donanım ayarlarını Turnike & Geçiş Kontrol menümüzden kolayca yapabilirsiniz.',
    },
  ];

  setCycle(cycle: SaasBillingCycle): void {
    this.selectedCycle.set(cycle);
  }

  toggleFaq(index: number): void {
    this.openFaqIndex.update((current) => (current === index ? null : index));
  }

  isCurrentPlan(planId: SaasPlanId): boolean {
    return this.activePlan().id === planId;
  }

  openUpgradeModal(plan: SaasPlan): void {
    this.selectedTargetPlan.set(plan);
    this.upgradeModalOpen.set(true);
  }

  closeUpgradeModal(): void {
    this.upgradeModalOpen.set(false);
    this.selectedTargetPlan.set(null);
  }

  async confirmUpgrade(): Promise<void> {
    const target = this.selectedTargetPlan();
    if (!target) return;

    this.upgrading.set(true);
    try {
      await this.subService.selectPlan(target.id, this.selectedCycle());
      this.closeUpgradeModal();
    } finally {
      this.upgrading.set(false);
    }
  }

  getPrice(plan: SaasPlan): number {
    return this.selectedCycle() === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  }

  getMonthlyEquivalent(plan: SaasPlan): number {
    return Math.round(plan.priceYearly / 12);
  }

  getPeriodLabel(): string {
    return this.selectedCycle() === 'yearly' ? '/ yıl' : '/ ay';
  }
}
