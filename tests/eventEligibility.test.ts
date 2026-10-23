import { beforeAll, describe, expect, it } from 'vitest';
import { vanilla } from './helpers';
import {
  checkEvent, eligibilityBadgeHtml, eligibilityDetailsHtml, eligibilityFilter, eventOdds, parsePaths, parseProvinceState,
} from '../src/data/extensions/eventEligibility';

let DMI: any;
const ev = (id: number) => DMI.modctx.eventlookup[id];
const check = (id: number, f: Record<string, string>) => checkEvent(ev(id), parseProvinceState(f, DMI)!);
const keys = (cs: { key: string }[]) => cs.map((c) => c.key);

beforeAll(async () => {
  DMI = await vanilla();
});

describe('parseProvinceState', () => {
  it('is null without p_ keys and parses the rest', () => {
    expect(parseProvinceState({})).toBeNull();
    expect(parseProvinceState({ story: 'off', str: 'x' })).toBeNull();
    const s = parseProvinceState({ p_luck: '5', p_month: '4', p_cmdorder: '3', p_terrain: 'forest,coast', story: 'minor', p_paths: 'F2h1' })!;
    expect(s.scales.luck).toBe(3);
    expect(s.season).toBe(1);
    expect(s.commander).toBe(true);
    expect(s.story).toBe(1);
    expect([...s.terrain!]).toEqual(['forest', 'coast']);
    expect(s.paths).toEqual({ F: 2, H: 1 });
    expect(parsePaths('S3D1')).toEqual({ S: 3, D: 1 });
    // the Events page default story setting is All
    expect(parseProvinceState({ p_turn: '1' })!.story).toBe(2);
  });

  it('derives the era from the nation', () => {
    expect(parseProvinceState({ p_nation: '5' }, DMI)!.era).toBe(1);
  });
});

describe('checkEvent', () => {
  it('festival (event 0): own dominion and population ≥ 500', () => {
    expect(ev(0).ev.reqs).toEqual({ mydominion: ['1'], minpop: ['50'] });
    expect(check(0, { p_dom: '2', p_pop: '1000' }).verdict).toBe('eligible');
    const r = check(0, { p_dom: '-1', p_pop: '1000' });
    expect(r.verdict).toBe('blocked');
    expect(r.failed.map((c) => c.label)).toEqual(["owner's dominion"]);
    expect(check(0, { p_dom: '2', p_pop: '400' }).failed[0].label).toBe('population ≥ 500');
    // only population known: dominion is not modelled, so not blocked
    const u = check(0, { p_pop: '1000' });
    expect(u.verdict).toBe('unknown');
    expect(keys(u.unmodelled)).toEqual(['mydominion']);
  });

  it('scale requirements: req_luck N needs luck ≥ N, negative values allow the opposite scale', () => {
    // 9: luck 2
    expect(check(9, { p_luck: '2' }).verdict).toBe('eligible');
    expect(check(9, { p_luck: '3' }).verdict).toBe('eligible');
    expect(check(9, { p_luck: '1' }).verdict).toBe('blocked');
    expect(check(9, { p_luck: '1' }).failed[0].label).toBe('Luck ≥ 2');
    // 19: chaos -1 → Order 1 is fine, Order 2 is not
    expect(check(19, { p_order: '1', p_terrain: 'plains', p_pop: '500' }).verdict).toBe('eligible');
    expect(check(19, { p_order: '-3', p_terrain: 'plains', p_pop: '500' }).verdict).toBe('eligible');
    const r = check(19, { p_order: '2', p_terrain: 'plains', p_pop: '500' });
    expect(r.failed.map((c) => c.label)).toEqual(['Order ≤ 1 (or any Turmoil)']);
    // 20 is the sea twin of 19
    expect(check(20, { p_order: '0', p_terrain: 'plains' }).failed.map((c) => c.key)).toEqual(['land']);
    expect(check(20, { p_order: '0', p_terrain: 'sea' }).verdict).not.toBe('blocked');
  });

  it('turn gating', () => {
    // 1309: story 1, turn 15, …
    expect(keys(check(1309, { p_turn: '10' }).failed)).toEqual(['turn']);
    expect(keys(check(1309, { p_turn: '15' }).failed)).toEqual([]);
    // 128: luck 4 is beyond the normal scale range → unmodelled, not failed
    expect(check(128, { p_luck: '3', p_turn: '20' }).unmodelled.map((c) => c.key)).toContain('luck');
  });

  it('story gating uses the effective (inherited) level', () => {
    expect(check(1772, { p_turn: '1', story: 'off' }).failed.map((c) => c.label)).toEqual(['Story events: Minor or All']);
    expect(check(1772, { p_turn: '1', story: 'minor' }).failed).toEqual([]);
    // 1310 has no story requirement but only follows story-1 event 1309
    const r = check(1310, { p_turn: '20', story: 'off' });
    expect(r.verdict).toBe('blocked');
    expect(r.failed[0].label).toMatch(/Minor or All \(storyline\)/);
    expect(check(1310, { p_turn: '20' }).needsChain).toBe(true);
  });

  it('fornation and independents', () => {
    // 521: Ermor (54) only, death 1, turn 16, land, pop0ok
    expect(keys(check(521, { p_nation: '54' }).failed)).toEqual([]);
    expect(check(521, { p_nation: '5' }).failed[0].label).toMatch(/^only for /);
    expect(check(521, { p_nation: 'indep' }).verdict).toBe('blocked');
    // pop0ok: events need 50 people unless pop0ok
    expect(keys(check(521, { p_nation: '54', p_pop: '0' }).failed)).toEqual([]);
    expect(keys(check(9, { p_pop: '10' }).failed)).toEqual(['pop0ok']);
  });

  it('seasons and terrain', () => {
    // 62: spring, land, not cave
    expect(check(62, { p_season: '0', p_terrain: 'forest' }).verdict).toBe('eligible');
    expect(check(62, { p_month: '1', p_terrain: 'forest' }).verdict).toBe('eligible');
    expect(keys(check(62, { p_month: '4', p_terrain: 'forest' }).failed)).toEqual(['season']);
    expect(keys(check(62, { p_season: '0', p_terrain: 'cave' }).failed)).toEqual(['cave']);
  });

  it('commander orders, chains and the strict filter', () => {
    // 1312: code 101, temple 0, maxunrest 5, targorder 3 (Patrol), mintroops 20, rare 80
    const ok = check(1312, { p_cmdorder: '3', p_temple: '0', p_unrest: '0', p_troops: '30' });
    expect(ok.verdict).toBe('unknown');
    expect(ok.needsChain).toBe(true);
    expect(ok.failed).toEqual([]);
    expect(check(1312, { p_cmdorder: '4' }).failed.map((c) => c.label)).toEqual(['needs a Patrol order']);
    expect(check(1312, { p_cmd: '0' }).verdict).toBe('blocked');
    // unrest ±25%: 6 vs max 5 is "maybe", 10 is out
    expect(keys(check(1312, { p_unrest: '6' }).unmodelled)).toContain('maxunrest');
    expect(keys(check(1312, { p_unrest: '10' }).failed)).toEqual(['maxunrest']);

    const f = { p_cmdorder: '3', p_temple: '0', p_unrest: '0', p_troops: '30' };
    expect(eligibilityFilter(ev(1312), f, DMI)).toBe(true);
    expect(eligibilityFilter(ev(1312), { ...f, p_nochain: '1' }, DMI)).toBe(false);
    expect(eligibilityFilter(ev(1312), { ...f, p_strict: '1' }, DMI)).toBe(false);
    expect(eligibilityFilter(ev(9), { p_luck: '2', p_strict: '1' }, DMI)).toBe(true);
    expect(eligibilityFilter(ev(9), { p_luck: '0' }, DMI)).toBe(false);
    expect(eligibilityFilter(ev(9), {}, DMI)).toBe(true);
  });

  it('narrows the whole event list without throwing', () => {
    const all: any[] = DMI.modctx.eventdata;
    const f = { p_nation: '5', p_turn: '10', p_luck: '1', p_dom: '3', p_terrain: 'forest', p_season: '1', p_pop: '5000', p_cmdorder: '7', p_paths: 'F2' };
    const n = all.filter((o) => eligibilityFilter(o, f, DMI)).length;
    expect(n).toBeGreaterThan(100);
    expect(n).toBeLessThan(all.length * 0.7);
    const strict = all.filter((o) => eligibilityFilter(o, { ...f, p_strict: '1' }, DMI)).length;
    expect(strict).toBeGreaterThan(10);
    expect(strict).toBeLessThan(n / 3);
  });
});

describe('odds and summaries', () => {
  it('describes rarity and req_rare', () => {
    const always = eventOdds(ev(1312), null);
    expect(always.pct).toBe(80);
    expect(always.text).toBe('≈ 80%/month');
    const good = eventOdds(ev(9), parseProvinceState({ p_luck: '2' }));
    expect(good.pct).toBeUndefined();
    expect(good.text).toMatch(/common good · ≈ 100% if picked/);
    expect(good.parts.join('\n')).toMatch(/good events favoured/);
  });

  it('renders badges', () => {
    expect(eligibilityBadgeHtml(ev(9), {}, DMI)).toBe('');
    expect(eligibilityBadgeHtml(ev(9), { p_luck: '1' }, DMI)).toContain('blocked · Luck ≥ 2');
    expect(eligibilityBadgeHtml(ev(0), { p_pop: '1000' }, DMI)).toContain('possible · 1 unmodelled');
    expect(eligibilityDetailsHtml(ev(0), { p_pop: '1000' }, DMI)).toContain('population ≥ 500');
  });
});
