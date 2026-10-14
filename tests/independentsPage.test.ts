import { describe, expect, it } from 'vitest';
import { PAGE_BY_ID, PAGES, pageForRefKind } from '../src/pages';
import { renderRef } from '../src/ui/legacy';
import { refFor } from '../src/state/results';
import { vanilla, withMods } from './helpers';

const grid = (DMI: any) => DMI[PAGE_BY_ID.independents.module].grid;
const run = (DMI: any, f: Record<string, any>) => {
  const g = grid(DMI);
  const args = g.getSearchArgs(f);
  return g.data().filter((o: any) => g.searchFilter(o, args)).map((o: any) => o.id) as number[];
};
const pane = (DMI: any, ref: string) => renderRef(DMI, ref, false)!.html;
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '-').replace(/&minus;/g, '-').replace(/\s+/g, ' ');
const pdRows = (html: string) => [...html.matchAll(/<tr><td>([\s\S]*?)<\/tr>/g)].map((m) => text(m[1]).trim());

describe('Independents page', () => {
  it('is registered right after Sites with the poptype ref kind', () => {
    const ids = PAGES.filter((p) => p.group === 'main').map((p) => p.id);
    expect(ids[ids.indexOf('site') + 1]).toBe('independents');
    expect(PAGE_BY_ID.independents).toMatchObject({ label: 'Independents', refKind: 'poptype' });
    expect(pageForRefKind('poptype')).toBe('independents');
  });

  it('has one row per population type, ref links resolve to the row', async () => {
    const DMI = await vanilla();
    const rows = grid(DMI).data();
    expect(rows.length).toBe(DMI.Independents.all.length);
    expect(rows.map((o: any) => o.id)).toEqual(DMI.Independents.all.map((p: any) => p.id));
    expect(refFor('independents', rows[0])).toBe('poptype 25');
    expect(DMI.resolveRef('poptype 25')).toMatchObject({ kind: 'poptype', o: rows[0] });
    expect(DMI.resolveRef('poptype 9999')).toBeUndefined();
  });

  it('text search matches the poptype name and its units; an id ignores other filters', async () => {
    const DMI = await vanilla();
    expect(run(DMI, { str: 'barbarian' })).toContain(25);
    expect(run(DMI, { str: 'demon priest' })).toContain(88);
    expect(run(DMI, { str: 'zzzz' })).toEqual([]);
    expect(run(DMI, { str: '25', terrain: 'cave' })).toEqual([25]);
  });

  it('terrain and era filters work on the per-era lists', async () => {
    const DMI = await vanilla();
    expect(run(DMI, { terrain: 'forest' })).toContain(25);
    expect(run(DMI, { terrain: 'cave' })).toContain(88);
    expect(run(DMI, { terrain: 'cave' })).not.toContain(25);
    expect(DMI.Independents.get(88).availability.byEra.EA).toContain('mountain');
    expect(run(DMI, { terrain: 'mountain', era: 'EA' })).toContain(88);
    expect(run(DMI, { terrain: 'mountain', era: 'MA' })).not.toContain(88);
    expect(run(DMI, { era: 'EA' })).toContain(25);
    // special-only poptype counts as present in its special eras
    expect(run(DMI, { era: 'EA' })).toContain(85);
    expect(run(DMI, { terrain: 'none' })).toContain(106);
    expect(run(DMI, { terrain: 'none' })).not.toContain(25);
  });

  it('mage, priest and path filters use the recruitable commanders', async () => {
    const DMI = await vanilla();
    expect(run(DMI, { caster: 'mage' })).toContain(40);
    expect(run(DMI, { caster: 'priest' })).toContain(40);
    expect(run(DMI, { caster: 'mage' })).not.toContain(25);
    expect(run(DMI, { caster: 'none' })).toContain(25);
    expect(run(DMI, { caster: 'none' })).not.toContain(40);
    expect(run(DMI, { caster: 'priest' })).not.toContain(103); // shaman: random paths only
    const s = run(DMI, { mpaths: 'S' });
    expect(s).toContain(40);
    expect(s).not.toContain(25);
    expect(run(DMI, { mpaths: 'SF' })).not.toContain(40); // all selected paths
    expect(run(DMI, { mpaths: 'SF', inclusive: true })).toContain(40); // either
    expect(run(DMI, { mpaths: 'SF', inclusive: true })).toContain(41);
  });

  it('source filter separates vanilla, edited and mod-added rows', async () => {
    const DMI = await withMods([
      { name: 'edit.dm', text: '#selectpoptype 25\n#addrecunit 30\n#end\n#selectpoptype 150\n#addrecunit 89\n#defunit1 89\n#end\n' },
    ]);
    expect(run(DMI, { source: 'edited' })).toEqual([25]);
    expect(run(DMI, { source: 'added' })).toEqual([150]);
    expect(run(DMI, { source: 'base' })).not.toContain(25);
    expect(run(DMI, { source: 'base' })).not.toContain(150);
    expect(run(DMI, { source: 'base' }).length).toBe(81);
  });

  it('25 Barbarians pane: PD table counts, commander from PD 20, notes and links', async () => {
    const DMI = await vanilla();
    const html = pane(DMI, 'poptype 25');
    expect(html).toContain('Barbarians');
    expect(html).toContain('data-ref="unit 139"');
    expect(html).toContain('data-ref="unit 141"');
    expect(html).toContain('Province defence (once you own it)');
    const rows = pdRows(html);
    // unit, per PD, PD 1 / 5 / 10 / 20
    expect(rows[0]).toBe('#139 Barbarian 1 1 5 10 20');
    expect(rows[1]).toBe('#140 Barbarian 1 1 5 10 20');
    expect(rows[2]).toMatch(/\(PD commander\) - - - - 1$/);
    const t = text(html);
    expect(t).toContain('PD commander (from PD 20):');
    expect(t).toContain('Your nation also adds its own PD commander, and from PD 20 (PD-19) of each of its own PD units.');
    expect(t).toContain('The independent garrison you fight before conquest is generated separately and is not shown yet.');
    expect(html).toContain('href="#/merc"');
    expect(t).toContain('PD checked in game');
    expect(t).toContain('forest');
    expect(t).not.toMatch(/%/); // lists only, no probabilities
  });

  it('27: the mult-5 unit is absent at PD 1 and half at PD 10', async () => {
    const DMI = await vanilla();
    expect(pdRows(pane(DMI, 'poptype 27'))[2]).toMatch(/0\.5 0 2 5 10$/);
  });

  it('88 Ko-Oni shows the Demon Priest as PD commander; 38 and 105 list unused data', async () => {
    const DMI = await vanilla();
    const h88 = pane(DMI, 'poptype 88');
    expect(h88).toContain('data-ref="unit 1609"');
    expect(text(h88)).toContain('PD commander (from PD 20): #1609 Demon Priest');
    const h38 = pane(DMI, 'poptype 38');
    expect(text(h38)).toContain('unused data (the game uses the first entry)');
    expect(h38).toContain('unverified');
    expect(text(pane(DMI, 'poptype 105'))).toContain('unused data: key 230');
  });

  it('shows the override note when a mod sets defcom1 next to the key-235 commander', async () => {
    const DMI = await withMods([{ name: 'e.dm', text: '#selectpoptype 88\n#defcom1 34\n#end\n' }]);
    const html = pane(DMI, 'poptype 88');
    expect(text(html)).toContain('(overrides defcom1:');
    expect(html).toContain('data-ref="unit 34"');
    expect(html).toContain('unverified');
    expect(html).toContain('modified by e.dm');
  });

  it('a mod-added poptype is a row and its pane names the mod', async () => {
    const DMI = await withMods([{ name: 'new.dm', text: '#selectpoptype 150\n#addrecunit 89\n#addreccom 92\n#defunit1 89\n#defcom1 92\n#end\n' }]);
    expect(grid(DMI).data().map((o: any) => o.id)).toContain(150);
    expect(run(DMI, { str: 'poptype 150' })).toEqual([150]);
    const t = text(pane(DMI, 'poptype 150'));
    expect(t).toContain('Poptype 150 (mod: new.dm)');
    expect(t).toContain('not placed by the random map generator');
    expect(t).toContain('defined by a mod');
  });

  it('unit panes link back to the poptypes that use them', async () => {
    const DMI = await vanilla();
    const h139 = pane(DMI, 'unit 139');
    expect(h139).toContain('<h4>Independents</h4>');
    expect(h139).toContain('data-ref="poptype 25"');
    expect(text(h139)).toContain('Recruitable in:');
    expect(text(h139)).toContain('Province defence in:');
    const h141 = pane(DMI, 'unit 141');
    expect(text(h141)).toContain('Commander in:');
    expect(text(h141)).toContain('Province defence in:'); // PD commander
    // a unit no poptype uses gets no section
    expect(pane(DMI, 'unit 89')).not.toContain('<h4>Independents</h4>');
  });

  it('mage paths column shows fixed icons, with random-only paths dimmed', async () => {
    const DMI = await vanilla();
    const col = grid(DMI).columns.find((c: any) => c.id === 'mpaths');
    const row = (id: number) => grid(DMI).data().find((o: any) => o.id === id);
    expect(col.formatter(0, 0, null, col, row(25))).toBe('');
    const h = col.formatter(0, 0, null, col, row(62)); // Tribals, Deer: fixed N, random A
    expect(h).toContain('Path_N');
    expect(h).toMatch(/pt-random[^>]*><span class="pathicon Path_A"/);
  });
});
