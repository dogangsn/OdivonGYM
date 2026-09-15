import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ComingSoon } from '../../shared/components/coming-soon/coming-soon';

@Component({
  selector: 'app-admin-branches',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Şubeler"
      icon="store"
      description="Birden fazla salon şubesini yönet — adres, çalışma saatleri, kapasite."
    />
    <app-coming-soon
      icon="store"
      title="Şube yönetimi yakında burada"
      description="Tek salon mu, zincir mi olduğunu buradan kur; her şubenin kendi üyeleri, çalışanları ve doluluk durumu ayrı takip edilecek."
    />
  `,
})
export class AdminBranches {}
