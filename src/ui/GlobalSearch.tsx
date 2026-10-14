import * as Dialog from '@radix-ui/react-dialog';
import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { PAGES, type PageDef } from '../pages';
import type { DMI } from '../data/load';
import { useData } from '../state/data';
import { refFor } from '../state/results';
import { useView } from '../state/view';

export const useGlobalSearch = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

interface Entry {
  page: PageDef;
  ref: string;
  name: string;
  lname: string;
  sub: string;
  id: string;
  o: any;
}

function subtitle(page: PageDef, o: any): string {
  switch (page.id) {
    case 'unit':
      return [o.nationname, o.typechar].filter(Boolean).join(' · ');
    case 'spell':
      return [o.research, o.type].filter(Boolean).join(' · ');
    case 'item':
      return [o.type, o.constlevel === 12 ? 'unforgeable' : o.constlevel ? `constr ${o.constlevel}` : ''].filter(Boolean).join(' · ');
    case 'site':
      return [o.path, o.level !== undefined ? `level ${o.level}` : ''].filter(Boolean).join(' · ');
    case 'nation':
      return o.epithet ?? '';
    case 'independents':
      return o.info.recruits.slice(0, 4).map((u: any) => u.name).join(', ');
    case 'wpn':
      return o.wpnclass ?? '';
    case 'armor':
      return o.type ?? '';
    default:
      return '';
  }
}

function buildIndex(DMI: DMI): Entry[] {
  const out: Entry[] = [];
  for (const page of PAGES) {
    const grid = DMI[page.module]?.grid;
    if (!grid) continue;
    for (const o of grid.data()) {
      if (page.id === 'unit' && !Number.isInteger(Number(o.id))) continue; // per-nation duplicates
      if (page.id === 'unit' && o.name === 'Empty') continue;
      const name = page.id === 'event' ? String(o.description ?? '').slice(0, 90) : String(o.fullname || o.name || '');
      if (!name) continue;
      out.push({ page, ref: refFor(page.id, o), name, lname: name.toLowerCase(), sub: subtitle(page, o), id: String(o.id), o });
    }
  }
  return out;
}

function score(e: Entry, q: string): number {
  if (e.id === q) return 1000;
  const i = e.lname.indexOf(q);
  if (i < 0) return -1;
  let s = 100 - Math.min(i, 60);
  if (i === 0) s += 200;
  else if (e.lname[i - 1] === ' ' || e.lname[i - 1] === '(') s += 80;
  if (e.lname.length === q.length) s += 300;
  if (e.page.id === 'event') s -= 120; // events are long descriptions; rank below named things
  return s - e.lname.length * 0.2;
}

export function GlobalSearch() {
  const open = useGlobalSearch((s) => s.open);
  const setOpen = useGlobalSearch((s) => s.setOpen);
  const DMI = useData((s) => s.DMI);
  const version = useData((s) => s.version);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const index = useMemo(() => (open && DMI ? buildIndex(DMI) : []), [open, DMI, version]);

  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return [];
    const scored: [number, Entry][] = [];
    for (const e of index) {
      const s = score(e, ql);
      if (s >= 0) scored.push([s, e]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const top = scored.slice(0, 80).map((x) => x[1]);
    // group by page in nav order, keeping relevance order inside groups
    return PAGES.flatMap((p) => top.filter((e) => e.page === p).slice(0, 12));
  }, [q, index]);

  useEffect(() => setHi(0), [q]);
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  const choose = (e: Entry, pin: boolean) => {
    const v = useView.getState();
    if (pin) v.togglePin(e.ref);
    else {
      v.setPage(e.page.id);
      useView.getState().select(e.ref);
    }
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" />
        <Dialog.Content
          className="fixed left-1/2 top-[10vh] z-50 w-[640px] max-w-[94vw] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl animate-in"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Search everything</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search size={18} className="text-muted" />
            <input
              autoFocus
              className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
              placeholder="Search units, spells, items, sites, nations… (name or id)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHi((h) => Math.min(results.length - 1, h + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHi((h) => Math.max(0, h - 1));
                } else if (e.key === 'Enter' && results[hi]) {
                  e.preventDefault();
                  choose(results[hi], e.shiftKey);
                }
              }}
            />
            <span className="kbd">Esc</span>
          </div>
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
            {!q.trim() && (
              <div className="px-4 py-8 text-center text-sm text-muted">
                Type to search all {index.length.toLocaleString()} entries. <span className="kbd">Enter</span> opens ·{' '}
                <span className="kbd">Shift</span>+<span className="kbd">Enter</span> pins
              </div>
            )}
            {q.trim() && results.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted">Nothing found for “{q}”</div>}
            {results.map((e, i) => {
              const showGroup = e.page !== results[i - 1]?.page;
              const thumb = e.page.thumb && DMI ? e.page.thumb(e.o, DMI) : undefined;
              return (
                <div key={e.ref}>
                  {showGroup && (
                    <div className="section-label flex items-center gap-1.5 px-4 pb-1 pt-2.5">
                      <e.page.icon size={12} /> {e.page.label}
                    </div>
                  )}
                  <button
                    data-i={i}
                    className={'flex w-full items-center gap-3 px-4 py-1.5 text-left ' + (i === hi ? 'bg-row-hover' : '')}
                    onMouseMove={() => setHi(i)}
                    onClick={(ev) => choose(e, ev.shiftKey)}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                      {thumb ? <img src={thumb} alt="" className="sprite-thumb max-h-7 max-w-7" /> : <e.page.icon size={16} className="text-muted" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{e.name}</span>
                      {e.sub && <span className="block truncate text-xs text-muted">{e.sub}</span>}
                    </span>
                    <span className="text-xs tabular-nums text-muted">#{e.id}</span>
                    {i === hi && <CornerDownLeft size={14} className="text-muted" />}
                  </button>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
