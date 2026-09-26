import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GymApi } from '../api/gym.api';

@Injectable({ providedIn: 'root' })
export class TenantOnboardingService {
  private readonly api = inject(GymApi);

  async ensureTenantDefaults(_tenantId?: string, _tenantName?: string): Promise<void> {
    await firstValueFrom(this.api.seedDefaults());
  }
}
