import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of, startWith, switchMap } from 'rxjs';
import { EinvoiceApi } from '../../core/api/einvoice.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { CreateInvoiceInput, EInvoiceConfig, EInvoiceItem, InvoiceStatus } from '../../core/models/e-invoice.model';

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

  async updateInvoice(
    id: string,
    patch: Partial<CreateInvoiceInput> & { status?: InvoiceStatus; gibUuid?: string },
  ): Promise<void> {
    await firstValueFrom(this.api.updateItem(id, patch));
    this.reload$.next();
  }

  async deleteInvoice(id: string): Promise<void> {
    await firstValueFrom(this.api.removeItem(id));
    this.reload$.next();
  }

  async seedSampleInvoices(): Promise<void> {
    const samples: CreateInvoiceInput[] = [
      {
        invoiceNumber: 'GIB2026000000001',
        gibUuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        direction: 'outbound',
        recipientName: 'Mert Aksoy',
        recipientVknOrTckn: '28491029384',
        recipientAddress: 'Nisbetiye Mah. Aytar Cad. No: 18 Beşiktaş / İstanbul',
        recipientDistrict: 'Beşiktaş',
        recipientCity: 'İstanbul',
        recipientPhone: '0532 100 20 30',
        recipientEmail: 'mert.aksoy@example.com',
        amount: 3000,
        discountTotal: 0,
        kdvRate: 20,
        invoiceType: 'earswive',
        invoiceProfile: 'EARSIVFATURA',
        invoiceTypeCode: 'SATIS',
        provider: 'gib_portal',
        paymentMethod: 'card',
        paymentStatus: 'paid',
        isDeliveryNoteReplacement: true,
        description: '6 Aylık Premium Fitness & Reformer Pilates Üyeliği',
        notes: '213 sayılı VUK 509 tebliği uyarınca e-Arşiv faturanın kağıt çıktısı irsaliye yerine geçer.',
        items: [
          {
            name: '6 Aylık Premium Fitness Üyeliği',
            quantity: 1,
            unit: 'Paket',
            unitPrice: 2000,
            discountRate: 0,
            discountAmount: 0,
            kdvRate: 20,
            total: 2000,
            kdvAmount: 400,
            grandTotal: 2400,
          },
          {
            name: 'Kişisel Antrenörlük (PT) 5 Seans',
            quantity: 5,
            unit: 'Seans',
            unitPrice: 200,
            discountRate: 0,
            discountAmount: 0,
            kdvRate: 20,
            total: 1000,
            kdvAmount: 200,
            grandTotal: 1200,
          },
        ],
      },
      {
        invoiceNumber: 'ODV2026000000042',
        gibUuid: 'a5e3f421-4829-4c28-9841-f76100192834',
        direction: 'outbound',
        recipientName: 'Bora Teknoloji Danışmanlık A.Ş.',
        recipientVknOrTckn: '1820491823',
        recipientTaxOffice: 'Zincirlikuyu Vergi Dairesi',
        recipientAddress: 'Büyükdere Cad. No: 193 Şişli / İstanbul',
        recipientDistrict: 'Şişli',
        recipientCity: 'İstanbul',
        recipientPhone: '0212 400 50 60',
        recipientEmail: 'fatura@borateknoloji.com',
        amount: 15000,
        discountTotal: 0,
        kdvRate: 20,
        invoiceType: 'commercial',
        invoiceProfile: 'TICARIFATURA',
        invoiceTypeCode: 'SATIS',
        provider: 'uyumsoft',
        paymentMethod: 'transfer',
        paymentStatus: 'paid',
        isDeliveryNoteReplacement: true,
        description: 'Kurumsal Şirket Çalışanları Yıllık Spor Salonu Sağlık Paketi',
        notes: 'Kurumsal üyelik sözleşmesi kapsamında düzenlenmiştir.',
        items: [
          {
            name: 'Kurumsal Şirket Fitness Üyeliği (10 Kişilik Kota)',
            quantity: 10,
            unit: 'Adet',
            unitPrice: 1500,
            discountRate: 0,
            discountAmount: 0,
            kdvRate: 20,
            total: 15000,
            kdvAmount: 3000,
            grandTotal: 18000,
          },
        ],
      },
      {
        invoiceNumber: 'FAT2026000000214',
        gibUuid: 'c912e847-1934-4b92-9132-841920384712',
        direction: 'inbound',
        recipientName: 'Protein Dağıtım & Spor Gıdaları A.Ş.',
        recipientVknOrTckn: '7390192841',
        recipientTaxOffice: 'Marmara Kurumlar VD.',
        recipientAddress: 'İkitelli OSB Metal-İş Sanayi Sit. 12. Blok No: 4 Başakşehir / İstanbul',
        recipientDistrict: 'Başakşehir',
        recipientCity: 'İstanbul',
        amount: 8500,
        discountTotal: 0,
        kdvRate: 10,
        invoiceType: 'purchase',
        invoiceProfile: 'TEMELFATURA',
        invoiceTypeCode: 'SATIS',
        provider: 'manuel',
        paymentMethod: 'transfer',
        paymentStatus: 'paid',
        description: 'Whey Protein, BCAA ve L-Karnitin Toptan Vitamin Bar Alımı',
        items: [
          {
            name: 'Whey Protein İzole 2000g Çikolatalı',
            quantity: 5,
            unit: 'Adet',
            unitPrice: 1100,
            discountRate: 0,
            discountAmount: 0,
            kdvRate: 10,
            total: 5500,
            kdvAmount: 550,
            grandTotal: 6050,
          },
          {
            name: 'BCAA 4:1:1 Karpuz Aromalı 500g',
            quantity: 6,
            unit: 'Adet',
            unitPrice: 500,
            discountRate: 0,
            discountAmount: 0,
            kdvRate: 10,
            total: 3000,
            kdvAmount: 300,
            grandTotal: 3300,
          },
        ],
      },
    ];
    for (const sample of samples) {
      await this.createInvoice(sample);
    }
  }
}
