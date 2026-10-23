// New in this app: the "Province" panel of the Events page eligibility checker.
// Describe a province; the events table narrows to events that could fire there (see eventEligibility.ts).
// State lives in the page filters under `p_*` keys (plus the shared `story` key), so it is in the URL.
import { ChevronDown, ChevronRight, Minus, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ELIGIBILITY_KEYS, MONTHS, ORDERS, PATH_LETTERS, SCALES, SEASONS, TERRAINS, checkEvent, eligibilitySummary, eventOdds,
  formatPaths, hasProvinceState, parsePaths, parseProvinceState, type CheckResult,
} from '../data/extensions/eventEligibility';

export interface EventEligibilityProps {
  values: Record<string, any>;
  set: (key: string, value: string | undefined) => void;
  DMI: any;
  /** start expanded (default: expanded when a province is described) */
  defaultOpen?: boolean;
}

const PATH_TITLES: Record<string, string> = {
  F: 'Fire', A: 'Air', W: 'Water', E: 'Earth', S: 'Astral', D: 'Death', N: 'Nature', G: 'Glamour', B: 'Blood', H: 'Holy',
};

export function EventEligibility({ values, set, DMI, defaultOpen }: EventEligibilityProps) {
  const active = hasProvinceState(values);
  const [open, setOpen] = useState(defaultOpen ?? active);
  const v = (k: string) => (values[k] === undefined || values[k] === null ? '' : String(values[k]));
  const setv = (k: string, x: string | number | undefined) => set(k, x === undefined || x === '' ? undefined : String(x));

  const stats = useMemo(() => {
    const s = parseProvinceState(values, DMI);
    if (!s) return null;
    const events: any[] = DMI?.modctx?.eventdata ?? [];
    let eligible = 0;
    let possible = 0;
    for (const o of events) {
      const r = checkEvent(o, s);
      if (r.verdict === 'eligible') eligible++;
      if (r.verdict !== 'blocked') possible++;
    }
    return { eligible, possible, total: events.length };
  }, [values, DMI]);

  const reset = () => ELIGIBILITY_KEYS.forEach((k) => values[k] !== undefined && set(k, undefined));

  return (
    <div className="rounded-md border border-line">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button className="flex flex-1 items-center gap-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
          <span className="section-label" title="Describe a province: events that cannot fire there are hidden">
            Province eligibility
          </span>
          {active && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-accent" />}
        </button>
        {active && (
          <button className="rounded p-0.5 text-muted hover:bg-row-hover hover:text-fg" onClick={reset} title="Reset province" aria-label="Reset province">
            <X size={13} />
          </button>
        )}
      </div>
      {stats && (
        <div className="px-2 pb-1.5 text-[11px] text-muted" title="possible = no requirement fails; eligible = every requirement is modelled and met">
          {stats.possible} of {stats.total} possible · {stats.eligible} fully eligible
        </div>
      )}
      {open && (
        <div className="flex flex-col gap-3 border-t border-line p-2">
          <Row label="Owner">
            <NationSelect DMI={DMI} value={v('p_nation')} onChange={(x) => setv('p_nation', x)} />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Turn">
              <NumBox value={v('p_turn')} onChange={(x) => setv('p_turn', x)} placeholder="any" min={1} />
            </Row>
            <Row label="Season / month">
              <select
                className="input px-1.5 py-1 text-xs"
                value={v('p_month') ? 'm' + v('p_month') : v('p_season') ? 's' + v('p_season') : ''}
                onChange={(e) => {
                  const x = e.target.value;
                  setv('p_month', x[0] === 'm' ? x.slice(1) : undefined);
                  setv('p_season', x[0] === 's' ? x.slice(1) : undefined);
                }}
              >
                <option value="">Any</option>
                {SEASONS.map((s, i) => (
                  <optgroup key={s} label={s}>
                    <option value={'s' + i}>{s} (any month)</option>
                    {MONTHS.slice(i * 3, i * 3 + 3).map((m, j) => (
                      <option key={m} value={'m' + (i * 3 + j)}>
                        {m}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Row>
          </div>
          <Row label="Story events setting">
            <Choice
              value={v('story') || 'all'}
              options={[
                ['off', 'Off'],
                ['minor', 'Minor'],
                ['all', 'All'],
              ]}
              onChange={(x) => setv('story', x === 'all' ? undefined : x)}
            />
          </Row>

          <Row label="Scales">
            <div className="flex flex-col gap-1">
              {SCALES.map(([axis, pos, neg]) => (
                <Stepper
                  key={axis}
                  value={v('p_' + axis)}
                  min={-3}
                  max={3}
                  onChange={(x) => setv('p_' + axis, x)}
                  left={neg}
                  right={pos}
                  show={(n) => (n === 0 ? 'neutral' : n > 0 ? `${pos} ${n}` : `${neg} ${-n}`)}
                />
              ))}
            </div>
          </Row>
          <Row label="Dominion" hint="candles: own dominion to the right, enemy dominion to the left">
            <Stepper value={v('p_dom')} min={-10} max={10} onChange={(x) => setv('p_dom', x)} left="Enemy" right="Own" show={(n) => (n === 0 ? 'none' : n > 0 ? `own ${n}` : `enemy ${-n}`)} />
          </Row>

          <Row label="Terrain" hint="when any terrain is picked, the others count as absent; land unless Sea is picked">
            <div className="flex flex-wrap gap-1">
              {TERRAINS.map(([flag, label]) => {
                const cur = v('p_terrain').split(',').filter(Boolean);
                const on = cur.includes(flag);
                return (
                  <Chip
                    key={flag}
                    on={on}
                    onClick={() => setv('p_terrain', (on ? cur.filter((x) => x !== flag) : [...cur, flag]).join(','))}
                  >
                    {label}
                  </Chip>
                );
              })}
            </div>
          </Row>

          <Row label="Buildings" hint="click to cycle: any → yes → no">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['p_fort', 'Fort'],
                  ['p_temple', 'Temple'],
                  ['p_lab', 'Lab'],
                  ['p_capital', 'Capital'],
                ] as const
              ).map(([k, label]) => (
                <TriChip key={k} label={label} value={v(k)} onChange={(x) => setv(k, x)} />
              ))}
            </div>
          </Row>

          <div className="grid grid-cols-2 gap-2">
            <Row label="Population">
              <NumBox value={v('p_pop')} onChange={(x) => setv('p_pop', x)} placeholder="any" min={0} />
            </Row>
            <Row label="Unrest">
              <NumBox value={v('p_unrest')} onChange={(x) => setv('p_unrest', x)} placeholder="any" min={0} />
            </Row>
            <Row label="Province defence">
              <NumBox value={v('p_pd')} onChange={(x) => setv('p_pd', x)} placeholder="any" min={0} />
            </Row>
            <Row label="Troops present">
              <NumBox value={v('p_troops')} onChange={(x) => setv('p_troops', x)} placeholder="any" min={0} />
            </Row>
          </div>

          <Row label="Commander" hint="a commander in the province: their order and magic paths (best mage levels present)">
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1">
                <TriChip label="Present" value={v('p_cmd')} onChange={(x) => setv('p_cmd', x)} />
                <select className="input min-w-0 flex-1 px-1.5 py-1 text-xs" value={v('p_cmdorder')} onChange={(e) => setv('p_cmdorder', e.target.value)} aria-label="Commander order">
                  <option value="">Any order</option>
                  {ORDERS.map(([n, label]) => (
                    <option key={n} value={n}>
                      {label}
                      {n >= 100 ? ' (event)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <PathLevels value={v('p_paths')} onChange={(x) => setv('p_paths', x)} />
            </div>
          </Row>

          <div className="flex flex-col gap-1.5 text-xs text-muted">
            <label className="flex cursor-pointer items-center gap-2" title="hide events with requirements this panel cannot check (units, sites, world codes…)">
              <Switch checked={v('p_strict') === '1'} onChange={(c) => setv('p_strict', c ? '1' : undefined)} />
              Only fully modelled events
            </label>
            <label className="flex cursor-pointer items-center gap-2" title="hide follow-ups that need an event chain already running in this province">
              <Switch checked={v('p_nochain') === '1'} onChange={(c) => setv('p_nochain', c ? '1' : undefined)} />
              Hide storyline follow-ups
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-muted" title={hint}>
        {label}
      </div>
      {children}
    </div>
  );
}

function NumBox({ value, onChange, placeholder, min }: { value: string; onChange: (v: string) => void; placeholder?: string; min?: number }) {
  return (
    <input
      className="input px-1.5 py-1 text-xs tabular-nums"
      inputMode="numeric"
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        const x = e.target.value.replace(/[^\d-]/g, '');
        onChange(min !== undefined && x !== '' && parseInt(x, 10) < min ? String(min) : x);
      }}
    />
  );
}

function Choice({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-md border border-line bg-raised p-0.5" role="radiogroup">
      {options.map(([val, label]) => (
        <button
          key={val}
          role="radio"
          aria-checked={value === val}
          className={'flex-1 rounded px-2 py-1 text-xs transition-colors ' + (value === val ? 'bg-accent text-white shadow-sm dark:text-bg' : 'text-muted hover:text-fg')}
          onClick={() => onChange(val)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={'rounded-md border px-1.5 py-0.5 text-xs transition-colors ' + (on ? 'border-accent bg-accent/15 text-fg' : 'border-line bg-raised text-muted hover:text-fg')}
    >
      {children}
    </button>
  );
}

/** any → yes ('1') → no ('0') → any */
function TriChip({ label, value, onChange }: { label: string; value: string; onChange: (v: string | undefined) => void }) {
  const next = value === '' ? '1' : value === '1' ? '0' : undefined;
  const cls = value === '1' ? 'border-good bg-good/15 text-fg' : value === '0' ? 'border-bad bg-bad/10 text-bad line-through' : 'border-line bg-raised text-muted hover:text-fg';
  return (
    <button
      className={'rounded-md border px-1.5 py-0.5 text-xs transition-colors ' + cls}
      onClick={() => onChange(next)}
      title={`${label}: ${value === '1' ? 'yes' : value === '0' ? 'no' : 'any'} (click to change)`}
    >
      {label}
      {value === '1' ? ' ✓' : value === '0' ? ' ✗' : ''}
    </button>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
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

function Stepper({
  value, min, max, onChange, left, right, show,
}: {
  value: string;
  min: number;
  max: number;
  onChange: (v: string | undefined) => void;
  left: string;
  right: string;
  show: (n: number) => string;
}) {
  const set = value !== '';
  const n = set ? parseInt(value, 10) : 0;
  const step = (d: number) => onChange(String(Math.max(min, Math.min(max, (set ? n : 0) + d))));
  return (
    <div className={'flex items-center gap-1 rounded-md border px-1 py-0.5 text-xs ' + (set ? 'border-accent/70 bg-accent/10' : 'border-line bg-raised')}>
      <button className="flex items-center gap-0.5 px-0.5 text-muted hover:text-fg" onClick={() => step(-1)} aria-label={`More ${left}`} title={`towards ${left}`}>
        <Minus size={11} />
      </button>
      <span className="w-16 shrink-0 truncate text-[11px] text-muted">{left}</span>
      <button className="min-w-0 flex-1 truncate text-center font-medium tabular-nums" onClick={() => onChange(undefined)} title={set ? 'click to clear' : 'not set'}>
        {set ? show(n) : <span className="text-muted">any</span>}
      </button>
      <span className="w-16 shrink-0 truncate text-right text-[11px] text-muted">{right}</span>
      <button className="flex items-center gap-0.5 px-0.5 text-muted hover:text-fg" onClick={() => step(1)} aria-label={`More ${right}`} title={`towards ${right}`}>
        <Plus size={11} />
      </button>
    </div>
  );
}

function PathLevels({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const lv = parsePaths(value);
  const setLv = (p: string, n: number) => onChange(formatPaths({ ...lv, [p]: Math.max(0, Math.min(9, n)) }));
  return (
    <div className="grid grid-cols-5 gap-1">
      {PATH_LETTERS.split('').map((p) => {
        const n = lv[p] ?? 0;
        return (
          <div key={p} className={'flex flex-col items-center rounded-md border py-1 ' + (n ? 'border-accent/70 bg-accent/10' : 'border-line bg-raised')} title={`${PATH_TITLES[p]} ${n}`}>
            <span className={`pathicon Path_${p} !h-4 !w-4`}>{p}</span>
            <div className="mt-0.5 flex items-center">
              <button className="px-0.5 text-muted hover:text-fg" onClick={() => setLv(p, n - 1)} aria-label={`Lower ${PATH_TITLES[p]}`}>
                <Minus size={11} />
              </button>
              <span className="w-3 text-center text-xs font-semibold tabular-nums">{n}</span>
              <button className="px-0.5 text-muted hover:text-fg" onClick={() => setLv(p, n + 1)} aria-label={`Raise ${PATH_TITLES[p]}`}>
                <Plus size={11} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NationSelect({ DMI, value, onChange }: { DMI: any; value: string; onChange: (v: string) => void }) {
  const groups: { label: string; nations: { id: number; name: string }[] }[] = DMI?.modctx?.nationOptions ?? [];
  return (
    <div className="relative">
      <select className="input appearance-none py-1 pr-7 text-xs" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Province owner">
        <option value="">Any owner</option>
        <option value="indep">Independents</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label[0].toUpperCase() + g.label.slice(1)}>
            {g.nations.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

const TONE: Record<string, string> = {
  good: 'border-good/60 bg-good/10 text-good',
  bad: 'border-bad/60 bg-bad/10 text-bad',
  unknown: 'border-line bg-raised text-muted',
};

/** Compact per-event verdict ("eligible", "blocked · Luck ≥ 2", "possible · 3 unmodelled"); null without a province. */
export function EligibilityBadge({ o, filters, DMI, showOdds }: { o: any; filters: Record<string, any>; DMI?: any; showOdds?: boolean }) {
  const s = parseProvinceState(filters, DMI);
  if (!s || !o?.ev) return null;
  const r: CheckResult = checkEvent(o, s);
  const sum = eligibilitySummary(r);
  const odds = showOdds ? eventOdds(o, s) : null;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={'whitespace-nowrap rounded border px-1 py-px text-[11px] ' + TONE[sum.tone]} title={sum.title}>
        {sum.text}
      </span>
      {odds && (
        <span className="whitespace-nowrap text-[11px] text-muted" title={odds.parts.join('\n')}>
          {odds.text}
        </span>
      )}
    </span>
  );
}
