/**
 * Longest a sign-in stays valid ("beni hatırla" açıkken). Without "remember me" Firebase uses
 * session persistence, which ends when the browser closes. MainApi enforces the same limit
 * (SESSION_MAX_AGE_DAYS) and answers SESSION_EXPIRED.
 */
export const SESSION_MAX_AGE_DAYS = 30;

/** `authTime` is the token's auth_time as a date string (Firebase IdTokenResult.authTime). */
export function isSessionTooOld(authTime: string | null | undefined, now = Date.now()): boolean {
  if (!authTime) return false;
  const signedIn = Date.parse(authTime);
  return Number.isFinite(signedIn) && now - signedIn > SESSION_MAX_AGE_DAYS * 86_400_000;
}
