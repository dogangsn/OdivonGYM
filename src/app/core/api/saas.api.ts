import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { GymSaasSubscription } from '../models/saas-plan.model';

@Injectable({ providedIn: 'root' })
export class SaasApi {
  private readonly api = inject(ApiClient);

  get() {
    return this.api.get<GymSaasSubscription | null>('/gym/saas').pipe(map((r) => r.data));
  }

  save(body: unknown) {
    return this.api.patch<GymSaasSubscription>('/gym/saas', body).pipe(map((r) => r.data));
  }
}
