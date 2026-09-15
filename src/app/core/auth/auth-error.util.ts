/** Firebase Auth hata kodlarını kullanıcıya gösterilecek Türkçe metne çevirir. */
const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'E-posta adresi geçerli görünmüyor.',
  'auth/user-disabled': 'Bu hesap devre dışı bırakılmış.',
  'auth/user-not-found': 'Bu e-posta ile kayıtlı bir hesap bulunamadı.',
  'auth/wrong-password': 'E-posta veya şifre hatalı.',
  'auth/invalid-credential': 'E-posta veya şifre hatalı.',
  'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanımda.',
  'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
  'auth/too-many-requests': 'Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar dene.',
  'auth/popup-closed-by-user': 'Google penceresi kapatıldı, tekrar dene.',
  'auth/network-request-failed': 'İnternet bağlantını kontrol et.',
};

export function toAuthErrorMessage(error: unknown): string {
  // Firebase Auth hataları her zaman bir `code` alanı taşır (örn. "auth/wrong-password"),
  // ama `FirebaseError` sınıfı public SDK'dan export edilmediği için duck-typing yapıyoruz.
  const code = (error as { code?: string } | null)?.code;
  return (code && MESSAGES[code]) || 'Bir şeyler ters gitti, lütfen tekrar dene.';
}
