import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { DocumentsApi } from '../api/documents.api';
import { tenantReload } from '../api/unwrap';
import { AuthService } from '../auth/auth.service';
import {
  CreateMemberDocumentInput,
  DocumentStatus,
  MemberDocument,
  UpdateMemberDocumentInput,
} from '../models/member-document.model';

@Injectable({ providedIn: 'root' })
export class MemberDocumentsService {
  private readonly api = inject(DocumentsApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchMemberDocuments(userId: string): Observable<MemberDocument[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.list({ userId }));
  }

  watchAllTenantDocuments(): Observable<MemberDocument[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.list());
  }

  async addDocument(input: CreateMemberDocumentInput): Promise<string> {
    const created = await firstValueFrom(
      this.api.create({
        ...input,
        issueDate: input.issueDate.toISOString(),
        expiryDate: input.expiryDate ? input.expiryDate.toISOString() : null,
      }),
    );
    this.reload$.next();
    return created.id;
  }

  async updateDocument(id: string, input: UpdateMemberDocumentInput): Promise<void> {
    await firstValueFrom(
      this.api.update(id, {
        ...input,
        issueDate: input.issueDate instanceof Date ? input.issueDate.toISOString() : input.issueDate,
        expiryDate:
          input.expiryDate instanceof Date ? input.expiryDate.toISOString() : input.expiryDate,
      }),
    );
    this.reload$.next();
  }

  async updateDocumentStatus(id: string, status: DocumentStatus, notes?: string): Promise<void> {
    await firstValueFrom(this.api.update(id, { status, notes }));
    this.reload$.next();
  }

  async deleteDocument(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id));
    this.reload$.next();
  }
}
