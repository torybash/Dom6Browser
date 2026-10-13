// Bridge between the ported upstream renderers (which produce html strings) and the React UI.
import type { DMI } from '../data/load';
import { fetchText } from '../state/data';
import { enhanceUnitCard } from './unitCard';
import { withCalculated } from './calculated';

export interface RenderedPane {
  html: string;
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
    html = r.kind === 'rndmagic' ? wrapRandomMagic(DMI.MUnit.renderRandomMagic(r.o), r.o) : withCalculated(DMI, r.o, r.o.renderOverlay(r.o));
  } catch (e: any) {
    console.error(e);
    html = `<div class="overlay-main"><p class="text-bad">Failed to render ${ref}: ${escapeHtml(String(e?.message ?? e))}</p></div>`;
  }
  return { html, jobs: DMI.takeContentJobs(), kind: r.kind, o: r.o };
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
  // the Calculated section goes right under the stat card
  root.querySelectorAll<HTMLElement>('.calc-section').forEach((sec) => {
    sec.closest('.overlay-contents')?.querySelector('.ucard')?.after(sec);
  });
  root.querySelectorAll<HTMLImageElement>('img').forEach(fixImage);
  root.querySelectorAll<HTMLTableElement>('table.overlay-table').forEach((t) => {
    const first = t.rows[0];
    if (first && /background/.test(first.getAttribute('style') ?? '')) t.classList.add('equip-table');
  });
  groupFlags(root);
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
