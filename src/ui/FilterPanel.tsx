import { ChevronDown, Plus, RotateCcw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FilterDef, PageDef } from '../pages';
import type { DMI } from '../data/load';
import { useSettings } from '../state/settings';
import { useView, type Filters, type PropertyFilter } from '../state/view';
import { tableApi } from './ResultsTable';
import { EventEligibility } from './EventEligibility';
import { NationPicker } from './NationPicker';
import { isCasterSet } from '../data/extensions/casterLevels';

interface Props {
  page: PageDef;
  DMI: DMI;
}

export function FilterPanel({ page, DMI }: Props) {
  const filters = useView((s) => s.filters[page.id]) ?? EMPTY;
  const setFilter = useView((s) => s.setFilter);
  const patch = useView((s) => s.patchFilters);
  const advanced = useSettings((s) => s.advanced);
  const customJs = useSettings((s) => s.customJs);

  const visible = page.filters.filter((d) => !(d.type === 'number' && d.advanced && !advanced));
  const numbers = visible.filter((d) => d.type === 'number');
  const others = visible.filter((d) => d.type !== 'number');

  return (
    <div className="flex flex-col gap-4 p-3">
      <SearchBox page={page} value={filters.str ?? ''} onChange={(v) => setFilter('str', v)} />
      {others.map((d) => (
        <FilterControl key={keyOf(d)} def={d} filters={filters} DMI={DMI} setFilter={setFilter} patch={patch} />
      ))}
      {page.id === 'event' && <EventEligibility values={filters} set={(k, v) => setFilter(k, v ?? '')} DMI={DMI} />}
      {numbers.length > 0 && (
        <Section label="Effect masks" active={numbers.some((d) => d.type === 'number' && filters[d.key])} onReset={() => patch(Object.fromEntries(numbers.map((d) => [(d as any).key, ''])))}>
          <div className="grid grid-cols-3 gap-2">
            {numbers.map((d) => d.type === 'number' && <NumberField key={d.key} def={d} value={filters[d.key] ?? ''} onChange={(v) => setFilter(d.key, v)} />)}
          </div>
        </Section>
      )}
      {advanced && <PropertyFilters page={page} DMI={DMI} value={filters.properties ?? []} onChange={(v) => setFilter('properties', v)} />}
      {advanced && customJs && <CustomJs value={filters.customjs ?? ''} onChange={(v) => setFilter('customjs', v)} DMI={DMI} />}
    </div>
  );
}

const EMPTY: Filters = {};
const keyOf = (d: FilterDef) => (d.type === 'scope' ? d.type : d.key);

function Section({ label, active, onReset, children, hint }: { label: string; active: boolean; onReset: () => void; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex h-5 items-center justify-between">
        <span className="section-label" title={hint}>
          {label}
        </span>
        {active && (
          <button className="rounded p-0.5 text-muted hover:bg-row-hover hover:text-fg" onClick={onReset} title={`Reset ${label.toLowerCase()}`} aria-label={`Reset ${label}`}>
            <X size={13} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function SearchBox({ page, value, onChange }: { page: PageDef; value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  // debounce typing a little; filtering 4000 units is fast but re-rendering the table is not free
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), 120);
    return () => clearTimeout(t);
  }, [local, value, onChange]);

  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        id="page-search"
        className="input pl-8 pr-8"
        placeholder={`Search ${page.label.toLowerCase()} by name or id`}
        value={local}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setLocal(e.target.value)}
        onKeyDown={(e) => {
          if (e.ctrlKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            tableApi.move?.(e.key === 'ArrowDown' ? 1 : -1);
          } else if (e.key === 'Enter') {
            tableApi.move?.(0);
          } else if (e.key === 'Escape' && local) {
            e.stopPropagation();
            setLocal('');
            onChange('');
          } else stepNumeric(e, local, (v) => setLocal(v));
        }}
      />
      {local && (
        <button
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg"
          onClick={() => {
            setLocal('');
            onChange('');
          }}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** upstream: numpad +/- increments/decrements numbers in text boxes */
function stepNumeric(e: React.KeyboardEvent, value: string, set: (v: string) => void, mask = false) {
  if (e.code !== 'NumpadAdd' && e.code !== 'NumpadSubtract') return;
  e.preventDefault();
  const n = parseInt(value) || (mask ? 1 : 0);
  if (mask) set(String(e.code === 'NumpadAdd' ? n * 2 : Math.max(1, Math.ceil(n / 2))));
  else set(String(e.code === 'NumpadAdd' ? n + 1 : n - 1));
}

interface ControlProps {
  def: FilterDef;
  filters: Filters;
  DMI: DMI;
  setFilter: (k: string, v: any) => void;
  patch: (p: Filters) => void;
}

function FilterControl({ def, filters, DMI, setFilter, patch }: ControlProps) {
  switch (def.type) {
    case 'nation':
      return (
        <Section label="Nation / era" active={!!filters[def.key]} onReset={() => setFilter(def.key, '')}>
          <NationPicker DMI={DMI} value={filters[def.key] ?? ''} onChange={(v) => setFilter(def.key, v)} />
        </Section>
      );
    case 'select':
      return (
        <Section label={def.label} active={!!filters[def.key]} onReset={() => setFilter(def.key, '')}>
          <div className="relative">
            <select className="input appearance-none pr-8" value={filters[def.key] ?? ''} onChange={(e) => setFilter(def.key, e.target.value)}>
              {def.options.map((o) =>
                o.divider ? (
                  <option key={o.value} disabled>
                    ──────────
                  </option>
                ) : (
                  <option key={o.value} value={o.value} title={o.title}>
                    {o.label}
                  </option>
                ),
              )}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        </Section>
      );
    case 'segmented':
      return (
        <Section label={def.label} active={!!filters[def.key]} onReset={() => setFilter(def.key, '')} hint={def.hint}>
          <Segmented value={filters[def.key] ?? ''} options={def.options} onChange={(v) => setFilter(def.key, v)} />
        </Section>
      );
    case 'multi': {
      const sel = String(filters[def.key] ?? '').split(',').filter(Boolean);
      const toggle = (v: string) => {
        const next = sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v];
        // keep the option order so the URL is stable
        setFilter(def.key, def.options.map((o) => o.value).filter((x) => next.includes(x)).join(','));
      };
      return (
        <Section label={def.label} active={sel.length > 0} onReset={() => setFilter(def.key, '')} hint={def.hint}>
          <div className="filter-chips">
            {def.options.map((o) => {
              const on = sel.includes(o.value);
              return (
                <button key={o.value} aria-pressed={on} title={o.title ?? o.label} className={'filter-chip ' + (o.className ?? '') + (on ? ' on' : '')} onClick={() => toggle(o.value)}>
                  {o.icon && <span className="filter-chip-icon" dangerouslySetInnerHTML={{ __html: o.icon }} />}
                  <span>{o.label}</span>
                </button>
              );
            })}
          </div>
        </Section>
      );
    }
    case 'dataSelect':
      return (
        <Section label={def.label} active={!!filters[def.key]} onReset={() => setFilter(def.key, '')} hint={def.hint}>
          <div className="relative">
            <select className="input appearance-none pr-8" value={filters[def.key] ?? ''} onChange={(e) => setFilter(def.key, e.target.value)}>
              {def.options(DMI).map((o) => (
                <option key={o.value} value={o.value} title={o.title}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        </Section>
      );
    case 'range': {
      const clean = (v: string) => v.replace(/[^\d-]/g, '');
      if (def.single) {
        const v = String(filters[def.key] ?? '');
        return (
          <Section label={def.label} active={!!v} onReset={() => setFilter(def.key, '')} hint={def.hint}>
            <input className="input w-24 px-2 py-1 tabular-nums" inputMode="numeric" placeholder={def.placeholder} aria-label={def.label} value={v} onChange={(e) => setFilter(def.key, clean(e.target.value))} onKeyDown={(e) => stepNumeric(e, v, (n) => setFilter(def.key, n))} />
          </Section>
        );
      }
      const [min = '', max = ''] = String(filters[def.key] ?? '').split('~');
      const set = (lo: string, hi: string) => setFilter(def.key, lo || hi ? `${lo}~${hi}` : '');
      return (
        <Section label={def.label} active={!!(min || max)} onReset={() => setFilter(def.key, '')} hint={def.hint}>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <input className="input w-20 px-2 py-1 tabular-nums" inputMode="numeric" placeholder="min" aria-label={`${def.label} minimum`} value={min} onChange={(e) => set(clean(e.target.value), max)} />
            –
            <input className="input w-20 px-2 py-1 tabular-nums" inputMode="numeric" placeholder="max" aria-label={`${def.label} maximum`} value={max} onChange={(e) => set(min, clean(e.target.value))} />
          </div>
        </Section>
      );
    }
    case 'scope': {
      const v = filters[def.nationalKey] ? 'national' : filters[def.genericKey] ? 'generic' : '';
      return (
        <Section label="Scope" active={!!v} onReset={() => patch({ [def.nationalKey]: false, [def.genericKey]: false })}>
          <Segmented
            value={v}
            options={[
              { value: '', label: 'All' },
              { value: 'national', label: 'National' },
              { value: 'generic', label: 'Generic' },
            ]}
            onChange={(nv) => patch({ [def.nationalKey]: nv === 'national', [def.genericKey]: nv === 'generic' })}
          />
        </Section>
      );
    }
    case 'paths': {
      const sel: string = filters[def.key] ?? '';
      return (
        <Section label={def.label} active={!!sel || (def.inclusiveKey ? !!filters[def.inclusiveKey] : false)} onReset={() => patch({ [def.key]: '', ...(def.inclusiveKey ? { [def.inclusiveKey]: false } : {}) })}>
          <div className="flex flex-wrap gap-1">
            {def.paths.split('').map((p) => {
              const on = sel.includes(p);
              return (
                <button
                  key={p}
                  aria-pressed={on}
                  title={PATH_NAMES[p]}
                  className={'flex h-8 w-8 items-center justify-center rounded-md border transition-colors ' + (on ? 'border-accent bg-accent/15' : 'border-line bg-raised opacity-70 hover:opacity-100')}
                  onClick={() => setFilter(def.key, on ? sel.replace(p, '') : orderPaths(sel + p))}
                >
                  <span className={`${def.icon === 'Gem' ? 'gemicon Gem_' : 'pathicon Path_'}${p} !h-[18px] !w-[18px]`}>{p}</span>
                </button>
              );
            })}
          </div>
          {def.inclusiveKey && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted" title="match spells/items where either path is selected (otherwise all of their paths must be selected)">
              <Toggle checked={!!filters[def.inclusiveKey]} onChange={(c) => setFilter(def.inclusiveKey!, c)} />
              Inclusive (either path matches)
            </label>
          )}
        </Section>
      );
    }
    case 'pathLevels': {
      const lv: Record<string, number> = filters[def.key] ?? {};
      const active = isCasterSet(lv);
      return (
        <Section
          label={def.label}
          active={active || !!filters[def.boostKey]}
          onReset={() => patch({ [def.key]: '', [def.boostKey]: '' })}
          hint="the path levels your mage has; every other path counts as 0. Shows only what that mage can cast / forge"
        >
          <CasterPips paths={def.paths} value={lv} onChange={(v) => setFilter(def.key, isCasterSet(v) ? v : '')} />
          {active && (
            <div className="mt-2 flex items-center gap-2" title="also show entries the mage could reach with this many extra levels from boosters (shown dimmed)">
              <span className="shrink-0 text-xs text-muted">Boost</span>
              <Segmented
                value={String(filters[def.boostKey] ?? '')}
                options={[
                  { value: '', label: '+0' },
                  { value: '1', label: '+1' },
                  { value: '2', label: '+2' },
                ]}
                onChange={(v) => setFilter(def.boostKey, v)}
              />
            </div>
          )}
        </Section>
      );
    }
    default:
      return null;
  }
}

const PIPS = 9;

/** One row of pips per path: clicking pip n sets that path to n, clicking the current top pip clears it. */
function CasterPips({ paths, value, onChange }: { paths: string; value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const [hover, setHover] = useState<[string, number] | null>(null);
  const set = (p: string, n: number) => {
    const next = { ...value };
    if (n > 0) next[p] = n;
    else delete next[p];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-px" onMouseLeave={() => setHover(null)}>
      {paths.split('').map((p) => {
        const n = value[p] ?? 0;
        const shown = hover?.[0] === p ? hover[1] : n;
        return (
          <div key={p} className="flex h-5 items-center gap-1.5" role="radiogroup" aria-label={PATH_NAMES[p]}>
            <span className={`pathicon Path_${p} !h-4 !w-4 shrink-0 ${n ? '' : 'opacity-50'}`} title={PATH_NAMES[p]}>
              {p}
            </span>
            <div className="flex items-center">
              {Array.from({ length: PIPS }, (_, i) => i + 1).map((k) => (
                <button
                  key={k}
                  role="radio"
                  aria-checked={n === k}
                  aria-label={`${PATH_NAMES[p]} ${k}`}
                  title={n === k ? `Clear ${PATH_NAMES[p]}` : `${PATH_NAMES[p]} ${k}`}
                  className={'group flex h-5 items-center px-[2px] ' + (k === 6 ? 'ml-1' : '')}
                  onMouseEnter={() => setHover([p, k])}
                  onClick={() => set(p, n === k ? 0 : k)}
                >
                  <span
                    className={
                      'block h-2.5 w-2.5 rounded-full border transition-colors ' +
                      (k <= shown ? (hover?.[0] === p && k > n ? 'border-accent bg-accent/40' : 'border-accent bg-accent') : 'border-line bg-raised group-hover:border-muted')
                    }
                  />
                </button>
              ))}
            </div>
            <span className={'w-3 text-xs font-semibold tabular-nums ' + (n ? 'text-fg' : 'text-transparent')}>{n || 0}</span>
          </div>
        );
      })}
    </div>
  );
}

export const PATH_NAMES: Record<string, string> = {
  F: 'Fire', A: 'Air', W: 'Water', E: 'Earth', S: 'Astral', D: 'Death', N: 'Nature', G: 'Glamour', B: 'Blood', H: 'Holy',
};
const orderPaths = (s: string) => 'FAWESDNGBH'.split('').filter((p) => s.includes(p)).join('');

function NumberField({ def, value, onChange }: { def: Extract<FilterDef, { type: 'number' }>; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block" title={def.title}>
      <span className="mb-0.5 block text-[11px] text-muted">{def.label}</span>
      <input className="input px-2 py-1 tabular-nums" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, ''))} onKeyDown={(e) => stepNumeric(e, value, onChange, def.mask)} />
    </label>
  );
}

export function Segmented({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-md border border-line bg-raised p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={'flex-1 rounded px-2 py-1 text-xs transition-colors ' + (value === o.value ? 'bg-accent text-white shadow-sm dark:text-bg' : 'text-muted hover:text-fg')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (c: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      className={'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ' + (checked ? 'bg-accent' : 'bg-line')}
    >
      <span className={'inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ' + (checked ? 'translate-x-3.5' : 'translate-x-0.5')} />
    </button>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function PropertyFilters({ page, DMI, value, onChange }: { page: PageDef; DMI: DMI; value: PropertyFilter[]; onChange: (v: PropertyFilter[]) => void }) {
  const rows = value.length ? value : [{ key: '', comp: '=~' as const, val: '' }];
  const keys = useMemo(() => {
    const grid = DMI[page.module]?.grid;
    const set = new Set<string>();
    const data: any[] = grid?.data() ?? [];
    for (let i = 0; i < data.length; i += Math.max(1, Math.floor(data.length / 600))) Object.keys(data[i]).forEach((k) => set.add(k));
    Object.keys(DMI.propertyAliases ?? {}).forEach((k) => set.add(k));
    return Array.from(set).filter((k) => !/^(renderOverlay|matchProperty|searchable|titles)$/.test(k)).sort();
  }, [DMI, page]);

  const update = (i: number, p: Partial<PropertyFilter>) => {
    // rows with an empty key are ignored by the matcher (and dropped from the URL)
    onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  };

  return (
    <Section label="Property filters" active={value.some((r) => r.key)} onReset={() => onChange([])} hint="filter by any data key, e.g. holy, fireres >= 25, mpath =~ s[4-9]">
      <datalist id={`propkeys-${page.id}`}>
        {keys.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-1">
            <button
              className={'h-7 w-6 shrink-0 rounded border text-xs font-bold ' + (r.not ? 'border-bad bg-bad/10 text-bad' : 'border-line text-muted')}
              onClick={() => update(i, { not: !r.not })}
              title="not (invert this filter)"
              aria-pressed={!!r.not}
            >
              !
            </button>
            <input className="input min-w-0 flex-[1.3] px-1.5 py-1 font-mono text-xs" placeholder="key" list={`propkeys-${page.id}`} value={r.key} onChange={(e) => update(i, { key: e.target.value })} />
            <select className="input w-[52px] shrink-0 px-1 py-1 font-mono text-xs" value={r.comp} onChange={(e) => update(i, { comp: e.target.value as PropertyFilter['comp'] })} title="=~ regex match · == equals · >= / <= numeric">
              <option value="=~">=~</option>
              <option value="==">==</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
            </select>
            <input className="input min-w-0 flex-1 px-1.5 py-1 font-mono text-xs" placeholder="value" value={r.val} onChange={(e) => update(i, { val: e.target.value })} onKeyDown={(e) => stepNumeric(e, r.val, (v) => update(i, { val: v }))} />
            {rows.length > 1 && (
              <button className="shrink-0 rounded p-1 text-muted hover:text-fg" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove property filter">
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        <button className="btn-ghost justify-start px-1 text-xs" onClick={() => onChange([...rows, { key: '', comp: '=~', val: '' }])}>
          <Plus size={13} /> Add property filter
        </button>
      </div>
    </Section>
  );
}

function CustomJs({ value, onChange, DMI }: { value: string; onChange: (v: string) => void; DMI: DMI }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <Section label="Custom JS filter" active={!!value} onReset={() => onChange('')} hint="javascript expression evaluated per row; `o` is the row, num(v) parses numbers">
      <textarea className="input h-20 font-mono text-xs" placeholder="num(o.hp) > 30 && o.holy" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => onChange(local)} />
      <div className="mt-1 flex items-center justify-between">
        <span className="truncate text-xs text-bad">{DMI.customJsError}</span>
        <button className="btn-ghost px-1.5 py-0.5 text-xs" onClick={() => onChange(local)}>
          <RotateCcw size={12} /> Apply
        </button>
      </div>
    </Section>
  );
}
