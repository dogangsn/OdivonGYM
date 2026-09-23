import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  addDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import {
  CreateShopProductInput,
  CreateShopSaleInput,
  ShopProduct,
  ShopSale,
  UpdateShopProductInput,
} from '../../core/models/shop-product.model';
import {
  DEFAULT_STOCK_CATEGORIES,
  StockCategoryItem,
} from '../../core/models/stock-category.model';
import { UserProfile } from '../../core/models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class AdminShopService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);

  private tenantId(): string {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');
    return tenantId;
  }

  /**
   * Tenant'a ait dinamik stok & ürün kategorilerini gerçek zamanlı dinler.
   * Eğer hiç kategori yoksa otomatik olarak varsayılanları tohumlar (seed).
   */
  watchCategories(): Observable<StockCategoryItem[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of([] as StockCategoryItem[]);
        const q = query(
          collection(this.firestore, 'gym_stock_categories'),
          where('tenantId', '==', tenantId),
        );
        return (collectionData(q, { idField: 'id' }) as Observable<StockCategoryItem[]>).pipe(
          tap((cats) => {
            if (cats && cats.length === 0) {
              void this.seedDefaultCategoriesIfEmpty(tenantId);
            }
          }),
          map((cats) =>
            [...cats].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'tr')),
          ),
        );
      }),
    );
  }

  async createCategory(
    input: Omit<StockCategoryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const tenantId = this.tenantId();
    const docRef = await addDoc(collection(this.firestore, 'gym_stock_categories'), {
      tenantId,
      key: input.key || input.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: input.name,
      icon: input.icon || 'inventory_2',
      colorTag: input.colorTag || 'indigo',
      description: input.description ?? '',
      isDefault: input.isDefault ?? false,
      order: input.order ?? 99,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateCategory(id: string, input: Partial<StockCategoryItem>): Promise<void> {
    const cleanData: Record<string, any> = { updatedAt: serverTimestamp() };
    if (input.name !== undefined) cleanData['name'] = input.name;
    if (input.key !== undefined) cleanData['key'] = input.key;
    if (input.icon !== undefined) cleanData['icon'] = input.icon;
    if (input.colorTag !== undefined) cleanData['colorTag'] = input.colorTag;
    if (input.description !== undefined) cleanData['description'] = input.description;
    if (input.order !== undefined) cleanData['order'] = input.order;

    await updateDoc(doc(this.firestore, 'gym_stock_categories', id), cleanData);
  }

  async deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'gym_stock_categories', id));
  }

  async seedDefaultCategoriesIfEmpty(tenantIdParam?: string): Promise<void> {
    const tenantId = tenantIdParam || this.tenantId();
    const q = query(
      collection(this.firestore, 'gym_stock_categories'),
      where('tenantId', '==', tenantId),
    );
    const snap = await getDocs(q);
    if (!snap.empty) return;

    const batch = writeBatch(this.firestore);
    const now = serverTimestamp();
    for (const cat of DEFAULT_STOCK_CATEGORIES) {
      const docRef = doc(collection(this.firestore, 'gym_stock_categories'));
      batch.set(docRef, {
        id: docRef.id,
        tenantId,
        key: cat.key,
        name: cat.name,
        icon: cat.icon || 'inventory_2',
        colorTag: cat.colorTag || 'indigo',
        description: cat.description || '',
        isDefault: true,
        order: cat.order || 1,
        createdAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();
  }

  watchProducts(): Observable<ShopProduct[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of([] as ShopProduct[]);
        return collectionData(query(collection(this.firestore, 'shop_products'), where('tenantId', '==', tenantId)), {
          idField: 'id',
        }) as Observable<ShopProduct[]>;
      }),
    );
  }

  watchSales(): Observable<ShopSale[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of([] as ShopSale[]);
        return collectionData(query(collection(this.firestore, 'shop_sales'), where('tenantId', '==', tenantId)), {
          idField: 'id',
        }) as Observable<ShopSale[]>;
      }),
    );
  }

  async createProduct(input: CreateShopProductInput): Promise<string> {
    const docRef = await addDoc(collection(this.firestore, 'shop_products'), {
      tenantId: this.tenantId(),
      name: input.name,
      sku: input.sku,
      price: input.price,
      stock: input.stock,
      category: input.category,
      description: input.description ?? '',
      imageUrl: input.imageUrl ?? '',
      supplier: input.supplier ?? '',
      cost: input.cost ?? 0,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateProduct(id: string, input: UpdateShopProductInput): Promise<void> {
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const key of ['name', 'price', 'stock', 'category', 'description', 'imageUrl', 'supplier', 'cost', 'status'] as const) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    await updateDoc(doc(this.firestore, 'shop_products', id), data);
  }

  async deleteProduct(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'shop_products', id));
  }

  /** Satışı kaydeder ve stoğu AYNI işlemde düşer — stok yetersizse hiçbir şey yazılmaz. */
  async recordSale(input: CreateShopSaleInput): Promise<string> {
    const tenantId = this.tenantId();
    const productRef = doc(this.firestore, 'shop_products', input.productId);
    const saleRef = doc(collection(this.firestore, 'shop_sales'));

    await runTransaction(this.firestore, async (tx) => {
      const snap = await tx.get(productRef);
      if (!snap.exists()) throw new Error('Ürün bulunamadı.');
      const stock = (snap.data()['stock'] as number) ?? 0;
      if (stock < input.quantity) throw new Error(`Yetersiz stok (mevcut: ${stock}).`);

      tx.set(saleRef, {
        tenantId,
        userId: input.userId ?? null,
        productId: input.productId,
        productName: input.productName,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalAmount: input.totalAmount,
        paymentMethod: input.paymentMethod,
        discount: input.discount ?? 0,
        notes: input.notes ?? '',
        saleDate: serverTimestamp(),
        status: 'completed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Otomatik Kasa Hareketi (accounting_entries)
      const accountingRef = doc(collection(this.firestore, 'accounting_entries'));
      tx.set(accountingRef, {
        tenantId,
        type: 'income',
        amount: input.totalAmount,
        category: 'product',
        description: `Ürün Satışı: ${input.productName} (x${input.quantity})`,
        referenceId: saleRef.id,
        referenceType: 'product-sale',
        paymentMethod: input.paymentMethod,
        notes: input.notes ?? '',
        entryDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.update(productRef, { stock: stock - input.quantity, updatedAt: serverTimestamp() });
    });

    return saleRef.id;
  }

  /** İade: satış "refunded" olur, adet stoğa geri eklenir (ürün silinmişse sadece durum değişir). */
  async refundSale(sale: ShopSale): Promise<void> {
    const saleRef = doc(this.firestore, 'shop_sales', sale.id);
    const productRef = doc(this.firestore, 'shop_products', sale.productId);

    await runTransaction(this.firestore, async (tx) => {
      const [saleSnap, productSnap] = await Promise.all([tx.get(saleRef), tx.get(productRef)]);
      if (!saleSnap.exists() || saleSnap.data()['status'] !== 'completed') return;

      tx.update(saleRef, { status: 'refunded', updatedAt: serverTimestamp() });
      if (productSnap.exists()) {
        const stock = (productSnap.data()['stock'] as number) ?? 0;
        tx.update(productRef, { stock: stock + sale.quantity, updatedAt: serverTimestamp() });
      }
    });
  }

  async deleteSale(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'shop_sales', id));
  }

  /**
   * Çoklu ürün içeren POS sepetini işler:
   * 1. Ürünlerin stoklarını atomik olarak düşer.
   * 2. Satış kayıtlarını oluşturur.
   * 3. Ödeme 'wallet' ise üyenin bakiyesini kontrol eder, düşer ve wallet_transactions ekler.
   */
  async checkout(input: {
    items: { product: ShopProduct; quantity: number; isPackageIncluded?: boolean }[];
    paymentMethod: 'cash' | 'card' | 'wallet' | 'transfer';
    member?: UserProfile | null;
    discount?: number;
    notes?: string;
  }): Promise<void> {
    const tenantId = this.tenantId();
    if (input.items.length === 0) throw new Error('Sepetiniz boş.');

    const subtotal = input.items.reduce(
      (sum, item) => sum + (item.isPackageIncluded ? 0 : item.product.price * item.quantity),
      0,
    );
    const totalAmount = Math.max(0, subtotal - (input.discount ?? 0));

    if (input.paymentMethod === 'wallet') {
      if (!input.member) throw new Error('E-Cüzdan ile ödeme için lütfen bir üye seçin.');
      const currentBalance = input.member.walletBalance ?? 0;
      if (currentBalance < totalAmount) {
        throw new Error(`Yetersiz cüzdan bakiyesi (Mevcut: ₺${currentBalance.toFixed(2)}, Gerekli: ₺${totalAmount.toFixed(2)}).`);
      }
    }

    await runTransaction(this.firestore, async (tx) => {
      // FAZ 1: TÜM OKUMALAR (READS) - Firestore kuralları gereği tüm get işlemleri set/update işlemlerinden önce yapılmalıdır.
      const productDocs: { ref: any; item: (typeof input.items)[0]; currentStock: number }[] = [];
      for (const item of input.items) {
        const pRef = doc(this.firestore, 'shop_products', item.product.id);
        const pSnap = await tx.get(pRef);
        if (!pSnap.exists()) throw new Error(`${item.product.name} bulunamadı.`);
        const stock = (pSnap.data()['stock'] as number) ?? 0;
        if (stock < item.quantity) {
          throw new Error(`Yetersiz stok: ${item.product.name} (Kalan: ${stock})`);
        }
        productDocs.push({ ref: pRef, item, currentStock: stock });
      }

      let userRef: any = null;
      let currentBalance = 0;
      if (input.paymentMethod === 'wallet' && input.member) {
        userRef = doc(this.firestore, 'users', input.member.uid);
        const userSnap = await tx.get(userRef);
        const userData = userSnap.data() as Record<string, any> | undefined;
        currentBalance = Number(userData?.['walletBalance'] ?? 0);
        if (currentBalance < totalAmount) {
          throw new Error('İşlem anında üyenin cüzdan bakiyesi yetersiz kaldı.');
        }
      }

      // FAZ 2: TÜM YAZMALAR (WRITES)
      // 2.1 Stok düşüşleri ve satış kayıtları
      for (const { ref, item, currentStock } of productDocs) {
        tx.update(ref, {
          stock: currentStock - item.quantity,
          updatedAt: serverTimestamp(),
        });

        const effectivePrice = item.isPackageIncluded ? 0 : item.product.price;
        const lineTotal = effectivePrice * item.quantity;
        const itemNote = item.isPackageIncluded
          ? `[Pakete Dahil Ücretsiz Hak] ${input.notes ?? ''}`.trim()
          : input.notes ?? '';

        const saleRef = doc(collection(this.firestore, 'shop_sales'));
        tx.set(saleRef, {
          tenantId,
          userId: input.member?.uid ?? null,
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: effectivePrice,
          totalAmount: lineTotal,
          paymentMethod: input.paymentMethod,
          discount: 0,
          notes: itemNote,
          saleDate: serverTimestamp(),
          status: 'completed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 2.2 Cüzdan bakiyesi düşümü ve cüzdan hareket kaydı
      if (input.paymentMethod === 'wallet' && input.member && userRef) {
        const walletTxRef = doc(collection(this.firestore, 'wallet_transactions'));
        tx.set(walletTxRef, {
          userId: input.member.uid,
          tenantId,
          type: 'debit',
          amount: totalAmount,
          description: `Vitamin Bar Satışı (${input.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')})`,
          referenceType: 'product',
          paymentMethod: 'wallet',
          status: 'completed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        tx.update(userRef, {
          walletBalance: currentBalance - totalAmount,
          updatedAt: serverTimestamp(),
        });
      }

      // 2.3 Salon Kasa Hareketi (accounting_entries)
      const accountingRef = doc(collection(this.firestore, 'accounting_entries'));
      tx.set(accountingRef, {
        tenantId,
        type: 'income',
        amount: totalAmount,
        category: 'product',
        description: `Vitamin Bar POS: ${input.items.map((i) => `${i.product.name} (x${i.quantity})`).join(', ')}`,
        referenceType: 'product-sale',
        paymentMethod: input.paymentMethod,
        notes: input.notes || (input.member ? `Müşteri: ${input.member.displayName}` : 'Kasa Satışı'),
        entryDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  /** Yeni salonlar için hazır popüler Vitamin Bar ürünlerini yükler */
  async seedDefaultProducts(): Promise<void> {
    const defaults: CreateShopProductInput[] = [
      { name: 'Optimum Whey Protein (30g Saşe)', sku: 'WHEY-01', price: 85, stock: 50, category: 'protein', description: 'Tek porsiyonluk yüksek kaliteli peynir altı suyu proteini' },
      { name: 'Multipower BCAA 2:1:1 İçecek (500ml)', sku: 'BCAA-01', price: 65, stock: 40, category: 'bcaa', description: 'Antrenman esnası ve sonrası amino asit içeceği' },
      { name: 'Kreatin Monohidrat (Tek Doz 5g)', sku: 'CREA-01', price: 45, stock: 60, category: 'bcaa', description: 'Saf mikronize kreatin monohidrat' },
      { name: 'Fellas Protein Bar (Kakaolu 45g)', sku: 'BAR-01', price: 55, stock: 35, category: 'bar', description: 'Yüksek lif ve %30 proteinli doğal bar' },
      { name: 'Grenade Carb Killa Bar (60g)', sku: 'BAR-02', price: 95, stock: 25, category: 'bar', description: 'Karamelli çikolata kaplı premium protein bar' },
      { name: 'Soğuk Doğal Kaynak Suyu (500ml)', sku: 'WATER-01', price: 15, stock: 120, category: 'drink', description: 'Buz gibi doğal kaynak suyu' },
      { name: 'Beypazarı Doğal Maden Suyu', sku: 'SODA-01', price: 20, stock: 80, category: 'drink', description: 'Doğal mineralli maden suyu' },
      { name: 'Odivon GYM Shaker (700ml)', sku: 'SHK-01', price: 180, stock: 20, category: 'accessory', description: 'Sızdırmaz karıştırıcı hazneli sporcu shaker' },
      { name: 'Mikrofiber Sporcu Havlusu', sku: 'TOWL-01', price: 120, stock: 15, category: 'accessory', description: 'Hızlı kuruyan antibakteriyel spor salonu havlusu' },
    ];

    for (const p of defaults) {
      await this.createProduct(p);
    }
  }
}
