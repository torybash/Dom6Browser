// The "Calculated" section of the unit card: values the game computes (patrol strength, upkeep, ...).
// Rendered as an html string inside the unit pane so the detail panel, hover previews and Compare
// (which diffs [data-key] rows) all get it from renderRef.
import { Calculator } from 'lucide-static';
import type { DMI } from '../data/load';
import { formatDerived } from '../data/extensions/derived/registry';
import { escapeHtml } from './legacy';

export function renderCalculatedHtml(DMI: DMI, o: any): string {
  const rows: { def: any; result: any }[] = DMI.Derived?.all(o) ?? [];
  if (!rows.length) return '';
  let approx = false;
  let html = '';
  let formulas = '';
  for (const { def, result } of rows) {
    const likely = result.confidence === 'LIKELY';
    approx ||= likely;
    const title = [
      def.formula,
      'Source: ' + def.source,
      likely ? '≈ not yet confirmed against the game' : '',
      result.note ?? '',
    ].filter(Boolean).join('\n');
    html +=
      `<div class="ustat calc-row${likely ? ' calc-likely' : ''}" data-key="${def.field}" data-stat="${escapeHtml(def.stat ?? '')}" data-label="${escapeHtml(def.label)}"` +
      ` data-value="${escapeHtml(formatDerived(def, result))}" data-formula="${escapeHtml(def.formula)}" data-source="${escapeHtml(def.source)}"` +
      `${result.note ? ` data-note="${escapeHtml(result.note)}"` : ''}${likely ? ' data-likely="1"' : ''} title="${escapeHtml(title)}">` +
      `<span class="ustat-label">${escapeHtml(def.label)}</span>` +
      `<span class="stat-value">${escapeHtml(formatDerived(def, result))}</span></div>`;
    formulas += `<dt>${escapeHtml(def.label)}</dt><dd>${escapeHtml(def.formula)} <span class="calc-source">(${escapeHtml(def.source)})</span></dd>`;
  }
  return (
    '<details class="calc-section">' +
    `<summary class="calc-head"><span class="uicon">${Calculator}</span><span class="calc-title">Calculated</span>` +
    '<span class="calc-sub">base unit: no items, scales or province effects</span></summary>' +
    `<div class="calc-grid">${html}</div>` +
    (approx ? '<p class="calc-legend">≈ formula not yet confirmed against the game. Hover a value for its formula.</p>' : '') +
    `<details class="calc-formulas"><summary>Formulas</summary><dl>${formulas}</dl></details>` +
    '</details>'
  );
}

/** Inserts the section into a rendered unit pane, before the footer. */
export function withCalculated(DMI: DMI, o: any, html: string): string {
  if (!o || !('calc_siege' in o)) return html;
  const section = renderCalculatedHtml(DMI, o);
  const at = html.indexOf('<div class="overlay-footer">');
  return section && at >= 0 ? html.slice(0, at) + section + html.slice(at) : html;
}
