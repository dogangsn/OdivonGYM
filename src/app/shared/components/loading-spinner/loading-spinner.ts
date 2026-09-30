import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GymLoader } from '../gym-loader/gym-loader';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [GymLoader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-4 text-center w-full">
      <app-gym-loader [inline]="true" [message]="label() || 'Veriler Yükleniyor…'" size="sm" />
    </div>
  `,
})
export class LoadingSpinner {
  readonly label = input<string>('');
}
