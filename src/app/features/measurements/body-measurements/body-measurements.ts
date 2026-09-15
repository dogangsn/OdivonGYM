import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ComingSoon } from '../../../shared/components/coming-soon/coming-soon';

@Component({
  selector: 'app-body-measurements',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Vücut Ölçümleri"
      icon="monitor_weight"
      description="Kilo, yağ oranı ve diğer ölçümlerini zaman içindeki grafiklerle takip et."
    />
    <app-coming-soon
      icon="monitor_weight"
      title="Ölçüm geçmişi yakında burada"
      description="Her ölçümünü kaydedip ilerlemeni grafik üzerinde görebileceksin."
    />
  `,
})
export class BodyMeasurements {}
