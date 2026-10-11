// Filtering + sorting for the results table, driving the ported upstream grid specs.
import { useMemo } from 'react';
import { PAGE_BY_ID, UNIT_TYPE_VALUES, type PageId } from '../pages';
import type { DMI } from '../data/load';
import type { Filters, Sort } from './view';

export interface GridColumn {
  id: string;
  name: string;
  field: string;
  width: number;
  sortable?: boolean;
  sortCmp?: string;
  cssClass?: string;
  nameHtml?: string;
  formatter?: (row: number, cell: number, value: any, col: GridColumn, o: any) => string;
}

export interface GridSpec {
  page: string;
  data: () => any[];
  columns: GridColumn[];
  getSearchArgs?: (f: Filters) => any;
  searchFilter: (o: any, args: any) => boolean;
  preSort?: (e: unknown, args: { sortCol: GridColumn; sortAsc: boolean }) => void;
  defaultSortCmp?: (a: any, b: any) => number;
  initialSort?: string;
  sortIcon?: { field: string; path?: string; gem?: string } | null;
}

export function gridFor(DMI: DMI, page: PageId): GridSpec {
  return DMI[PAGE_BY_ID[page].module].grid;
}

export interface FilterOptions {
  advanced: boolean;
  moreInfo: boolean;
  customJs: boolean;
}

/** Maps app filter state to the shape upstream getSearchArgs() expects. */
export function toUpstreamFilters(page: PageId, f: Filters, o: FilterOptions): Filters {
  const out: Filters = { ...f };
  if (page === 'unit' && f.types) out.types = UNIT_TYPE_VALUES[f.types] ?? f.types;
  if (!o.advanced) {
    delete out.properties;
    delete out.customjs;
  }
  if (!o.customJs) delete out.customjs;
  if (!o.moreInfo) {
    delete out.effect;
    delete out.effect_mask;
    delete out.special_mask;
  }
  return out;
}

export function buildArgs(DMI: DMI, grid: GridSpec, f: Filters) {
  if (grid.getSearchArgs) return grid.getSearchArgs(f);
  return {
    str: (f.str || '').toLowerCase().trim(),
    properties: DMI.buildPropertyArgs(f.properties),
    customjs: f.customjs,
  };
}

/* ---------------------------------------------------------------------------------------------
   Sorting. Upstream chains comparators: each new sort falls back to the previous one on ties, and
   path/gem columns rotate their priority path on every click (preSort mutates the sort keys).
---------------------------------------------------------------------------------------------- */

interface SortChain {
  key: string;
  version: number;
  cmp: ((a: any, b: any) => number) | null;
}
const chains = new Map<PageId, SortChain>();

export interface SortRequest extends Sort {
  /** click counter; forces a re-sort (and rotation) when the same column is clicked again */
  n?: number;
}

function applySort(DMI: DMI, page: PageId, grid: GridSpec, version: number, sort: SortRequest | undefined) {
  let chain = chains.get(page);
  if (!chain || chain.version !== version) {
    // fresh data: replay upstream's initial sort (click on the initial column, ascending)
    const initial = grid.columns.find((c) => c.id === grid.initialSort) ?? grid.columns[0];
    const args = { sortCol: initial, sortAsc: true };
    grid.preSort?.(null, args);
    const cmp = DMI.makeSortCmp(initial, args.sortAsc, grid.defaultSortCmp);
    chain = { key: `${initial.id}|a|`, version, cmp };
    chains.set(page, chain);
  }
  if (!sort) return chain.cmp;
  const key = `${sort.col}|${sort.asc ? 'a' : 'd'}|${sort.n ?? ''}`;
  if (chain.key === key) return chain.cmp;
  const col = grid.columns.find((c) => c.id === sort.col);
  if (!col) return chain.cmp;
  const args = { sortCol: col, sortAsc: sort.asc };
  grid.preSort?.(null, args);
  chain.cmp = DMI.makeSortCmp(col, args.sortAsc, chain.cmp);
  chain.key = key;
  return chain.cmp;
}

export interface Results {
  rows: any[];
  total: number;
  grid: GridSpec;
  error?: string;
}

export function useResults(
  DMI: DMI | undefined,
  version: number,
  page: PageId,
  filters: Filters,
  sort: SortRequest | undefined,
  opts: FilterOptions,
): Results | null {
  return useMemo(() => {
    if (!DMI) return null;
    const grid = gridFor(DMI, page);
    const data = grid.data();
    const f = toUpstreamFilters(page, filters, opts);
    let rows: any[];
    let error: string | undefined;
    try {
      const args = buildArgs(DMI, grid, f);
      rows = data.filter((o) => grid.searchFilter(o, args));
      if (DMI.customJsError) error = DMI.customJsError;
    } catch (e: any) {
      console.error(e);
      error = String(e?.message ?? e);
      rows = [];
    }
    const cmp = applySort(DMI, page, grid, version, sort);
    if (cmp) rows.sort(cmp);
    return { rows, total: data.length, grid, error };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DMI, version, page, filters, sort?.col, sort?.asc, sort?.n, opts.advanced, opts.moreInfo, opts.customJs]);
}

/** Ref string used by upstream links for a row of the given page. */
export function refFor(page: PageId, o: any): string {
  return `${PAGE_BY_ID[page].refKind} ${o.id}`;
}

export function displayName(o: any): string {
  return o?.fullname || o?.name || o?.description?.slice(0, 60) || `#${o?.id}`;
}
