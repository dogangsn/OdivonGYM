import { Timestamp } from '@angular/fire/firestore';

/** Kullanıcının üyelik durumu. Otoriter kaynak: Cloud Functions / Admin SDK / admin paneli. */
export type MembershipStatus = 'trial' | 'active' | 'expired' | 'cancelled';

/** Uygulama içi rol — route guard'larında kullanılır. */
export type UserRole = 'user' | 'admin';

export type Gender = 'female' | 'male' | 'unspecified';

/**
 * `users/{uid}` koleksiyonundaki doküman şekli.
 *
 * Doküman SADECE Cloud Functions (Admin SDK) tarafından oluşturulur — bkz.
 * `functions/src/tenant/*` ve `firestore.rules` (`users` altında client
 * `create` izni yok). Client, kendi dokümanında yalnızca `displayName` ve
 * `photoURL`'ü güncelleyebilir; `tenantId`/`role`/üyelik alanları admin
 * panelinden (bkz. AdminMembersService) veya Cloud Functions'tan değişir.
 */
export interface UserProfile {
  uid: string;
  /** Bu kullanıcının ait olduğu spor salonu — bkz. `tenants/{tenantId}`. Tüm veri izolasyonunun temeli. */
  tenantId: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  membershipStatus: MembershipStatus;
  trialStartedAt: Timestamp;
  trialEndsAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // --- Admin panelinden manuel kayıtta doldurulan, opsiyonel üye bilgileri ---
  /** E.164'e yakın serbest metin — biçim doğrulaması sadece basit desenle yapılır. */
  phone?: string;
  gender?: Gender;
  birthDate?: Timestamp | null;
  /** Üyeliğin/paketin başladığı tarih — admin panelinde elle seçilir, paket dışı (özel) süreler için de geçerli. */
  membershipStartsAt?: Timestamp | null;
  /** `membershipStatus === 'active'` iken paketin bittiği tarih — admin panelinde elle seçilir/düzenlenir. */
  membershipEndsAt?: Timestamp | null;
  /** Seçilen paketin görünen adı (örn. "3 Aylık") — henüz ayrı bir packages koleksiyonu yok. */
  packageLabel?: string | null;
  /** Sadece admin panelinde görünen dahili not. */
  notes?: string;
  /** ISO 3166-1 alpha-2 (örn. "TR") — kayıt formunda seçilir, bkz. core/data/countries.ts. */
  country?: string;
  /** Arayüz dili — kayıt formunda ülkeye göre önerilir, kullanıcı sonradan değiştirebilir. */
  language?: string;
  /** TL cinsinden e-cüzdan bakiyesi — otomat/market alışverişi ve ders/PT ek satışlarında kullanılır. */
  walletBalance?: number;
}

