import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as F from '../src/data/extensions/derived/formulas';
import { UNIT_DERIVED, formatDerived } from '../src/data/extensions/derived/registry';
import type { UnitInputs } from '../src/data/extensions/derived/types';
import { serializeEntity } from './golden/normalize.mjs';
import { vanilla, withMods } from './helpers';

const base: UnitInputs = {
  commander: false, str: 10, prec: 10, enc: 3, castingEnc: null, mapmove: 16, flying: false, old: false,
  mounted: false, animal: false, undisciplined: false, mindless: false, patrolbonus: 0, siegebonus: 0, castledef: 0,
  goldcost: 10, addupkeep: 0, sacred: false, slave: false, summoned: false, size: 3, appetite: 0, neednoteat: false,
  supplybonus: 0, mount: null, recruitableCommander: false, magicLevels: 0, sureRandomPath: false, holyLevel: 0, leader: 40,
  slowRecruit: false,
};
const u = (over: Partial<UnitInputs>): UnitInputs => ({ ...base, ...over });

describe('calculated value formulas', () => {
  it('patrol strength', () => {
    expect(F.patrol(base).value).toBeCloseTo(1.3);
    expect(F.patrol(u({ flying: true })).value).toBeCloseTo(2);
    expect(F.patrol(u({ commander: true })).value).toBeCloseTo(2.6);
    // the game rounds up to one decimal
    expect(F.patrol(u({ undisciplined: true })).value).toBeCloseTo(0.7);
    expect(F.patrol(u({ mindless: true, undisciplined: true })).value).toBeCloseTo(0.7);
    expect(F.patrol(u({ patrolbonus: 5 })).value).toBeCloseTo(6.3);
    expect(F.patrol(u({ mounted: true })).confidence).toBe('LIKELY');
  });

  it('siege strength and defence: a strength 10 human counts as 1', () => {
    expect(F.siege(base).value).toBe(1);
    expect(F.siege(u({ flying: true, siegebonus: 10 })).value).toBe(12);
    expect(F.siegeDefence(base).value).toBe(0.5);
    expect(F.siegeDefence(u({ mindless: true, castledef: 1 })).value).toBeCloseTo((1 / 8 + 1) / 2);
    expect(F.siegeDefence(u({ animal: true, undisciplined: true })).value).toBeCloseTo(0.125);
  });

  it('upkeep per year', () => {
    const cases: [number, number][] = [[30, 24], [45, 36], [35, 28], [40, 32], [32, 26], [0, 0]];
    for (const [gold, year] of cases) expect(F.upkeep(u({ goldcost: gold })).value).toBe(year);
    expect(F.upkeep(u({ goldcost: 30, sacred: true })).value).toBe(12);
    expect(F.upkeep(u({ goldcost: 30, sacred: true, slave: true })).value).toBe(12);
    expect(F.upkeep(u({ goldcost: null })).value).toBeNull();
  });

  it('supply usage by size, animals, gluttony, mounts and supply bonus', () => {
    const bySize = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => F.supply(u({ size })).value);
    expect(bySize).toEqual([0.5, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5]);
    expect(F.supply(u({ size: 6, animal: true })).value).toBe(1);
    expect(F.supply(u({ appetite: 1 })).value).toBe(1.5);
    expect(F.supply(u({ neednoteat: true })).value).toBe(0);
    expect(F.supply(u({ neednoteat: true, appetite: 3 })).value).toBe(2.5);
    // like the unit sheet, only the rider counts
    const mounted = F.supply(u({ mount: { size: 5, appetite: 0, animal: true, neednoteat: false } }));
    expect(mounted).toEqual({ value: 1, note: 'the mount eats 1 more (armies count both)' });
    expect(F.supply(u({ supplybonus: 10 })).value).toBe(-9);
  });

  it('formats LIKELY values with ≈ and drops trailing zeros', () => {
    const patrol = UNIT_DERIVED.find((d) => d.id === 'patrol')!;
    const enc = UNIT_DERIVED.find((d) => d.id === 'castingenc')!;
    const upkeep = UNIT_DERIVED.find((d) => d.id === 'upkeep')!;
    expect(formatDerived(patrol, { value: 1.3 })).toBe('1.3');
    expect(formatDerived(patrol, { value: 1.3, confidence: 'LIKELY' })).toBe('≈1.3');
    expect(formatDerived(upkeep, { value: 24 })).toBe('≈24');
    expect(formatDerived(enc, { value: 5 })).toBe('5');
    expect(formatDerived(enc, { value: 5, confidence: 'LIKELY' })).toBe('≈5');
    expect(formatDerived(enc, { value: null })).toBe('');
  });
});

describe('calculated values on loaded units', () => {
  it('computes real units through the legacy fields', async () => {
    const DMI = await vanilla();
    const unit = (id: number) => DMI.modctx.unitlookup[id];
    expect(unit(61).calc_patrol).toBeCloseTo(1.3); // Spearman: (10 + 16) / 20
    expect(unit(61).calc_siege).toBe(1);
    expect(unit(61).calc_supply).toBe(1);
    expect(unit(22).calc_supply).toBe(1); // Knight: the rider only, like the unit sheet
    expect(unit(56).calc_patrol).toBeGreaterThan(5); // Royal Forester, patrol bonus 5
    // commanders get +2 map move in game: (10 + 18) / 20 × 2
    expect(DMI.Derived.get(unit(61), 'patrol', { role: 'commander' }).value).toBeCloseTo(2.8);
  });

  it('gives every unit finite values or none, and never throws', async () => {
    const DMI = await vanilla();
    const counts: Record<string, number> = {};
    for (const o of DMI.modctx.unitdata) {
      for (const { def, result } of DMI.Derived.all(o)) {
        expect(Number.isFinite(result.value), `${def.id} of unit ${o.id}`).toBe(true);
        counts[def.id] = (counts[def.id] ?? 0) + 1;
      }
    }
    expect(counts.siege).toBe(DMI.modctx.unitdata.length);
    expect(counts.patrol).toBe(DMI.modctx.unitdata.length);
    expect(counts.castingenc).toBeGreaterThan(500);
  });

  it('stays invisible to legacy code and the golden comparison', async () => {
    const DMI = await withMods([]);
    const units = DMI.modctx.unitdata;
    const before = units.map((o: any) => JSON.stringify(serializeEntity(o)));
    for (const o of units) for (const def of UNIT_DERIVED) void o[def.field];
    units.forEach((o: any, i: number) => {
      expect(Object.keys(o).some((k) => k.startsWith('calc_'))).toBe(false);
      expect(JSON.stringify(serializeEntity(o))).toBe(before[i]);
    });
  });

  it('exists for modded units', async () => {
    const text = readFileSync(join(__dirname, 'golden', 'mods', 'golden-test.dm'), 'utf8');
    const DMI = await withMods([{ name: 'golden-test.dm', text }]);
    const o = DMI.modctx.unitlookup[5000];
    expect(o.name).toBe('Golden Warlock');
    expect(o.calc_siege).toBeGreaterThan(0);
    expect(DMI.Derived.all(o).length).toBeGreaterThan(3);
  });
});

describe('Calculated section', () => {
  it('is inserted before the unit footer with ≈ markers and escaped tooltips', async () => {
    const { withCalculated } = await import('../src/ui/calculated');
    const DMI = await vanilla();
    const o = DMI.modctx.unitlookup[61];
    const html = withCalculated(DMI, o, o.renderOverlay(o));
    const at = html.indexOf('<div class="calc-section">');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(html.indexOf('<div class="overlay-footer">'));
    expect(html).toContain('data-key="calc_patrol"');
    expect(html).toContain('>1.3<');
    expect(html).toContain('≈'); // upkeep is still unconfirmed
    expect(html).not.toMatch(/title="[^"]*</);
    const spell = DMI.modctx.spelllookup[1];
    expect(withCalculated(DMI, spell, 'x')).toBe('x');
  });
});

describe('calculated columns and filters', () => {
  it('sorts units without a value last in both directions', async () => {
    const DMI = await vanilla();
    const col = DMI.MUnit.grid.columns.find((c: any) => c.id === 'calc_upkeep');
    expect(col.derived).toBe(true);
    const rows = [...DMI.modctx.unitdata];
    for (const asc of [true, false]) {
      rows.sort(DMI.makeSortCmp(col, asc));
      expect(rows[0].calc_upkeep).toBeDefined();
      expect(rows[rows.length - 1].calc_upkeep).toBeUndefined(); // pretenders have no gold cost
      const a = rows[0].calc_upkeep, b = rows[1].calc_upkeep;
      expect(asc ? a <= b : a >= b).toBe(true);
    }
  });

  it('compares property filters on calculated values as decimals', async () => {
    const DMI = await vanilla();
    const [arg] = DMI.buildPropertyArgs([{ key: 'calc_patrol', comp: '>=', val: '1.35' }]);
    const spearman = DMI.modctx.unitlookup[61]; // 1.3
    expect(DMI.matchProperty(spearman, arg.key, arg.comp, arg.val)).toBeFalsy();
    const [arg2] = DMI.buildPropertyArgs([{ key: 'calc_patrol', comp: '<=', val: '1.35' }]);
    expect(DMI.matchProperty(spearman, arg2.key, arg2.comp, arg2.val)).toBe(true);
    // a value of 0 still matches (legacy matchProperty treats 0 as missing)
    const free = DMI.modctx.unitdata.find((o: any) => o.calc_upkeep === 0);
    const [zero] = DMI.buildPropertyArgs([{ key: 'calc_upkeep', comp: '<=', val: '0' }]);
    expect(free.matchProperty(free, zero.key, zero.comp, zero.val)).toBe(true);
  });

  it('keeps chosen columns in the URL and shows a sorted-by column', async () => {
    const { useView, stateToHash, applyHash } = await import('../src/state/view');
    const { shownCalcColumns } = await import('../src/ui/ResultsTable');
    useView.setState({ page: 'unit', calcCols: { unit: ['calc_patrol', 'calc_siege'] } });
    const hash = stateToHash(useView.getState());
    expect(hash).toContain('calc=patrol%2Csiege');
    useView.setState({ calcCols: {} });
    applyHash(hash);
    expect(useView.getState().calcCols.unit).toEqual(['calc_patrol', 'calc_siege']);
    expect(useView.getState().filters.unit).toEqual({});
    expect(shownCalcColumns(['calc_patrol'], 'calc_upkeep')).toEqual(['calc_patrol', 'calc_upkeep']);
    expect(shownCalcColumns(undefined, 'name')).toEqual([]);
  });
});

describe('calculated range filters', () => {
  it('parses open and closed ranges', async () => {
    const { parseRange, formatRange } = await import('../src/data/extensions/derived');
    expect(parseRange('1.5~3')).toEqual({ min: 1.5, max: 3 });
    expect(parseRange('~3')).toEqual({ min: undefined, max: 3 });
    expect(parseRange('-2~')).toEqual({ min: -2, max: undefined });
    expect(parseRange('~')).toBeNull();
    expect(parseRange('3')).toBeNull();
    expect(formatRange('', '')).toBe('');
    expect(formatRange('1.', '')).toBe('1.~');
  });

  it('filters units by range and drops units without a value', async () => {
    const { inCalcRanges } = await import('../src/data/extensions/derived');
    const DMI = await vanilla();
    const unit = (id: number) => DMI.modctx.unitlookup[id];
    expect(inCalcRanges(unit(61), { calc_patrol: '1.3~1.3' })).toBe(true);
    expect(inCalcRanges(unit(61), { calc_patrol: '1.31~' })).toBe(false);
    expect(inCalcRanges(unit(61), { calc_patrol: '~2', calc_siege: '1~' })).toBe(true);
    const pretender = DMI.modctx.unitdata.find((o: any) => o.calc_upkeep === undefined);
    expect(inCalcRanges(pretender, { calc_upkeep: '~100' })).toBe(false);
    expect(inCalcRanges(pretender, {})).toBe(true);
  });
});

describe('in-game values (tests/fixtures/ingame-values.json)', () => {
  const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'ingame-values.json'), 'utf8'));
  for (const e of fixture.entries) {
    // known mismatches have a recorded cause; they flip to failures if a formula change fixes them
    const test = e.known ? it.fails : it;
    test(`${e.name} (${e.unit}, ${e.role ?? 'troop'}) ${e.value} = ${e.expected}${e.known ? ` [known: ${e.known}]` : ''}`, async () => {
      const DMI = await vanilla();
      const o = DMI.modctx.unitlookup[e.unit];
      expect(o.name).toBe(e.name);
      // the game shows one decimal
      const v = DMI.Derived.get(o, e.value, { ...(e.role ? { role: e.role } : {}), ...e.context }).value;
      expect(Number(v.toFixed(1))).toBeCloseTo(e.expected, 5);
    });
  }
  it('mostly matches', () => {
    const known = fixture.entries.filter((e: any) => e.known).length;
    expect(known / fixture.entries.length).toBeLessThan(0.1);
  });
});

describe('commander points', () => {
  const cmd = (over: Partial<UnitInputs>) =>
    F.commanderPoints(u({ commander: true, recruitableCommander: true, magicLevels: 0, sureRandomPath: false, holyLevel: 0, leader: 40, slowRecruit: false, ...over }));
  it('is 1 for plain commanders, 2 for mages, doubled when slow to recruit', () => {
    expect(cmd({}).value).toBe(1);
    expect(cmd({ holyLevel: 1 }).value).toBe(1);
    expect(cmd({ magicLevels: 1 }).value).toBe(2);
    expect(cmd({ sureRandomPath: true }).value).toBe(2);
    expect(cmd({ magicLevels: 2, slowRecruit: true }).value).toBe(4);
    expect(cmd({ holyLevel: 2 })).toMatchObject({ value: 2, confidence: 'LIKELY' });
    expect(cmd({ commander: false }).value).toBeNull();
    expect(cmd({ recruitableCommander: false }).value).toBeNull();
  });
});
