import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Auth,
  User,
  authState,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from '@angular/fire/auth';
import { firstValueFrom, of, switchMap, tap } from 'rxjs';
import { IdentityApi } from '../api/identity.api';
import { MembershipStatus, UserProfile } from '../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly identity = inject(IdentityApi);

  private readonly firebaseUser = signal<User | null>(null);
  private readonly userProfile = signal<UserProfile | null>(null);
  private readonly readyWaiters: Array<() => void> = [];

  readonly ready = signal(false);
  readonly isAuthenticated = computed(() => this.firebaseUser() !== null);
  readonly profile = computed(() => this.userProfile());
  readonly membershipStatus = computed<MembershipStatus | null>(
    () => this.userProfile()?.membershipStatus ?? null,
  );

  readonly trialDaysLeft = computed(() => {
    const trialEndsAt = this.userProfile()?.trialEndsAt;
    if (!trialEndsAt) {
      return 0;
    }
    const millis = new Date(trialEndsAt).getTime();
    const diffMs = millis - Date.now();
    return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  });

  readonly isTrialExpired = computed(
    () => this.membershipStatus() === 'trial' && this.trialDaysLeft() <= 0,
  );

  readonly canAccessApp = computed(() => {
    const status = this.membershipStatus();
    if (status === 'active') return true;
    if (status === 'trial') return !this.isTrialExpired();
    return false;
  });

  readonly onboardingCompleted = computed(() => this.userProfile()?.onboardingCompleted !== false);

  constructor() {
    authState(this.auth)
      .pipe(
        tap((user) => {
          this.ready.set(false);
          this.firebaseUser.set(user);
        }),
        switchMap((user) => (user ? this.identity.me() : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (me) => {
          this.userProfile.set(me ? mapCurrentUser(me) : null);
          this.markReady();
        },
        error: (err) => {
          console.error('OdivonGYM: profil okunamadı', err);
          this.userProfile.set(null);
          this.markReady();
        },
      });
  }

  async getIdToken(forceRefresh = false): Promise<string | null> {
    const user = this.auth.currentUser ?? this.firebaseUser();
    if (!user) {
      return null;
    }
    return user.getIdToken(forceRefresh);
  }

  async waitUntilReady(): Promise<void> {
    if (this.ready()) {
      return;
    }
    // `toObservable` burada kullanılamaz: giriş/kayıt `await` sonrası enjeksiyon
    // bağlamı dışında çalışır ve yönlendirme hiç başlamadan hata verir.
    await new Promise<void>((resolve) => {
      if (this.ready()) {
        resolve();
        return;
      }
      this.readyWaiters.push(resolve);
    });
  }

  async refreshProfile(): Promise<void> {
    if (!this.firebaseUser()) {
      this.userProfile.set(null);
      return;
    }
    const me = await firstValueFrom(this.identity.me());
    this.userProfile.set(mapCurrentUser(me));
  }

  async signUpWithEmail(input: {
    tenantName: string;
    email: string;
    password: string;
    displayName: string;
    country: string;
    phone: string;
    language: string;
  }): Promise<void> {
    await firstValueFrom(
      this.identity.register({
        email: input.email,
        password: input.password,
        tenantName: input.tenantName,
        module: 'gym',
        displayName: input.displayName,
        phone: input.phone,
      }),
    );
    await this.signInWithEmail(input.email, input.password, true);
  }

  async signInWithEmail(email: string, password: string, remember = true): Promise<void> {
    this.ready.set(false);
    await setPersistence(this.auth, remember ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(this.auth, email, password);
    await this.waitUntilReady();
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async logOut(): Promise<void> {
    await signOut(this.auth);
    this.firebaseUser.set(null);
    this.userProfile.set(null);
    this.markReady();
  }

  private markReady(): void {
    this.ready.set(true);
    if (this.readyWaiters.length === 0) {
      return;
    }
    const waiters = this.readyWaiters.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }
}

function mapCurrentUser(me: {
  uid: string;
  email: string;
  displayName: string | null;
  phone?: string | null;
  tenantId: string;
  role: UserProfile['role'];
  membershipStatus: MembershipStatus;
  trialEndsAt: string | null;
  onboardingCompleted: boolean;
}): UserProfile {
  return {
    uid: me.uid,
    tenantId: me.tenantId,
    email: me.email,
    displayName: me.displayName ?? '',
    photoURL: null,
    role: me.role,
    membershipStatus: me.membershipStatus,
    trialStartedAt: me.trialEndsAt ?? '',
    trialEndsAt: me.trialEndsAt ?? '',
    createdAt: '',
    updatedAt: '',
    phone: me.phone ?? undefined,
    onboardingCompleted: me.onboardingCompleted,
  };
}
