/**
 * Firebase Auth VE Cloud Functions callable hata kodlarını `authErrors.*`
 * çeviri anahtarlarına çevirir. Callable'lardan (bkz. functions/src/tenant/*)
 * gelen `HttpsError`'lar client'a `functions/<code>` biçiminde ulaşır — bu
 * eşleme olmadan hepsi `authErrors.generic`'e düşer ("Bir şeyler ters gitti"),
 * ki bu tam olarak asıl nedeni gizleyen, teşhis edilemez bir mesajdır.
 */
const CODE_TO_KEY: Record<string, string> = {
  'auth/invalid-email': 'authErrors.invalidEmail',
  'auth/user-disabled': 'authErrors.userDisabled',
  'auth/user-not-found': 'authErrors.userNotFound',
  'auth/wrong-password': 'authErrors.wrongPassword',
  'auth/invalid-credential': 'authErrors.invalidCredential',
  'auth/email-already-in-use': 'authErrors.emailAlreadyInUse',
  'auth/weak-password': 'authErrors.weakPassword',
  'auth/too-many-requests': 'authErrors.tooManyRequests',
  'auth/popup-closed-by-user': 'authErrors.popupClosedByUser',
  'auth/network-request-failed': 'authErrors.networkRequestFailed',
  'functions/already-exists': 'authErrors.emailAlreadyInUse',
  'functions/permission-denied': 'authErrors.permissionDenied',
  'functions/invalid-argument': 'authErrors.invalidArgument',
  'functions/unauthenticated': 'authErrors.unauthenticated',
  'functions/unavailable': 'authErrors.networkRequestFailed',
  // Spark planında (Cloud Functions yok) yetki hataları artık doğrudan
  // Firestore client SDK'sından geliyor — `functions/` ön eki OLMADAN.
  'permission-denied': 'authErrors.permissionDenied',
};

/**
 * `translate` olarak `TranslocoService.translate` (veya aynı imzadaki başka
 * bir fonksiyon) geçirilir — bu dosyanın kendisi Angular DI'a bağımlı
 * kalmasın diye saf bir fonksiyon olarak tutuluyor.
 */
export function toAuthErrorMessage(error: unknown, translate: (key: string) => string): string {
  if (error instanceof Error && !(error as { code?: string }).code) {
    return error.message;
  }
  // Firebase Auth hataları her zaman bir `code` alanı taşır (örn. "auth/wrong-password"),
  // ama `FirebaseError` sınıfı public SDK'dan export edilmediği için duck-typing yapıyoruz.
  const code = (error as { code?: string } | null)?.code;
  const key = (code && CODE_TO_KEY[code]) || 'authErrors.generic';
  return translate(key);
}
