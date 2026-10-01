import { SOURCES, sourceLabel, STAGE_CLASS, STAGE_LABEL } from './lead-labels';

describe('lead labels', () => {
  it('labels every source, unknown and legacy values', () => {
    expect(SOURCES).not.toContain('unknown' as never);
    for (const source of SOURCES) {
      expect(sourceLabel(source)).toBeTruthy();
    }
    expect(sourceLabel(null)).toBe('Belirtilmemiş');
    expect(sourceLabel('tiktok')).toBe('tiktok');
  });

  it('has a label and a style for every stage, including trial', () => {
    expect(Object.keys(STAGE_LABEL).sort()).toEqual(['called', 'converted', 'lost', 'trial', 'visited']);
    expect(Object.keys(STAGE_CLASS).sort()).toEqual(Object.keys(STAGE_LABEL).sort());
  });
});
