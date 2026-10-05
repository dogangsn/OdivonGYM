import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService, SAAS_RENEW_URL } from './auth.service';
import { isSaasRenewUrl, trialGuard, wizardGuard } from './trial.guard';

describe('trialGuard', () => {
  const locked = signal(false);
  const onboarded = signal(true);
  const landing = signal(SAAS_RENEW_URL);

  beforeEach(() => {
    locked.set(false);
    onboarded.set(true);
    landing.set(SAAS_RENEW_URL);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            ready: signal(true),
            isSaasLocked: locked,
            onboardingCompleted: onboarded,
            lockedLandingUrl: landing,
          },
        },
      ],
    });
  });

  const run = (url: string) =>
    TestBed.runInInjectionContext(() => trialGuard({} as never, { url } as RouterStateSnapshot));
  const urlOf = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  it('sends an expired gym to the subscription page even if the wizard is unfinished', () => {
    locked.set(true);
    onboarded.set(false);
    expect(urlOf(run('/dashboard'))).toBe('/admin/subscription');
    expect(urlOf(run('/admin/members'))).toBe('/admin/subscription');
    expect(urlOf(run('/admin/subscriptions'))).toBe('/admin/subscription');
    expect(run('/admin/subscription')).toBeTrue();
  });

  it('sends expired non-admins to the package page', () => {
    locked.set(true);
    landing.set('/onboarding/trial-expired');
    expect(urlOf(run('/admin/subscription'))).toBe('/onboarding/trial-expired');
  });

  it('keeps the wizard for an active gym that has not finished setup', () => {
    onboarded.set(false);
    expect(urlOf(run('/dashboard'))).toBe('/onboarding/wizard');
  });

  it('lets an active gym through', () => {
    expect(run('/admin/members')).toBeTrue();
  });

  it('blocks the wizard for an expired gym', () => {
    locked.set(true);
    const result = TestBed.runInInjectionContext(() => wizardGuard({} as never, {} as never));
    expect(urlOf(result)).toBe('/admin/subscription');
  });

  it('matches only the SaaS subscription page', () => {
    expect(isSaasRenewUrl('/admin/subscription?tab=history')).toBeTrue();
    expect(isSaasRenewUrl('/admin/subscriptions')).toBeFalse();
  });
});
