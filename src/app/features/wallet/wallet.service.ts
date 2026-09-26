import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { WalletApi } from '../../core/api/wallet.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { WalletTransaction } from '../../core/models/wallet-transaction.model';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly api = inject(WalletApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchTransactions(): Observable<WalletTransaction[]> {
    return tenantReload(this.profile$, this.reload$, () =>
      this.api.list({ userId: this.auth.profile()?.uid }),
    );
  }
}
