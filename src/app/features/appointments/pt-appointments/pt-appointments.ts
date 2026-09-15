import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ComingSoon } from '../../../shared/components/coming-soon/coming-soon';

@Component({
  selector: 'app-pt-appointments',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="PT Randevu"
      icon="event_available"
      description="Personal trainer'ınla randevu al, mevcut randevularını görüntüle veya iptal et."
    />
    <app-coming-soon
      icon="event_available"
      title="Randevu sistemi yakında burada"
      description="Uygun saatleri görüp antrenörünle tek tıkla randevu oluşturabileceksin."
    />
  `,
})
export class PtAppointments {}
