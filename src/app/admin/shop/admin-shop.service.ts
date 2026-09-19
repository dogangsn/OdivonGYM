import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ShopProduct, ShopSale, CreateShopProductInput, CreateShopSaleInput } from '../../core/models/shop-product.model';

@Injectable({ providedIn: 'root' })
export class AdminShopService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchProducts(): Observable<ShopProduct[]> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      return new Observable<ShopProduct[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'shop_products'),
      where('tenantId', '==', tenantId),
    );

    return collectionData(q, { idField: 'id' }) as Observable<ShopProduct[]>;
  }

  watchSales(): Observable<ShopSale[]> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      return new Observable<ShopSale[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'shop_sales'),
      where('tenantId', '==', tenantId),
    );

    return collectionData(q, { idField: 'id' }) as Observable<ShopSale[]>;
  }

  async createProduct(input: CreateShopProductInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      throw new Error('Salon bilgisi bulunamadı');
    }

    const docRef = await addDoc(collection(this.firestore, 'shop_products'), {
      tenantId,
      name: input.name,
      sku: input.sku,
      price: input.price,
      stock: input.stock,
      category: input.category,
      description: input.description || '',
      imageUrl: input.imageUrl || '',
      supplier: input.supplier || '',
      cost: input.cost || 0,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updateProduct(id: string, input: Partial<CreateShopProductInput>): Promise<void> {
    const updateData: any = { updatedAt: serverTimestamp() };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.stock !== undefined) updateData.stock = input.stock;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl;
    if (input.supplier !== undefined) updateData.supplier = input.supplier;
    if (input.cost !== undefined) updateData.cost = input.cost;

    await updateDoc(doc(this.firestore, 'shop_products', id), updateData);
  }

  async recordSale(input: CreateShopSaleInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      throw new Error('Salon bilgisi bulunamadı');
    }

    const docRef = await addDoc(collection(this.firestore, 'shop_sales'), {
      tenantId,
      userId: input.userId || null,
      productId: input.productId,
      productName: input.productName,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      totalAmount: input.totalAmount,
      paymentMethod: input.paymentMethod,
      discount: input.discount || 0,
      notes: input.notes || '',
      saleDate: serverTimestamp(),
      status: 'completed',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }
}
