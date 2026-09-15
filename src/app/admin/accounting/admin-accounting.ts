import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ComingSoon } from '../../shared/components/coming-soon/coming-soon';

@Component({
  selector: 'app-admin-accounting',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Muhasebe"
      icon="account_balance"
      description="Gelir/gider raporları, üyelik ödemeleri ve market satışlarının mali özeti."
    />
    <app-coming-soon
      icon="account_balance"
      title="Muhasebe modülü yakında burada"
      description="Üyelik ödemeleri, market satışları ve giderlerin birleştiği gelir raporları burada görünecek. E-fatura/e-arşiv entegrasyonu gerekiyorsa bir sonraki adımda birlikte netleştirelim."
    />
  `,
})
export class AdminAccounting {}
