import { describe, expect, it } from 'vitest';
import { vanilla } from './helpers';

describe('data pipeline', () => {
  it('loads every table without errors', async () => {
    const t0 = Date.now();
    const DMI = await vanilla();
    const m = DMI.modctx;
    console.log('load ms', Date.now() - t0, {
      units: m.unitdata.length, spells: m.spelldata.length, items: m.itemdata.length,
      sites: m.sitedata.length, mercs: m.mercdata.length, events: m.eventdata.length,
      weapons: m.wpndata.length, armor: m.armordata.length, nations: m.nationdata.length,
    });
    expect(DMI.errors).toEqual([]);
    expect(m.unitdata.length).toBeGreaterThan(3000);
    expect(m.itemdata.length).toBeGreaterThan(400);
  });
});
