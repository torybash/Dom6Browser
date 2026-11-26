// Single-key shortcuts and the keyboard help. Keys are matched by e.key, so they follow the keyboard
// layout; none of them needs AltGr on a Danish (or other Nordic) layout.
import * as Dialog from '@radix-ui/react-dialog';
import { Keyboard, X } from 'lucide-react';
import { create } from 'zustand';
import { PAGES } from '../pages';
import { closeCard, currentCardKeys, cycleCard, frontCardKey, useCards } from '../state/cards';
import { useView } from '../state/view';

export interface KeyAction {
  /** e.key values that trigger it */
  keys: string[];
  /** how the keys are shown in the help */
  label: string;
  desc: string;
  /** only on the desktop cards board */
  cards?: boolean;
  run: (e: KeyboardEvent) => void;
}

export const useShortcutDialog = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export const KEY_ACTIONS: KeyAction[] = [
  { keys: ['f', 'F'], label: 'F', desc: 'focus the page search', run: () => document.getElementById('page-search')?.focus() },
  {
    keys: DIGITS.slice(0, PAGES.length),
    label: `1 – ${PAGES.length >= 10 ? '0' : PAGES.length}`,
    desc: 'go to page by number',
    run: (e) => useView.getState().setPage(PAGES[DIGITS.indexOf(e.key)].id),
  },
  { keys: ['?'], label: '?', desc: 'show this list', run: () => useShortcutDialog.getState().setOpen(true) },
  { keys: ['t', 'T'], label: 'T', desc: 'tidy cards into columns', cards: true, run: () => useCards.getState().tidy(currentCardKeys()) },
  { keys: ['c', 'C'], label: 'C', desc: 'collapse / expand all cards', cards: true, run: () => useCards.getState().toggleAllCollapsed(currentCardKeys()) },
  { keys: ['d', 'D'], label: 'D', desc: 'highlight differences', cards: true, run: () => useCards.getState().setDiff(!useCards.getState().diff) },
  { keys: [',', '.'], label: ',  .', desc: 'previous / next card', cards: true, run: (e) => cycleCard(e.key === '.' ? 1 : -1) },
  {
    keys: [' '],
    label: 'Space',
    desc: 'collapse / expand the top card',
    cards: true,
    run: () => {
      const k = frontCardKey();
      if (k) useCards.getState().toggleCollapse(k);
    },
  },
  {
    keys: ['x', 'X'],
    label: 'X',
    desc: 'close the top card',
    cards: true,
    run: () => {
      const k = frontCardKey();
      if (k) closeCard(k);
    },
  },
];

/** The action for a key press, or undefined. Modifier combos are left to the browser (Shift only for '?'). */
export function keyAction(e: KeyboardEvent, cardsView: boolean) {
  if (e.ctrlKey || e.metaKey || e.altKey) return undefined;
  return KEY_ACTIONS.find((a) => a.keys.includes(e.key) && (!a.cards || cardsView));
}

const OTHER_ROWS: [string, string][] = [
  ['Ctrl K  or  /', 'search everything'],
  ['↑ ↓  (Ctrl in search box)', 'move through results'],
  ['Enter', 'pin / unpin selected'],
  ['Alt ← →', 'detail history'],
  ['Ctrl ← →', 'previous / next page'],
  ['Esc', 'close / leave a text box'],
  ['Esc Esc', 'clear filters'],
];

const CARD_ROWS: [string, string][] = [
  ['Alt + drag', 'move a card without snapping'],
  ['Dbl-click title', 'collapse a card'],
];

export function ShortcutHelp() {
  const groups: [string, [string, string][]][] = [
    ['Keyboard', [...OTHER_ROWS, ...KEY_ACTIONS.filter((a) => !a.cards).map((a): [string, string] => [a.label, a.desc])]],
    ['Cards', [...KEY_ACTIONS.filter((a) => a.cards).map((a): [string, string] => [a.label, a.desc]), ...CARD_ROWS]],
  ];
  return (
    <div className="px-2 pb-1 text-[11px] text-muted">
      {groups.map(([title, rows]) => (
        <div key={title} className="mb-1.5 last:mb-0">
          <div className="section-label mb-1">{title}</div>
          {rows.map(([k, d]) => (
            <div key={k} className="flex justify-between gap-2 py-0.5">
              <span className="font-mono">{k}</span>
              <span>{d}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ShortcutDialog() {
  const open = useShortcutDialog((s) => s.open);
  const setOpen = useShortcutDialog((s) => s.setOpen);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[86vh] w-80 max-w-[95vw] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-line bg-panel p-2 shadow-2xl animate-in"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <Dialog.Title className="flex items-center gap-2 font-display text-base font-bold">
              <Keyboard size={16} /> Shortcuts
            </Dialog.Title>
            <Dialog.Close className="btn-ghost p-1" aria-label="Close">
              <X size={16} />
            </Dialog.Close>
          </div>
          <ShortcutHelp />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
