import { X } from 'lucide-react';
import type { PageDef } from '../pages';
import type { DMI } from '../data/load';
import { useSettings } from '../state/settings';
import { useView, type Filters } from '../state/view';
import { nationLabel } from './FilterPanel';
import { UNIT_DERIVED, parseRange } from '../data/extensions/derived';

interface Chip {
  id: string;
  label: React.ReactNode;
  clear: Filters;
}

export function activeChips(page: PageDef, f: Filters, DMI: DMI, o: { advanced: boolean; moreInfo: boolean; customJs: boolean }): Chip[] {
  const chips: Chip[] = [];
  if (f.str) chips.push({ id: 'str', label: <>“{f.str}”</>, clear: { str: '' } });
  for (const d of page.filters) {
    if (d.type === 'nation' && f[d.key]) chips.push({ id: d.key, label: nationLabel(DMI, f[d.key]), clear: { [d.key]: '' } });
    if (d.type === 'select' && f[d.key]) {
      const opt = d.options.find((x) => x.value === f[d.key]);
      chips.push({ id: d.key, label: `${d.label}: ${opt?.label ?? f[d.key]}`, clear: { [d.key]: '' } });
    }
    if (d.type === 'scope') {
      if (f[d.nationalKey]) chips.push({ id: 'national', label: 'National only', clear: { [d.nationalKey]: false } });
      if (f[d.genericKey]) chips.push({ id: 'generic', label: 'Generic only', clear: { [d.genericKey]: false } });
    }
    if (d.type === 'paths' && f[d.key]) {
      chips.push({
        id: d.key,
        label: (
          <span className="inline-flex items-center gap-0.5">
            {String(f[d.key])
              .split('')
              .map((p) => (
                <span key={p} className={`${d.icon === 'Gem' ? 'gemicon Gem_' : 'pathicon Path_'}${p}`}>
                  {p}
                </span>
              ))}
            {d.inclusiveKey && f[d.inclusiveKey] ? <span className="ml-1 text-muted">(either)</span> : null}
          </span>
        ),
        clear: { [d.key]: '', ...(d.inclusiveKey ? { [d.inclusiveKey]: false } : {}) },
      });
    }
    if (d.type === 'pathLevels' && f[d.key]) {
      const lv = f[d.key] as Record<string, number>;
      chips.push({
        id: d.key,
        label: (
          <span className="inline-flex items-center gap-1">
            ≤
            {Object.entries(lv).map(([p, n]) => (
              <span key={p} className="inline-flex items-center">
                <span className={`pathicon Path_${p}`}>{p}</span>
                {n}
              </span>
            ))}
          </span>
        ),
        clear: { [d.key]: '' },
      });
    }
    if (d.type === 'number' && o.moreInfo && f[d.key]) chips.push({ id: d.key, label: `${d.label} ${f[d.key]}`, clear: { [d.key]: '' } });
    if (d.type === 'calculated') {
      for (const c of UNIT_DERIVED) {
        const r = parseRange(f[c.field]);
        if (!r) continue;
        const range = r.min !== undefined && r.max !== undefined ? `${r.min}–${r.max}` : r.min !== undefined ? `≥ ${r.min}` : `≤ ${r.max}`;
        chips.push({ id: c.field, label: `${c.shortLabel} ${range}`, clear: { [c.field]: '' } });
      }
    }
  }
  if (o.advanced && Array.isArray(f.properties)) {
    f.properties.forEach((p: any, i: number) => {
      if (!p.key) return;
      chips.push({
        id: 'prop' + i,
        label: (
          <span className="font-mono">
            {p.not ? '!' : ''}
            {p.key} {p.comp} {p.val}
          </span>
        ),
        clear: { properties: f.properties.filter((_: any, j: number) => j !== i) },
      });
    });
  }
  if (o.advanced && o.customJs && f.customjs) chips.push({ id: 'customjs', label: 'Custom JS', clear: { customjs: '' } });
  return chips;
}

export function ActiveFilters({ page, DMI }: { page: PageDef; DMI: DMI }) {
  const filters = useView((s) => s.filters[page.id]) ?? {};
  const patch = useView((s) => s.patchFilters);
  const reset = useView((s) => s.resetFilters);
  const advanced = useSettings((s) => s.advanced);
  const moreInfo = useSettings((s) => s.moreInfo);
  const customJs = useSettings((s) => s.customJs);
  const chips = activeChips(page, filters, DMI, { advanced, moreInfo, customJs });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span key={c.id} className="chip pr-1">
          {c.label}
          <button className="rounded-full p-0.5 text-muted hover:bg-row-hover hover:text-fg" onClick={() => patch(c.clear)} aria-label="Remove filter">
            <X size={11} />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => reset()}>
          Clear all
        </button>
      )}
    </div>
  );
}
