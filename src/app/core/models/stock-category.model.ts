export interface StockCategoryItem {
  id?: string;
  tenantId: string;
  key: string;
  name: string;
  icon?: string;
  colorTag?: string;
  description?: string;
  isDefault?: boolean;
  order?: number;
  createdAt?: any;
  updatedAt?: any;
}

export const DEFAULT_STOCK_CATEGORIES: Array<Omit<StockCategoryItem, 'tenantId'>> = [
  {
    key: 'protein',
    name: 'Protein & Tozlar',
    icon: '🥛',
    colorTag: 'indigo',
    description: 'Whey, Isolate, Kazein ve bitkisel protein tozları',
    isDefault: true,
    order: 1,
  },
  {
    key: 'bcaa',
    name: 'BCAA & Pre-Workout',
    icon: '⚡',
    colorTag: 'amber',
    description: 'Amino asit, BCAA, kreatin ve enerji verici antrenman öncesi ürünler',
    isDefault: true,
    order: 2,
  },
  {
    key: 'drink',
    name: 'İçecek & Su',
    icon: '🥤',
    colorTag: 'cyan',
    description: 'Maden suyu, izotonik sporcu içecekleri, soğuk kahve ve su',
    isDefault: true,
    order: 3,
  },
  {
    key: 'bar',
    name: 'Bar & Atıştırmalık',
    icon: '🍫',
    colorTag: 'emerald',
    description: 'Yüksek proteinli barlar, fıstık ezmesi ve sağlıklı atıştırmalıklar',
    isDefault: true,
    order: 4,
  },
  {
    key: 'accessory',
    name: 'Aksesuar & Havlu',
    icon: '🎒',
    colorTag: 'purple',
    description: 'Shaker, antrenman havlusu, eldiven, bileklik ve spor aksesuarları',
    isDefault: true,
    order: 5,
  },
];

/**
 * Kategori nesnesinin her zaman dolu ve benzersiz bir `key` değerine sahip olmasını sağlar.
 * Eski kayıtlarda `key` alanı boş/undefined ise `code`, `id` veya `name` üzerinden üretir.
 */
export function ensureCategoryKey(cat: Partial<StockCategoryItem> & Record<string, any>, fallbackIndex = 0): string {
  const rawKey = (cat.key || cat['code'] || cat['slug'] || '').toString().trim();
  if (rawKey) return rawKey;
  const rawName = (cat.name || cat['label'] || '').toString().trim();
  if (rawName) {
    return rawName
      .toLocaleLowerCase('tr')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `cat_${fallbackIndex}`;
  }
  return (cat.id || `cat_${fallbackIndex}`).toString().trim();
}

/**
 * Ürünün `category` alanının seçili kategori (key, name, id veya bilinen eş anlamlı anahtar) ile eşleşip eşleşmediğini kontrol eder.
 */
export function matchesProductCategory(
  productCategory: string | undefined | null,
  target: { id?: string; key?: string; name?: string; label?: string } | null | undefined,
): boolean {
  if (!productCategory || !target) return false;
  const pCat = productCategory.trim().toLocaleLowerCase('tr');
  if (!pCat) return false;

  const candidates = new Set<string>();
  for (const val of [target.id, target.key, target.name, target.label]) {
    if (val && val.trim()) {
      const lower = val.trim().toLocaleLowerCase('tr');
      candidates.add(lower);
      candidates.add(ensureCategoryKey({ name: val }));
    }
  }

  if (candidates.has(pCat) || candidates.has(ensureCategoryKey({ name: pCat }))) {
    return true;
  }

  // Alt kelime eşleşmesi (Örn: 'atıştırmalık' <-> 'atıştırmalık & bar', 'ekipman' <-> 'ekipman & aksesuar')
  const pCatClean = ensureCategoryKey({ name: pCat });
  for (const c of candidates) {
    if (!c) continue;
    if (c === pCat || c === pCatClean) return true;
    if (pCat.length >= 4 && c.includes(pCat)) return true;
    if (c.length >= 4 && pCat.includes(c)) return true;
    if (pCatClean.length >= 4 && (c.includes(pCatClean) || pCatClean.includes(c))) return true;
  }

  // Bilinen kategori anahtarı <-> Türkçe kategori adı eşleştirmeleri
  const combinedTarget = Array.from(candidates).join(' ');
  if ((pCat === 'drink' || pCat === 'water') && (combinedTarget.includes('içecek') || combinedTarget.includes('icecek') || combinedTarget.includes('su'))) {
    return true;
  }
  if ((pCat === 'bar' || pCat === 'snack') && (combinedTarget.includes('atıştırmalık') || combinedTarget.includes('atistirmalik') || combinedTarget.includes('bar'))) {
    return true;
  }
  if (pCat === 'protein' && (combinedTarget.includes('protein') || combinedTarget.includes('toz'))) {
    return true;
  }
  if ((pCat === 'bcaa' || pCat === 'amino') && (combinedTarget.includes('amino') || combinedTarget.includes('bcaa') || combinedTarget.includes('performans'))) {
    return true;
  }
  if ((pCat === 'accessory' || pCat === 'equipment') && (combinedTarget.includes('ekipman') || combinedTarget.includes('aksesuar') || combinedTarget.includes('havlu'))) {
    return true;
  }

  return false;
}

/**
 * Kategori adı/anahtarına veya mevcut ikonuna göre uygun emojiyi döndürür.
 * 'inventory_2' gibi Material icon string'lerinin arayüzde ham metin olarak çıkmasını önler.
 */
export function resolveCategoryEmoji(catNameOrKey?: string, currentIcon?: string): string {
  const icon = currentIcon?.trim();
  if (icon && icon !== 'inventory_2' && !/^[a-z0-9_]+$/i.test(icon)) {
    return icon;
  }
  const text = (catNameOrKey || '').toLowerCase();
  if (text.includes('protein') || text.includes('toz')) return '🥛';
  if (text.includes('bcaa') || text.includes('amino') || text.includes('kreatin') || text.includes('creatine')) return '⚡';
  if (text.includes('içecek') || text.includes('su') || text.includes('drink') || text.includes('water')) return '🥤';
  if (text.includes('bar') || text.includes('atıştırmalık') || text.includes('snack')) return '🍫';
  if (text.includes('ekipman') || text.includes('aksesuar') || text.includes('havlu') || text.includes('shaker')) return '🎒';
  if (text.includes('performans') || text.includes('güç') || text.includes('pre-workout') || text.includes('enerji')) return '⚡';
  if (text.includes('vitamin') || text.includes('mineral') || text.includes('hap') || text.includes('tablet')) return '💊';
  return '📦';
}
