import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GymApi } from '../../core/api/gym.api';
import { CreateGymInfoInput, GymInfo } from '../../core/models/gym-info.model';

@Injectable({ providedIn: 'root' })
export class AdminGymInfoService {
  private readonly api = inject(GymApi);

  async load(): Promise<GymInfo | null> {
    return firstValueFrom(this.api.getInfo());
  }

  async save(input: CreateGymInfoInput, _exists: boolean): Promise<void> {
    await firstValueFrom(this.api.patchInfo(input));
  }
}
