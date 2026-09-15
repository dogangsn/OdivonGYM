import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ComingSoon } from '../../../shared/components/coming-soon/coming-soon';

@Component({
  selector: 'app-class-schedule',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Ders Takvimi"
      icon="calendar_month"
      description="Haftalık grup derslerini incele, yer ayırt ve rezervasyonlarını yönet."
    />
    <app-coming-soon
      icon="calendar_month"
      title="Ders takvimi yakında burada"
      description="Yoga, spin, box gibi grup derslerine buradan tek tıkla rezervasyon yapabileceksin."
    />
  `,
})
export class ClassSchedule {}
