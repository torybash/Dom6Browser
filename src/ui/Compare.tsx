import * as Dialog from '@radix-ui/react-dialog';
import { Columns3, Pin, X } from 'lucide-react';
import { useCallback, useMemo, useRef } from 'react';
import { PAGES, pageForRefKind } from '../pages';
import { useData } from '../state/data';
import { displayName } from '../state/results';
import { useSettings } from '../state/settings';
import { useView } from '../state/view';
import { useRefHandlers } from './DetailPanel';
import { renderRef } from './legacy';
import { LegacyHtml } from './LegacyHtml';

/** Bottom tray listing pinned entries (replaces upstream's draggable popups). */
export function PinTray() {
  const pins = useView((s) => s.pins);
  const DMI = useData((s) => s.DMI);
  const navigate = useView((s) => s.navigate);
  const unpin = useView((s) => s.unpin);
  const clear = useView((s) => s.clearPins);
  const setCompareOpen = useView((s) => s.setCompareOpen);
  if (!pins.length || !DMI) return null;
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-t border-line bg-panel px-3">
      <Pin size={14} className="shrink-0 text-accent" />
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1">
        {pins.map((ref) => {
          const r = DMI.resolveRef(ref);
          const page = PAGES.find((p) => p.id === pageForRefKind(r?.kind ?? ref.split(' ')[0]));
          const thumb = r && page?.thumb ? page.thumb(r.o, DMI) : undefined;
          return (
            <span key={ref} className="chip shrink-0 cursor-pointer gap-1.5 py-1 pl-1.5 pr-1 hover:border-accent/60" onClick={() => navigate(ref)} title="Show in detail panel">
              {thumb ? <img src={thumb} alt="" className="sprite-thumb h-5 w-5" /> : page ? <page.icon size={13} className="text-muted" /> : null}
              <span className="max-w-[160px] truncate">{r ? displayName(r.o) : ref}</span>
              <button
                className="rounded-full p-0.5 text-muted hover:bg-row-hover hover:text-fg"
                onClick={(e) => {
                  e.stopPropagation();
                  unpin(ref);
                }}
                aria-label="Unpin"
              >
                <X size={11} />
              </button>
            </span>
          );
        })}
      </div>
      <button className="btn-primary shrink-0 py-1" onClick={() => setCompareOpen(true)} disabled={pins.length < 1}>
        <Columns3 size={14} /> Compare{pins.length > 1 ? ` ${pins.length}` : ''}
      </button>
      <button className="btn-ghost shrink-0 px-2 text-xs" onClick={clear} title="Unpin all">
        Clear
      </button>
    </div>
  );
}

/** Side-by-side view of pinned entries; values that differ between them are highlighted. */
export function CompareView() {
  const open = useView((s) => s.compareOpen);
  const setOpen = useView((s) => s.setCompareOpen);
  const pins = useView((s) => s.pins);
  const unpin = useView((s) => s.unpin);
  const DMI = useData((s) => s.DMI);
  const version = useData((s) => s.version);
  const showModCmds = useSettings((s) => s.advanced && s.modCmds);
  const { onHover } = useRefHandlers();
  const navigate = useView((s) => s.navigate);
  const togglePin = useView((s) => s.togglePin);
  // links: shift-click adds a column, plain click closes compare and opens the entry
  const onRef = useCallback(
    (info: { ref: string; alt: boolean }) => {
      if (info.alt) togglePin(info.ref);
      else {
        setOpen(false);
        navigate(info.ref);
      }
    },
    [navigate, togglePin, setOpen],
  );
  const rootRef = useRef<HTMLDivElement>(null);

  const panes = useMemo(
    () => (open && DMI ? pins.map((ref) => ({ ref, pane: renderRef(DMI, ref, showModCmds) })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, DMI, version, pins, showModCmds],
  );

  // after all columns rendered, mark rows/tiles whose values differ between columns
  const rendered = useRef(0);
  const highlight = useCallback(() => {
    rendered.current++;
    if (rendered.current < panes.length || !rootRef.current) return;
    const cols = Array.from(rootRef.current.querySelectorAll<HTMLElement>('[data-compare-col]'));
    const values = new Map<string, (string | null)[]>();
    const elements = new Map<string, HTMLElement[]>();
    cols.forEach((col, ci) => {
      col.querySelectorAll<HTMLElement>('[data-key], tr[class]').forEach((el) => {
        const key = el.dataset.key ?? (el.getAttribute('class') ?? '').trim().split(/\s+/)[0];
        if (!key || key === 'modded') return;
        const val = (el.querySelector('.stat-value, td')?.textContent ?? '').trim();
        if (!values.has(key)) values.set(key, Array(cols.length).fill(null));
        values.get(key)![ci] = val;
        elements.set(key, [...(elements.get(key) ?? []), el]);
      });
    });
    values.forEach((vals, key) => {
      const distinct = new Set(vals.map((v) => v ?? '—'));
      if (distinct.size > 1) elements.get(key)!.forEach((el) => el.classList.add('cmp-diff'));
    });
  }, [panes.length]);
  rendered.current = 0;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-3 z-40 flex flex-col overflow-hidden rounded-xl border border-line bg-bg shadow-2xl animate-in sm:inset-6" aria-describedby={undefined}>
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-panel px-4">
            <Dialog.Title className="flex items-center gap-2 font-display text-lg font-bold">
              <Columns3 size={18} /> Compare <span className="text-sm font-normal text-muted">differences are highlighted</span>
            </Dialog.Title>
            <Dialog.Close className="btn-ghost" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div ref={rootRef} className="flex min-h-0 flex-1 gap-3 overflow-auto p-3">
            {panes.map(({ ref, pane }) => (
              <div key={ref} data-compare-col className="relative w-[400px] shrink-0 self-start rounded-lg border border-line bg-panel">
                <button className="absolute right-2 top-2 z-10 btn-ghost p-1" onClick={() => unpin(ref)} title="Unpin" aria-label="Unpin">
                  <X size={14} />
                </button>
                {pane ? (
                  <LegacyHtml html={pane.html} jobs={pane.jobs} onRef={onRef} onHover={onHover} onRendered={highlight} />
                ) : (
                  <p className="p-4 text-sm text-muted">{ref} not found</p>
                )}
              </div>
            ))}
            {panes.length === 0 && <p className="m-auto text-sm text-muted">Pin entries (Shift+click or the pin button) to compare them here.</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
