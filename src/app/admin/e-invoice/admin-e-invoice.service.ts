import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import {
  CreateInvoiceInput,
  EInvoiceConfig,
  EInvoiceItem,
  InvoiceLineItem,
  InvoiceProvider,
} from '../../core/models/e-invoice.model';

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
        provider: input.provider || 'manuel',
        username: input.username || '',
        companyTitle: input.companyTitle || 'ODİVON SPOR VE SAĞLIK HİZMETLERİ LTD. ŞTİ.',
        companyVkn: input.companyVkn || '7290184910',
        taxOffice: input.taxOffice || 'Beşiktaş Vergi Dairesi',
        address: input.address || 'Levent Mah. Cömert Sk. No: 12 Beşiktaş / İstanbul',
        phone: input.phone || '0850 300 00 00',
        email: input.email || 'muhasebe@odivongym.com',
        apiKey: input.apiKey || '',
        apiSecret: input.apiSecret || '',
        webServiceUrl: input.webServiceUrl || '',
        prefix: input.prefix || (input.provider === 'gib_portal' ? 'GIB' : input.provider === 'manuel' ? 'FAT' : 'ODV'),
        isTestEnvironment: input.isTestEnvironment ?? true,
        autoSendOnPayment: input.autoSendOnPayment ?? true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  /**
   * Genel fatura ve e-fatura oluşturur (Entegratör bağımsız: Manuel, GİB Portal, Uyumsoft, Sovos, QNB vb.)
   */
  async createInvoice(input: CreateInvoiceInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const provider: InvoiceProvider = input.provider || 'manuel';
    const direction = input.direction || 'outbound';

    // Kalemler varsa toplamları kalemlerden hesapla, yoksa tek kalemden hesapla
    let amount = 0;
    let kdvAmount = 0;
    let totalAmount = 0;
    let lineItems: InvoiceLineItem[] = [];

    if (input.items && input.items.length > 0) {
      lineItems = input.items.map((item) => {
        const itemTotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
        const itemKdv = Math.round(itemTotal * (item.kdvRate / 100) * 100) / 100;
        const grandTotal = Math.round((itemTotal + itemKdv) * 100) / 100;
        amount += itemTotal;
        kdvAmount += itemKdv;
        totalAmount += grandTotal;
        return {
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          kdvRate: item.kdvRate,
          total: itemTotal,
          kdvAmount: itemKdv,
          grandTotal,
        };
      });
      amount = Math.round(amount * 100) / 100;
      kdvAmount = Math.round(kdvAmount * 100) / 100;
      totalAmount = Math.round(totalAmount * 100) / 100;
    } else {
      const baseAmount = Number(input.amount || 0);
      const kdvRate = Number(input.kdvRate ?? 20);
      amount = Math.round(baseAmount * 100) / 100;
      kdvAmount = Math.round((amount * (kdvRate / 100)) * 100) / 100;
      totalAmount = Math.round((amount + kdvAmount) * 100) / 100;
      lineItems = [
        {
          name: input.description || (direction === 'outbound' ? 'Spor Salonu Hizmet Bedeli' : 'Mal/Hizmet Alımı'),
          quantity: 1,
          unitPrice: amount,
          kdvRate,
          total: amount,
          kdvAmount,
          grandTotal: totalAmount,
        },
      ];
    }

    // Fatura numarası: Kullanıcı kendisi girdiyse onu kullan, yoksa akıllı prefix üret
    let invoiceNumber = input.invoiceNumber?.trim();
    if (!invoiceNumber) {
      const year = new Date().getFullYear();
      const prefix = provider === 'gib_portal' ? 'GIB' : provider === 'manuel' ? 'FAT' : 'ODV';
      const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
      invoiceNumber = `${prefix}${year}${randomSuffix}`;
    }

    const issueDate = input.issueDate
      ? Timestamp.fromDate(new Date(input.issueDate))
      : serverTimestamp();

    const status =
      provider === 'manuel'
        ? (input.paymentStatus === 'paid' ? 'paid' : 'signed')
        : 'sent';

    const docRef = await addDoc(collection(this.firestore, 'einvoice_items'), {
      tenantId,
      invoiceNumber,
      direction,
      recipientName: input.recipientName.trim(),
      recipientVknOrTckn: input.recipientVknOrTckn.trim(),
      recipientTaxOffice: input.recipientTaxOffice?.trim() || '',
      recipientAddress: input.recipientAddress?.trim() || '',
      amount,
      kdvRate: input.kdvRate ?? (lineItems[0]?.kdvRate || 20),
      kdvAmount,
      totalAmount,
      status,
      invoiceType: input.invoiceType,
      provider,
      paymentMethod: input.paymentMethod || 'card',
      paymentStatus: input.paymentStatus || 'paid',
      issueDate,
      gibUuid: provider !== 'manuel' ? crypto.randomUUID() : undefined,
      description: input.description || lineItems[0]?.name || 'Fatura Kalemi',
      notes: input.notes || '',
      items: lineItems,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async deleteInvoice(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'einvoice_items', id));
  }

  /**
   * İlk kurulumda veya test amaçlı örnek faturaları veritabanına ekler
   */
  async seedSampleInvoices(): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

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
        items: [
          { name: '6 Aylık Standart Fitness Paketi', quantity: 1, unitPrice: 2500, kdvRate: 20, total: 2500, kdvAmount: 500, grandTotal: 3000 },
        ],
      },
      {
        invoiceNumber: 'FAT202600000214',
        direction: 'inbound',
        recipientName: 'Protein Dağıtım & Spor Gıdaları A.Ş.',
        recipientVknOrTckn: '7390192841',
        recipientTaxOffice: 'Mecidiyeköy VD.',
        amount: 8500,
        kdvRate: 10,
        invoiceType: 'purchase',
        provider: 'manuel',
        paymentMethod: 'transfer',
        paymentStatus: 'paid',
        description: 'Whey Protein ve BCAA Toptan Stok Alımı',
        items: [
          { name: 'Optimum Gold Whey 2270g (x5 Koli)', quantity: 5, unitPrice: 1300, kdvRate: 10, total: 6500, kdvAmount: 650, grandTotal: 7150 },
          { name: 'BCAA 400g Karpuz Aromalı (x4 Koli)', quantity: 4, unitPrice: 500, kdvRate: 10, total: 2000, kdvAmount: 200, grandTotal: 2200 },
        ],
      },
      {
        invoiceNumber: 'ODV202600000452',
        direction: 'outbound',
        recipientName: 'Selin Doğan',
        recipientVknOrTckn: '39102839481',
        amount: 4500,
        kdvRate: 20,
        invoiceType: 'earswive',
        provider: 'manuel',
        paymentMethod: 'card',
        paymentStatus: 'paid',
        description: '10 Seans Özel PT Dersi & Fitness Üyeliği',
        items: [
          { name: '10 Seans Özel PT Dersi', quantity: 10, unitPrice: 400, kdvRate: 20, total: 4000, kdvAmount: 800, grandTotal: 4800 },
          { name: 'OdivonGYM Akıllı RFID Bileklik', quantity: 1, unitPrice: 500, kdvRate: 20, total: 500, kdvAmount: 100, grandTotal: 600 },
        ],
      },
      {
        invoiceNumber: 'FAT202600000918',
        direction: 'inbound',
        recipientName: 'TechnoGym Türkiye Ekipman Servisi',
        recipientVknOrTckn: '8392019482',
        recipientTaxOffice: 'Kadıköy VD.',
        amount: 3200,
        kdvRate: 20,
        invoiceType: 'purchase',
        provider: 'manuel',
        paymentMethod: 'open_account',
        paymentStatus: 'pending',
        description: 'Koşu Bantları ve Kardio Cihazları Periyodik Bakım',
        items: [
          { name: 'Kardio & Koşu Bandı Motor Bakımı', quantity: 1, unitPrice: 3200, kdvRate: 20, total: 3200, kdvAmount: 640, grandTotal: 3840 },
        ],
      },
    ];

    for (const sample of samples) {
      await this.createInvoice(sample);
    }
  }
}
