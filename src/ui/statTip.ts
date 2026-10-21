// Dominions-style tooltip for unit stat rows. Rows and chips are `.ustat[data-tip]` / `.uchip[data-tip]` with a child
// `<template class="stat-tip-src">`; one shared `div.stat-tip` on <body> shows a clone of it.

const MARGIN = 8;
const GAP = 6;

let installed = false;
let tip: HTMLDivElement | null = null;
let current: HTMLElement | null = null;

function rowOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? (target.closest('.ustat[data-tip], .uchip[data-tip]') as HTMLElement | null) : null;
}

function hide(): void {
  if (current) current.removeAttribute('aria-describedby');
  current = null;
  if (tip) tip.style.display = 'none';
}

function position(row: HTMLElement, el: HTMLElement): void {
  const r = row.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  let top = r.bottom + GAP;
  if (top + h > vh - MARGIN && r.top - GAP - h >= MARGIN) top = r.top - GAP - h;
  top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));
  const left = Math.max(MARGIN, Math.min(r.left, vw - w - MARGIN));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function show(row: HTMLElement): void {
  if (row === current && tip && tip.style.display !== 'none') return;
  hide();
  const src = row.querySelector<HTMLTemplateElement>('template.stat-tip-src');
  if (!src) return;
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'stat-tip';
    tip.setAttribute('role', 'tooltip');
    tip.id = 'stat-tip';
    document.body.appendChild(tip);
  }
  tip.replaceChildren(src.content.cloneNode(true));
  tip.style.display = 'block';
  tip.style.left = '0px';
  tip.style.top = '0px';
  current = row;
  row.setAttribute('aria-describedby', tip.id);
  position(row, tip);
}

export function installStatTips(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const opts = { passive: true } as const;

  document.addEventListener('pointerover', (e) => {
    const row = rowOf(e.target);
    if (row) show(row);
  });
  document.addEventListener('pointerout', (e) => {
    const row = rowOf(e.target);
    if (!row || row !== current) return;
    const to = e.relatedTarget;
    if (to instanceof Node && row.contains(to)) return;
    hide();
  });
  document.addEventListener('focusin', (e) => {
    const row = rowOf(e.target);
    if (row) show(row);
  });
  document.addEventListener('focusout', (e) => {
    if (rowOf(e.target) === current) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
  document.addEventListener('scroll', hide, { capture: true, ...opts });
  window.addEventListener('resize', hide);
  // a re-render can remove the hovered row without firing pointerout
  new MutationObserver(() => {
    if (current && !current.isConnected) hide();
  }).observe(document.body, { childList: true, subtree: true });
}
