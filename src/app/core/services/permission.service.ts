import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import {
  UserRole,
  Permission,
  RoleDefinition,
  ROLE_DEFINITIONS,
} from '../models/user-role.model';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  /**
   * Yönetici / Patronlar için canlı arayüz simülasyonu:
   * Farklı bir rolün gözünden menüyü ve ekranları deneyimlemeyi sağlar.
   */
  readonly previewRole = signal<UserRole | null>(null);

  /** Aktif rol (simülasyon varsa o, yoksa oturum açan kullanıcının asıl rolü) */
  readonly currentRole = computed<UserRole>(() => {
    const preview = this.previewRole();
    if (preview) return preview;
    const profileRole = this.auth.profile()?.role as UserRole | undefined;
    return profileRole ?? 'user';
  });

  /** Aktif rol tanım nesnesi */
  readonly roleDefinition = computed<RoleDefinition>(() => {
    return ROLE_DEFINITIONS[this.currentRole()] ?? ROLE_DEFINITIONS['user'];
  });

  /** Personel mi? (Patron, Yönetici, Antrenör veya Resepsiyon) */
  readonly isStaff = computed<boolean>(() => {
    const role = this.currentRole();
    return ['owner', 'admin', 'trainer', 'receptionist'].includes(role);
  });

  /** Patron mu? (Salon Sahibi) */
  readonly isOwner = computed<boolean>(() => this.currentRole() === 'owner');

  /** Yönetici veya Patron mu? */
  readonly isAdmin = computed<boolean>(() => {
    const role = this.currentRole();
    return role === 'owner' || role === 'admin';
  });

  /** Antrenör mü? */
  readonly isTrainer = computed<boolean>(() => this.currentRole() === 'trainer');

  /** Müşteri Hizmetleri / Resepsiyonist mi? */
  readonly isReceptionist = computed<boolean>(() => this.currentRole() === 'receptionist');

  /** Normal Sporcu Üye mi? */
  readonly isUser = computed<boolean>(() => this.currentRole() === 'user');

  /** Kullanıcı arayüzünde gösterilecek rol unvanı */
  readonly roleTitle = computed<string>(() => {
    return this.roleDefinition().name;
  });

  /**
   * Belirli bir yetkiye sahip mi kontrol eder.
   */
  hasPermission(permission: Permission): boolean {
    // Patron her şeye yetkilidir
    if (this.currentRole() === 'owner') return true;

    // Rolün tanımlı yetkileri
    const roleDef = this.roleDefinition();
    return roleDef.permissions.includes(permission);
  }

  /**
   * Belirli bir rota için erişim iznini denetler.
   */
  canAccessRoute(path: string): boolean {
    const role = this.currentRole();

    // Normal sporcu üye admin rotalarına erişemez
    if (role === 'user') return false;

    // Patron ve Genel Yönetici tüm admin rotalarına erişebilir
    if (role === 'owner' || role === 'admin') return true;

    // Antrenör erişebileceği sayfalar
    if (role === 'trainer') {
      const allowedTrainerRoutes = [
        '/admin/overview',
        '/admin/wizard',
        '/admin/members',
        '/admin/disciplines',
        '/classes',
        '/appointments',
        '/workout',
        '/measurements',
        '/dashboard',
        '/profile',
      ];
      return allowedTrainerRoutes.some((r) => path.startsWith(r));
    }

    // Müşteri Hizmetleri / Resepsiyon erişebileceği sayfalar
    if (role === 'receptionist') {
      const allowedReceptionRoutes = [
        '/admin/overview',
        '/admin/members',
        '/admin/access-control',
        '/admin/shop',
        '/admin/packages',
        '/classes',
        '/appointments',
        '/dashboard',
        '/profile',
      ];
      return allowedReceptionRoutes.some((r) => path.startsWith(r));
    }

    return false;
  }

  /**
   * Canlı rol önizlemesini ayarlar.
   */
  setPreviewRole(role: UserRole | null): void {
    this.previewRole.set(role);
  }

  /**
   * Canlı rol önizlemesini sıfırlar.
   */
  resetPreviewRole(): void {
    this.previewRole.set(null);
  }
}
