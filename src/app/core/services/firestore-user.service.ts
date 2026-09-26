import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdentityApi } from '../api/identity.api';
import { UserProfile } from '../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class FirestoreUserService {
  private readonly identity = inject(IdentityApi);

  async updateOwnProfile(
    _uid: string,
    changes: Partial<Pick<UserProfile, 'displayName' | 'photoURL' | 'phone'>>,
  ): Promise<void> {
    await firstValueFrom(
      this.identity.updateMe({
        displayName: changes.displayName,
        phone: changes.phone,
      }),
    );
  }
}
