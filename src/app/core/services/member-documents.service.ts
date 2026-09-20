import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Firestore,
  Timestamp,
  collection,
  collectionData,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import {
  CreateMemberDocumentInput,
  DocumentStatus,
  MemberDocument,
  UpdateMemberDocumentInput,
} from '../models/member-document.model';

@Injectable({ providedIn: 'root' })
export class MemberDocumentsService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);

  /** Belirli bir üyenin tüm evrak ve lisanslarını dinler */
  watchMemberDocuments(userId: string): Observable<MemberDocument[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId || !userId) return of([] as MemberDocument[]);
        const q = query(
          collection(this.firestore, 'member_documents'),
          where('tenantId', '==', tenantId),
          where('userId', '==', userId),
        );
        return (collectionData(q, { idField: 'id' }) as Observable<MemberDocument[]>).pipe(
          map((list) =>
            [...list].sort(
              (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
            ),
          ),
        );
      }),
    );
  }

  /** Salondaki tüm üyelerin evraklarını (onay bekleyen, süresi dolan vb.) dinler */
  watchAllTenantDocuments(): Observable<MemberDocument[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of([] as MemberDocument[]);
        const q = query(
          collection(this.firestore, 'member_documents'),
          where('tenantId', '==', tenantId),
        );
        return (collectionData(q, { idField: 'id' }) as Observable<MemberDocument[]>).pipe(
          map((list) =>
            [...list].sort(
              (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
            ),
          ),
        );
      }),
    );
  }

  async addDocument(input: CreateMemberDocumentInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const col = collection(this.firestore, 'member_documents');
    const newDoc = doc(col);
    const now = serverTimestamp();

    await setDoc(newDoc, {
      id: newDoc.id,
      userId: input.userId,
      tenantId,
      disciplineId: input.disciplineId || null,
      documentType: input.documentType,
      documentName: input.documentName.trim(),
      fileUrl: input.fileUrl || null,
      issueDate: Timestamp.fromDate(input.issueDate),
      expiryDate: input.expiryDate ? Timestamp.fromDate(input.expiryDate) : null,
      status: input.status || 'approved',
      notes: input.notes?.trim() || '',
      verifiedBy: this.auth.profile()?.displayName || 'Yönetici',
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return newDoc.id;
  }

  async updateDocument(id: string, input: UpdateMemberDocumentInput): Promise<void> {
    const payload: Record<string, any> = {
      ...input,
      updatedAt: serverTimestamp(),
    };
    if (input.issueDate) {
      payload['issueDate'] = Timestamp.fromDate(input.issueDate);
    }
    if (input.expiryDate !== undefined) {
      payload['expiryDate'] = input.expiryDate ? Timestamp.fromDate(input.expiryDate) : null;
    }

    await updateDoc(doc(this.firestore, 'member_documents', id), payload);
  }

  async updateDocumentStatus(id: string, status: DocumentStatus, notes?: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'member_documents', id), {
      status,
      ...(notes !== undefined ? { notes } : {}),
      verifiedBy: this.auth.profile()?.displayName || 'Yönetici',
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async deleteDocument(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'member_documents', id));
  }
}
