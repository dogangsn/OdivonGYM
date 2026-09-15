import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ComingSoon } from '../../shared/components/coming-soon/coming-soon';

@Component({
  selector: 'app-admin-shop',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Market Satışları"
      icon="point_of_sale"
      description="Salon içi kantin/market ürün stoku ve satış takibi (protein tozu, içecek, aksesuar vb.)."
    />
    <app-coming-soon
      icon="point_of_sale"
      title="Market modülü yakında burada"
      description="Ürün stoku, satış noktası (POS) ekranı ve günlük/aylık satış raporları burada olacak."
    />
  `,
})
export class AdminShop {}
