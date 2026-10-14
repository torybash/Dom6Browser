import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bitfields } from '../src/data/legacy/bits';
import { parseTextToTable, createLookup } from '../src/data/tsv';
import { vanilla, withMods } from './helpers';

const modText = readFileSync(join(__dirname, 'golden', 'mods', 'golden-test.dm'), 'utf8');

describe('tsv', () => {
  it('parses tab separated rows, skipping empty cells and blank-id rows', () => {
    const t = parseTextToTable('id\tname\tx\n1\tFoo\t\n\tskipped\t1\n2\tBar\t3\n');
    expect(t).toEqual([{ id: '1', name: 'Foo' }, { id: '2', name: 'Bar', x: '3' }]);
    const l = createLookup(t, 'id', 'name');
    expect(l['2']).toBe(t[1]);
    expect(l['foo']).toBe(t[0]);
  });
});

describe('bitfields (BigInt port of goog.math.Long helpers)', () => {
  it('matches set bits including > 32 bit masks', () => {
    const masks = { '1': { bit_name: 'a' }, '2': { bit_name: 'b' }, '4398046511104': { bit_name: 'big' } };
    expect(bitfields.bitfieldValues('4398046511105', masks)).toEqual(['a', 'big']);
    expect(bitfields.longOr('2097152', '1')).toBe('2097153');
  });
});

describe('spells', () => {
  it('shows caster bonus with + notation (Shocking Grasp: 15 base + A1 caster = 18+++)', async () => {
    const DMI = await vanilla();
    const sg = DMI.modctx.spelldata.find((s: any) => s.name === 'Shocking Grasp');
    const html: string = sg.renderOverlay(sg);
    expect(html).toMatch(/Damage:<\/th><td>18\+\+\+/);
  });
});

describe('property search', () => {
  const run = async (page: string, rows: any[]) => {
    const DMI = await vanilla();
    const grid = DMI[page].grid;
    const args = grid.getSearchArgs ? grid.getSearchArgs({ properties: rows }) : { str: '', properties: DMI.buildPropertyArgs(rows) };
    return grid.data().filter((o: any) => grid.searchFilter(o, args));
  };

  it('key with blank value matches any non-blank value (holy)', async () => {
    const rows = await run('MUnit', [{ key: 'holy', comp: '=~', val: '' }]);
    expect(rows.length).toBeGreaterThan(50);
    expect(rows.every((o: any) => o.holy)).toBe(true);
  });

  it('numeric comparison (fireres >= 25)', async () => {
    const rows = await run('MUnit', [{ key: 'fireres', comp: '>=', val: '25' }]);
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((o: any) => parseInt(o.fireres) >= 25)).toBe(true);
  });

  it('regex on magic paths (mpath =~ s[4-9])', async () => {
    const rows = await run('MUnit', [{ key: 'mpath', comp: '=~', val: 's[4-9]' }]);
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.every((o: any) => /s[4-9]/i.test(o.mpath))).toBe(true);
  });

  it('not (!) inverts and aliases resolve (sacred -> holy)', async () => {
    const all = await run('MUnit', []);
    const holy = await run('MUnit', [{ key: 'sacred', comp: '=~', val: '' }]);
    const notHoly = await run('MUnit', [{ key: 'sacred', comp: '=~', val: '', not: true }]);
    expect(holy.length).toBeGreaterThan(0);
    expect(holy.length + notHoly.length).toBe(all.length);
  });

  it('items match properties of their attached weapon', async () => {
    const rows = await run('MItem', [{ key: 'dmg', comp: '>=', val: '20' }]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((o: any) => o.weapon)).toBe(true);
  });
});

describe('mods', () => {
  it('applies changes, records mod commands and reports problems with line numbers', async () => {
    const DMI = await withMods([{ name: 'golden-test.dm', text: modText }]);
    const m = DMI.modctx;
    expect(m.loadedmods).toEqual(['Golden Test Mod']);
    const warlock = m.unitlookup[89];
    expect(warlock.hp).toBe('30');
    expect(warlock.modded).toMatch(/1:9&nbsp;&nbsp;#gcost 50/);
    expect(m.unitlookup[5000].name).toBe('Golden Warlock');
    expect(m.wpnlookup[2001].name).toBe('Golden Blade');

    const msgs = DMI.modMessages.map((x: any) => `${x.level}@${x.line}: ${x.msg}`);
    // unknown commands with extra trailing characters are resolved to a known prefix (inside an open object)
    expect(msgs).toContain('warning@51: unrecognised cmd.. assuming you meant: #gcost');
    expect(msgs).toContain('error@54: unrecognised command');
    expect(msgs).toContain('error@55: data not found');
    expect(m.unitlookup[92].gcost).toBe('77');
  });

  it('a reload without mods restores vanilla values', async () => {
    const DMI = await withMods([]);
    expect(DMI.modctx.unitlookup[89].hp).toBe('15');
    expect(DMI.modctx.unitlookup[5000]).toBeUndefined();
  });
});

describe('thrones', () => {
  it('the site Kind filter finds only thrones (rarity 11-13)', async () => {
    const DMI = await vanilla();
    const grid = DMI.MSite.grid;
    const args = grid.getSearchArgs({ sitetype: 'Thrones' });
    const rows = grid.data().filter((o: any) => grid.searchFilter(o, args));
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.every((o: any) => o.rarity >= 11)).toBe(true);
    expect(rows.some((o: any) => o.rarity === 13)).toBe(true);
  });

  it('shows wild defenders as "yes" and keeps guardian commanders as unit refs', async () => {
    const { withThroneInfo } = await import('../src/data/extensions/thrones');
    const DMI = await vanilla();
    const fire = DMI.modctx.sitelookup[1379]; // Throne of Fire: wild defenders + a commander
    const html = withThroneInfo(fire, fire.renderOverlay(fire));
    expect(html).toMatch(/<tr class="wilddefenders [^>]*title="[^"]*not in the data files[^>]*>[\s\S]*?<td>yes<\/td>/);
    expect(html).toContain('data-ref="unit 99"');
    const crystal = DMI.modctx.sitelookup[1362]; // no wild defenders: untouched
    expect(withThroneInfo(crystal, crystal.renderOverlay(crystal))).toBe(crystal.renderOverlay(crystal));
  });
});

describe('carried items', () => {
  it('units with a start item class pair with the items of that class, shown by the legacy row only', async () => {
    const { withCarries } = await import('../src/data/extensions/carries');
    const DMI = await vanilla();
    const ryujin = DMI.modctx.unitlookup[2104];
    expect(DMI.Carries.itemsFor(ryujin).map((i: any) => i.id)).toEqual([508]);
    expect(withCarries(DMI, ryujin, ryujin.renderOverlay(ryujin))).not.toContain('carries-section');
    expect(DMI.Carries.itemsFor(DMI.modctx.unitlookup[89])).toEqual([]);
  });

  it('units with randomitems show the random magic item value', async () => {
    const { withCarries } = await import('../src/data/extensions/carries');
    const DMI = await vanilla();
    const u = DMI.modctx.unitlookup[651];
    expect(withCarries(DMI, u, u.renderOverlay(u))).toContain('Random magic items (value 300)');
  });

  it('items with a start item class list the units that can carry them (inferred)', async () => {
    const { withCarries } = await import('../src/data/extensions/carries');
    const DMI = await vanilla();
    const pearl = DMI.modctx.itemlookup[508];
    const ids = DMI.Carries.unitsFor(pearl).map((u: any) => u.id);
    expect(ids).toEqual(expect.arrayContaining([2104, 2105, 2316, 3249, 3250]));
    const html = withCarries(DMI, pearl, pearl.renderOverlay(pearl));
    expect(html).toMatch(/Can be carried by[\s\S]*data-ref="unit 2104"/);
    expect(DMI.Carries.unitsFor(DMI.modctx.itemlookup[1])).toEqual([]);
  });
});
