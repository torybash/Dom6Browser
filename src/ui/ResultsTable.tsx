import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PageDef, PageId } from '../pages';
import type { DMI } from '../data/load';
import { refFor, type GridColumn, type Results } from '../state/results';
import { useSettings } from '../state/settings';
import { useView } from '../state/view';
import { usePreview } from './HoverPreview';

const ROW_H = 34;

interface ColPrefs {
  hidden: string[];
  widths: Record<string, number>;
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
}

export function tableColumns(page: PageDef, results: Results, advanced: boolean, thumbnails: boolean, prefs: ColPrefs): ViewColumn[] {
  const cols: ViewColumn[] = [];
  if (thumbnails && page.thumb) cols.push({ id: '__thumb', label: '', width: 40, minWidth: 40, kind: 'thumb' });
  if (advanced) cols.push({ id: '__id', label: 'id', width: 56, minWidth: 40, kind: 'id', numeric: true });
  for (const c of results.grid.columns) {
    if (prefs.hidden.includes(c.id)) continue;
    const isName = c.id === 'name' || c.id === 'description';
    cols.push({
      id: c.id,
      label: c.name,
      html: c.nameHtml,
      col: c,
      // upstream widths are relative; scale them up for the roomier layout
      width: prefs.widths[c.id] ?? Math.round(c.width * (isName ? 2 : 1.35)),
      minWidth: 36,
      kind: 'data',
      numeric: c.cssClass === 'numeric',
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
  const thumbnails = useSettings((s) => s.thumbnails);
  const detailRef = useView((s) => s.detailRef);
  const sort = useView((s) => s.sorts[page.id]);
  const setSort = useView((s) => s.setSort);
  const select = useView((s) => s.select);
  const navigate = useView((s) => s.navigate);
  const togglePin = useView((s) => s.togglePin);
  const showPreview = usePreview((s) => s.show);
  const scrollRef = useRef<HTMLDivElement>(null);

  const cols = useMemo(() => tableColumns(page, results, advanced, thumbnails, prefs), [page, results, advanced, thumbnails, prefs]);
  const template = cols.map((c) => (c.kind === 'data' && (c.id === 'name' || c.id === 'description') ? `minmax(${c.width}px, 3fr)` : `${c.width}px`)).join(' ');
  const totalMin = cols.reduce((a, c) => a + c.width, 0);

  const rows = results.rows;
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
    const startW = c.width;
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
                title={c.col?.sortable ? (/listed_mpath|listed_gempath|boosterssort/.test(c.col.field) ? 'Sort by path; click again to rotate the priority path' : 'Sort') : undefined}
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
                      setPrefs((p) => {
                        const widths = { ...p.widths };
                        delete widths[c.id];
                        return { ...p, widths };
                      });
                    }}
                    title="Drag to resize · double-click to reset"
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
                  if (e.shiftKey || e.ctrlKey || e.metaKey) togglePin(ref);
                  else {
                    select(ref);
                    onActivate?.();
                  }
                }}
                onHoverRef={showPreview}
              />
            );
          })}
        </div>
      </div>
      {rows.length === 0 && (
        <div className="absolute inset-x-0 top-24 text-center text-sm text-muted">No matches. Try clearing some filters.</div>
      )}
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
  page: PageDef;
  DMI: DMI;
  onClick: (e: React.MouseEvent) => void;
  onHoverRef: (info: any) => void;
}

const Row = memo(function Row({ o, index, top, cols, template, selected, page, DMI, onClick, onHoverRef }: RowProps) {
  return (
    <div
      role="row"
      aria-rowindex={index + 1}
      aria-selected={selected}
      className="grid-row grid items-center text-[13px]"
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
