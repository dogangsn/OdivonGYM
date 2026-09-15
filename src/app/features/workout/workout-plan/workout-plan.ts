import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ComingSoon } from '../../../shared/components/coming-soon/coming-soon';

@Component({
  selector: 'app-workout-plan',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Antrenman Programı"
      icon="sports_gymnastics"
      description="Kişisel antrenman planını, egzersiz videolarını ve set/tekrar takibini burada göreceksin."
    />
    <app-coming-soon
      icon="sports_gymnastics"
      title="Antrenman programı yakında burada"
      description="Antrenörün sana özel hazırladığı programı, set/tekrar geçmişini ve ilerlemeni bir sonraki fazda buradan takip edeceksin."
    />
  `,
})
export class WorkoutPlan {}
