// Cards view: geometry and stacking of the floating cards. Which cards are open is not stored here:
// every pin is a card, plus the "loose" card showing the current detailRef when it is not pinned.
// Positions are per session only; cards restored from the URL are placed automatically.
import { create } from 'zustand';
import { clampToBounds, tidy, type Bounds, type Rect } from '../ui/cardLayout';
import { useView } from './view';

/** geometry key of the loose (unpinned) card */
export const LOOSE = '~loose';
export const CARD_W = 400;
export const CARD_MIN_W = 300;
export const CARD_MAX_W = 800;
/** height assumed for a card that has not been measured yet */
export const CARD_EST_H = 520;

export interface CardGeom {
  x: number;
  y: number;
  w: number;
  /** explicit height after a resize; auto (content height, capped by the board) when unset */
  h?: number;
  z: number;
  collapsed?: boolean;
}

interface CardsState {
  geom: Record<string, CardGeom>;
  topZ: number;
  /** bumped to replay the focus animation on a card */
  pulse: { key: string; n: number } | null;
  diff: boolean;
  bounds: Bounds;

  place: (key: string, at: Omit<CardGeom, 'z'>) => void;
  patch: (key: string, patch: Partial<CardGeom>) => void;
  front: (key: string) => void;
  /** front + expand + pulse */
  focus: (key: string) => void;
  toggleCollapse: (key: string) => void;
  setAllCollapsed: (keys: string[], collapsed: boolean) => void;
  /** collapse all when any is expanded, else expand all */
  toggleAllCollapsed: (keys: string[]) => void;
  /** the loose card was pinned: it keeps its place under its ref, the next loose card gets a new one */
  adoptLoose: (ref: string) => void;
  /** forget geometry of cards that are no longer open */
  prune: (open: string[]) => void;
  tidy: (keys: string[]) => void;
  setDiff: (diff: boolean) => void;
  setBounds: (b: Bounds) => void;
}

/** Rendered card heights, written by the cards themselves (not reactive). */
export const cardHeights = new Map<string, number>();

export const useCards = create<CardsState>((set, get) => ({
  geom: {},
  topZ: 1,
  pulse: null,
  diff: false,
  bounds: { w: 1200, h: 800 },

  place: (key, at) => {
    const s = get();
    set({ geom: { ...s.geom, [key]: { ...at, z: s.topZ + 1 } }, topZ: s.topZ + 1 });
  },
  patch: (key, patch) => {
    const s = get();
    const g = s.geom[key];
    if (g) set({ geom: { ...s.geom, [key]: { ...g, ...patch } } });
  },
  front: (key) => {
    const s = get();
    const g = s.geom[key];
    if (!g || g.z === s.topZ) return;
    set({ geom: { ...s.geom, [key]: { ...g, z: s.topZ + 1 } }, topZ: s.topZ + 1 });
  },
  focus: (key) => {
    const s = get();
    const g = s.geom[key];
    set({
      ...(g ? { geom: { ...s.geom, [key]: { ...g, collapsed: false, z: s.topZ + 1 } }, topZ: s.topZ + 1 } : {}),
      pulse: { key, n: (s.pulse?.n ?? 0) + 1 },
    });
  },
  toggleCollapse: (key) => {
    const g = get().geom[key];
    if (g) get().patch(key, { collapsed: !g.collapsed });
  },
  setAllCollapsed: (keys, collapsed) => {
    const geom = { ...get().geom };
    for (const k of keys) if (geom[k]) geom[k] = { ...geom[k], collapsed };
    set({ geom });
  },
  toggleAllCollapsed: (keys) => {
    const s = get();
    s.setAllCollapsed(keys, anyExpanded(keys, s.geom));
  },
  adoptLoose: (ref) => {
    const s = get();
    const g = s.geom[LOOSE];
    if (!g) return;
    const geom = { ...s.geom, [ref]: g };
    delete geom[LOOSE];
    const h = cardHeights.get(LOOSE);
    if (h !== undefined) cardHeights.set(ref, h);
    cardHeights.delete(LOOSE);
    set({ geom });
  },
  prune: (open) => {
    const s = get();
    const keep = new Set(open);
    const stale = Object.keys(s.geom).filter((k) => !keep.has(k));
    if (!stale.length) return;
    const geom = { ...s.geom };
    for (const k of stale) {
      delete geom[k];
      cardHeights.delete(k);
    }
    set({ geom });
  },
  tidy: (keys) => {
    const s = get();
    const items = keys.filter((k) => s.geom[k]).map((k) => ({ key: k, w: s.geom[k].w, h: cardHeights.get(k) ?? CARD_EST_H }));
    const pos = tidy(items, s.bounds);
    const geom = { ...s.geom };
    pos.forEach((p, k) => (geom[k] = { ...geom[k], ...p }));
    set({ geom });
  },
  setDiff: (diff) => set({ diff }),
  setBounds: (b) => {
    const s = get();
    if (s.bounds.w === b.w && s.bounds.h === b.h) return;
    // keep every card reachable after the window shrinks
    const geom: Record<string, CardGeom> = {};
    for (const [k, g] of Object.entries(s.geom)) {
      const { x, y } = clampToBounds({ x: g.x, y: g.y, w: g.w, h: 0 }, b);
      geom[k] = x === g.x && y === g.y ? g : { ...g, x, y };
    }
    set({ bounds: b, geom });
  },
}));

/** Keys of the open cards, in pin order with the loose card last. */
export function openCardKeys(pins: string[], detailRef: string | null): string[] {
  return detailRef && !pins.includes(detailRef) ? [...pins, LOOSE] : pins;
}

/** Keys of the open cards in the current view. */
export function currentCardKeys(): string[] {
  const v = useView.getState();
  return openCardKeys(v.pins, v.detailRef);
}

export function anyExpanded(keys: string[], geom: Record<string, CardGeom>) {
  return keys.some((k) => geom[k] && !geom[k].collapsed);
}

/** The open card on top, or null when there is none. */
export function frontCardKey(): string | null {
  const { geom } = useCards.getState();
  let top: string | null = null;
  for (const k of currentCardKeys()) if (geom[k] && (!top || geom[k].z > geom[top].z)) top = k;
  return top;
}

/** Bring the next (1) or previous (-1) open card, in pin order, to the front. */
export function cycleCard(dir: 1 | -1) {
  const { geom, focus } = useCards.getState();
  const keys = currentCardKeys().filter((k) => geom[k]);
  if (!keys.length) return;
  const i = keys.indexOf(frontCardKey() ?? '');
  focus(keys[i < 0 ? 0 : (i + dir + keys.length) % keys.length]);
}

/** Close a card: unpin it, and hide it if it is the loose card. */
export function closeCard(key: string) {
  const v = useView.getState();
  const ref = cardRef(key);
  if (key !== LOOSE) v.unpin(key);
  // a closed card should not reappear as the loose card
  if (v.detailRef === ref) useView.setState({ detailRef: null });
}

/** The ref shown by a card key. */
export function cardRef(key: string): string | null {
  return key === LOOSE ? useView.getState().detailRef : key;
}

/** Rect of an open card (measured height when known). */
export function cardRect(key: string): Rect | null {
  const g = useCards.getState().geom[key];
  return g ? { x: g.x, y: g.y, w: g.w, h: cardHeights.get(key) ?? g.h ?? CARD_EST_H } : null;
}
