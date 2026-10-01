import { isSessionTooOld, SESSION_MAX_AGE_DAYS } from '../auth/session-policy';
import { BUILD_INFO } from './build-info';
import { compareVersions } from './version-compare';

describe('version management', () => {
  it('compares x.y.z and ignores build metadata', () => {
    expect(compareVersions('1.2.0+abc', '1.2.0')).toBe(0);
    expect(compareVersions('1.1.9', '1.2.0')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.3')).toBe(1);
  });

  it('compiles a unique build identity into the bundle', () => {
    expect(BUILD_INFO.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(BUILD_INFO.buildId.startsWith(`${BUILD_INFO.version}+`)).toBeTrue();
  });

  it('expires a sign-in older than the session limit', () => {
    const now = Date.parse('2026-10-01T08:00:00Z');
    const daysAgo = (d: number) => new Date(now - d * 86_400_000).toUTCString();
    expect(SESSION_MAX_AGE_DAYS).toBe(30);
    expect(isSessionTooOld(daysAgo(29), now)).toBeFalse();
    expect(isSessionTooOld(daysAgo(31), now)).toBeTrue();
    expect(isSessionTooOld(null, now)).toBeFalse();
  });
});
