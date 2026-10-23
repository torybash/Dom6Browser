import { describe, expect, it } from 'vitest';
import { vanilla } from './helpers';
import { pathNeeds, shortfall, unitCasterOptions } from '../src/data/extensions/casterLevels';

const run = (DMI: any, mod: string, f: Record<string, any>) => {
  const grid = DMI[mod].grid;
  const args = grid.getSearchArgs(f);
  return grid.data().filter((o: any) => grid.searchFilter(o, args));
};

describe('Caster path filter', () => {
  it('unlisted paths count as 0 for spells', async () => {
    const DMI = await vanilla();
    const rows = run(DMI, 'MSpell', { mlevels: { E: 3, N: 2 } });
    expect(rows.length).toBeGreaterThan(0);
    for (const o of rows) expect(shortfall(o, { E: 3, N: 2 })).toBe(0);
    expect(rows.some((o: any) => pathNeeds(o).some(([p]) => p === 'F'))).toBe(false);
    expect(rows.some((o: any) => o.path1 === 'E' && o.pathlevel1 == 3)).toBe(true);
  });

  it('items check main and secondary path', async () => {
    const DMI = await vanilla();
    const rows = run(DMI, 'MItem', { mlevels: { E: 2 } });
    expect(rows.length).toBeGreaterThan(0);
    for (const o of rows) expect(pathNeeds(o).every(([p, n]) => p === 'E' && n <= 2)).toBe(true);
  });

  it('boost lets near misses through; no levels means no filter', async () => {
    const DMI = await vanilla();
    const exact = run(DMI, 'MSpell', { mlevels: { E: 3 } });
    const boosted = run(DMI, 'MSpell', { mlevels: { E: 3 }, mboost: '1' });
    expect(boosted.length).toBeGreaterThan(exact.length);
    for (const o of boosted) expect(shortfall(o, { E: 3 })).toBeLessThanOrEqual(1);
    expect(run(DMI, 'MSpell', { mlevels: { E: 0 } }).length).toBe(run(DMI, 'MSpell', {}).length);
  });

  it('unit options combine fixed paths with guaranteed random picks', () => {
    const u = { E: '2', randompaths: [{ paths: 'EN', levels: '1', chance: '100' }, { paths: 'FW', levels: '1', chance: '10' }] };
    expect(unitCasterOptions(u)).toEqual([{ E: 3 }, { E: 2, N: 1 }]);
    expect(unitCasterOptions({ randompaths: [] })).toEqual([]);
  });
});
