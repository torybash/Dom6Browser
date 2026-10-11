import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { useData } from '../state/data';
import { useSettings } from '../state/settings';
import { useView } from '../state/view';
import { renderRef } from './legacy';
import { LegacyHtml, type RefEventInfo } from './LegacyHtml';

interface PreviewState {
  target: { ref: string; rect: DOMRect } | null;
  show: (info: RefEventInfo | null) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Hover previews for ref links (upstream's sliding "floating overlay"). */
export const usePreview = create<PreviewState>((set) => ({
  target: null,
  show: (info) => {
    clearTimeout(timer);
    if (!info) {
      set({ target: null });
      return;
    }
    if (!useSettings.getState().hoverPreviews) return;
    const rect = info.anchor.getBoundingClientRect();
    timer = setTimeout(() => set({ target: { ref: info.ref, rect } }), 280);
  },
}));

// any navigation or scrolling invalidates the anchor the preview points at
useView.subscribe((s, prev) => {
  if (s.detailRef !== prev.detailRef || s.page !== prev.page || s.compareOpen !== prev.compareOpen) usePreview.getState().show(null);
});
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => usePreview.getState().show(null), true);
  window.addEventListener('pointerdown', () => usePreview.getState().show(null), true);
}

export function HoverPreview() {
  const target = usePreview((s) => s.target);
  const DMI = useData((s) => s.DMI);
  const showModCmds = useSettings((s) => s.advanced && s.modCmds);
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const pane = useMemo(
    () => (target && DMI ? renderRef(DMI, target.ref, showModCmds) : null),
    [target, DMI, showModCmds],
  );

  useLayoutEffect(() => {
    if (!target || !cardRef.current) return setPos(null);
    const card = cardRef.current.getBoundingClientRect();
    const r = target.rect;
    const gap = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // prefer the side with more room (detail panel usually sits on the right)
    let left = r.left - card.width - gap;
    if (left < 8 || vw - r.right > r.left) left = r.right + gap;
    if (left + card.width > vw - 8) left = Math.max(8, vw - card.width - 8);
    let top = r.top - 24;
    if (top + card.height > vh - 8) top = Math.max(8, vh - card.height - 8);
    setPos({ left, top });
  }, [target, pane]);

  if (!target || !pane) return null;
  return (
    <div
      ref={cardRef}
      className="preview-card pointer-events-none fixed z-50 w-[380px] max-w-[92vw] overflow-hidden rounded-lg border border-line bg-panel shadow-2xl animate-in"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, maxHeight: '72vh' }}
    >
      <LegacyHtml html={pane.html} jobs={pane.jobs} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-panel" />
    </div>
  );
}
