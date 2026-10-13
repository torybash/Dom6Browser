// Cards view: dom6inspector-style floating cards over the workspace. Every pin is a card; the loose
// card (dashed outline) shows the current detailRef, i.e. whatever row or link was clicked last.
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Pin, X } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PAGES, pageForRefKind } from '../pages';
import {
  CARD_EST_H,
  CARD_MAX_W,
  CARD_MIN_W,
  CARD_W,
  cardHeights,
  cardRect,
  LOOSE,
  openCardKeys,
  useCards,
  type CardGeom,
} from '../state/cards';
import { useData } from '../state/data';
import { displayName } from '../state/results';
import { useSettings } from '../state/settings';
import { useView } from '../state/view';
import { clampToBounds, MARGIN, placeFree, placeNear, snap, type Rect } from './cardLayout';
import { clearDiffs, markDiffs } from './Compare';
import { usePreview } from './HoverPreview';
import { renderRef } from './legacy';
import { LegacyHtml, type RefEventInfo } from './LegacyHtml';

const NEW_CARD = { w: CARD_W, h: CARD_EST_H };

function currentKeys() {
  const v = useView.getState();
  return openCardKeys(v.pins, v.detailRef);
}

function rectsExcept(key: string | null): Rect[] {
  return currentKeys()
    .filter((k) => k !== key)
    .map(cardRect)
    .filter((r): r is Rect => !!r);
}

export function CardBoard() {
  const boardRef = useRef<HTMLDivElement>(null);
  const pins = useView((s) => s.pins);
  const detailRef = useView((s) => s.detailRef);
  const keys = useMemo(() => openCardKeys(pins, detailRef), [pins, detailRef]);
  const geom = useCards((s) => s.geom);
  const diff = useCards((s) => s.diff);

  useLayoutEffect(() => {
    const el = boardRef.current!;
    const measure = () => useCards.getState().setBounds({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // give new cards a place; forget cards that were closed (the loose card keeps its spot while hidden)
  useLayoutEffect(() => {
    const c = useCards.getState;
    for (const k of keys) {
      if (c().geom[k]) continue;
      // the loose card was pinned (pin button, Enter, Shift+click): it stays where it is
      if (k !== LOOSE && k === detailRef && c().geom[LOOSE]) {
        c().adoptLoose(k);
        continue;
      }
      const r = placeFree(NEW_CARD, rectsExcept(k), c().bounds);
      c().place(k, { x: r.x, y: r.y, w: CARD_W });
    }
    c().prune([...keys, LOOSE]);
  }, [keys, detailRef]);

  // a clicked row or link should be visible: raise the card showing it
  useEffect(() => {
    if (!detailRef) return;
    const v = useView.getState();
    if (v.pins.includes(detailRef)) useCards.getState().focus(detailRef);
    else useCards.getState().front(LOOSE);
  }, [detailRef]);

  // diff highlighting between cards of the same kind, recomputed once after a burst of changes
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const runDiff = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const root = boardRef.current;
      if (!root) return;
      clearDiffs(root);
      if (!useCards.getState().diff) return;
      const groups = new Map<string, HTMLElement[]>();
      root.querySelectorAll<HTMLElement>('[data-card-body]').forEach((el) => {
        const kind = el.dataset.kind ?? '';
        groups.set(kind, [...(groups.get(kind) ?? []), el]);
      });
      groups.forEach((cols, kind) => kind && cols.length > 1 && markDiffs(cols));
    }, 30);
  }, []);
  const collapsedSig = keys.map((k) => (geom[k]?.collapsed ? 1 : 0)).join('');
  useEffect(runDiff, [diff, keys, collapsedSig, runDiff]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div ref={boardRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-label="Cards">
      {keys.map((k) => geom[k] && <FloatingCard key={k} k={k} g={geom[k]} onRendered={runDiff} />)}
    </div>
  );
}

const FloatingCard = memo(function FloatingCard({ k, g, onRendered }: { k: string; g: CardGeom; onRendered: () => void }) {
  const loose = k === LOOSE;
  const detailRef = useView((s) => s.detailRef);
  const ref = loose ? detailRef : k;
  const DMI = useData((s) => s.DMI);
  const version = useData((s) => s.version);
  const showModCmds = useSettings((s) => s.advanced && s.modCmds);
  const boardH = useCards((s) => s.bounds.h);
  const canBack = useView((s) => loose && s.historyIndex > 0);
  const canForward = useView((s) => loose && s.historyIndex < s.history.length - 1);
  const pulse = useCards((s) => (s.pulse?.key === k ? s.pulse.n : 0));
  const showPreview = usePreview((s) => s.show);
  const elRef = useRef<HTMLElement>(null);

  const pane = useMemo(
    () => (DMI && ref ? renderRef(DMI, ref, showModCmds) : null),
    // version: re-render after data reloads (mods)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [DMI, version, ref, showModCmds],
  );
  const page = pane ? PAGES.find((p) => p.id === pageForRefKind(pane.kind)) : undefined;
  const thumb = pane && DMI && page?.thumb ? page.thumb(pane.o, DMI) : undefined;
  const name = pane ? displayName(pane.o) : (ref ?? '');

  // heights feed placement, snapping and tidy
  useLayoutEffect(() => {
    const el = elRef.current!;
    const measure = () => cardHeights.set(k, el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [k]);

  // replay the focus animation (upstream bounced an already open popup)
  useEffect(() => {
    const el = elRef.current;
    if (!pulse || !el) return;
    el.classList.remove('card-pulse');
    void el.offsetWidth;
    el.classList.add('card-pulse');
  }, [pulse]);

  const onRef = useCallback(
    (info: RefEventInfo) => {
      const v = useView.getState();
      const c = useCards.getState();
      const open = v.pins.includes(info.ref) ? info.ref : v.detailRef === info.ref ? LOOSE : null;
      if (open) return c.focus(open);
      // Shift/Ctrl/middle click: look at it in the loose card without pinning
      if (info.alt) return v.navigate(info.ref);
      const src = cardRect(k);
      const others = rectsExcept(null);
      const r = src ? placeNear(src, NEW_CARD, others, c.bounds) : placeFree(NEW_CARD, others, c.bounds);
      c.place(info.ref, { x: r.x, y: r.y, w: CARD_W });
      v.pin(info.ref);
    },
    [k],
  );

  const close = () => {
    const v = useView.getState();
    if (!loose) v.unpin(k);
    // a closed card should not reappear as the loose card
    if (v.detailRef === ref) useView.setState({ detailRef: null });
  };

  const drag = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, x: g.x, y: g.y };
    const others = rectsExcept(k);
    track('grabbing', (ev) => {
      const c = useCards.getState();
      let r: Rect = { x: start.x + ev.clientX - start.px, y: start.y + ev.clientY - start.py, w: g.w, h: cardHeights.get(k) ?? CARD_EST_H };
      // Alt: free placement
      if (!ev.altKey) r = { ...r, ...snap(r, others, c.bounds) };
      r = clampToBounds(r, c.bounds);
      c.patch(k, { x: r.x, y: r.y });
    });
  };

  const resize = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const start = { px: e.clientX, py: e.clientY, w: g.w, h: elRef.current!.offsetHeight };
    track('nwse-resize', (ev) => {
      const w = Math.max(CARD_MIN_W, Math.min(CARD_MAX_W, Math.round(start.w + ev.clientX - start.px)));
      const h = Math.max(120, Math.round(start.h + ev.clientY - start.py));
      useCards.getState().patch(k, { w, h });
    });
  };

  const iconBtn = 'btn-ghost p-1';
  return (
    <section
      ref={elRef}
      aria-label={name}
      className={'float-card pointer-events-auto absolute flex flex-col ' + (loose ? 'float-card-loose' : '')}
      style={{
        left: g.x,
        top: g.y,
        width: g.w,
        height: g.collapsed ? undefined : g.h,
        maxHeight: Math.max(160, boardH - g.y - MARGIN),
        zIndex: g.z,
      }}
      onPointerDownCapture={() => useCards.getState().front(k)}
      onAnimationEnd={(e) => e.target === e.currentTarget && e.currentTarget.classList.remove('card-pulse')}
    >
      <div
        className={'float-card-title flex h-9 shrink-0 cursor-grab touch-none select-none items-center gap-1.5 pl-2 pr-1 ' + (g.collapsed ? '' : 'border-b border-line')}
        onPointerDown={drag}
        onDoubleClick={(e) => !(e.target as HTMLElement).closest('button') && useCards.getState().toggleCollapse(k)}
        title="Drag to move (Alt: no snapping) · double-click to collapse"
      >
        {thumb ? <img src={thumb} alt="" className="sprite-thumb h-5 w-5 shrink-0" /> : page ? <page.icon size={14} className="shrink-0 text-muted" /> : null}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        {loose && (
          <>
            <span className="rounded bg-accent/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent">Preview</span>
            <button className={iconBtn} disabled={!canBack} onClick={useView.getState().back} title="Back (Alt+←)" aria-label="Back">
              <ArrowLeft size={14} />
            </button>
            <button className={iconBtn} disabled={!canForward} onClick={useView.getState().forward} title="Forward (Alt+→)" aria-label="Forward">
              <ArrowRight size={14} />
            </button>
            {ref && (
              <button className={iconBtn + ' text-accent'} onClick={() => useView.getState().pin(ref)} title="Pin: keep this card open (Enter)" aria-label="Pin">
                <Pin size={14} />
              </button>
            )}
          </>
        )}
        <button
          className={iconBtn}
          onClick={() => useCards.getState().toggleCollapse(k)}
          title={g.collapsed ? 'Expand' : 'Collapse'}
          aria-label={g.collapsed ? 'Expand' : 'Collapse'}
          aria-expanded={!g.collapsed}
        >
          {g.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button className={iconBtn} onClick={close} title={loose ? 'Close' : 'Close (unpin)'} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      {!g.collapsed && (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto" data-card-body data-kind={pane?.kind}>
            {pane ? (
              <LegacyHtml key={ref} html={pane.html} jobs={pane.jobs} onRef={onRef} onHover={showPreview} onRendered={onRendered} className="animate-in" />
            ) : (
              <p className="p-4 text-sm text-muted">That entry does not exist in the loaded data.</p>
            )}
          </div>
          <div
            className="float-card-resize absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
            onPointerDown={resize}
            onDoubleClick={() => useCards.getState().patch(k, { w: CARD_W, h: undefined })}
            title="Drag to resize · double-click to reset"
          />
        </>
      )}
    </section>
  );
});

/** Follows the pointer until release, with a fixed cursor and no text selection meanwhile. */
function track(cursor: string, onMove: (e: PointerEvent) => void) {
  const body = document.body.style;
  const up = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    body.cursor = '';
    body.userSelect = '';
  };
  body.cursor = cursor;
  body.userSelect = 'none';
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}
