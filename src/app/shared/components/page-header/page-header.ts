import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Her sayfanın üstünde tutarlı bir başlık şeridi — ikon, başlık, açıklama ve
 * sağda aksiyon butonları için bir slot (`<ng-content select="[actions]">`).
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <div class="flex items-center gap-3">
          @if (icon()) {
            <span class="page-header__icon">
              <mat-icon>{{ icon() }}</mat-icon>
            </span>
          }
          <h1>{{ title() }}</h1>
        </div>
        @if (description()) {
          <p>{{ description() }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
  styles: `
    .page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
    }

    .page-header__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      border-radius: 12px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }

    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.01em;
    }

    p {
      margin: 6px 0 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.9rem;
      max-width: 60ch;
    }

    .page-header__actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly icon = input<string>('');
}
