// View state: current page, per-page filters/sort/selection, detail history and pins.
// Everything is mirrored into the URL hash (replacing upstream's cookie + permalink button), so any
// view can be bookmarked or shared. The last view is restored from localStorage when the hash is empty.
import { create } from 'zustand';
import { PAGE_BY_ID, PAGES, type PageId } from '../pages';

export type Filters = Record<string, any>;
export interface Sort {
  col: string;
  asc: boolean;
  /** click counter (not persisted): re-clicking a path column rotates its priority path */
  n?: number;
}
export interface PropertyFilter {
  key: string;
  comp: '=~' | '==' | '>=' | '<=';
  val: string;
  not?: boolean;
}

interface ViewState {
  page: PageId;
  filters: Partial<Record<PageId, Filters>>;
  sorts: Partial<Record<PageId, Sort>>;
  /** calculated-value columns shown in the table (field names, e.g. calc_patrol) */
  calcCols: Partial<Record<PageId, string[]>>;
  selected: Partial<Record<PageId, string>>;
  detailRef: string | null;
  history: string[];
  historyIndex: number;
  pins: string[];
  compareOpen: boolean;

  setPage: (page: PageId) => void;
  setFilter: (key: string, value: any) => void;
  patchFilters: (patch: Filters) => void;
  resetFilters: (keys?: string[]) => void;
  setSort: (sort: Sort | undefined) => void;
  setCalcCols: (fields: string[]) => void;
  /** select a row in the current page's table */
  select: (ref: string | null) => void;
  /** open a ref in the detail panel (cross-links), recording history */
  navigate: (ref: string) => void;
  back: () => void;
  forward: () => void;
  togglePin: (ref: string) => void;
  unpin: (ref: string) => void;
  clearPins: () => void;
  setCompareOpen: (open: boolean) => void;
}

const HISTORY_MAX = 100;

function pushHistory(s: ViewState, ref: string): Pick<ViewState, 'history' | 'historyIndex'> {
  if (s.history[s.historyIndex] === ref) return { history: s.history, historyIndex: s.historyIndex };
  const history = [...s.history.slice(0, s.historyIndex + 1), ref].slice(-HISTORY_MAX);
  return { history, historyIndex: history.length - 1 };
}

export const useView = create<ViewState>((set, get) => ({
  page: 'unit',
  filters: {},
  sorts: {},
  calcCols: {},
  selected: {},
  detailRef: null,
  history: [],
  historyIndex: -1,
  pins: [],
  compareOpen: false,

  setPage: (page) => {
    const s = get();
    if (page === s.page) return;
    const ref = s.selected[page] ?? null;
    set({ page, detailRef: ref, ...(ref ? pushHistory(s, ref) : {}) });
  },
  setFilter: (key, value) => get().patchFilters({ [key]: value }),
  patchFilters: (patch) => {
    const s = get();
    const cur = { ...(s.filters[s.page] ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === '' || v === undefined || v === null || v === false || (Array.isArray(v) && !v.length)) delete cur[k];
      else cur[k] = v;
    }
    // upstream units page: choosing a nation while showing "all units" switches to national available units
    if (s.page === 'unit' && 'nation' in patch && patch.nation && !cur.types) {
      cur.types = 'available';
      cur.national = true;
      delete cur.generic;
    }
    set({ filters: { ...s.filters, [s.page]: cur } });
  },
  resetFilters: (keys) => {
    const s = get();
    if (!keys) return set({ filters: { ...s.filters, [s.page]: {} } });
    const cur = { ...(s.filters[s.page] ?? {}) };
    keys.forEach((k) => delete cur[k]);
    set({ filters: { ...s.filters, [s.page]: cur } });
  },
  setSort: (sort) => {
    const s = get();
    set({ sorts: { ...s.sorts, [s.page]: sort } });
  },
  select: (ref) => {
    const s = get();
    set({
      selected: { ...s.selected, [s.page]: ref ?? undefined },
      detailRef: ref,
      ...(ref ? pushHistory(s, ref) : {}),
    });
  },
  navigate: (ref) => {
    const s = get();
    set({ detailRef: ref, ...pushHistory(s, ref) });
  },
  back: () => {
    const s = get();
    if (s.historyIndex <= 0) return;
    const i = s.historyIndex - 1;
    set({ historyIndex: i, detailRef: s.history[i] });
  },
  forward: () => {
    const s = get();
    if (s.historyIndex >= s.history.length - 1) return;
    const i = s.historyIndex + 1;
    set({ historyIndex: i, detailRef: s.history[i] });
  },
  setCalcCols: (fields) => set({ calcCols: { ...get().calcCols, [get().page]: fields } }),
  togglePin: (ref) => {
    const s = get();
    set({ pins: s.pins.includes(ref) ? s.pins.filter((p) => p !== ref) : [...s.pins, ref] });
  },
  unpin: (ref) => set({ pins: get().pins.filter((p) => p !== ref) }),
  clearPins: () => set({ pins: [], compareOpen: false }),
  setCompareOpen: (open) => set({ compareOpen: open }),
}));

/* ------------------------------------------------------------------------------------------------
   URL serialisation:  #/unit?q=warlock&nation=63&types=available&national=1&sort=goldcost.d&sel=unit:89&pins=unit:89,spell:5
------------------------------------------------------------------------------------------------- */

const encRef = (r: string) => r.replace(' ', ':');
const decRef = (r: string) => r.replace(':', ' ');

const PATHS_ORDER = 'FAWESDNGBH';

export function filtersToParams(f: Filters, p: URLSearchParams) {
  for (const [k, v] of Object.entries(f)) {
    if (k === 'str') p.set('q', v);
    else if (k === 'mlevels') {
      const s = PATHS_ORDER.split('')
        .filter((c) => v[c] !== undefined && Number(v[c]) !== 9)
        .map((c) => c + v[c])
        .join('');
      if (s) p.set('lv', s);
    } else if (k === 'properties') {
      for (const pr of v as PropertyFilter[]) {
        if (pr.key) p.append('p', [pr.key, pr.comp, pr.val, pr.not ? '!' : ''].join('~'));
      }
    } else if (v === true) p.set(k, '1');
    else p.set(k, String(v));
  }
}

export function paramsToFilters(p: URLSearchParams): Filters {
  const f: Filters = {};
  const props: PropertyFilter[] = [];
  p.forEach((v, k) => {
    if (k === 'sort' || k === 'sel' || k === 'pins' || k === 'calc') return;
    if (k === 'q') f.str = v;
    else if (k === 'lv') {
      const lv: Record<string, number> = {};
      for (const m of v.matchAll(/([A-Z])(\d)/g)) lv[m[1]] = Number(m[2]);
      f.mlevels = lv;
    } else if (k === 'p') {
      const [key, comp, val, not] = v.split('~');
      props.push({ key, comp: (comp as PropertyFilter['comp']) || '=~', val: val ?? '', not: not === '!' });
    } else if (['national', 'generic', 'inclusive'].includes(k)) f[k] = v === '1';
    else f[k] = v;
  });
  if (props.length) f.properties = props;
  return f;
}

export function stateToHash(s: ViewState): string {
  const p = new URLSearchParams();
  filtersToParams(s.filters[s.page] ?? {}, p);
  const sort = s.sorts[s.page];
  if (sort) p.set('sort', `${sort.col}.${sort.asc ? 'a' : 'd'}`);
  const calc = s.calcCols[s.page];
  if (calc?.length) p.set('calc', calc.map((f) => f.replace(/^calc_/, '')).join(','));
  if (s.detailRef) p.set('sel', encRef(s.detailRef));
  if (s.pins.length) p.set('pins', s.pins.map(encRef).join(','));
  const qs = p.toString();
  return `#/${s.page}${qs ? '?' + qs : ''}`;
}

export function applyHash(hash: string): boolean {
  const m = /^#\/(\w+)(?:\?(.*))?$/.exec(hash);
  if (!m || !(m[1] in PAGE_BY_ID)) return false;
  const page = m[1] as PageId;
  const p = new URLSearchParams(m[2] ?? '');
  const s = useView.getState();
  const sortStr = p.get('sort');
  const sel = p.get('sel');
  const pins = p.get('pins');
  const patch: Partial<ViewState> = {
    page,
    filters: { ...s.filters, [page]: paramsToFilters(p) },
    sorts: {
      ...s.sorts,
      [page]: sortStr ? { col: sortStr.replace(/\.[ad]$/, ''), asc: !sortStr.endsWith('.d') } : undefined,
    },
    pins: pins ? pins.split(',').filter(Boolean).map(decRef) : [],
    calcCols: { ...s.calcCols, [page]: (p.get('calc') ?? '').split(',').filter(Boolean).map((id) => 'calc_' + id) },
  };
  if (sel) {
    const ref = decRef(sel);
    patch.detailRef = ref;
    patch.selected = { ...s.selected, [page]: ref };
    Object.assign(patch, pushHistory(s, ref));
  } else {
    patch.detailRef = null;
  }
  useView.setState(patch);
  return true;
}

const LAST_KEY = 'dom6browser:lastView';

/** Wires the store to location.hash and localStorage. Call once at startup. */
export function initUrlSync() {
  const fromHash = applyHash(location.hash);
  if (!fromHash) {
    try {
      const last = localStorage.getItem(LAST_KEY);
      if (last) applyHash(last);
    } catch {
      /* storage unavailable */
    }
  }

  let lastPage = useView.getState().page;
  let writing = false;
  useView.subscribe((s) => {
    const hash = stateToHash(s);
    if (hash !== location.hash) {
      writing = true;
      // page switches create history entries; everything else replaces (typing would flood history)
      if (s.page !== lastPage) history.pushState(null, '', hash);
      else history.replaceState(null, '', hash);
      writing = false;
    }
    lastPage = s.page;
    try {
      localStorage.setItem(LAST_KEY, hash);
    } catch {
      /* ignore */
    }
  });

  window.addEventListener('popstate', () => {
    if (!writing) applyHash(location.hash);
  });
  window.addEventListener('hashchange', () => {
    if (!writing && location.hash !== stateToHash(useView.getState())) applyHash(location.hash);
  });
}

export const pageIds = PAGES.map((p) => p.id);
