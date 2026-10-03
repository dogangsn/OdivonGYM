import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom, of } from 'rxjs';
import {
  LowStockItem,
  PurchaseOrder,
  PurchaseOrderStatus,
  StockApi,
  StockCount,
  StockCountLine,
} from '../../core/api/stock.api';
import { ShopProduct } from '../../core/models/shop-product.model';
import { Supplier } from '../../core/models/supplier.model';
import { AlertService } from '../../core/services/alert.service';
import { PermissionService } from '../../core/services/permission.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { toAppError } from '../../shared/models/app-error.model';
import { SlideOver } from '../../shared/ui/slide-over';
import { formatDate, formatMoney } from '../../shared/ui/ui-utils';
import { AdminShopService } from '../shop/admin-shop.service';
import { AdminSuppliersService } from '../suppliers/admin-suppliers.service';

type StockTab = 'low' | 'counts' | 'orders';

const ORDER_STATUS: Record<PurchaseOrderStatus, { label: string; cls: string }> = {
  draft: { label: 'Taslak', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  ordered: { label: 'Sipariş verildi', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
  received: { label: 'Teslim alındı', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
  cancelled: { label: 'İptal', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
};

const COUNT_STATUS: Record<StockCount['status'], { label: string; cls: string }> = {
  open: { label: 'Devam ediyor', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  completed: { label: 'Tamamlandı', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
  cancelled: { label: 'İptal', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

/** Sunucu mesajları İngilizce; kullanıcıya hata kodunun Türkçesi gösterilir. */
const ERRORS: Record<string, string> = {
  GYM_STOCK_STATE: 'Bu kaydın durumu bu işleme izin vermiyor (sayfayı yenileyin).',
  GYM_PRODUCT_NOT_FOUND: 'Ürünlerden biri bulunamadı (silinmiş olabilir).',
  GYM_SUPPLIER_NOT_FOUND: 'Tedarikçi bulunamadı.',
  VALIDATION_ERROR: 'Bilgiler eksik ya da hatalı.',
  FORBIDDEN_PERMISSION: 'Bu işlem için yetkiniz yok.',
};

interface DraftLine {
  productId: string;
  quantity: number;
  unitCost: number;
}

@Component({
  selector: 'app-admin-stock',
  standalone: true,
  imports: [FormsModule, MatIconModule, PageHeader, SlideOver],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-stock.html',
})
export class AdminStock {
  private readonly api = inject(StockApi);
  private readonly alert = inject(AlertService);
  private readonly permissions = inject(PermissionService);
  private readonly shopService = inject(AdminShopService);
  private readonly suppliersService = inject(AdminSuppliersService);

  protected readonly money = formatMoney;
  protected readonly date = formatDate;
  protected readonly orderStatus = ORDER_STATUS;
  protected readonly countStatus = COUNT_STATUS;

  protected readonly canCount = this.permissions.can('shop', 'update');
  protected readonly canSeeOrders = this.permissions.can('gymSuppliers');
  protected readonly canOrder = this.permissions.can('gymSuppliers', 'create');
  protected readonly canReceive = this.permissions.can('gymSuppliers', 'update');

  protected readonly tab = signal<StockTab>('low');
  protected readonly busy = signal(false);

  protected readonly products = toSignal(this.shopService.watchProducts(), { initialValue: [] as ShopProduct[] });
  protected readonly suppliers = toSignal(this.canSeeOrders ? this.suppliersService.watchSuppliers() : of([] as Supplier[]), {
    initialValue: [] as Supplier[],
  });
  protected readonly activeProducts = computed(() =>
    [...this.products()].filter((p) => p.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'tr')),
  );

  // ---- Minimum stok ----
  protected readonly low = signal<LowStockItem[] | null>(null);
  protected readonly lowSupplier = signal('');
  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly lowShown = computed(() => {
    const supplier = this.lowSupplier();
    return (this.low() ?? []).filter((item) => !supplier || (supplier === '-' ? !item.supplierId : item.supplierId === supplier));
  });

  // ---- Sayım ----
  protected readonly counts = signal<StockCount[] | null>(null);
  protected readonly openCount = signal<StockCount | null>(null);
  protected readonly countEdits = signal<Record<string, number | null>>({});
  protected readonly countFilter = signal('');
  protected readonly countLines = computed<StockCountLine[]>(() => {
    const count = this.openCount();
    const edits = this.countEdits();
    const q = this.countFilter().trim().toLocaleLowerCase('tr');
    return (count?.lines ?? [])
      .map((line) => {
        const counted = line.productId in edits ? edits[line.productId] : line.counted;
        return { ...line, counted, difference: counted === null ? null : counted - line.expected };
      })
      .filter((line) => !q || line.productName.toLocaleLowerCase('tr').includes(q) || line.sku.toLocaleLowerCase('tr').includes(q));
  });
  protected readonly dirtyCount = computed(() => Object.keys(this.countEdits()).length);

  // ---- Siparişler ----
  protected readonly orders = signal<PurchaseOrder[] | null>(null);
  protected readonly orderDrawer = signal(false);
  protected readonly editingOrder = signal<PurchaseOrder | null>(null);
  protected orderSupplierId = '';
  protected orderExpectedDate = '';
  protected orderNotes = '';
  protected readonly orderLines = signal<DraftLine[]>([]);
  protected readonly orderError = signal('');
  protected readonly orderTotal = computed(() =>
    Math.round(this.orderLines().reduce((sum, line) => sum + (line.quantity || 0) * (line.unitCost || 0), 0) * 100) / 100,
  );

  protected readonly receiving = signal<PurchaseOrder | null>(null);
  protected readonly receivedQty = signal<Record<string, number>>({});

  constructor() {
    void this.reloadLow();
  }

  protected setTab(tab: StockTab): void {
    this.tab.set(tab);
    if (tab === 'low') void this.reloadLow();
    if (tab === 'counts') void this.reloadCounts();
    if (tab === 'orders') void this.reloadOrders();
  }

  // ===== Minimum stok =====
  protected async reloadLow(): Promise<void> {
    await this.run(async () => {
      this.low.set(await firstValueFrom(this.api.lowStock()));
      this.selected.set(new Set());
    });
  }

  protected toggle(productId: string): void {
    const next = new Set(this.selected());
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    this.selected.set(next);
  }

  protected toggleAll(): void {
    const shown = this.lowShown();
    const all = shown.length > 0 && shown.every((item) => this.selected().has(item.productId));
    this.selected.set(all ? new Set() : new Set(shown.map((item) => item.productId)));
  }

  protected isAllSelected(): boolean {
    const shown = this.lowShown();
    return shown.length > 0 && shown.every((item) => this.selected().has(item.productId));
  }

  /** Seçili düşük stoklu ürünlerle sipariş taslağı açar; tek tedarikçili seçimde tedarikçiyi doldurur. */
  protected orderFromLow(): void {
    const items = (this.low() ?? []).filter((item) => this.selected().has(item.productId));
    if (!items.length) return;
    const supplierIds = [...new Set(items.map((item) => item.supplierId).filter(Boolean))] as string[];
    this.openOrder(null, {
      supplierId: supplierIds.length === 1 ? supplierIds[0] : this.lowSupplier() && this.lowSupplier() !== '-' ? this.lowSupplier() : '',
      lines: items.map((item) => ({ productId: item.productId, quantity: item.suggestedQty, unitCost: item.unitCost })),
    });
    this.tab.set('orders');
    void this.reloadOrders();
  }

  // ===== Sayım =====
  protected async reloadCounts(): Promise<void> {
    await this.run(async () => this.counts.set(await firstValueFrom(this.api.counts())));
  }

  protected async startCount(): Promise<void> {
    const ok = await this.alert.actionConfirm(
      'Yeni Stok Sayımı',
      'Tüm aktif ürünler için sayım listesi açılır; beklenen miktar şu anki stoktur. Sayımı tamamlayana kadar stok değişmez.',
      'Sayımı Başlat',
      'info',
    );
    if (!ok) return;
    await this.run(async () => {
      const count = await firstValueFrom(this.api.createCount({}));
      this.openCountEditor(count);
      await this.reloadCounts();
    });
  }

  protected async openCountById(id: string): Promise<void> {
    await this.run(async () => this.openCountEditor(await firstValueFrom(this.api.count(id))));
  }

  private openCountEditor(count: StockCount): void {
    this.countEdits.set({});
    this.countFilter.set('');
    this.openCount.set(count);
  }

  protected closeCount(): void {
    this.openCount.set(null);
    this.countEdits.set({});
  }

  protected setCounted(productId: string, raw: string | number | null): void {
    const value = raw === '' || raw === null ? null : Math.max(0, Math.floor(Number(raw)));
    this.countEdits.update((edits) => ({ ...edits, [productId]: Number.isNaN(value) ? null : value }));
  }

  /** Sayılanı "beklenenle aynı" diye hızlıca işaretler. */
  protected matchExpected(line: StockCountLine): void {
    this.setCounted(line.productId, line.expected);
  }

  protected async saveCount(): Promise<boolean> {
    const count = this.openCount();
    if (!count) return false;
    const entries = Object.entries(this.countEdits()).map(([productId, counted]) => ({ productId, counted }));
    if (!entries.length) return true;
    return this.run(async () => {
      const updated = await firstValueFrom(this.api.updateCount(count.id, { entries }));
      this.countEdits.set({});
      this.openCount.set(updated);
      this.alert.toastSuccess('Sayım kaydedildi.');
    });
  }

  protected async completeCount(): Promise<void> {
    const count = this.openCount();
    if (!count || !(await this.saveCount())) return;
    const summary = this.openCount()?.summary;
    const ok = await this.alert.actionConfirm(
      'Sayımı Tamamla',
      `${summary?.countedLines ?? 0} ürünün stoku sayılan miktara eşitlenecek (${summary?.mismatchedLines ?? 0} üründe fark var). Sayılmayan ürünlere dokunulmaz. Bu işlem geri alınamaz.`,
      'Stokları Güncelle',
      'warning',
    );
    if (!ok) return;
    await this.run(async () => {
      await firstValueFrom(this.api.completeCount(count.id));
      this.alert.toastSuccess('Sayım tamamlandı, stoklar güncellendi.');
      this.closeCount();
      await this.reloadCounts();
    });
  }

  protected async cancelCount(count: StockCount): Promise<void> {
    if (!(await this.alert.actionConfirm('Sayımı İptal Et', 'Sayım kapatılır, stoklar değişmez.', 'İptal Et', 'warning'))) return;
    await this.run(async () => {
      await firstValueFrom(this.api.cancelCount(count.id));
      if (this.openCount()?.id === count.id) this.closeCount();
      await this.reloadCounts();
    });
  }

  // ===== Siparişler =====
  protected async reloadOrders(): Promise<void> {
    if (!this.canSeeOrders) return;
    await this.run(async () => this.orders.set(await firstValueFrom(this.api.orders())));
  }

  protected openOrder(order: PurchaseOrder | null, prefill?: { supplierId: string; lines: DraftLine[] }): void {
    this.editingOrder.set(order);
    this.orderError.set('');
    this.orderSupplierId = order?.supplierId ?? prefill?.supplierId ?? '';
    this.orderExpectedDate = order?.expectedDate ?? '';
    this.orderNotes = order?.notes ?? '';
    this.orderLines.set(
      order
        ? order.lines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitCost: line.unitCost }))
        : (prefill?.lines ?? [{ productId: '', quantity: 1, unitCost: 0 }]),
    );
    this.orderDrawer.set(true);
  }

  protected addLine(): void {
    this.orderLines.update((lines) => [...lines, { productId: '', quantity: 1, unitCost: 0 }]);
  }

  protected removeLine(index: number): void {
    this.orderLines.update((lines) => lines.filter((_, i) => i !== index));
  }

  protected setLine(index: number, patch: Partial<DraftLine>): void {
    this.orderLines.update((lines) =>
      lines.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        // Ürün seçilince birim maliyet ürün kartındaki maliyetle dolar.
        if (patch.productId && !line.unitCost) {
          next.unitCost = this.products().find((p) => p.id === patch.productId)?.cost ?? 0;
        }
        return next;
      }),
    );
  }

  /** Tedarikçiye bağlı ürünlerin düşük stoklularını siparişe ekler. */
  protected async addSupplierLowItems(): Promise<void> {
    if (!this.orderSupplierId) return;
    const items = await firstValueFrom(this.api.lowStock(this.orderSupplierId));
    const existing = new Set(this.orderLines().map((line) => line.productId));
    const extra = items
      .filter((item) => !existing.has(item.productId))
      .map((item) => ({ productId: item.productId, quantity: item.suggestedQty, unitCost: item.unitCost }));
    if (!extra.length) {
      this.alert.toastInfo('Bu tedarikçiye bağlı, minimumun altında başka ürün yok.');
      return;
    }
    this.orderLines.update((lines) => [...lines.filter((line) => line.productId), ...extra]);
  }

  protected async saveOrder(): Promise<void> {
    const lines = this.orderLines().filter((line) => line.productId);
    if (!this.orderSupplierId) return this.orderError.set('Tedarikçi seçin.');
    if (!lines.length) return this.orderError.set('En az bir ürün ekleyin.');
    if (lines.some((line) => !(line.quantity >= 1) || !(line.unitCost >= 0))) {
      return this.orderError.set('Miktar en az 1, birim maliyet 0 veya üzeri olmalı.');
    }
    if (new Set(lines.map((line) => line.productId)).size !== lines.length) {
      return this.orderError.set('Aynı ürün iki satırda olamaz.');
    }
    const body = {
      supplierId: this.orderSupplierId,
      lines: lines.map((line) => ({ productId: line.productId, quantity: Math.floor(line.quantity), unitCost: Number(line.unitCost) })),
      expectedDate: this.orderExpectedDate || undefined,
      notes: this.orderNotes.trim(),
    };
    const editing = this.editingOrder();
    const ok = await this.run(async () => {
      await firstValueFrom(editing ? this.api.updateOrder(editing.id, body) : this.api.createOrder(body));
    }, this.orderError);
    if (ok) {
      this.alert.toastSuccess(editing ? 'Sipariş güncellendi.' : 'Sipariş taslağı oluşturuldu.');
      this.orderDrawer.set(false);
      await this.reloadOrders();
    }
  }

  protected async markOrdered(order: PurchaseOrder): Promise<void> {
    const ok = await this.alert.actionConfirm(
      'Sipariş Verildi',
      `${order.supplierName} siparişi (${this.money(order.totalAmount)}) tedarikçiye gönderildi olarak işaretlensin mi?`,
      'Gönderildi',
      'info',
    );
    if (!ok) return;
    await this.run(async () => {
      await firstValueFrom(this.api.markOrdered(order.id));
      await this.reloadOrders();
    });
  }

  protected async cancelOrder(order: PurchaseOrder): Promise<void> {
    if (!(await this.alert.actionConfirm('Siparişi İptal Et', 'Sipariş iptal edilir; stok değişmez.', 'İptal Et', 'warning'))) return;
    await this.run(async () => {
      await firstValueFrom(this.api.cancelOrder(order.id));
      await this.reloadOrders();
    });
  }

  protected openReceive(order: PurchaseOrder): void {
    this.receivedQty.set(Object.fromEntries(order.lines.map((line) => [line.productId, line.quantity])));
    this.receiving.set(order);
  }

  protected setReceived(productId: string, raw: string | number): void {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    this.receivedQty.update((qty) => ({ ...qty, [productId]: value }));
  }

  protected receivedTotal(order: PurchaseOrder): number {
    const qty = this.receivedQty();
    return Math.round(order.lines.reduce((sum, line) => sum + (qty[line.productId] ?? 0) * line.unitCost, 0) * 100) / 100;
  }

  protected async confirmReceive(): Promise<void> {
    const order = this.receiving();
    if (!order) return;
    const qty = this.receivedQty();
    const lines = order.lines.map((line) => ({ productId: line.productId, receivedQuantity: qty[line.productId] ?? 0 }));
    if (!lines.some((line) => line.receivedQuantity > 0)) {
      this.alert.toastWarning('Gelen ürün miktarı girin.');
      return;
    }
    const ok = await this.run(async () => {
      await firstValueFrom(this.api.receiveOrder(order.id, lines));
    });
    if (ok) {
      this.alert.toastSuccess(`Mal kabul yapıldı; stoklar arttı, tedarikçi bakiyesine ${this.money(this.receivedTotal(order))} eklendi.`);
      this.receiving.set(null);
      await this.reloadOrders();
    }
  }

  protected productName(id: string): string {
    return this.products().find((p) => p.id === id)?.name ?? '';
  }

  private async run(task: () => Promise<void>, errorSignal?: { set(value: string): void }): Promise<boolean> {
    this.busy.set(true);
    try {
      await task();
      return true;
    } catch (err) {
      const message = ERRORS[toAppError(err).code] ?? 'İşlem tamamlanamadı, tekrar deneyin.';
      if (errorSignal) errorSignal.set(message);
      else this.alert.toastError(message);
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
