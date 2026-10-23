// Events page table: columns read the event model (o.ev); filters go through getSearchArgs/searchFilter.
import { describe, expect, it } from 'vitest';
import { PAGE_BY_ID } from '../src/pages';
import { vanilla } from './helpers';

const grid = (DMI: any) => DMI.MEvent.grid;
const run = (DMI: any, f: Record<string, any>) => {
  const g = grid(DMI);
  const args = g.getSearchArgs(f);
  return g.data().filter((o: any) => g.searchFilter(o, args));
};
const ids = (rows: any[]) => new Set(rows.map((o) => Number(o.id)));
const byId = (DMI: any, id: number) => grid(DMI).data().find((o: any) => Number(o.id) === id);
const cell = (DMI: any, colId: string, o: any) => {
  const c = grid(DMI).columns.find((x: any) => x.id === colId);
  return String(c.formatter(0, 0, o[c.field], c, o) ?? '');
};
const sortBy = (DMI: any, colId: string, asc = true) => {
  const g = grid(DMI);
  const col = g.columns.find((c: any) => c.id === colId);
  return [...g.data()].sort(DMI.makeSortCmp(col, asc, undefined));
};

/** every event reachable forward from `id` through storyline links */
function successors(DMI: any, id: number): number[] {
  const out = new Set<number>();
  const stack = [id];
  while (stack.length) {
    const x = stack.pop()!;
    for (const l of byId(DMI, x)?.ev?.next ?? []) if (!out.has(l.id)) {
      out.add(l.id);
      stack.push(l.id);
    }
  }
  out.delete(id);
  return [...out];
}

describe('events grid columns', () => {
  it('has the event columns, some hidden by default', async () => {
    const DMI = await vanilla();
    const cols = grid(DMI).columns;
    const colIds = cols.map((c: any) => c.id);
    expect(colIds).toEqual(
      expect.arrayContaining(['description', 'rarity', 'chance', 'story', 'storyline', 'turn', 'unique', 'nations', 'triggers', 'rewards', 'fulldesc']),
    );
    const hidden = cols.filter((c: any) => c.defaultHidden).map((c: any) => c.id);
    expect(hidden).toEqual(expect.arrayContaining(['turn', 'unique', 'nations', 'fulldesc']));
    expect(hidden).not.toContain('description');
    for (const c of cols) expect(c.sortable, c.id).toBe(true);
  });

  it('title column shows the readable title, full description in the tooltip', async () => {
    const DMI = await vanilla();
    const o = byId(DMI, 1772);
    const html = cell(DMI, 'description', o);
    expect(html).toContain(o.ev.title.replace(/&/g, '&amp;').slice(0, 20));
    expect(html).toContain('title="');
  });

  it('kind badge, chance, story, triggers and rewards render', async () => {
    const DMI = await vanilla();
    const rows = grid(DMI).data();
    const good = rows.find((o: any) => o.ev.kind === 'good');
    expect(cell(DMI, 'rarity', good)).toContain('ev-kind-good');
    const withChance = rows.find((o: any) => o.ev.chance !== undefined);
    expect(cell(DMI, 'chance', withChance)).toBe(`${withChance.ev.chance}%`);
    expect(cell(DMI, 'story', byId(DMI, 1772))).toContain('Minor');
    const inherited = rows.find((o: any) => o.ev.storyEffective > o.ev.story);
    expect(cell(DMI, 'story', inherited)).toContain('ev-story-inh');
    const harm = rows.find((o: any) => o.ev.rewards.includes('harm'));
    expect(cell(DMI, 'rewards', harm)).toContain('evi-r-harm');
    const trig = rows.find((o: any) => o.ev.triggers.includes('order'));
    expect(cell(DMI, 'triggers', trig)).toMatch(/evi-t-order[^>]*title="Commander order"/);
    const nat = rows.find((o: any) => o.ev.forNations.length);
    expect(cell(DMI, 'nations', nat)).toContain(DMI.modctx.nationlookup[nat.ev.forNations[0]].name);
  });

  it('kind sorts good → always → bad → global', async () => {
    const DMI = await vanilla();
    const order = ['good', 'always', 'bad', 'global'];
    const kinds = sortBy(DMI, 'rarity').map((o: any) => order.indexOf(o.ev.kind));
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]).toBeGreaterThanOrEqual(kinds[i - 1]);
  });

  it('storyline sort groups each storyline together in id order', async () => {
    const DMI = await vanilla();
    const rows = sortBy(DMI, 'storyline').filter((o: any) => o.ev.storyline !== undefined);
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1].ev.storyline, b = rows[i].ev.storyline;
      expect(b).toBeGreaterThanOrEqual(a);
      if (a === b) expect(Number(rows[i].id)).toBeGreaterThan(Number(rows[i - 1].id));
    }
  });
});

describe('events grid filters', () => {
  it('the page declares the filters', () => {
    const keys = PAGE_BY_ID.event.filters.map((d: any) => d.key);
    expect(keys).toEqual(expect.arrayContaining(['story', 'kind', 'nation', 'role', 'storyline', 'trig', 'rew', 'turn', 'chance']));
  });

  it('story setting: Off < Minor < All, and All shows everything', async () => {
    const DMI = await vanilla();
    const all = run(DMI, {}).length;
    expect(all).toBe(grid(DMI).data().length);
    expect(run(DMI, { story: 'all' }).length).toBe(all);
    const minor = run(DMI, { story: 'minor' }).length;
    const off = run(DMI, { story: 'off' }).length;
    expect(off).toBeLessThan(minor);
    expect(minor).toBeLessThan(all);
  });

  it('story Off hides the Mage King legend and its follow-ups; Minor shows them', async () => {
    const DMI = await vanilla();
    const follow = successors(DMI, 1772);
    expect(follow.length).toBeGreaterThan(0);
    const off = ids(run(DMI, { story: 'off' }));
    expect(off.has(1772)).toBe(false);
    for (const id of follow) expect(off.has(id), `event ${id}`).toBe(false);
    const minor = ids(run(DMI, { story: 'minor' }));
    expect(minor.has(1772)).toBe(true);
    // follow-ups that need only Minor show with Minor
    for (const id of follow) if (byId(DMI, id).ev.storyEffective <= 1) expect(minor.has(id), `event ${id}`).toBe(true);
  });

  it('kind filter keeps only the chosen kinds', async () => {
    const DMI = await vanilla();
    const good = run(DMI, { kind: 'good' });
    expect(good.length).toBeGreaterThan(0);
    expect(good.every((o: any) => o.ev.kind === 'good')).toBe(true);
    const goodBad = run(DMI, { kind: 'good,bad' });
    expect(goodBad.length).toBe(good.length + run(DMI, { kind: 'bad' }).length);
  });

  it('nation filter keeps events without fornation or for that nation', async () => {
    const DMI = await vanilla();
    const nat = grid(DMI).data().find((o: any) => o.ev.forNations.length === 1);
    const n = nat.ev.forNations[0];
    const other = DMI.modctx.nationdata.find((x: any) => Number(x.id) !== n && !grid(DMI).data().some((o: any) => o.ev.forNations.includes(Number(x.id)))).id;
    const forN = ids(run(DMI, { nation: String(n) }));
    const forOther = ids(run(DMI, { nation: String(other) }));
    expect(forN.has(Number(nat.id))).toBe(true);
    expect(forOther.has(Number(nat.id))).toBe(false);
    for (const o of grid(DMI).data()) if (!o.ev.forNations.length && !o.ev.reqs.notfornation) expect(forOther.has(Number(o.id))).toBe(true);
    // era code: any nation of that era
    const era = DMI.modctx.nationOptions.find((g: any) => g.nations.some((x: any) => Number(x.id) === n));
    expect(ids(run(DMI, { nation: era.code })).has(Number(nat.id))).toBe(true);
  });

  it('role, storyline, trigger, reward, turn and chance filters', async () => {
    const DMI = await vanilla();
    expect(run(DMI, { role: 'start' }).every((o: any) => o.ev.role === 'start')).toBe(true);
    const sl = byId(DMI, 1772).ev.storyline;
    const one = run(DMI, { storyline: String(sl) });
    expect(ids(one)).toEqual(new Set(DMI.eventStorylines[sl].events));
    expect(run(DMI, { trig: 'order' }).every((o: any) => o.ev.triggers.includes('order'))).toBe(true);
    expect(run(DMI, { rew: 'harm' }).every((o: any) => o.ev.rewards.includes('harm'))).toBe(true);
    const t5 = run(DMI, { turn: '5' });
    expect(t5.every((o: any) => (o.ev.minTurn ?? 0) <= 5 && (o.ev.maxTurn ?? 999) >= 5)).toBe(true);
    expect(t5.length).toBeLessThan(grid(DMI).data().length);
    const ch = run(DMI, { chance: '10~20' });
    expect(ch.length).toBeGreaterThan(0);
    expect(ch.every((o: any) => (o.ev.chance ?? 100) >= 10 && (o.ev.chance ?? 100) <= 20)).toBe(true);
  });

  it('text search matches the readable title and an id', async () => {
    const DMI = await vanilla();
    const o = byId(DMI, 1772);
    const word = o.ev.title.split(' ').filter((w: string) => w.length > 4)[0].toLowerCase();
    expect(ids(run(DMI, { str: word })).has(1772)).toBe(true);
    expect(ids(run(DMI, { str: '1772', story: 'off' })).has(1772)).toBe(true);
  });
});
