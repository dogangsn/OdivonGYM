import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ComingSoon } from '../../../shared/components/coming-soon/coming-soon';

@Component({
  selector: 'app-water-tracker',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Su Takibi"
      icon="water_drop"
      description="Günlük su hedefini belirle, içtikçe işaretle."
    />
    <app-coming-soon
      icon="water_drop"
      title="Su takibi yakında burada"
      description="Günlük hedefe ne kadar kaldığını gösteren basit bir sayaçla suyunu takip edeceksin."
    />
  `,
})
export class WaterTracker {}
