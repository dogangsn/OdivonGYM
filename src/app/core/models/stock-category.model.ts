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
