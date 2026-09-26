import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { GuestMember } from '../models/guest-member.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class GuestsApi {
  private readonly api = inject(ApiClient);

  list() {
    return this.api.get<GuestMember[]>('/gym/guest-members', { limit: 100 }).pipe(map((r) => unwrapList<GuestMember>(r.data)));
  }

  create(body: unknown) {
    return this.api.post<GuestMember>('/gym/guest-members', body).pipe(map((r) => r.data));
  }

  update(id: string, body: unknown) {
    return this.api.patch<GuestMember>(`/gym/guest-members/${id}`, body).pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api.delete<{ id: string }>(`/gym/guest-members/${id}`).pipe(map((r) => r.data));
  }
}
