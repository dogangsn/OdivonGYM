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
