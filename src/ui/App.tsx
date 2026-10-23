import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { Columns3, LayoutGrid, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PAGE_BY_ID, PAGES, type PageDef } from '../pages';
import { useData } from '../state/data';
import { enabledMods, useMods } from '../state/mods';
import { useResults } from '../state/results';
import { useSettings } from '../state/settings';
import { initUrlSync, useView } from '../state/view';
import { activeChips, ActiveFilters } from './ActiveFilters';
import { CardBoard } from './CardBoard';
import { CompareView, PinTray } from './Compare';
import { DetailPanel } from './DetailPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { FilterPanel } from './FilterPanel';
import { GlobalSearch, useGlobalSearch } from './GlobalSearch';
import { HoverPreview, usePreview } from './HoverPreview';
import { ModsDialog } from './ModsDialog';
import { isColHidden, ResultsTable, shownCalcColumns, tableApi, toggleCol, useColumnPrefs } from './ResultsTable';
import { LoadingScreen, TopBar } from './TopBar';

function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function useStoredNumber(key: string, initial: number) {
  const [v, setV] = useState(() => {
    const n = Number(readStored(key));
    return Number.isFinite(n) && n > 0 ? n : initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, String(v));
    } catch {
      /* ignore */
    }
  }, [key, v]);
  return [v, setV] as const;
}

function useStoredBool(key: string, initial: boolean) {
  const [v, setV] = useState(() => {
    const s = readStored(key);
    return s === null ? initial : s === '1';
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [key, v]);
  return [v, setV] as const;
}

/** Applies theme / text size / advanced-visibility classes on <html>. */
function useRootClasses() {
  const s = useSettings();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  useEffect(() => {
    const c = document.documentElement.classList;
    c.toggle('dark', s.theme === 'dark' || (s.theme === 'system' && systemDark));
    c.toggle('opt-advanced', s.advanced);
    c.toggle('opt-moreinfo', s.moreInfo);
    c.toggle('opt-keys', s.showKeys);
    c.toggle('opt-nodescr', s.hideDescriptions);
    c.toggle('opt-formulas', s.showFormulas);
    c.toggle('opt-nostatlabels', !s.unitStatLabels);
    document.documentElement.style.setProperty('--font-scale', String(s.textScale));
  }, [s.theme, systemDark, s.advanced, s.moreInfo, s.showKeys, s.hideDescriptions, s.showFormulas, s.unitStatLabels, s.textScale]);
}

export function App() {
  useRootClasses();
  const status = useData((s) => s.status);
  const hasData = useData((s) => !!s.DMI);
  const load = useData((s) => s.load);
  const modsReady = useMods((s) => s.ready);
  const mods = useMods((s) => s.mods);
  const initMods = useMods((s) => s.init);

  useEffect(() => {
    initUrlSync();
    initMods();
    // debugging handle for the dev server only
    if (import.meta.env.DEV) (window as any).__dom6 = { useData, useMods, useView, useSettings };
  }, [initMods]);

  // (re)load data whenever the enabled mod set changes
  const modKey = useMemo(() => enabledMods(mods).map((m) => m.id + ':' + m.text.length).join('|'), [mods]);
  useEffect(() => {
    if (!modsReady) return;
    load(enabledMods(useMods.getState().mods).map((m) => ({ name: m.name, text: m.text })));
  }, [modsReady, modKey, load]);

  useGlobalShortcuts();

  if (!hasData) return <LoadingScreen />;
  return (
    <>
      <ErrorBoundary>
        <Workspace />
      </ErrorBoundary>
      {status === 'loading' && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-1.5 text-xs shadow-lg">Applying mods…</div>
      )}
      <GlobalSearch />
      <ModsDialog />
      <CompareView />
      <HoverPreview />
    </>
  );
}

function Workspace() {
  const mobile = useMediaQuery('(max-width: 767px)');
  return mobile ? <MobileWorkspace /> : <DesktopWorkspace />;
}

function usePageResults(page: PageDef) {
  const DMI = useData((s) => s.DMI)!;
  const version = useData((s) => s.version);
  const filters = useView((s) => s.filters[page.id]) ?? EMPTY;
  const sort = useView((s) => s.sorts[page.id]);
  const advanced = useSettings((s) => s.advanced);
  const moreInfo = useSettings((s) => s.moreInfo);
  const customJs = useSettings((s) => s.customJs);
  const results = useResults(DMI, version, page.id, filters, sort, { advanced, moreInfo, customJs })!;
  return { DMI, results };
}
const EMPTY = {};

function DesktopWorkspace() {
  const pageId = useView((s) => s.page);
  const page = PAGE_BY_ID[pageId];
  const [sidebarOpen, setSidebarOpen] = useStoredBool('dom6browser:sidebarOpen', true);
  const [sidebarW, setSidebarW] = useStoredNumber('dom6browser:sidebarW', SIDEBAR_DEFAULT);

  return (
    <div className="flex h-full flex-col">
      <TopBar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <>
            <aside className="flex min-h-0 shrink-0 flex-col border-r border-line bg-panel" style={{ width: sidebarW }}>
              <PageNav />
              <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
                <PageFilters page={page} />
              </div>
            </aside>
            <Resizer
              label="Resize sidebar"
              value={sidebarW}
              min={SIDEBAR_MIN}
              max={SIDEBAR_MAX}
              onResize={(d) => setSidebarW((w) => clamp(w + d, SIDEBAR_MIN, SIDEBAR_MAX))}
              onReset={() => setSidebarW(SIDEBAR_DEFAULT)}
            />
          </>
        )}
        <main className="flex min-w-0 flex-1 flex-col">
          <ErrorBoundary label="the results table" key={pageId}>
            <ResultsPane page={page} />
          </ErrorBoundary>
        </main>
        <ErrorBoundary label="the cards">
          <CardBoard />
        </ErrorBoundary>
      </div>
      <PinTray />
    </div>
  );
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 460;
const SIDEBAR_DEFAULT = 290;

function Resizer({
  label,
  value,
  min,
  max,
  invert,
  onResize,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** the panel sits to the right of the handle, so dragging left grows it */
  invert?: boolean;
  onResize: (delta: number) => void;
  onReset: () => void;
}) {
  const last = useRef(0);
  return (
    <div
      tabIndex={0}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={Math.round(max)}
      title="Drag to resize · double-click to reset"
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16;
        // keep the global shortcuts (Enter pins, arrows move the selection) from also firing
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(e.key)) e.stopPropagation();
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          onResize(e.key === 'ArrowRight' ? step : -step);
        } else if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          const target = (e.key === 'Home') !== !!invert ? min : max;
          onResize(invert ? value - target : target - value);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          onReset();
        }
      }}
      className="group relative z-10 -mx-1 w-2 shrink-0 cursor-col-resize outline-none"
      onPointerDown={(e) => {
        e.preventDefault();
        last.current = e.clientX;
        const move = (ev: PointerEvent) => {
          onResize(ev.clientX - last.current);
          last.current = ev.clientX;
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          document.body.style.cursor = '';
        };
        document.body.style.cursor = 'col-resize';
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
      role="separator"
      aria-orientation="vertical"
    >
      <div className="mx-auto h-full w-px bg-transparent transition-colors group-hover:bg-accent/60 group-focus-visible:w-0.5 group-focus-visible:bg-accent" />
    </div>
  );
}

function PageNav({ onPick }: { onPick?: () => void }) {
  const pageId = useView((s) => s.page);
  const setPage = useView((s) => s.setPage);
  const DMI = useData((s) => s.DMI)!;
  const counts = useMemo(() => Object.fromEntries(PAGES.map((p) => [p.id, DMI[p.module]?.grid?.data().length ?? 0])), [DMI]);
  const item = (p: PageDef) => (
    <button
      key={p.id}
      onClick={() => {
        setPage(p.id);
        onPick?.();
      }}
      aria-current={pageId === p.id ? 'page' : undefined}
      className={
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ' +
        (pageId === p.id ? 'bg-accent/10 font-medium text-fg shadow-[inset_3px_0_0_rgb(var(--accent))]' : 'text-muted hover:bg-row-hover hover:text-fg')
      }
    >
      <p.icon size={16} className={pageId === p.id ? 'text-accent' : ''} />
      <span className="flex-1">{p.label}</span>
      <span className="text-[11px] tabular-nums text-muted/80">{counts[p.id]?.toLocaleString()}</span>
    </button>
  );
  return (
    <nav className="shrink-0 p-2" aria-label="Pages">
      {PAGES.filter((p) => p.group === 'main').map(item)}
      <div className="section-label px-2.5 pb-1 pt-3">Reference</div>
      {PAGES.filter((p) => p.group === 'reference').map(item)}
    </nav>
  );
}

function PageFilters({ page }: { page: PageDef }) {
  const DMI = useData((s) => s.DMI)!;
  return <FilterPanel page={page} DMI={DMI} />;
}

function ResultsPane({ page, onOpenFilters, onActivate }: { page: PageDef; onOpenFilters?: () => void; onActivate?: () => void }) {
  const { DMI, results } = usePageResults(page);
  const [prefs, setPrefs] = useColumnPrefs(page.id);
  const filters = useView((s) => s.filters[page.id]) ?? EMPTY;
  const advanced = useSettings((s) => s.advanced);
  const moreInfo = useSettings((s) => s.moreInfo);
  const customJs = useSettings((s) => s.customJs);
  const nChips = activeChips(page, filters, DMI, { advanced, moreInfo, customJs }).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <page.icon size={18} className="text-accent" />
          <h1 className="font-display text-lg font-bold">{page.label}</h1>
          <span className="text-sm tabular-nums text-muted">
            {results.rows.length === results.total ? results.total.toLocaleString() : `${results.rows.length.toLocaleString()} of ${results.total.toLocaleString()}`}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {onOpenFilters && (
              <button className="btn relative py-1" onClick={onOpenFilters}>
                <SlidersHorizontal size={14} /> Filters
                {nChips > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white dark:text-bg">{nChips}</span>}
              </button>
            )}
            <ColumnPicker page={page} results={results} prefs={prefs} setPrefs={setPrefs} />
          </div>
        </div>
        <ActiveFilters page={page} DMI={DMI} />
        {results.error && <div className="rounded-md bg-bad/10 px-2 py-1 text-xs text-bad">{results.error}</div>}
      </div>
      <ResultsTable page={page} DMI={DMI} results={results} prefs={prefs} setPrefs={setPrefs} onActivate={onActivate} />
    </div>
  );
}

function ColumnPicker({ page, results, prefs, setPrefs }: { page: PageDef; results: any; prefs: any; setPrefs: any }) {
  const thumbnails = useSettings((s) => s.thumbnails);
  const set = useSettings((s) => s.set);
  const calcCols = useView((s) => s.calcCols[page.id]);
  const sortCol = useView((s) => s.sorts[page.id]?.col);
  const setCalcCols = useView((s) => s.setCalcCols);
  const shownCalc = shownCalcColumns(calcCols, sortCol);
  const calcColumns = results.grid.columns.filter((c: any) => c.derived);
  return (
    <Popover.Root>
      <Popover.Trigger className="btn-ghost" title="Columns" aria-label="Choose columns">
        <Columns3 size={16} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} className="z-50 w-56 rounded-lg border border-line bg-panel p-2 shadow-xl animate-in">
          <div className="section-label px-1 pb-1">Columns</div>
          {page.thumb && (
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-row-hover">
              <input type="checkbox" checked={thumbnails} onChange={(e) => set({ thumbnails: e.target.checked })} className="accent-[rgb(var(--accent))]" />
              Thumbnail
            </label>
          )}
          {results.grid.columns.filter((c: any) => !c.derived).map((c: any) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-row-hover">
              <input
                type="checkbox"
                className="accent-[rgb(var(--accent))]"
                checked={!isColHidden(prefs, c)}
                disabled={c.id === 'name' || c.id === 'description'}
                onChange={(e) => setPrefs((p: any) => toggleCol(p, c, e.target.checked))}
              />
              {c.name}
            </label>
          ))}
          {calcColumns.length > 0 && (
            <>
              <div className="section-label px-1 pb-1 pt-2" title="Values the game calculates; ≈ marks formulas not yet confirmed in game">
                Calculated
              </div>
              {calcColumns.map((c: any) => (
                <label
                  key={c.id}
                  title={c.id === sortCol ? 'Shown because the table is sorted by it' : c.title}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-row-hover"
                >
                  <input
                    type="checkbox"
                    className="accent-[rgb(var(--accent))]"
                    checked={shownCalc.includes(c.id)}
                    disabled={c.id === sortCol}
                    onChange={(e) => setCalcCols(e.target.checked ? [...shownCalc, c.id] : shownCalc.filter((f) => f !== c.id))}
                  />
                  {c.name}
                </label>
              ))}
            </>
          )}
          <button
            className="btn-ghost mt-1 w-full justify-start px-1 text-xs"
            onClick={() => {
              setPrefs(() => ({ hidden: [], shown: [], widths: {} }));
              setCalcCols([]);
            }}
          >
            Reset columns
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ------------------------------------------------------------------------------------------------
   Mobile: list and detail are full screen, filters live in a bottom sheet, pages in a bottom bar.
------------------------------------------------------------------------------------------------- */

function MobileWorkspace() {
  const pageId = useView((s) => s.page);
  const page = PAGE_BY_ID[pageId];
  const detailRef = useView((s) => s.detailRef);
  const [showDetail, setShowDetail] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const DMI = useData((s) => s.DMI)!;

  // following a cross-link from anywhere opens the detail view
  useEffect(() => {
    if (detailRef) setShowDetail(true);
  }, [detailRef]);
  useEffect(() => setShowDetail(false), [pageId]);

  return (
    <div className="flex h-full flex-col">
      <TopBar compact />
      <div className="relative min-h-0 flex-1">
        <div className={'absolute inset-0 flex flex-col ' + (showDetail && detailRef ? 'invisible' : '')}>
          <ResultsPane page={page} onOpenFilters={() => setFiltersOpen(true)} onActivate={() => setShowDetail(true)} />
        </div>
        {showDetail && detailRef && (
          <div className="absolute inset-0 animate-in">
            <DetailPanel onClose={() => setShowDetail(false)} />
          </div>
        )}
      </div>
      <PinTray mobile />
      <nav className="flex h-14 shrink-0 items-stretch border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]" aria-label="Pages">
        {PAGES.filter((p) => ['unit', 'spell', 'item', 'site'].includes(p.id)).map((p) => (
          <button
            key={p.id}
            className={'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ' + (pageId === p.id ? 'text-accent' : 'text-muted')}
            onClick={() => useView.getState().setPage(p.id)}
            aria-current={pageId === p.id ? 'page' : undefined}
          >
            <p.icon size={18} />
            {p.label}
          </button>
        ))}
        <button
          className={'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ' + (!['unit', 'spell', 'item', 'site'].includes(pageId) ? 'text-accent' : 'text-muted')}
          onClick={() => setPagesOpen(true)}
        >
          <LayoutGrid size={18} />
          More
        </button>
      </nav>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen} title={`Filter ${page.label.toLowerCase()}`}>
        <FilterPanel page={page} DMI={DMI} />
      </Sheet>
      <Sheet open={pagesOpen} onOpenChange={setPagesOpen} title="Pages">
        <PageNav onPick={() => setPagesOpen(false)} />
      </Sheet>
    </div>
  );
}

function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-line bg-panel shadow-2xl animate-in" aria-describedby={undefined}>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <Dialog.Title className="font-display font-bold">{title}</Dialog.Title>
            <Dialog.Close className="btn-ghost" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ------------------------------------------------------------------------------------------------ */

function isTyping(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping(document.activeElement);
      const dialogOpen = !!document.querySelector('[role="dialog"]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useGlobalSearch.getState().setOpen(true);
        return;
      }
      if (dialogOpen) return;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        useGlobalSearch.getState().setOpen(true);
        return;
      }
      const v = useView.getState();
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (e.key === 'ArrowLeft') v.back();
        else v.forward();
        return;
      }
      if (e.ctrlKey && !typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const i = PAGES.findIndex((p) => p.id === v.page);
        const next = PAGES[(i + (e.key === 'ArrowRight' ? 1 : PAGES.length - 1)) % PAGES.length];
        v.setPage(next.id);
        return;
      }
      if (typing) return;
      const inTable = !!(document.activeElement as HTMLElement | null)?.closest?.('[data-results-table]');
      if (!inTable && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        tableApi.move?.(e.key === 'ArrowDown' ? 1 : -1);
      } else if (!inTable && e.key === 'Enter') {
        tableApi.pinSelected?.();
      } else if (e.key === 'Escape') {
        // upstream: close the top popup; with none open, clear filters and focus the search box
        if (usePreview.getState().target) return usePreview.getState().show(null);
        // desktop cards: Esc closes the loose card first (pinned cards stay)
        const cardsView = !window.matchMedia('(max-width: 767px)').matches;
        if (cardsView && v.detailRef && !v.pins.includes(v.detailRef)) return useView.setState({ detailRef: null });
        v.resetFilters();
        document.getElementById('page-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
