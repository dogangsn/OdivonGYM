import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdentityApi } from '../../core/api/identity.api';
import { AuthService } from '../../core/auth/auth.service';
import { UserProfile, Gender } from '../../core/models/user-profile.model';

export interface UpdateProfileInput {
  displayName?: string;
  phone?: string;
  gender?: Gender;
  birthDate?: Date | null;
  country?: string;
  language?: string;
  photoURL?: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly identity = inject(IdentityApi);
  private readonly auth = inject(AuthService);

  async updateProfile(input: UpdateProfileInput): Promise<void> {
    await firstValueFrom(
      this.identity.updateMe({
        displayName: input.displayName,
        phone: input.phone,
      }),
    );
    await this.auth.refreshProfile();
  }
}
