import { HttpsError } from 'firebase-functions/v2/https';

/**
 * `admin.auth().createUser()` başarısız olursa Admin SDK'nın kendi hata
 * kodunu (örn. `auth/email-already-exists`) fırlatır — bunu YAKALAMADAN
 * fonksiyondan çıkmasına izin verirsek, Firebase Functions güvenlik gereği
 * istemciye bunu ayrıntısız, genel bir "internal" hataya çevirir (bkz.
 * client tarafı `authErrors.generic` — "Bir şeyler ters gitti"). Bu yüzden
 * bilinen hata kodlarını burada anlamlı bir `HttpsError`'a çeviriyoruz;
 * client bunu `functions/<code>` olarak görür ve `auth-error.util.ts`
 * bunu doğru mesaja çözer.
 */
export function mapCreateUserError(error: unknown): never {
  const code = (error as { code?: string } | null)?.code;

  if (code === 'auth/email-already-exists') {
    throw new HttpsError('already-exists', 'Bu e-posta adresi zaten kullanımda.');
  }
  if (code === 'auth/invalid-password') {
    throw new HttpsError('invalid-argument', 'Şifre en az 6 karakter olmalı.');
  }
  if (code === 'auth/invalid-email') {
    throw new HttpsError('invalid-argument', 'E-posta adresi geçerli görünmüyor.');
  }

  throw new HttpsError('internal', 'Kullanıcı oluşturulamadı, lütfen tekrar dene.');
}
