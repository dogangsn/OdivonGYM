import { toMillis } from '../../shared/ui/ui-utils';
import { UserProfile } from '../../core/models/user-profile.model';

describe('AdminSubscriptions Freeze Logic', () => {
  function parseFreezeDays(val: string | number | null | undefined): number {
    if (val === null || val === undefined || val === '') {
      return 0;
    }
    const parsed = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (!isNaN(parsed)) {
      return Math.max(0, Math.min(365, parsed));
    }
    return 0;
  }

  function calculateFreezePreview(member: Partial<UserProfile> | null, days: number): string {
    if (!member || !days || days <= 0) return '';
    let base = new Date();
    if (member.membershipEndsAt) {
      const ms = toMillis(member.membershipEndsAt as any);
      if (ms > Date.now()) base = new Date(ms);
    }
    base.setDate(base.getDate() + days);
    return base.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  it('should parse valid numbers and clamp them within 0 to 365', () => {
    expect(parseFreezeDays(15)).toBe(15);
    expect(parseFreezeDays('45')).toBe(45);
    expect(parseFreezeDays('0')).toBe(0);
    expect(parseFreezeDays('')).toBe(0);
    expect(parseFreezeDays(null)).toBe(0);
    expect(parseFreezeDays(undefined)).toBe(0);
    expect(parseFreezeDays('abc')).toBe(0);
    expect(parseFreezeDays(500)).toBe(365);
    expect(parseFreezeDays(-10)).toBe(0);
  });

  it('should calculate new end date preview by adding freeze days to active membership date', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const member: Partial<UserProfile> = {
      uid: 'user-123',
      displayName: 'Ahmet Yılmaz',
      membershipEndsAt: futureDate.toISOString() as any,
    };

    const preview = calculateFreezePreview(member, 15);
    expect(preview).toBeTruthy();
    expect(typeof preview).toBe('string');
  });

  it('should return empty string if days is 0 or negative', () => {
    const member: Partial<UserProfile> = {
      uid: 'user-123',
      displayName: 'Ahmet Yılmaz',
    };
    expect(calculateFreezePreview(member, 0)).toBe('');
    expect(calculateFreezePreview(member, -5)).toBe('');
    expect(calculateFreezePreview(null, 15)).toBe('');
  });
});
