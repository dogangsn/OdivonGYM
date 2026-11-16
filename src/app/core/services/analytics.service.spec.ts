import { AnalyticsService } from './analytics.service';

describe('AnalyticsService.cleanPath', () => {
  it('drops query string and hash', () => {
    expect(AnalyticsService.cleanPath('/payment-result?token=abc&status=ok#x')).toBe('/payment-result');
    expect(AnalyticsService.cleanPath('/auth/register?plan=pro')).toBe('/auth/register');
  });

  it('masks long ids that contain digits', () => {
    expect(AnalyticsService.cleanPath('/admin/members/aB3dE5fG7hJ9kL1mN2pQ')).toBe('/admin/members/:id');
    expect(AnalyticsService.cleanPath('/admin/subscriptions')).toBe('/admin/subscriptions');
  });

  it('keeps the root path', () => {
    expect(AnalyticsService.cleanPath('')).toBe('/');
    expect(AnalyticsService.cleanPath('/#ozellikler')).toBe('/');
  });
});
