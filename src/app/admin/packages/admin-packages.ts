import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ComingSoon } from '../../shared/components/coming-soon/coming-soon';

@Component({
  selector: 'app-admin-packages',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Paket & Fiyatlandırma"
      icon="sell"
      description="Üyelik paketlerini oluştur, düzenle, fiyatlandır — üyelerin /paketler sayfasında gördüğü liste burada yönetilir."
    />
    <app-coming-soon
      icon="sell"
      title="Paket yönetimi yakında burada"
      description="Aylık/3 aylık/6 aylık/yıllık paketleri, fiyatlarını ve içeriklerini buradan ekleyip düzenleyeceksin."
    />
  `,
})
export class AdminPackages {}
