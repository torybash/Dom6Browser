import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { PageDef, PageId } from '../pages';
import type { DMI } from '../data/load';
import { refFor, type GridColumn, type Results } from '../state/results';
import { useSettings } from '../state/settings';
import { useCards } from '../state/cards';
import { useView } from '../state/view';
import { usePreview } from './HoverPreview';
import { PATH_NAMES } from './FilterPanel';
import { isCasterSet, missingLevels } from '../data/extensions/casterLevels';

const ROW_H = 34;

export interface ColPrefs {
  /** columns the user switched off */
  hidden: string[];
  /** default-hidden columns the user switched on */
  shown?: string[];
  widths: Record<string, number>;
}

/** Columns flagged defaultHidden stay hidden until the user turns them on; the rest until turned off. */
export function isColHidden(prefs: ColPrefs, col: { id: string; defaultHidden?: boolean }): boolean {
  return col.defaultHidden ? !prefs.shown?.includes(col.id) : prefs.hidden.includes(col.id);
}

/** Prefs after the user toggles a column. */
export function toggleCol(prefs: ColPrefs, col: { id: string; defaultHidden?: boolean }, visible: boolean): ColPrefs {
  const without = (l: string[] = []) => l.filter((h) => h !== col.id);
  if (col.defaultHidden) return { ...prefs, shown: visible ? [...without(prefs.shown), col.id] : without(prefs.shown) };
  return { ...prefs, hidden: visible ? without(prefs.hidden) : [...without(prefs.hidden), col.id] };
}

function loadPrefs(page: PageId): ColPrefs {
  try {
    return { hidden: [], widths: {}, ...JSON.parse(localStorage.getItem('dom6browser:cols:' + page) || '{}') };
  } catch {
    return { hidden: [], widths: {} };
  }
}
function savePrefs(page: PageId, p: ColPrefs) {
  try {
    localStorage.setItem('dom6browser:cols:' + page, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function useColumnPrefs(page: PageId) {
  const [prefs, setPrefs] = useState<ColPrefs>(() => loadPrefs(page));
  useEffect(() => setPrefs(loadPrefs(page)), [page]);
  const update = useCallback(
    (fn: (p: ColPrefs) => ColPrefs) =>
      setPrefs((p) => {
        const n = fn(p);
        savePrefs(page, n);
        return n;
      }),
    [page],
  );
  return [prefs, update] as const;
}

interface ViewColumn {
  id: string;
  label: string;
  html?: string;
  col?: GridColumn;
  width: number;
  minWidth: number;
  kind: 'thumb' | 'id' | 'data';
  numeric?: boolean;
  /** text column at its automatic width: takes a share of any leftover room */
  flex?: boolean;
}

/** Content width of a column, measured from sampled rows: p95 sets the default, max is what double-click fits to. */
export interface ColFit {
  p95: number;
  max: number;
}

const MIN_COL_W = 36;
const MAX_AUTO_W = 360;
const MAX_FIT_W = 640;
const MEASURE_ROWS = 150;

/** Default and full-fit widths from measured cell widths; the header label is a floor for both. */
export function fitFromSamples(cellWidths: number[], headerWidth: number): ColFit {
  const s = [...cellWidths].sort((a, b) => a - b);
  const max = Math.max(MIN_COL_W, headerWidth, s[s.length - 1] ?? 0);
  let p95 = Math.max(MIN_COL_W, headerWidth, s[Math.floor((s.length - 1) * 0.95)] ?? 0);
  // a near-miss outlier costs little room, so show it whole
  if (max - p95 <= 24) p95 = max;
  return { p95: Math.min(MAX_AUTO_W, Math.ceil(p95)), max: Math.min(MAX_FIT_W, Math.ceil(max)) };
}

/** Measured fits per loaded game data and page, so revisiting a page doesn't re-measure. */
const fitCache = new WeakMap<object, Map<string, Record<string, ColFit>>>();
const NO_FITS: Record<string, ColFit> = {};

/** Calculated-value columns to show: the chosen ones, plus the sort column so a shared sort is visible. */
export function shownCalcColumns(calcCols: string[] | undefined, sortCol: string | undefined): string[] {
  const shown = calcCols ?? [];
  return sortCol?.startsWith('calc_') && !shown.includes(sortCol) ? [...shown, sortCol] : shown;
}

export function tableColumns(
  page: PageDef,
  results: Results,
  advanced: boolean,
  prefs: ColPrefs,
  shownCalc: string[] = [],
  fits: Record<string, ColFit> = {},
): ViewColumn[] {
  const cols: ViewColumn[] = [];
  if (page.thumb) cols.push({ id: '__thumb', label: '', width: 40, minWidth: 40, kind: 'thumb' });
  if (advanced) cols.push({ id: '__id', label: 'id', width: 56, minWidth: 40, kind: 'id', numeric: true });
  for (const c of results.grid.columns) {
    if (c.derived ? !shownCalc.includes(c.id) : isColHidden(prefs, c)) continue;
    const isName = c.id === 'name' || c.id === 'description';
    const custom = prefs.widths[c.id];
    const numeric = c.cssClass === 'numeric';
    cols.push({
      id: c.id,
      label: c.name,
      html: c.nameHtml,
      col: c,
      // until measured, scale the upstream (relative) widths up for the roomier layout
      width: custom ?? fits[c.id]?.p95 ?? Math.round(c.width * (isName ? 2 : 1.35)),
      minWidth: MIN_COL_W,
      kind: 'data',
      numeric,
      flex: custom === undefined && !numeric,
    });
  }
  return cols;
}

interface Props {
  page: PageDef;
  DMI: DMI;
  results: Results;
  prefs: ColPrefs;
  setPrefs: (fn: (p: ColPrefs) => ColPrefs) => void;
  onActivate?: () => void;
}

export function ResultsTable({ page, DMI, results, prefs, setPrefs, onActivate }: Props) {
  const advanced = useSettings((s) => s.advanced);
  const detailRef = useView((s) => s.detailRef);
  const sort = useView((s) => s.sorts[page.id]);
  const setSort = useView((s) => s.setSort);
  const select = useView((s) => s.select);
  const navigate = useView((s) => s.navigate);
  const togglePin = useView((s) => s.togglePin);
  const ctrlOpensCard = useSettings((s) => s.ctrlOpensCard);
  const showPreview = usePreview((s) => s.show);
  const scrollRef = useRef<HTMLDivElement>(null);

  const calcCols = useView((s) => s.calcCols[page.id]);
  // caster filter with a boost: rows that need boosters are dimmed, with what is missing on hover
  const caster = useView((s) => s.filters[page.id]?.mlevels);
  const boosted = useView((s) => !!s.filters[page.id]?.mboost) && isCasterSet(caster);
  const nearMiss = (o: any) => {
    if (!boosted) return undefined;
    const m = missingLevels(o, caster);
    return m.length ? 'Needs boosters: ' + m.map(([p, d]) => `+${d} ${PATH_NAMES[p]}`).join(', ') : undefined;
  };
  const shownCalc = useMemo(() => shownCalcColumns(calcCols, sort?.col), [calcCols, sort?.col]);
  const [, remeasured] = useReducer((n: number) => n + 1, 0);
  const fits = fitCache.get(DMI)?.get(page.id) ?? NO_FITS;
  const onMeasured = useCallback(
    (measured: Record<string, ColFit>) => {
      let byPage = fitCache.get(DMI);
      if (!byPage) fitCache.set(DMI, (byPage = new Map()));
      byPage.set(page.id, { ...byPage.get(page.id), ...measured });
      remeasured();
    },
    [DMI, page.id],
  );
  const cols = useMemo(
    () => tableColumns(page, results, advanced, prefs, shownCalc, fits),
    [page, results, advanced, prefs, shownCalc, fits],
  );
  // text columns at their automatic width split any leftover room in proportion to their width
  const template = cols.map((c) => (c.flex ? `minmax(${c.width}px, ${c.width}fr)` : `${c.width}px`)).join(' ');
  const totalMin = cols.reduce((a, c) => a + c.width, 0);

  const rows = results.rows;
  const unmeasured = useMemo(() => cols.filter((c) => c.kind === 'data' && !fits[c.id]), [cols, fits]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const selectedIndex = useMemo(() => rows.findIndex((o) => refFor(page.id, o) === detailRef), [rows, detailRef, page.id]);

  // keep the selected row visible when it changes via keyboard
  const lastKeyNav = useRef(false);
  useEffect(() => {
    if (lastKeyNav.current && selectedIndex >= 0) virtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
    lastKeyNav.current = false;
  }, [selectedIndex, virtualizer]);

  // reset scroll on page change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page.id]);

  const moveSelection = useCallback(
    (delta: number) => {
      if (!rows.length) return;
      const i = selectedIndex < 0 ? (delta > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, selectedIndex + delta));
      lastKeyNav.current = true;
      select(refFor(page.id, rows[i]));
    },
    [rows, selectedIndex, select, page.id],
  );

  // expose for global shortcuts (Ctrl+↑/↓ from search boxes)
  useEffect(() => {
    tableApi.move = moveSelection;
    tableApi.pinSelected = () => detailRef && togglePin(detailRef);
    return () => {
      tableApi.move = undefined;
    };
  }, [moveSelection, detailRef, togglePin]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / ROW_H) - 1);
    const map: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: page, PageUp: -page, Home: -1e9, End: 1e9 };
    if (e.key in map && !e.altKey && !e.ctrlKey) {
      e.preventDefault();
      moveSelection(map[e.key]);
    } else if (e.key === 'Enter' && detailRef) {
      e.preventDefault();
      togglePin(detailRef);
    }
  };

  const onHeaderClick = (c: ViewColumn) => {
    if (!c.col?.sortable) return;
    const rotating = !!results.grid.preSort && /listed_mpath|listed_gempath|boosterssort/.test(c.col.field);
    if (sort?.col === c.id) setSort({ col: c.id, asc: rotating ? false : !sort.asc, n: (sort.n ?? 0) + 1 });
    else setSort({ col: c.id, asc: !rotating, n: 0 });
  };

  const startResize = (e: React.PointerEvent, c: ViewColumn) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    // flexible columns render wider than c.width, so measure what is actually on screen
    const startW = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect().width ?? c.width;
    const move = (ev: PointerEvent) => {
      const w = Math.max(c.minWidth, Math.round(startW + ev.clientX - startX));
      setPrefs((p) => ({ ...p, widths: { ...p.widths, [c.id]: w } }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const sortIcon = results.grid.sortIcon;

  return (
    <div
      ref={scrollRef}
      className="relative min-h-0 flex-1 overflow-auto outline-none"
      tabIndex={0}
      role="grid"
      aria-rowcount={rows.length}
      aria-label={`${page.label} results`}
      onKeyDown={onKeyDown}
      data-results-table
    >
      <div style={{ minWidth: totalMin }}>
        <div
          role="row"
          className="sticky top-0 z-10 grid h-9 items-stretch border-b border-line bg-panel/95 text-xs font-semibold text-muted backdrop-blur"
          style={{ gridTemplateColumns: template }}
        >
          {cols.map((c) => {
            const active = sort ? sort.col === c.id : results.grid.initialSort ? results.grid.initialSort === c.id : results.grid.columns[0]?.id === c.id;
            const showSortIcon = sortIcon && c.col && sortIcon.field === c.col.field && active;
            return (
              <div
                key={c.id}
                role="columnheader"
                aria-sort={active ? ((sort?.asc ?? true) ? 'ascending' : 'descending') : 'none'}
                className={
                  'group relative flex select-none items-center gap-1 px-2.5 ' +
                  (c.numeric ? 'justify-end ' : '') +
                  (c.col?.sortable ? 'cursor-pointer hover:text-fg ' : '') +
                  (active ? 'text-fg' : '')
                }
                onClick={() => onHeaderClick(c)}
                title={c.col?.title ?? (c.col?.sortable ? (/listed_mpath|listed_gempath|boosterssort/.test(c.col.field) ? 'Sort by path; click again to rotate the priority path' : 'Sort') : undefined)}
              >
                {c.html ? <span className="legacy" dangerouslySetInnerHTML={{ __html: c.html }} /> : <span className="truncate">{c.label}</span>}
                {showSortIcon && (
                  <span className={sortIcon.gem ? `gemicon Gem_${sortIcon.gem}` : `pathicon Path_${sortIcon.path}`}>{sortIcon.gem ?? sortIcon.path}</span>
                )}
                {active && !showSortIcon && c.col?.sortable && ((sort?.asc ?? true) ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                {c.kind === 'data' && (
                  <span
                    className="absolute right-0 top-1.5 bottom-1.5 w-1.5 cursor-col-resize rounded bg-line/0 group-hover:bg-line"
                    onPointerDown={(e) => startResize(e, c)}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      // fit the longest value, sampled or on screen; double-clicking a fitted column returns it to automatic
                      const i = cols.indexOf(c);
                      const onScreen = [...(scrollRef.current?.querySelectorAll<HTMLElement>('.grid-row') ?? [])].map((r) => {
                        const cell = r.children[i];
                        if (!cell) return 0;
                        const range = document.createRange();
                        range.selectNodeContents(cell);
                        return range.getBoundingClientRect().width + 20; // px-2.5 either side
                      });
                      const fit = fits[c.id] && Math.min(MAX_FIT_W, Math.ceil(Math.max(fits[c.id].max, ...onScreen)));
                      setPrefs((p) => {
                        const widths = { ...p.widths };
                        if (fit === undefined || widths[c.id] === fit) delete widths[c.id];
                        else widths[c.id] = fit;
                        return { ...p, widths };
                      });
                    }}
                    title="Drag to resize · double-click to fit everything (again for automatic)"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((v) => {
            const o = rows[v.index];
            const ref = refFor(page.id, o);
            return (
              <Row
                key={ref}
                o={o}
                index={v.index}
                top={v.start}
                cols={cols}
                template={template}
                selected={ref === detailRef}
                nearMiss={nearMiss(o)}
                page={page}
                DMI={DMI}
                onClick={(e) => {
                  const a = (e.target as HTMLElement).closest<HTMLElement>('a.ref[data-ref]');
                  if (a) {
                    e.stopPropagation();
                    showPreview(null);
                    navigate(a.dataset.ref!);
                    onActivate?.();
                    return;
                  }
                  const mod = e.shiftKey || e.ctrlKey || e.metaKey;
                  if (onActivate || ctrlOpensCard) {
                    if (mod) togglePin(ref);
                    else {
                      select(ref);
                      onActivate?.();
                    }
                  } else if (mod) select(ref);
                  else openCard(ref);
                }}
                onHoverRef={showPreview}
              />
            );
          })}
        </div>
      </div>
      {unmeasured.length > 0 && rows.length > 0 && (
        <ColumnMeasurer key={page.id + ':' + unmeasured.map((c) => c.id).join()} cols={unmeasured} rows={rows} page={page} DMI={DMI} onMeasured={onMeasured} />
      )}
      {rows.length === 0 && (
        <div className="absolute inset-x-0 top-24 text-center text-sm text-muted">No matches. Try clearing some filters.</div>
      )}
    </div>
  );
}

/** Room a header keeps for its sort arrow, so the label isn't cut off once the column is sorted. */
const SORT_ICON_W = 16;

/**
 * Renders a sample of rows off-screen at their natural width, once, and reports how wide each column's
 * content is. Real cells are used because most columns are formatter HTML (icons, gems), not plain text.
 */
function ColumnMeasurer({ cols, rows, page, DMI, onMeasured }: { cols: ViewColumn[]; rows: any[]; page: PageDef; DMI: DMI; onMeasured: (f: Record<string, ColFit>) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const n = Math.min(rows.length, MEASURE_ROWS);
  const sample = Array.from({ length: n }, (_, i) => rows[Math.floor((i * rows.length) / n)]);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const width = (el: Element) => el.getBoundingClientRect().width;
    const out: Record<string, ColFit> = {};
    cols.forEach((c, j) => {
      const head = root.querySelector(`[data-mh="${j}"]`);
      const cells = [...root.querySelectorAll(`[data-mc="${j}"]`)].map(width);
      out[c.id] = fitFromSamples(cells, (head ? width(head) : 0) + SORT_ICON_W);
    });
    onMeasured(out);
    // measure once per column set; the caller unmounts this when done
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden">
      <div className="flex text-xs font-semibold">
        {cols.map((c, j) => (
          <div key={c.id} data-mh={j} className="w-max flex-none px-2.5">
            {c.html ? <span className="legacy" dangerouslySetInnerHTML={{ __html: c.html }} /> : c.label}
          </div>
        ))}
      </div>
      {sample.map((o, i) => (
        <div key={i} className="flex text-[13px]">
          {cols.map((c, j) => (
            <div key={c.id} data-mc={j} className="w-max flex-none">
              <Cell c={c} o={o} index={i} page={page} DMI={DMI} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Imperative handle used by global keyboard shortcuts. */
export const tableApi: { move?: (delta: number) => void; pinSelected?: () => void } = {};

interface RowProps {
  o: any;
  index: number;
  top: number;
  cols: ViewColumn[];
  template: string;
  selected: boolean;
  /** caster filter with boost: why this row needs boosters */
  nearMiss?: string;
  page: PageDef;
  DMI: DMI;
  onClick: (e: React.MouseEvent) => void;
  onHoverRef: (info: any) => void;
}

const Row = memo(function Row({ o, index, top, cols, template, selected, nearMiss, page, DMI, onClick, onHoverRef }: RowProps) {
  return (
    <div
      role="row"
      aria-rowindex={index + 1}
      aria-selected={selected}
      // striped by data index, not DOM position: virtualized rows come and go as the list scrolls
      className={'grid-row grid items-center text-[13px]' + (index % 2 ? ' grid-row-alt' : '') + (nearMiss ? ' opacity-50' : '')}
      title={nearMiss}
      style={{ gridTemplateColumns: template, position: 'absolute', top, left: 0, right: 0, height: ROW_H }}
      onClick={onClick}
      onMouseOver={(e) => {
        const a = (e.target as HTMLElement).closest<HTMLElement>('a.ref[data-ref]');
        if (a) onHoverRef({ ref: a.dataset.ref, alt: false, anchor: a });
      }}
      onMouseOut={(e) => {
        const a = (e.target as HTMLElement).closest('a.ref');
        if (a && !a.contains(e.relatedTarget as Node)) onHoverRef(null);
      }}
    >
      {cols.map((c) => (
        <Cell key={c.id} c={c} o={o} index={index} page={page} DMI={DMI} />
      ))}
    </div>
  );
});

function Cell({ c, o, index, page, DMI }: { c: ViewColumn; o: any; index: number; page: PageDef; DMI: DMI }) {
  if (c.kind === 'thumb') {
    const src = page.thumb?.(o, DMI);
    return (
      <div className="flex h-full items-center justify-center overflow-hidden px-1">
        {src ? <img src={src} alt="" loading="lazy" className="sprite-thumb max-h-[30px] max-w-[34px]" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : null}
      </div>
    );
  }
  if (c.kind === 'id') return <div className="grid-cell numeric text-muted">{Math.round(o.id * 100) / 100}</div>;
  const col = c.col!;
  const v = o[col.field];
  if (col.formatter) {
    const html = col.formatter(index, 0, v, col, o);
    return <div className={'grid-cell legacy-cell ' + (c.numeric ? 'numeric' : '')} dangerouslySetInnerHTML={{ __html: html == null ? '' : String(html) }} />;
  }
  return (
    <div className={'grid-cell ' + (c.numeric ? 'numeric' : '')} title={c.id === 'name' || c.id === 'description' ? String(v ?? '') : undefined}>
      {v == null ? '' : String(v)}
    </div>
  );
}

/** Upstream row click: open the entry as its own card, or bring its card forward when it is already open. */
function openCard(ref: string) {
  const v = useView.getState();
  const open = v.pins.includes(ref) || v.detailRef === ref;
  v.pin(ref);
  v.select(ref);
  if (open) useCards.getState().focus(ref);
}
