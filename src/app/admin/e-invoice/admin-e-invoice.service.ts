import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of, startWith, switchMap } from 'rxjs';
import { EinvoiceApi } from '../../core/api/einvoice.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { CreateInvoiceInput, EInvoiceConfig, EInvoiceItem } from '../../core/models/e-invoice.model';

@Injectable({ providedIn: 'root' })
export class AdminEInvoiceService {
  private readonly api = inject(EinvoiceApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchConfig(): Observable<EInvoiceConfig | null> {
    return this.profile$.pipe(
      switchMap((profile) => {
        if (!profile?.tenantId) return of(null);
        return this.reload$.pipe(
          startWith(null),
          switchMap(() => this.api.getConfig()),
        );
      }),
    );
  }

  watchInvoices(): Observable<EInvoiceItem[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listItems());
  }

  async saveConfig(input: Partial<EInvoiceConfig>): Promise<void> {
    await firstValueFrom(this.api.saveConfig(input));
    this.reload$.next();
  }

  async createInvoice(input: CreateInvoiceInput): Promise<string> {
    const created = await firstValueFrom(
      this.api.createItem({
        ...input,
        issueDate: input.issueDate ? new Date(input.issueDate).toISOString() : undefined,
      }),
    );
    this.reload$.next();
    return created.id;
  }

  async deleteInvoice(id: string): Promise<void> {
    await firstValueFrom(this.api.removeItem(id));
    this.reload$.next();
  }

  async seedSampleInvoices(): Promise<void> {
    const samples: CreateInvoiceInput[] = [
      {
        invoiceNumber: 'GIB202600000101',
        direction: 'outbound',
        recipientName: 'Mert Aksoy',
        recipientVknOrTckn: '28491029384',
        amount: 2500,
        kdvRate: 20,
        invoiceType: 'earswive',
        provider: 'gib_portal',
        paymentMethod: 'card',
        paymentStatus: 'paid',
        description: '6 Aylık Standart Fitness Paketi',
      },
      {
        invoiceNumber: 'FAT202600000214',
        direction: 'inbound',
        recipientName: 'Protein Dağıtım & Spor Gıdaları A.Ş.',
        recipientVknOrTckn: '7390192841',
        amount: 8500,
        kdvRate: 10,
        invoiceType: 'purchase',
        provider: 'manuel',
        paymentMethod: 'transfer',
        paymentStatus: 'paid',
        description: 'Whey Protein ve BCAA Toptan Stok Alımı',
      },
    ];
    for (const sample of samples) {
      await this.createInvoice(sample);
    }
  }
}
