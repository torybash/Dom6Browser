// Bridge between the ported upstream renderers (which produce html strings) and the React UI.
import type { DMI } from '../data/load';
import { fetchText } from '../state/data';
import { enhanceUnitCard } from './unitCard';
import { withCalculated } from './calculated';
import { withCarries } from '../data/extensions/carries';
import { withThroneInfo } from '../data/extensions/thrones';
import { withIndependents } from '../data/extensions/independentsPage';
import { attachStatTips } from './derivedTips';
import { renderEventCard } from './eventCard';
import { eligibilityDetailsHtml } from '../data/extensions/eventEligibility';
import { useView } from '../state/view';
import { displayName } from '../state/results';

/** What the card header shows; it stays visible when the card is collapsed. */
export interface PaneHead {
  title: string;
  /** subtitle html: nation, school, slot, badges ('' when none) */
  sub: string;
  /** unit sprites (they toggle to the attack pose on click); '' for kinds that use their page thumbnail */
  sprites: string;
}

export interface RenderedPane {
  /** the card body: the upstream html without its header */
  html: string;
  head: PaneHead;
  jobs: ContentJob[];
  kind: string;
  o: any;
}

export interface ContentJob {
  sel: string;
  url?: string;
  html?: string;
  afterUrl?: string;
}

/** Renders the detail pane for an upstream ref ("unit 89", "spell 12", "rndmagic 89", …). */
export function renderRef(DMI: DMI, ref: string, showModCmds: boolean): RenderedPane | null {
  const r = DMI.resolveRef(ref);
  if (!r) return null;
  DMI.Options['Show mod cmds'] = showModCmds ? 1 : 0;
  DMI.takeContentJobs();
  let html: string;
  try {
    html =
      r.kind === 'rndmagic'
        ? wrapRandomMagic(DMI.MUnit.renderRandomMagic(r.o), r.o)
        : withThroneInfo(r.o, withIndependents(DMI, r.o, withCarries(DMI, r.o, withCalculated(DMI, r.o, r.kind === 'event' ? withEligibility(DMI, r.o, renderEventCard(DMI, r.o)) : r.o.renderOverlay(r.o)))));
  } catch (e: any) {
    console.error(e);
    html = `<div class="overlay-main"><p class="text-bad">Failed to render ${ref}: ${escapeHtml(String(e?.message ?? e))}</p></div>`;
  }
  const jobs = DMI.takeContentJobs();
  return { ...splitHead(DMI, r.o, html), jobs, kind: r.kind, o: r.o };
}

/**
 * Takes the header (title, subtitle line, sprites and pictures) out of the upstream html: the card
 * draws it in its own header. Also gives weapon and armor links their stat tooltips.
 */
function splitHead(DMI: DMI, o: any, html: string): { html: string; head: PaneHead } {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const doc = tpl.content;
  const header = doc.querySelector<HTMLElement>('.overlay-header');
  const titleEl = header?.querySelector('.h2replace, h2');
  // (the nation card puts its flag in the title; the header picture shows it)
  titleEl?.querySelectorAll('img').forEach((e) => e.remove());
  const title = titleEl?.textContent?.trim() || displayName(o);
  titleEl?.remove();
  header?.querySelectorAll('.overlay-pin, .item-image').forEach((e) => e.remove());
  const parts = Array.from(header?.children ?? []).filter((p) => p.textContent?.trim() || p.querySelector('img'));
  // the plain line (nation) first, then the right-floated bits (type, school, slot)
  const right = (p: Element) => (/float:\s*right/.test(p.getAttribute('style') ?? '') ? 1 : 0);
  parts.sort((a, b) => right(a) - right(b));
  const sub = parts.map((p) => `<span class="chead-part">${p.innerHTML.replace(/^(\s|&nbsp;)+/, '')}</span>`).join('');
  header?.remove();

  const spriteEls = Array.from(doc.querySelectorAll('img.unit-sprite'));
  const sprites = spriteEls.map((e) => e.outerHTML).join('');
  spriteEls.forEach((e) => e.remove());
  // the site picture sits in the body table
  if (o?.url) doc.querySelectorAll('.site.overlay-contents img').forEach((e) => e.getAttribute('src') === o.url && e.remove());

  doc.querySelectorAll<HTMLElement>('a.ref[data-ref^="wpn "], a.ref[data-ref^="armor "]').forEach((a) => {
    const tip = equipTipHtml(DMI, a.dataset.ref!);
    if (!tip) return;
    const t = document.createElement('template');
    t.className = 'stat-tip-src';
    t.innerHTML = tip;
    a.dataset.tip = '1';
    a.appendChild(t);
  });
  return { html: tpl.innerHTML, head: { title, sub, sprites } };
}

/** Tooltip for a weapon or armor link, in the style of the unit stat tooltips: the rows of its card. */
function equipTipHtml(DMI: DMI, ref: string): string {
  const r = DMI.resolveRef(ref);
  if (!r) return '';
  const tpl = document.createElement('template');
  tpl.innerHTML = r.o.renderOverlay(r.o);
  const text = (el: Element) => {
    const c = el.cloneNode(true) as Element;
    c.querySelectorAll('.internal-inline, .modding-inline').forEach((e) => e.remove());
    return (c.textContent ?? '').replace(/\s+/g, ' ').replace(/:\s*$/, '').trim();
  };
  let html = `<div class="tip-head">${escapeHtml(r.o.name ?? '')}</div>`;
  let dl = '';
  const flush = () => {
    if (dl) html += `<dl class="tip-derived">${dl}</dl>`;
    dl = '';
  };
  // a weapon's secondary effect follows as an h4 and a second table
  tpl.content.querySelectorAll('.overlay-main table.overlay-table, .overlay-main h4').forEach((el) => {
    if (el.tagName === 'H4') {
      flush();
      html += `<div class="tip-sub">${escapeHtml(text(el))}</div>`;
      return;
    }
    el.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr').forEach((tr) => {
      if (tr.matches('.hidden-row, .modding-row, .modded')) return;
      const th = tr.querySelector(':scope > th');
      const td = tr.querySelector(':scope > td');
      if (th && td) {
        dl += `<dt class="tip-label">${escapeHtml(text(th))}</dt><dd class="tip-value">${escapeHtml(text(td))}</dd>`;
      } else if (td && text(td)) {
        flush();
        html += `<div class="tip-text">${escapeHtml(text(td))}</div>`;
      }
    });
    flush();
  });
  return html;
}

/** With a province described in the Events filters, the event card lists which requirements it meets. */
function withEligibility(DMI: DMI, o: any, html: string): string {
  const details = eligibilityDetailsHtml(o, useView.getState().filters.event ?? {}, DMI);
  return details ? html.replace('<div class="overlay-main">', '<div class="overlay-main">' + details) : html;
}

function wrapRandomMagic(inner: string, o: any) {
  return `<div class="rndmagic overlay-contents"><div class="overlay-header"><div class="h2replace">Random magic</div><p>${escapeHtml(
    o.fullname || o.name,
  )}</p></div><div class="overlay-main">${inner}</div></div>`;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/* ---------------------------------------------------------------------------------------------
   DOM enhancements applied after the upstream html is inserted. These only restructure layout;
   all content (and the classes the advanced toggles rely on) is preserved.
---------------------------------------------------------------------------------------------- */

export function enhance(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.unit.overlay-contents > .overlay-main').forEach(enhanceUnitCard);
  root.querySelectorAll<HTMLElement>('.overlay-descr').forEach(foldDescription);
  // the Calculated section goes right under the stat card
  root.querySelectorAll<HTMLElement>('.calc-section').forEach((sec) => {
    sec.closest('.overlay-contents')?.querySelector('.ucard')?.after(sec);
  });
  attachStatTips(root);
  root.querySelectorAll<HTMLImageElement>('img').forEach(fixImage);
  root.querySelectorAll<HTMLTableElement>('table.overlay-table').forEach((t) => {
    const first = t.rows[0];
    if (first && /background/.test(first.getAttribute('style') ?? '')) t.classList.add('equip-table');
  });
  groupFlags(root);
  addUnitSprites(root);
}

/** Open state of the description foldouts, kept while browsing from card to card. */
let descrOpen = false;

/**
 * Folds the flavor text (and a spell's details text) away. The elements keep their classes, so the
 * async description load still finds them.
 */
function foldDescription(descr: HTMLElement) {
  if (descr.closest('details')) return;
  const fold = document.createElement('details');
  fold.className = 'descr-fold';
  fold.innerHTML = '<summary>Description</summary>';
  fold.open = descrOpen;
  fold.addEventListener('toggle', () => (descrOpen = fold.open));
  const details = descr.parentElement?.querySelector(':scope > .overlay-details');
  descr.replaceWith(fold);
  fold.appendChild(descr);
  if (details) fold.appendChild(details);
}

/** More unit links than this in one place is a list, and lists stay plain text. */
const SPRITE_LIST_MAX = 8;

/**
 * Unit links (Utils.unitRef, data-sprite) show the unit's sprite before the name, except in long lists
 * and in the nation card's recruitment sections.
 */
function addUnitSprites(root: HTMLElement) {
  const groups = new Map<Element, HTMLElement[]>();
  root.querySelectorAll<HTMLElement>('a.ref[data-sprite]').forEach((a) => {
    const p = a.parentElement;
    if (p) groups.set(p, [...(groups.get(p) ?? []), a]);
  });
  groups.forEach((links, parent) => {
    if (links.length > SPRITE_LIST_MAX || parent.closest('.nation-section, .full-list')) return;
    for (const a of links) {
      const img = document.createElement('img');
      img.className = 'ref-sprite';
      img.alt = '';
      img.src = a.dataset.sprite!;
      img.addEventListener('error', () => img.remove(), { once: true });
      a.classList.add('ref-unit');
      a.prepend(img);
    }
  });
}

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="6" fill="none" stroke="#8884" stroke-width="2" stroke-dasharray="4 3"/><text x="24" y="29" font-size="11" text-anchor="middle" fill="#8889" font-family="sans-serif">?</text></svg>',
  );

/** Pixel-art sprites are tiny: show them at 2x. Missing images (e.g. mod sprites) get a placeholder. */
function fixImage(img: HTMLImageElement) {
  const scale = () => {
    if (img.classList.contains('unit-sprite') && img.naturalWidth && img.naturalWidth <= 96) {
      img.style.width = img.naturalWidth * 2 + 'px';
    }
  };
  if (img.complete && img.naturalWidth) scale();
  else img.addEventListener('load', scale, { once: true });
  img.addEventListener(
    'error',
    () => {
      img.src = PLACEHOLDER;
      img.title = 'Image not available (custom mod sprites cannot be shown)';
      img.removeAttribute('data-action');
    },
    { once: true },
  );
}

function groupFlags(root: HTMLElement) {
  const parents = new Set<HTMLElement>();
  root.querySelectorAll<HTMLElement>('span.flag').forEach((f) => f.parentElement && parents.add(f.parentElement));
  parents.forEach((parent) => {
    const flags = Array.from(parent.children).filter((c) => c.matches('span.flag'));
    if (flags.length < 1) return;
    const list = document.createElement('div');
    list.className = 'flag-list';
    parent.insertBefore(list, flags[0]);
    flags.forEach((f) => list.appendChild(f));
    // drop the "(", ", " and ")" separators that surrounded the flags
    Array.from(parent.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE && /^[\s(),]*$/.test(n.textContent ?? '')) n.remove();
    });
  });
}

/* ---------------------------------------------------------------------------------------------
   Description loading (upstream Utils.loadContent / insertContent)
---------------------------------------------------------------------------------------------- */

export function runContentJobs(root: HTMLElement, jobs: ContentJob[], isAlive: () => boolean) {
  for (const job of jobs) {
    const target = () => root.querySelector<HTMLElement>(job.sel);
    if (job.url) {
      fetchText(job.url)
        .then((txt) => {
          const el = target();
          if (isAlive() && el) el.innerHTML = txt;
        })
        .catch(() => {
          /* missing description files are normal */
        });
    } else if (job.html !== undefined) {
      const apply = () => {
        const el = target();
        if (isAlive() && el) el.innerHTML = job.html!;
      };
      if (job.afterUrl) fetchText(job.afterUrl).then(apply, () => {});
      else apply();
    }
  }
}

/** Upstream "show" buttons for long lists: reveal the hidden .full-list. */
export function revealList(btn: HTMLElement) {
  let el: HTMLElement | null = btn.parentElement;
  while (el && !el.querySelector('.full-list')) el = el.parentElement;
  if (!el) return;
  el.querySelectorAll<HTMLElement>('.full-list').forEach((l) => (l.style.display = ''));
  if (!btn.dataset.keep && btn.parentElement && !btn.parentElement.querySelector('.full-list')) {
    btn.parentElement.style.display = 'none';
  } else if (btn.dataset.keep) {
    btn.remove();
  }
}

export function toggleSprite(img: HTMLImageElement) {
  const { src1, src2 } = img.dataset;
  if (!src1 || !src2) return;
  img.src = img.getAttribute('src') === src1 ? src2 : src1;
}
