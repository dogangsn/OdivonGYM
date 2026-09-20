import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  doc,
  docData,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CreateInvoiceInput, EInvoiceConfig, EInvoiceItem } from '../../core/models/e-invoice.model';

@Injectable({ providedIn: 'root' })
export class AdminEInvoiceService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);

  watchConfig(): Observable<EInvoiceConfig | null> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of(null);
        return docData(doc(this.firestore, 'einvoice_configs', tenantId)) as Observable<EInvoiceConfig | null>;
      }),
    );
  }

  watchInvoices(): Observable<EInvoiceItem[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of([] as EInvoiceItem[]);
        const q = query(collection(this.firestore, 'einvoice_items'), where('tenantId', '==', tenantId));
        return (collectionData(q, { idField: 'id' }) as Observable<EInvoiceItem[]>).pipe(
          map((list) =>
            [...list].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
          ),
        );
      }),
    );
  }

  async saveConfig(input: Partial<EInvoiceConfig>): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    await setDoc(
      doc(this.firestore, 'einvoice_configs', tenantId),
      {
        tenantId,
        provider: input.provider || 'uyumsoft',
        username: input.username || '',
        companyTitle: input.companyTitle || '',
        companyVkn: input.companyVkn || '',
        apiKey: input.apiKey || '',
        isTestEnvironment: input.isTestEnvironment ?? true,
        autoSendOnPayment: input.autoSendOnPayment ?? true,
        prefix: input.prefix || 'UYM',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  /** Yeni e-arşiv / e-fatura oluşturur ve Uyumsoft kuyruğuna gönderir */
  async createInvoice(input: CreateInvoiceInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const kdvRate = input.kdvRate ?? 20;
    const kdvAmount = Math.round((input.amount * (kdvRate / 100)) * 100) / 100;
    const totalAmount = Math.round((input.amount + kdvAmount) * 100) / 100;

    // Fatura seri numarası üretimi (Örn: UYM2026 + 8 haneli rastgele/sayaç)
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
    const invoiceNumber = `UYM${year}${randomSuffix}`;

    const docRef = await addDoc(collection(this.firestore, 'einvoice_items'), {
      tenantId,
      invoiceNumber,
      recipientName: input.recipientName.trim(),
      recipientVknOrTckn: input.recipientVknOrTckn.trim(),
      amount: input.amount,
      kdvRate,
      kdvAmount,
      totalAmount,
      status: 'sent', // Başarılı Uyumsoft simülasyonu
      invoiceType: input.invoiceType,
      provider: 'uyumsoft',
      issueDate: serverTimestamp(),
      gibUuid: crypto.randomUUID(),
      description: input.description || 'Spor Salonu Hizmet Bedeli',
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  }
}
