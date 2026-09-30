import { effectiveRole } from './auth.service';

describe('effectiveRole', () => {
  it('keeps owner and admin', () => {
    expect(effectiveRole({ role: 'owner' })).toBe('owner');
    expect(effectiveRole({ role: 'admin', roleIds: ['gym-trainer'] })).toBe('admin');
  });

  it('maps gym staff roles from roleIds', () => {
    expect(effectiveRole({ role: 'user', accountType: 'staff', roleIds: ['gym-reception'] })).toBe('receptionist');
    expect(effectiveRole({ role: 'user', roleIds: ['gym-trainer'] })).toBe('trainer');
    expect(effectiveRole({ role: 'user', roleIds: ['gym-trainer', 'gym-manager'] })).toBe('admin');
  });

  it('never gives a gym member a staff view', () => {
    expect(effectiveRole({ role: 'user', accountType: 'gym_member', roleIds: ['gym-manager'] })).toBe('user');
  });

  it('treats custom-role staff with gym permissions as the narrowest staff view', () => {
    expect(effectiveRole({ role: 'user', permissions: { members: ['view'] } })).toBe('receptionist');
    expect(effectiveRole({ role: 'user', permissions: { users: ['view'] } })).toBe('user');
    expect(effectiveRole({ role: 'user' })).toBe('user');
  });
});
