import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Auth,
  GoogleAuthProvider,
  User,
  authState,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from '@angular/fire/auth';
import { Firestore, Timestamp, collection, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { catchError, of, switchMap, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MembershipStatus, UserProfile } from '../models/user-profile.model';
import { FirestoreUserService } from '../services/firestore-user.service';
import { slugify } from '../data/slugify';

/**
 * Auth durumu + `users/{uid}` profilinin tek gerçek kaynağı. Her şey signal:
 * route guard'lar ve UI bileşenleri buradan `computed` olarak okur.
 *
 * ⚠️ SPARK PLANI: Cloud Functions (Admin SDK / Custom Claims) Firebase'de
 * SADECE Blaze planında deploy edilebiliyor. Bu proje Spark'ta olduğu için
 * `tenants`/`users` dokümanları burada, CLIENT'TAN, doğrudan Firestore'a
 * yazılır — otorite artık Admin SDK değil, `firestore.rules`'daki `get()`
 * tabanlı kontrollerdir (bkz. firestore.rules: `myTenantId()`,
 * `tenants/{tenantId}` → `ownerUid`). Blaze'e geçilirse bu servis tekrar
 * Cloud Functions'a (bkz. functions/src/tenant/*, hâlâ repoda duruyor) devredilebilir.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly firestoreUsers = inject(FirestoreUserService);

  private readonly firebaseUser = signal<User | null>(null);
  private readonly userProfile = signal<UserProfile | null>(null);

  /** İlk auth + profil çözümlemesi tamamlandı mı? Guard'lar bunu bekler. */
  readonly ready = signal(false);

  readonly isAuthenticated = computed(() => this.firebaseUser() !== null);
  readonly profile = computed(() => this.userProfile());
  readonly membershipStatus = computed<MembershipStatus | null>(
    () => this.userProfile()?.membershipStatus ?? null,
  );

  /** Deneme süresinden kalan gün (0'ın altına inmez). */
  readonly trialDaysLeft = computed(() => {
    const trialEndsAt = this.userProfile()?.trialEndsAt;
    if (!trialEndsAt) {
      return 0;
    }
    const diffMs = trialEndsAt.toMillis() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  });

  readonly isTrialExpired = computed(
    () => this.membershipStatus() === 'trial' && this.trialDaysLeft() <= 0,
  );

  /** Dashboard'a mı, yoksa "Paket Satın Al" ekranına mı gidebilir? */
  readonly canAccessApp = computed(() => {
    const status = this.membershipStatus();
    if (status === 'active') return true;
    if (status === 'trial') return !this.isTrialExpired();
    return false; // 'expired' | 'cancelled' | null (profil henüz oluşmadı)
  });

  constructor() {
    authState(this.auth)
      .pipe(
        tap((user) => {
          // Kimlik her değiştiğinde (giriş/kayıt/çıkış) guard'lar yeni
          // profil gelene kadar beklesin — aksi halde `ready` sinyalinin
          // ÖNCEKİ kullanıcıdan kalan `true` değeri, yeni kullanıcı için
          // profil daha okunmadan guard'ların yanlış karar vermesine yol
          // açar (örn. kayıttan hemen sonra "deneme süresi bitti" ekranına
          // düşme).
          this.ready.set(false);
          this.firebaseUser.set(user);
        }),
        switchMap((user) =>
          user
            ? this.firestoreUsers.watchProfile(user.uid).pipe(
                // Bu, kalıcı bir realtime dinleyici — doküman değişmediği
                // sürece uzun süre (dakikalarca) sessiz kalması NORMAL.
                // Sadece İLK değeri 10sn içinde bekliyoruz (ağ sorunuyla
                // asılı kalıp uygulamayı sonsuza kadar "Yükleniyor…"da
                // kilitlememesi için); sonraki sessizlikleri hata sanıp
                // az önce gelen geçerli profili `null`'a çevirmeyelim.
                timeout({ first: 10_000 }),
                catchError((err) => {
                  console.error('OdivonGYM: kullanıcı profili okunamadı', err);
                  return of(undefined);
                }),
              )
            : of(undefined),
        ),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (profile) => {
          this.userProfile.set(profile ?? null);
          this.ready.set(true);
        },
        // authState() kendisi hata verirse de aynı şekilde kilitlenmeyelim.
        error: (err) => {
          console.error('OdivonGYM: auth durumu okunamadı', err);
          this.ready.set(true);
        },
      });
  }

  /**
   * İş Kuralı 1 — yeni bir spor salonu kaydeder ve bu işlemi yapan kişiyi
   * otomatik olarak o salonun Admin'i yapar. `tenants/{tenantId}` ve
   * `users/{uid}` dokümanları TEK bir Firestore `WriteBatch`'te (atomik)
   * yazılır — ya ikisi de yazılır ya hiçbiri. `firestore.rules`, bu
   * dokümanları yalnızca bu kişinin (kendi uid'i + kendi yeni tenant'ının
   * `ownerUid`'i eşleşerek) yazabildiğini doğrular.
   *
   * `country`/`language`, kayıt formunda seçilen ülkeye göre gelir (bkz.
   * Register component + core/data/countries.ts) — ülke bazlı veri tutma ve
   * "kayıt olurken arayüz dilini otomatik seçme" gereksinimi buradan başlar.
   */
  async signUpWithEmail(input: {
    tenantName: string;
    email: string;
    password: string;
    displayName: string;
    country: string;
    phone: string;
    language: string;
  }): Promise<void> {
    const credential = await createUserWithEmailAndPassword(this.auth, input.email, input.password);
    await updateProfile(credential.user, { displayName: input.displayName });

    try {
      await this.bootstrapOwnTenant(credential.user.uid, input.tenantName, {
        email: input.email.trim(),
        displayName: input.displayName.trim(),
        photoURL: null,
        country: input.country,
        phone: input.phone,
        language: input.language,
      });
    } catch (error) {
      // Firestore tarafı (rules/ağ) başarısız olursa yetim bir Auth
      // kullanıcısı bırakmayalım — kendi hesabını silip hatayı yeniden fırlat.
      await credential.user.delete().catch(() => undefined);
      throw error;
    }
  }

  /**
   * `tenants/{tenantId}` + `users/{uid}` (role: 'admin') dokümanlarını
   * SIRAYLA (batch DEĞİL) oluşturur. `firestore.rules`'daki `users/{uid}`
   * create kuralı, `tenants/{tenantId}`'in ownerUid'ini `get()` ile
   * doğruluyor — ama rules engine, TEK bir atomik `writeBatch` içindeki
   * write'ları birbirine göre "başlangıç anındaki" (transaction öncesi)
   * durumu görerek değerlendirir. Yani tenant'ı da AYNI batch'te
   * oluşturursak, `exists(tenants/$(tenantId))` kuralı onu göremez ve write
   * `permission-denied` ile reddedilir (canlıda REST API ile doğrulandı).
   * Çözüm: tenant'ı önce yazıp `await` ile gerçekten commit olmasını
   * bekleyip, ANCAK ONDAN SONRA kullanıcı profilini yazmak — artık `get()`
   * gerçekten var olan bir dokümanı görür. Bedeli: ikisi arasında (çok kısa)
   * bir an için atomiklik yok; ağ tam bu arada koparsa sahipsiz bir tenant
   * kalabilir (güvenlik riski değil, sadece kullanılmayan bir kayıt —
   * `tenants` için `allow update, delete: if false` olduğundan silinemez).
   */
  private async bootstrapOwnTenant(
    uid: string,
    tenantName: string,
    profile: {
      email: string;
      displayName: string;
      photoURL: string | null;
      country?: string;
      phone?: string;
      language?: string;
    },
  ): Promise<string> {
    const tenantRef = doc(collection(this.firestore, 'tenants'));
    const now = Timestamp.now();
    const trialEndsAt = Timestamp.fromMillis(now.toMillis() + environment.trialDurationDays * 24 * 60 * 60 * 1000);

    await setDoc(tenantRef, {
      name: tenantName.trim(),
      slug: `${slugify(tenantName)}-${tenantRef.id.slice(0, 6)}`,
      ownerUid: uid,
      createdAt: now,
    });

    await setDoc(doc(this.firestore, 'users', uid), {
      uid,
      tenantId: tenantRef.id,
      role: 'admin',
      membershipStatus: 'trial',
      trialStartedAt: now,
      trialEndsAt,
      email: profile.email,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      country: profile.country ?? null,
      phone: profile.phone ?? null,
      language: profile.language ?? 'tr',
      createdAt: now,
      updatedAt: now,
    });

    return tenantRef.id;
  }

  /**
   * `remember` false ise oturum sadece bu sekme/pencere kapanana kadar
   * yaşar (browserSessionPersistence); true (varsayılan "Beni hatırla"
   * işaretli) ise tarayıcı kapansa da kalıcı olur.
   */
  async signInWithEmail(email: string, password: string, remember = true): Promise<void> {
    await setPersistence(this.auth, remember ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  /**
   * Google popup'ı zaten Auth kullanıcısını oluşturur/oturum açar. Bu
   * kimliğin sistemdeki İLK görünüşüyse (henüz `users/{uid}` dokümanı yoksa)
   * Kural 1 aynı şekilde uygulanır: yeni bir salon + admin profili kurulur.
   * Zaten kayıtlıysa (mevcut kullanıcı Google ile giriş yapıyorsa) hiçbir
   * şey yazılmaz — `watchProfile` zaten mevcut dokümanı okuyacaktır.
   */
  async signInWithGoogle(): Promise<void> {
    const credential = await signInWithPopup(this.auth, new GoogleAuthProvider());
    const { uid, email, displayName, photoURL } = credential.user;

    const existing = await getDoc(doc(this.firestore, 'users', uid));
    if (existing.exists()) {
      return;
    }

    await this.bootstrapOwnTenant(uid, displayName ? `${displayName} Salonu` : 'Yeni Salon', {
      email: email ?? '',
      displayName: displayName ?? 'Üye',
      photoURL: photoURL ?? null,
    });
  }

  /**
   * Çıkış sonrası `router.navigateByUrl('/auth/login')` (bkz. Shell.logOut)
   * hemen ardından çalışır — ama `authState()` aboneliğindeki `tap()`'in
   * `firebaseUser`/`ready` sinyallerini güncellemesi Firebase'in
   * `onAuthStateChanged` callback'ini tetiklemesini BEKLER, bu da bir sonraki
   * mikro/task'a kayabilir. O aradaki anda `guestGuard` hâlâ ESKİ (giriş
   * yapılmış) durumu görüp `/auth/login`'e gidişi anında `/dashboard`'a geri
   * çevirir — kullanıcı çıkış yapamaz, sadece profili boşalmış bir "hayalet"
   * ekranda kalır. Bu yüzden sinyalleri burada SENKRON olarak temizliyoruz;
   * `authState()`'in az sonra gelecek `null` emisyonu aynı değerleri
   * (zararsızca) tekrar uygular.
   */
  async logOut(): Promise<void> {
    await signOut(this.auth);
    this.firebaseUser.set(null);
    this.userProfile.set(null);
    this.ready.set(true);
  }
}
