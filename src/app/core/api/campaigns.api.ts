import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { Campaign } from '../models/campaign.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class CampaignsApi {
  private readonly api = inject(ApiClient);

  list() {
    return this.api.get<Campaign[]>('/gym/campaigns', { limit: 100 }).pipe(map((r) => unwrapList<Campaign>(r.data)));
  }

  create(body: unknown) {
    return this.api.post<Campaign>('/gym/campaigns', body).pipe(map((r) => r.data));
  }

  update(id: string, body: unknown) {
    return this.api.patch<Campaign>(`/gym/campaigns/${id}`, body).pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api.delete<{ id: string }>(`/gym/campaigns/${id}`).pipe(map((r) => r.data));
  }

  broadcast(body: unknown) {
    return this.api.post<Campaign>('/gym/campaigns/broadcast', body).pipe(map((r) => r.data));
  }
}
