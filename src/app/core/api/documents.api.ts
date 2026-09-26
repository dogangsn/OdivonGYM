import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { MemberDocument } from '../models/member-document.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private readonly api = inject(ApiClient);

  list(query?: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<MemberDocument[]>('/gym/member-documents', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<MemberDocument>(r.data)));
  }

  create(body: unknown) {
    return this.api.post<MemberDocument>('/gym/member-documents', body).pipe(map((r) => r.data));
  }

  update(id: string, body: unknown) {
    return this.api.patch<MemberDocument>(`/gym/member-documents/${id}`, body).pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api.delete<{ id: string }>(`/gym/member-documents/${id}`).pipe(map((r) => r.data));
  }
}
