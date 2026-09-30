import { addMonths, gymToday, previewSchedule } from './installment-math';

describe('installment preview math', () => {
  it('sums to the financed amount to the kuruş and puts leftovers on the last installment', () => {
    const rows = previewSchedule(1000, 3, '2026-10-31');
    expect(rows.map((r) => r.amount)).toEqual([333.33, 333.33, 333.34]);
    expect(rows.map((r) => r.dueDate)).toEqual(['2026-10-31', '2026-11-30', '2026-12-31']);
  });

  it('clamps month ends like the server', () => {
    expect(addMonths('2028-01-31', 1, 31)).toBe('2028-02-29');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('returns nothing for an empty or invalid plan', () => {
    expect(previewSchedule(0, 3, '2026-10-01')).toEqual([]);
    expect(previewSchedule(100, 3, '')).toEqual([]);
  });

  it('uses the Istanbul calendar day', () => {
    expect(gymToday(new Date('2026-09-30T21:30:00Z'))).toBe('2026-10-01');
  });
});
