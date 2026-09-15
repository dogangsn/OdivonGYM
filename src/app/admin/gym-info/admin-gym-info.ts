import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ComingSoon } from '../../shared/components/coming-soon/coming-soon';

@Component({
  selector: 'app-admin-gym-info',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Salon Bilgileri"
      icon="business"
      description="Salon adı, logo, adres, çalışma saatleri, iletişim bilgileri ve genel ayarlar."
    />
    <app-coming-soon
      icon="business"
      title="Salon bilgileri yakında burada"
      description="Salonunun adı, adresi, çalışma saatleri, iletişim bilgileri ve genel ayarları buradan düzenleyeceksin."
    />
  `,
})
export class AdminGymInfo {}
