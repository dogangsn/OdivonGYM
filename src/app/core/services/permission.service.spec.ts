import { Injector, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { UserProfile } from '../models/user-profile.model';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  const profile = signal<Partial<UserProfile> | null>(null);
  let service: PermissionService;

  beforeEach(() => {
    const injector = Injector.create({
      providers: [{ provide: AuthService, useValue: { profile } }, { provide: PermissionService }],
    });
    service = injector.get(PermissionService);
  });

  it('follows the MainApi permission map for staff', () => {
    profile.set({ role: 'receptionist', permissions: { shop: ['view', 'create'], members: ['view'] } });
    expect(service.can('shop')).toBeTrue();
    expect(service.can('shop', 'delete')).toBeFalse();
    expect(service.can('accounting')).toBeFalse();
    expect(service.can('members', 'update')).toBeFalse();
  });

  it('lets the owner do everything and a signed-out user nothing', () => {
    profile.set({ role: 'owner', permissions: {} });
    expect(service.can('reports')).toBeTrue();
    profile.set(null);
    expect(service.can('members')).toBeFalse();
  });

  it('opens POS and guest members to reception, not to the trainer', () => {
    profile.set({ role: 'receptionist' });
    expect(service.canAccessRoute('/admin/pos')).toBeTrue();
    expect(service.canAccessRoute('/admin/guest-members')).toBeTrue();
    profile.set({ role: 'trainer' });
    expect(service.canAccessRoute('/admin/pos')).toBeFalse();
  });
});
