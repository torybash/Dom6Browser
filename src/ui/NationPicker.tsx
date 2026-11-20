import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DMI } from '../data/load';
import { NationFlag } from './nationFlag';

export function nationLabel(DMI: DMI, v: string) {
  if (!v) return 'Any nation';
  if (v === 'EA') return 'Early era (all nations)';
  if (v === 'MA') return 'Middle era (all nations)';
  if (v === 'LA') return 'Late era (all nations)';
  const n = DMI.modctx.nationlookup[v];
  return n ? n.fullname : `Nation ${v}`;
}

type Option = { value: string; label: string; group?: string };

const ANY_NATION: Option[] = [{ value: '', label: 'Any nation' }];

export function NationPicker({ DMI, value, onChange, head = ANY_NATION, eras = true, className = '' }: {
  DMI: DMI;
  value: string;
  onChange: (v: string) => void;
  head?: Option[];
  eras?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const groups: { era: number; label: string; code: string; nations: { id: string; name: string }[] }[] = DMI.modctx.nationOptions ?? [];
    const ql = q.toLowerCase();
    const out = head.filter((h) => h.label.toLowerCase().includes(ql));
    for (const g of groups) {
      const eraItem = { value: g.code, label: `${g.label[0].toUpperCase()}${g.label.slice(1)} — all nations`, group: g.label };
      if (eras && eraItem.label.toLowerCase().includes(ql)) out.push(eraItem);
      for (const n of g.nations) {
        if (n.name.toLowerCase().includes(ql)) out.push({ value: String(n.id), label: n.name, group: g.label });
      }
    }
    return out;
  }, [DMI, q, head, eras]);

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
        <button className={'input flex items-center justify-between text-left ' + className} aria-haspopup="listbox">
          <span className={'truncate ' + (value ? '' : 'text-muted')}>
            <NationFlag id={value} />
            {head.find((h) => h.value === value)?.label ?? nationLabel(DMI, value)}
          </span>
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
                    <span className="truncate">
                      <NationFlag id={it.value} />
                      {it.label}
                    </span>
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
