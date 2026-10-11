import { describe, expect, it } from 'vitest';
import { vanilla } from './helpers';

const GRIDS = ['MItem', 'MSpell', 'MUnit', 'MSite', 'MMerc', 'MEvent', 'MWpn', 'MArmor'];

describe('rendering every entity', () => {
  for (const mod of GRIDS) {
    it(`${mod}: renderOverlay + default filter`, async () => {
      const DMI = await vanilla();
      const grid = DMI[mod].grid;
      const data = grid.data();
      const failures: string[] = [];
      for (const o of data) {
        try {
          const html = o.renderOverlay(o);
          if (typeof html !== 'string' || !html.length) failures.push(`${o.id}: empty`);
        } catch (e: any) {
          failures.push(`${o.id} ${o.name}: ${e?.message ?? e}`);
        }
      }
      const args = grid.getSearchArgs ? grid.getSearchArgs({}) : { str: '', properties: [] };
      const shown = data.filter((o: any) => grid.searchFilter(o, args));
      DMI.takeContentJobs();
      console.log(mod, 'rows', data.length, 'shown', shown.length, 'failures', failures.length);
      expect(failures.slice(0, 10)).toEqual([]);
      expect(shown.length).toBeGreaterThan(0);
    });
  }
});
