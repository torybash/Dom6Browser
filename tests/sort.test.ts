import { describe, expect, it } from 'vitest';
import { PAGES } from '../src/pages';
import { vanilla } from './helpers';

describe('sorting every grid by every column', () => {
  for (const page of PAGES) {
    it(page.id, async () => {
      const DMI = await vanilla();
      const grid = DMI[page.module].grid;
      const rows = [...grid.data()];
      let cmp = grid.defaultSortCmp;
      for (const col of grid.columns.filter((c: any) => c.sortable)) {
        // click twice: path/gem priority columns rotate on the second click
        for (const asc of [true, false]) {
          const args = { sortCol: col, sortAsc: asc };
          grid.preSort?.(null, args);
          cmp = DMI.makeSortCmp(col, args.sortAsc, cmp);
          rows.sort(cmp);
        }
        // cells must render for every row after sorting
        for (const o of rows.slice(0, 50)) col.formatter?.(0, 0, o[col.field], col, o);
      }
      expect(rows.length).toBe(grid.data().length);
    });
  }

  it('unit Magic column ranks by the rotating priority path', async () => {
    const DMI = await vanilla();
    const grid = DMI.MUnit.grid;
    const col = grid.columns.find((c: any) => c.field === 'listed_mpath');
    const args = { sortCol: col, sortAsc: true };
    grid.preSort(null, args);
    expect(args.sortAsc).toBe(false); // forced descending, like upstream
    expect(grid.sortIcon).toEqual({ field: 'listed_mpath', path: expect.any(String) });
    const first = grid.sortIcon.path;
    grid.preSort(null, { sortCol: col, sortAsc: true });
    expect(grid.sortIcon.path).not.toBe(first);
  });
});
