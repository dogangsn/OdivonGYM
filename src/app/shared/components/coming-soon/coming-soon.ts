import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Henüz inşa edilmemiş bir bölüm için tutarlı, "boş" hissettirmeyen durum
 * ekranı. Faz 2+'da gerçek içerikle değiştirilecek sayfalar bunu kullanır.
 */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="coming-soon">
      <span class="coming-soon__icon">
        <mat-icon>{{ icon() }}</mat-icon>
      </span>
      <h2>{{ title() }}</h2>
      <p>{{ description() }}</p>
      <button mat-stroked-button type="button" (click)="notify()">
        <mat-icon>notifications</mat-icon>
        Hazır olunca haber ver
      </button>
    </div>
  `,
  styles: `
    .coming-soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 6px;
      max-width: 420px;
      margin: 48px auto;
      padding: 40px 32px;
      border-radius: 24px;
      border: 1px dashed var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
    }

    .coming-soon__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      margin-bottom: 12px;
      border-radius: 16px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
    }

    h2 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
    }

    p {
      margin: 4px 0 20px;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.9rem;
    }
  `,
})
export class ComingSoon {
  private readonly snackBar = inject(MatSnackBar);

  readonly icon = input('construction');
  readonly title = input.required<string>();
  readonly description = input('Bu bölüm bir sonraki fazda aktif olacak.');

  notify(): void {
    this.snackBar.open('Not edildi — bu bölüm hazır olduğunda seni bilgilendireceğiz.', 'Kapat', {
      duration: 3000,
    });
  }
}
