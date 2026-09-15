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
import { Timestamp } from '@angular/fire/firestore';
import { catchError, of, switchMap, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MembershipStatus, NewUserProfile, UserProfile } from '../models/user-profile.model';
import { FirestoreUserService } from '../services/firestore-user.service';

/**
 * Auth durumu + `users/{uid}` profilinin tek gerçek kaynağı. Her şey signal:
 * route guard'lar ve UI bileşenleri buradan `computed` olarak okur.
 *
 * `membershipStatus` / `trialEndsAt` alanlarının otoriter kaynağı Cloud
 * Functions'tır (`createUserProfile`, `expireTrials`) — bu servis sadece
 * gösterim ve (Function henüz çalışmadıysa) tek seferlik fallback oluşturma
 * yapar; bkz. `FirestoreUserService.createTrialProfileIfMissing` ve
 * `firestore.rules`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
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

  async signUpWithEmail(email: string, password: string, displayName: string): Promise<void> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(credential.user, { displayName });
    await this.provisionTrialProfile(credential.user.uid, email, displayName, null);
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

  async signInWithGoogle(): Promise<void> {
    const credential = await signInWithPopup(this.auth, new GoogleAuthProvider());
    const { uid, email, displayName, photoURL } = credential.user;
    await this.provisionTrialProfile(uid, email ?? '', displayName ?? 'Üye', photoURL);
  }

  async logOut(): Promise<void> {
    await signOut(this.auth);
  }

  /**
   * `createUserProfile` Cloud Function'ının auth-trigger'ı normal şartlarda
   * bu dokümanı zaten oluşturur; burası sadece Function henüz deploy
   * edilmemişse (örn. yerel geliştirme) veya henüz tetiklenmediyse devreye
   * giren, idempotent bir güvenlik ağıdır (bkz. firestore.rules "create").
   */
  private async provisionTrialProfile(
    uid: string,
    email: string,
    displayName: string,
    photoURL: string | null,
  ): Promise<void> {
    const newProfile: NewUserProfile = {
      uid,
      email,
      displayName,
      photoURL,
      role: 'user',
      membershipStatus: 'trial',
      trialStartedAt: Timestamp.now(),
      trialEndsAt: FirestoreUserService.trialEndsAtFromNow(environment.trialDurationDays),
    };
    await this.firestoreUsers.createTrialProfileIfMissing(newProfile);
  }
}
