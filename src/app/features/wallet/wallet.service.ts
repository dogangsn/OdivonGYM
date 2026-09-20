import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { WalletTransaction } from '../../core/models/wallet-transaction.model';

/**
 * Üye tarafı sadece OKUR: bakiye ve hareketler admin panelinden (bkz.
 * `AdminMembersService.adjustWallet`) yazılır — üye kendi bakiyesini yükleyemez.
 */
@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchTransactions(): Observable<WalletTransaction[]> {
    const uid = this.auth.profile()?.uid;
    const tenantId = this.auth.profile()?.tenantId;
    if (!uid || !tenantId) return of([]);

    return collectionData(
      query(
        collection(this.firestore, 'wallet_transactions'),
        where('userId', '==', uid),
        where('tenantId', '==', tenantId),
      ),
      { idField: 'id' },
    ) as Observable<WalletTransaction[]>;
  }
}
