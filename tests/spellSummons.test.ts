import { describe, expect, it } from 'vitest';
import { vanilla } from './helpers';

const g = (DMI: any) => DMI.MSpell.grid;
const byName = (DMI: any, n: string) => g(DMI).data().find((o: any) => o.name === n);
const run = (DMI: any, f: Record<string, any>) => {
  const grid = g(DMI);
  const args = grid.getSearchArgs(f);
  return grid.data().filter((o: any) => grid.searchFilter(o, args));
};

describe('Spell summons', () => {
  it('unit summons carry a base count and are not commanders', async () => {
    const DMI = await vanilla();
    const imps = byName(DMI, '40 imps');
    expect(imps.summons).toHaveLength(1);
    expect(imps.summons[0]).toMatchObject({ role: 'unit', count: '40' });
    expect(imps.summons[0].unit.name).toBe('Imp');
    expect(byName(DMI, 'Summon Devil').summons[0]).toMatchObject({ role: 'unit', count: '' });
  });

  it('roles: remote attackers and combat summons are temp, rituals follow the effect', async () => {
    const DMI = await vanilla();
    expect(byName(DMI, 'Archer Illusions').summons[0]).toMatchObject({ role: 'temp', why: 'remote' });
    expect(byName(DMI, 'impflock').summons[0]).toMatchObject({ role: 'temp', why: 'battle' });
    expect(byName(DMI, 'Send Lady Midday').summons[0].role).toBe('temp');
    expect(byName(DMI, 'Summon Qarin').summons[0].role).toBe('temp');
  });

  it('effects 81/100 classify per unit', async () => {
    const DMI = await vanilla();
    const roles = Object.fromEntries(byName(DMI, 'Ghost Ship Armada').summons.map((x: any) => [x.unit.id, x.role]));
    expect(roles).toMatchObject({ 3348: 'cmdr', 3349: 'cmdr', 3350: 'cmdr', 3351: 'unit', 3352: 'unit' });
    expect(new Set(byName(DMI, 'Hidden in Snow').summons.map((x: any) => x.role))).toEqual(new Set(['cmdr', 'unit']));
  });

  it('count mirrors the detail panel for path-scaled counts', async () => {
    const DMI = await vanilla();
    expect(byName(DMI, 'Summon Okami').summons[0].count).toBe('10+');
  });

  it('commander summons (effect 21) are flagged cmdr', async () => {
    const DMI = await vanilla();
    const jinn = byName(DMI, 'Summon Jinn');
    expect(jinn.effect_number).toBe('21');
    expect(jinn.summons[0]).toMatchObject({ role: 'cmdr', count: '' });
  });

  it('multi-unit sets list every unit once, deduped by id', async () => {
    const DMI = await vanilla();
    const sprites = byName(DMI, 'Court of Sprites');
    expect(sprites.summons.length).toBeGreaterThan(1);
    expect(sprites.summons.every((x: any) => x.role === 'unit')).toBe(true);
    for (const o of g(DMI).data()) {
      const ids = (o.summons || []).map((x: any) => x.unit.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('keeps summonsunits intact for nations', async () => {
    const DMI = await vanilla();
    for (const o of g(DMI).data()) {
      if (o.summons) expect(o.summonsunits.length).toBeGreaterThanOrEqual(o.summons.length);
    }
  });

  it('summons filter', async () => {
    const DMI = await vanilla();
    const all = run(DMI, {}).length;
    const any = run(DMI, { summons: 'any' });
    const none = run(DMI, { summons: 'none' });
    const allSchools = '-1,0,1,2,3,4,5,6,7';
    const cmdr = run(DMI, { summons: 'cmdr', schools: allSchools });
    const unit = run(DMI, { summons: 'unit', schools: allSchools });
    const temp = run(DMI, { summons: 'temp', schools: allSchools });
    expect(any.length + none.length).toBe(all);
    
    expect(any.every((o: any) => o.summons?.length)).toBe(true);
    expect(cmdr.map((o: any) => o.name)).toContain('Summon Jinn');
    expect(cmdr.map((o: any) => o.name)).not.toContain('40 imps');
    expect(temp.map((o: any) => o.name)).not.toContain('40 imps');
    expect(cmdr.map((o: any) => o.name)).not.toContain('Archer Illusions');
    expect(unit.map((o: any) => o.name)).toContain('40 imps');
    expect(unit.map((o: any) => o.name)).not.toContain('Summon Jinn');
    expect(unit.map((o: any) => o.name)).not.toContain('impflock');
    expect(temp.map((o: any) => o.name)).toEqual(expect.arrayContaining(['impflock', 'Archer Illusions']));
    expect(temp.map((o: any) => o.name)).not.toContain('Summon Jinn');
  });

  it('formatter renders sprite refs, crown badge for commanders and the count', async () => {
    const DMI = await vanilla();
    const col = g(DMI).columns.find((c: any) => c.id === 'summons');
    expect(col.sortable).toBe(false);
    const html = col.formatter(0, 0, null, col, byName(DMI, 'Summon Jinn'));
    expect(html).toContain('data-ref="unit ');
    expect(html).toContain('summon-crown');
    expect(html).toContain('(commander)');
    const imps = col.formatter(0, 0, null, col, byName(DMI, '40 imps'));
    expect(col.formatter(0, 0, null, col, byName(DMI, 'impflock'))).toContain('summon-temp');
    expect(imps).not.toContain('summon-temp');
    expect(col.formatter(0, 0, null, col, byName(DMI, 'impflock'))).toContain('(battle only)');
    expect(col.formatter(0, 0, null, col, byName(DMI, 'Archer Illusions'))).toContain('(attacks remotely)');
    const devil = col.formatter(0, 0, null, col, byName(DMI, 'Summon Devil'));
    expect(devil).not.toContain('summon-crown');
    expect(devil).not.toContain('summon-temp');
    expect(imps).toContain('&times;40');
    expect(imps).toMatch(/src="[^"]*\.png"/);
    expect(col.formatter(0, 0, null, col, byName(DMI, 'Fireball') ?? {})).toBe('');
  });
});
