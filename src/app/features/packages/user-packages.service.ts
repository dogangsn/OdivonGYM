import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { GymPackage } from '../../core/models/gym-package.model';

/** Üye tarafı: salonun aktif paket kataloğunu okur. Satın alma/atama admin panelinden yapılır. */
@Injectable({ providedIn: 'root' })
export class UserPackagesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchAvailablePackages(): Observable<GymPackage[]> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) return of([]);

    return collectionData(
      query(collection(this.firestore, 'gym_packages'), where('tenantId', '==', tenantId), where('status', '==', 'active')),
      { idField: 'id' },
    ) as Observable<GymPackage[]>;
  }
}
