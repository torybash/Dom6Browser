// In-game style tooltips for the unit card's stat rows: merges the legacy row title with any derived
// (calculated) values shown for that stat. The floating widget (statTip.ts) reads the <template>.
import { escapeHtml } from './legacy';

function labelText(row: HTMLElement): string {
  const label = row.querySelector('.ustat-label')?.cloneNode(true) as HTMLElement | undefined;
  if (!label) return '';
  label.querySelectorAll('.internal-inline').forEach((e) => e.remove());
  return (label.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function derivedHtml(rows: HTMLElement[]): string {
  let html = '<dl class="tip-derived">';
  for (const r of rows) {
    const d = r.dataset;
    html += `<dt class="tip-label">${escapeHtml(d.label ?? '')}</dt>`;
    html += `<dd class="tip-value${d.likely ? ' tip-likely' : ''}">${escapeHtml(d.value ?? '')}</dd>`;
    html += `<dd class="tip-formula">${escapeHtml(d.formula ?? '')}</dd>`;
    html += `<dd class="tip-source">${escapeHtml('Source: ' + (d.source ?? '') + (d.note ? ' · ' + d.note : ''))}</dd>`;
  }
  return html + '</dl>';
}

export function attachStatTips(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.overlay-contents').forEach((contents) => {
    const calc = Array.from(contents.querySelectorAll<HTMLElement>('.calc-row[data-stat]'));
    contents.querySelectorAll<HTMLElement>('.ustat:not(.calc-row)').forEach((row) => {
      if (row.querySelector(':scope > template.stat-tip-src')) return;
      const key = row.dataset.key;
      const derived = key ? calc.filter((c) => c.dataset.stat === key) : [];
      const title = row.getAttribute('title')?.trim() ?? '';
      if (!title && !derived.length) return;
      let html = `<div class="tip-head">${escapeHtml(labelText(row))}</div>`;
      if (title) html += `<div class="tip-text">${escapeHtml(title).replace(/\r?\n/g, '<br>')}</div>`;
      if (derived.length) html += derivedHtml(derived);
      const tpl = document.createElement('template');
      tpl.className = 'stat-tip-src';
      tpl.innerHTML = html;
      row.dataset.tip = '1';
      row.tabIndex = 0;
      row.removeAttribute('title');
      if (derived.length) row.classList.add('has-derived');
      row.appendChild(tpl);
    });
  });
}
