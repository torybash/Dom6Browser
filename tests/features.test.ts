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
