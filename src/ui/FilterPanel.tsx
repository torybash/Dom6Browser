import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Minus, Plus, RotateCcw, Search, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { FilterDef, PageDef } from '../pages';
import type { DMI } from '../data/load';
import { useSettings } from '../state/settings';
import { useView, type Filters, type PropertyFilter } from '../state/view';
import { tableApi } from './ResultsTable';
import { UNIT_DERIVED, formatRange } from '../data/extensions/derived';

interface Props {
  page: PageDef;
  DMI: DMI;
}

export function FilterPanel({ page, DMI }: Props) {
  const filters = useView((s) => s.filters[page.id]) ?? EMPTY;
  const setFilter = useView((s) => s.setFilter);
  const patch = useView((s) => s.patchFilters);
  const advanced = useSettings((s) => s.advanced);
  const moreInfo = useSettings((s) => s.moreInfo);
  const customJs = useSettings((s) => s.customJs);

  const visible = page.filters.filter((d) => !(d.type === 'number' && d.moreInfo && !moreInfo));
  const numbers = visible.filter((d) => d.type === 'number');
  const others = visible.filter((d) => d.type !== 'number');

  return (
    <div className="flex flex-col gap-4 p-3">
      <SearchBox page={page} value={filters.str ?? ''} onChange={(v) => setFilter('str', v)} />
      {others.map((d) => (
        <FilterControl key={keyOf(d)} def={d} filters={filters} DMI={DMI} setFilter={setFilter} patch={patch} />
      ))}
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
const keyOf = (d: FilterDef) => (d.type === 'scope' || d.type === 'calculated' ? d.type : d.key);

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
    case 'calculated':
      return <CalculatedRanges filters={filters} patch={patch} />;
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
      const active = Object.values(lv).some((n) => n !== 9);
      const setLv = (p: string, n: number) => {
        const next = { ...lv, [p]: Math.max(0, Math.min(9, n)) };
        if (next[p] === 9) delete next[p];
        setFilter(def.key, Object.keys(next).length ? next : '');
      };
      return (
        <Section label={def.label} active={active} onReset={() => setFilter(def.key, '')} hint="hide entries needing a higher level than this in a path">
          <div className="grid grid-cols-5 gap-1">
            {def.paths.split('').map((p) => {
              const n = lv[p] ?? 9;
              return (
                <div key={p} className={'flex flex-col items-center rounded-md border py-1 ' + (n !== 9 ? 'border-accent/70 bg-accent/10' : 'border-line bg-raised')} title={`${PATH_NAMES[p]} ≤ ${n}`}>
                  <span className={`pathicon Path_${p} !h-4 !w-4`}>{p}</span>
                  <div className="mt-0.5 flex items-center">
                    <button className="px-0.5 text-muted hover:text-fg" onClick={() => setLv(p, n - 1)} aria-label={`Lower ${PATH_NAMES[p]}`}>
                      <Minus size={11} />
                    </button>
                    <span className="w-3 text-center text-xs font-semibold tabular-nums">{n}</span>
                    <button className="px-0.5 text-muted hover:text-fg" onClick={() => setLv(p, n + 1)} aria-label={`Raise ${PATH_NAMES[p]}`}>
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            className="mt-1.5 text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
            onClick={() => setFilter(def.key, Object.fromEntries(def.paths.split('').map((p) => [p, 0])))}
            title="set every path to 0, then raise the ones you have"
          >
            Set all to 0
          </button>
        </Section>
      );
    }
    default:
      return null;
  }
}

export const PATH_NAMES: Record<string, string> = {
  F: 'Fire', A: 'Air', W: 'Water', E: 'Earth', S: 'Astral', D: 'Death', N: 'Nature', G: 'Glamour', B: 'Blood', H: 'Holy',
};
const orderPaths = (s: string) => 'FAWESDNGBH'.split('').filter((p) => s.includes(p)).join('');

/** Min/max boxes for each calculated unit value; stored as "min..max" under the value's field. */
function CalculatedRanges({ filters, patch }: { filters: Filters; patch: (p: Filters) => void }) {
  const active = UNIT_DERIVED.some((d) => filters[d.field]);
  return (
    <Section
      label="Calculated values"
      hint="Values the game calculates; ≈ in the table marks formulas not yet confirmed in game"
      active={active}
      onReset={() => patch(Object.fromEntries(UNIT_DERIVED.map((d) => [d.field, ''])))}
    >
      <div className="grid grid-cols-[1fr_4rem_4rem] items-center gap-x-1.5 gap-y-1 text-xs">
        <span />
        <span className="text-[11px] text-muted">min</span>
        <span className="text-[11px] text-muted">max</span>
        {UNIT_DERIVED.map((d) => {
          const [min = '', max = ''] = String(filters[d.field] ?? '').split('..');
          const set = (lo: string, hi: string) => patch({ [d.field]: formatRange(lo, hi) });
          const box = (v: string, onChange: (v: string) => void, label: string) => (
            <input
              className="input px-1.5 py-0.5 tabular-nums"
              inputMode="decimal"
              aria-label={`${d.label} ${label}`}
              value={v}
              onChange={(e) => onChange(e.target.value.replace(/[^\d.-]/g, ''))}
            />
          );
          return (
            <Fragment key={d.id}>
              <span className="truncate" title={`${d.label}: ${d.formula}`}>
                {d.label}
              </span>
              {box(min, (v) => set(v, max), 'minimum')}
              {box(max, (v) => set(min, v), 'maximum')}
            </Fragment>
          );
        })}
      </div>
    </Section>
  );
}

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

export function nationLabel(DMI: DMI, v: string) {
  if (!v) return 'Any nation';
  if (v === 'EA') return 'Early era (all nations)';
  if (v === 'MA') return 'Middle era (all nations)';
  if (v === 'LA') return 'Late era (all nations)';
  const n = DMI.modctx.nationlookup[v];
  return n ? n.fullname : `Nation ${v}`;
}

function NationPicker({ DMI, value, onChange }: { DMI: DMI; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const groups: { era: number; label: string; code: string; nations: { id: string; name: string }[] }[] = DMI.modctx.nationOptions ?? [];
    const out: { value: string; label: string; group?: string }[] = [{ value: '', label: 'Any nation' }];
    const ql = q.toLowerCase();
    for (const g of groups) {
      const eraItem = { value: g.code, label: `${g.label[0].toUpperCase()}${g.label.slice(1)} — all nations`, group: g.label };
      if (!ql || eraItem.label.toLowerCase().includes(ql)) out.push(eraItem);
      for (const n of g.nations) {
        if (!ql || n.name.toLowerCase().includes(ql)) out.push({ value: String(n.id), label: n.name, group: g.label });
      }
    }
    return ql ? out.filter((i) => i.value !== '' || 'any nation'.includes(ql)) : out;
  }, [DMI, q]);

  useEffect(() => setHi(0), [q, open]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ('');
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="input flex items-center justify-between text-left" aria-haspopup="listbox">
          <span className={'truncate ' + (value ? '' : 'text-muted')}>{nationLabel(DMI, value)}</span>
          <ChevronDown size={14} className="shrink-0 text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[260px] rounded-lg border border-line bg-panel shadow-xl animate-in">
          <div className="border-b border-line p-2">
            <input
              autoFocus
              className="input"
              placeholder="Filter nations…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHi((h) => Math.min(items.length - 1, h + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHi((h) => Math.max(0, h - 1));
                } else if (e.key === 'Enter' && items[hi]) {
                  e.preventDefault();
                  choose(items[hi].value);
                }
              }}
            />
          </div>
          <div ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
            {items.map((it, i) => {
              const showGroup = it.group && it.group !== items[i - 1]?.group;
              return (
                <div key={it.value + it.label}>
                  {showGroup && <div className="section-label px-3 pb-0.5 pt-2">{it.group}</div>}
                  <button
                    data-i={i}
                    role="option"
                    aria-selected={value === it.value}
                    className={
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ' +
                      (i === hi ? 'bg-row-hover ' : '') +
                      (/all nations/.test(it.label) ? 'font-medium ' : '')
                    }
                    onMouseEnter={() => setHi(i)}
                    onClick={() => choose(it.value)}
                  >
                    <span className="w-3.5 shrink-0">{value === it.value && <Check size={14} className="text-accent" />}</span>
                    <span className="truncate">{it.label}</span>
                  </button>
                </div>
              );
            })}
            {items.length === 0 && <div className="px-3 py-4 text-center text-sm text-muted">No nations match</div>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
