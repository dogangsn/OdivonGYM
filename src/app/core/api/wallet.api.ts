import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { UserProfile } from '../models/user-profile.model';
import { WalletTransaction } from '../models/wallet-transaction.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class WalletApi {
  private readonly api = inject(ApiClient);

  list(query?: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<WalletTransaction[]>('/gym/wallet', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<WalletTransaction>(r.data)));
  }

  adjust(body: unknown) {
    return this.api.post<WalletTransaction>('/gym/wallet', body).pipe(map((r) => r.data));
  }

  purchase(body: unknown) {
    return this.api.post<UserProfile>('/gym/wallet/purchase', body).pipe(map((r) => r.data));
  }
}
