// Pure geometry for the floating cards view: placement, snapping, tidy and clamping.
// Coordinates are relative to the card board (the workspace below the top bar).

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Size {
  w: number;
  h: number;
}
export type Bounds = Size;

/** distance kept from the board edges */
export const MARGIN = 8;
/** gap between cards placed next to each other */
export const GAP = 10;
/** how much of a card must stay on the board so it can be grabbed again */
const GRAB_W = 80;
const GRAB_H = 36;

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const fitsBounds = (r: Rect, b: Bounds) => r.x >= MARGIN - 0.5 && r.x + r.w <= b.w - MARGIN + 0.5;

/** fits the board and keeps at least GAP from every other card */
const free = (r: Rect, others: Rect[], b: Bounds) =>
  fitsBounds(r, b) && !others.some((o) => overlaps(r, { x: o.x - GAP, y: o.y - GAP, w: o.w + 2 * GAP, h: o.h + 2 * GAP }));

/** the height used for overlap tests: cards are never taller than the board */
const usable = (size: Size, b: Bounds): Size => ({ w: size.w, h: Math.max(GRAB_H, Math.min(size.h, b.h - 2 * MARGIN)) });

/**
 * Upstream's "concertina": start at the top-right corner and step down-left until the card's corner
 * no longer sits on another card's corner.
 */
export function cascade(size: Size, others: Rect[], b: Bounds): Rect {
  const step = 24;
  let x = Math.max(MARGIN, b.w - size.w - MARGIN);
  let y = MARGIN;
  for (let i = 0; i < 200; i++) {
    if (!others.some((o) => Math.abs(o.x - x) < step / 2 && Math.abs(o.y - y) < step / 2)) break;
    x -= step;
    y += step;
    if (y > b.h / 2 || x < MARGIN) {
      y = MARGIN + ((i + 1) % 4) * 6;
      x = Math.max(MARGIN, x - 3 * step);
    }
  }
  return { x, y, ...size };
}

/** The first spot (scanning columns from the right, top to bottom) where the card overlaps nothing. */
export function freeSpot(size: Size, others: Rect[], b: Bounds): Rect | null {
  const s = usable(size, b);
  const step = 16;
  for (let x = b.w - s.w - MARGIN; x >= MARGIN; x -= step) {
    for (let y = MARGIN; y + Math.min(s.h, 200) <= b.h - MARGIN; y += step) {
      const r = { x, y, ...s };
      if (free(r, others, b)) return { ...r, h: size.h };
    }
  }
  return null;
}

/** Spot for a new card: free space if there is any, otherwise cascaded from the top-right. */
export function placeFree(size: Size, others: Rect[], b: Bounds): Rect {
  return freeSpot(size, others, b) ?? cascade(size, others, b);
}

/** Spot for a card opened from a link in `source`: beside it (right, then left), else anywhere free. */
export function placeNear(source: Rect, size: Size, others: Rect[], b: Bounds): Rect {
  const s = usable(size, b);
  const y = Math.max(MARGIN, Math.min(source.y, b.h - s.h - MARGIN));
  for (const x of [source.x + source.w + GAP, source.x - s.w - GAP]) {
    const r = { x, y, ...s };
    if (free(r, others, b)) return { ...r, h: size.h };
  }
  const spot = freeSpot(size, others, b);
  if (spot) return spot;
  // no room anywhere: overlap the source, offset so both title bars stay visible
  return clampToBounds({ x: source.x + 28, y: source.y + 28, ...size }, b);
}

/**
 * Snaps a dragged card's edges to the board margins and to other cards (aligned with their edges or
 * placed beside them with GAP). Each axis snaps to the closest target within `threshold`.
 */
export function snap(r: Rect, others: Rect[], b: Bounds, threshold = 8): { x: number; y: number } {
  const best = (edges: [number, number[]][]) => {
    let d = Infinity;
    for (const [edge, targets] of edges) for (const t of targets) if (Math.abs(t - edge) < Math.abs(d)) d = t - edge;
    return Math.abs(d) <= threshold ? d : 0;
  };
  const left = [MARGIN, ...others.flatMap((o) => [o.x, o.x + o.w + GAP])];
  const right = [b.w - MARGIN, ...others.flatMap((o) => [o.x + o.w, o.x - GAP])];
  const top = [MARGIN, ...others.flatMap((o) => [o.y, o.y + o.h + GAP])];
  const bottom = [b.h - MARGIN, ...others.flatMap((o) => [o.y + o.h, o.y - GAP])];
  return {
    x: r.x + best([
      [r.x, left],
      [r.x + r.w, right],
    ]),
    y: r.y + best([
      [r.y, top],
      [r.y + r.h, bottom],
    ]),
  };
}

/** Keeps enough of the card on the board to grab its title bar. */
export function clampToBounds<T extends Rect>(r: T, b: Bounds): T {
  const x = Math.max(Math.min(MARGIN, GRAB_W - r.w), Math.min(r.x, b.w - GRAB_W));
  const y = Math.max(0, Math.min(r.y, b.h - GRAB_H));
  return x === r.x && y === r.y ? r : { ...r, x, y };
}

/**
 * Arranges cards in columns, in the given order: each column is filled top to bottom, then the next
 * column starts to its right. The block of columns is aligned to the right edge (the results table
 * usually sits on the left).
 */
export function tidy<K>(items: { key: K; w: number; h: number }[], b: Bounds, gap = GAP): Map<K, { x: number; y: number }> {
  const cols: { w: number; items: { key: K; y: number }[] }[] = [];
  let col: (typeof cols)[number] | undefined;
  let y = MARGIN;
  for (const it of items) {
    const h = Math.min(it.h, b.h - 2 * MARGIN);
    if (!col || (col.items.length && y + h > b.h - MARGIN)) {
      col = { w: 0, items: [] };
      cols.push(col);
      y = MARGIN;
    }
    col.items.push({ key: it.key, y });
    col.w = Math.max(col.w, it.w);
    y += h + gap;
  }
  const total = cols.reduce((a, c) => a + c.w, 0) + gap * Math.max(0, cols.length - 1);
  let x = Math.max(MARGIN, b.w - MARGIN - total);
  const out = new Map<K, { x: number; y: number }>();
  for (const c of cols) {
    // columns that no longer fit pile up against the right edge
    const cx = Math.min(x, Math.max(MARGIN, b.w - MARGIN - c.w));
    for (const it of c.items) out.set(it.key, { x: cx, y: it.y });
    x += c.w + gap;
  }
  return out;
}
