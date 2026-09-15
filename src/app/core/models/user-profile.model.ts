import { Timestamp } from '@angular/fire/firestore';

/** Kullanıcının üyelik durumu. Otoriter kaynak: Cloud Functions / Admin SDK / admin paneli. */
export type MembershipStatus = 'trial' | 'active' | 'expired' | 'cancelled';

/** Uygulama içi rol — route guard'larında kullanılır. */
export type UserRole = 'user' | 'admin';

export type Gender = 'female' | 'male' | 'unspecified';

/**
 * `users/{uid}` koleksiyonundaki doküman şekli.
 *
 * `role`, `membershipStatus`, `trialStartedAt`, `trialEndsAt` gibi alanlar
 * client tarafından (kendi dokümanı için) kısıtlı şekilde yazılabilir —
 * asıl otorite Cloud Functions veya admin panelidir (bkz. firestore.rules).
 * Admin panelinden manuel üye kaydında (bkz. AdminMembersService) diğer
 * alanlar da doldurulur.
 */
export interface UserProfile {
  uid: string;
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
  /** `membershipStatus === 'active'` iken paketin bittiği tarih (bilgi amaçlı). */
  membershipEndsAt?: Timestamp | null;
  /** Seçilen paketin görünen adı (örn. "3 Aylık") — henüz ayrı bir packages koleksiyonu yok. */
  packageLabel?: string | null;
  /** Sadece admin panelinde görünen dahili not. */
  notes?: string;
  /** TL cinsinden e-cüzdan bakiyesi — otomat/market alışverişi ve ders/PT ek satışlarında kullanılır. */
  walletBalance?: number;
}

/** `create` sırasında client'ın gönderdiği, henüz Firestore'a yazılmamış şekil. */
export type NewUserProfile = Omit<UserProfile, 'createdAt' | 'updatedAt'>;
