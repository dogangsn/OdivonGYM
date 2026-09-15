/**
 * Faz 2'de (paket satın alma) kullanılacak taslak tipler. Şimdiden buraya
 * konuluyor ki `MembershipStatus` ile birlikte tek yerden import edilebilsin.
 */
export type PackageDuration = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface MembershipPackage {
  id: string;
  name: string;
  duration: PackageDuration;
  durationInDays: number;
  price: number;
  currency: 'TRY';
  description?: string;
  isActive: boolean;
}
