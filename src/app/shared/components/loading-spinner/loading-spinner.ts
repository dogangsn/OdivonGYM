import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <mat-spinner [diameter]="40" color="primary" />
      @if (label()) {
        <p class="text-sm text-[var(--mat-sys-on-surface-variant)]">{{ label() }}</p>
      }
    </div>
  `,
})
export class LoadingSpinner {
  readonly label = input<string>('');
}
