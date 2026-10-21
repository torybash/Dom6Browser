import { describe, expect, it } from 'vitest';
import { PAGE_BY_ID } from '../src/pages';
import { isColHidden, tableColumns, toggleCol } from '../src/ui/ResultsTable';
import { vanilla } from './helpers';

const cols = (DMI: any, mod: string) => DMI[mod].grid.columns as any[];
const ids = (DMI: any, mod: string) => cols(DMI, mod).map((c) => c.id);

function sortBy(DMI: any, mod: string, id: string, asc: boolean) {
  const grid = DMI[mod].grid;
  const col = grid.columns.find((c: any) => c.id === id);
  const args = { sortCol: col, sortAsc: asc };
  grid.preSort?.(null, args);
  return [...grid.data()].sort(DMI.makeSortCmp(col, args.sortAsc, undefined));
}

describe('value columns', () => {
  it('units: stat columns exist, numeric, with the agreed default visibility', async () => {
    const DMI = await vanilla();
    const shown = ['hp', 'prot', 'mr', 'mor', 'att', 'def'];
    const hidden = ['str', 'prec', 'size', 'enc', 'mapmove', 'ap', 'leader', 'magicleader', 'undeadleader'];
    for (const id of [...shown, ...hidden]) {
      const c = cols(DMI, 'MUnit').find((x) => x.id === id);
      expect(c, id).toBeTruthy();
      expect(c.cssClass).toBe('numeric');
      expect(c.sortCmp).toBe('num');
      expect(!!c.defaultHidden, id).toBe(hidden.includes(id));
    }
  });

  it('units: HP and Prot sort numerically (not as strings)', async () => {
    const DMI = await vanilla();
    for (const id of ['hp', 'prot', 'mapmove', 'leader']) {
      const rows = sortBy(DMI, 'MUnit', id, true);
      const vals = rows.map((o: any) => parseFloat(o[id]) || 0);
      for (let i = 1; i < vals.length; i++) if (vals[i] < vals[i - 1]) throw new Error(`${id} out of order at ${i}`);
    }
    const desc = sortBy(DMI, 'MUnit', 'hp', false);
    expect(parseFloat(desc[0].hp)).toBeGreaterThan(parseFloat(desc[desc.length - 1].hp));
  });

  it('units: cells render values after finalising the unit', async () => {
    const DMI = await vanilla();
    const grid = DMI.MUnit.grid;
    const hp = grid.columns.find((c: any) => c.id === 'hp');
    const prot = grid.columns.find((c: any) => c.id === 'prot');
    const o = grid.data().find((u: any) => u.name === 'Standard');
    expect(hp.formatter(0, 0, o.hp, hp, o)).toMatch(/^\d+$/);
    expect(prot.formatter(0, 0, o.prot, prot, o)).toMatch(/^\d+$/);
  });

  it('weapons, armor, items and spells gained value columns', async () => {
    const DMI = await vanilla();
    expect(ids(DMI, 'MWpn')).toEqual(expect.arrayContaining(['dmg', 'att', 'def', 'len', 'nratt', 'range', 'ammo']));
    expect(ids(DMI, 'MArmor')).toEqual(expect.arrayContaining(['protval', 'def', 'enc']));
    expect(ids(DMI, 'MItem')).toContain('gemcost');
    expect(ids(DMI, 'MSpell')).toEqual(expect.arrayContaining(['rng_bat', 'aoe_s', 'casttime']));
    const dmg = sortBy(DMI, 'MWpn', 'dmg', false).map((o: any) => parseFloat(o.dmg) || 0);
    for (let i = 1; i < dmg.length; i++) expect(dmg[i]).toBeLessThanOrEqual(dmg[i - 1]);
    const prot = sortBy(DMI, 'MArmor', 'protval', false);
    expect(prot[0].protval).toBeGreaterThan(prot[prot.length - 1].protval);
    const full = DMI.MArmor.grid.data().find((o: any) => o.name === 'Full Plate Armor');
    if (full) expect(full.protval).toBe(parseInt(full.protbody));
    const gems = sortBy(DMI, 'MItem', 'gemcost', false);
    expect(parseInt(gems[0].gemcost)).toBeGreaterThanOrEqual(parseInt(gems[gems.length - 1].gemcost) || 0);
  });
});

describe('default column visibility', () => {
  const none = { hidden: [] as string[], widths: {} };

  it('defaultHidden columns are off until shown, even for old saved prefs', async () => {
    const DMI = await vanilla();
    const grid = DMI.MUnit.grid;
    const results: any = { rows: [], total: 0, grid };
    const visible = (p: any) => tableColumns(PAGE_BY_ID.unit, results, false, false, p).map((c) => c.id);
    const v = visible(none);
    expect(v).toEqual(expect.arrayContaining(['hp', 'prot', 'mr', 'mor', 'att', 'def']));
    for (const id of ['str', 'prec', 'size', 'enc', 'mapmove', 'ap', 'leader', 'magicleader', 'undeadleader']) expect(v).not.toContain(id);
    // legacy prefs without a `shown` list behave the same
    expect(visible({ hidden: ['gold'], widths: {} })).not.toContain('str');
  });

  it('toggling shows/hides and reset restores defaults', async () => {
    const DMI = await vanilla();
    const str = cols(DMI, 'MUnit').find((c) => c.id === 'str');
    const hp = cols(DMI, 'MUnit').find((c) => c.id === 'hp');
    let p = toggleCol(none, str, true);
    expect(isColHidden(p, str)).toBe(false);
    p = toggleCol(p, str, false);
    expect(isColHidden(p, str)).toBe(true);
    p = toggleCol(none, hp, false);
    expect(isColHidden(p, hp)).toBe(true);
    expect(toggleCol(p, hp, true).hidden).toEqual([]);
    expect(isColHidden({ hidden: [], shown: [], widths: {} }, hp)).toBe(false);
  });

  it('other pages ship some hidden columns', async () => {
    const DMI = await vanilla();
    for (const mod of ['MWpn', 'MArmor', 'MSpell']) expect(cols(DMI, mod).some((c) => c.defaultHidden)).toBe(true);
    expect(cols(DMI, 'MWpn').find((c) => c.id === 'dmg').defaultHidden).toBeFalsy();
  });
});
