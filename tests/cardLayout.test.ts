import { describe, expect, it } from 'vitest';
import { cascade, clampToBounds, GAP, MARGIN, placeFree, placeNear, snap, tidy, type Rect } from '../src/ui/cardLayout';

const B = { w: 1600, h: 900 };
const size = { w: 400, h: 500 };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r: Rect) => r.x >= MARGIN && r.x + r.w <= B.w - MARGIN;

describe('placeFree', () => {
  it('starts at the top-right corner of an empty board', () => {
    expect(placeFree(size, [], B)).toMatchObject({ x: B.w - size.w - MARGIN, y: MARGIN });
  });

  it('avoids existing cards and stays on the board', () => {
    const a = { x: B.w - 408, y: 8, w: 400, h: 500 };
    const r = placeFree(size, [a], B);
    expect(overlaps(r, a)).toBe(false);
    expect(inside(r)).toBe(true);
  });

  it('cascades when the board is full', () => {
    const full = { x: 0, y: 0, w: B.w, h: B.h };
    const r = placeFree(size, [full], B);
    expect(r).toEqual(cascade(size, [full], B));
  });
});

describe('cascade', () => {
  it('steps down-left past cards sitting on the same corner', () => {
    const first = cascade(size, [], B);
    const second = cascade(size, [{ ...first }], B);
    expect(second.x).toBeLessThan(first.x);
    expect(second.y).toBeGreaterThan(first.y);
  });
});

describe('placeNear', () => {
  it('opens to the right of the source when there is room', () => {
    const src = { x: 100, y: 50, w: 400, h: 500 };
    expect(placeNear(src, size, [src], B)).toMatchObject({ x: 500 + GAP, y: 50 });
  });

  it('falls back to the left when the right side is off the board', () => {
    const src = { x: 1150, y: 50, w: 400, h: 500 };
    expect(placeNear(src, size, [src], B)).toMatchObject({ x: 1150 - 400 - GAP, y: 50 });
  });

  it('falls back to the left when the right side is taken', () => {
    const src = { x: 600, y: 50, w: 400, h: 500 };
    const right = { x: 1010, y: 0, w: 400, h: 900 };
    expect(placeNear(src, size, [src, right], B)).toMatchObject({ x: 600 - 400 - GAP });
  });

  it('keeps the new card on the board vertically', () => {
    const src = { x: 100, y: 700, w: 400, h: 150 };
    const r = placeNear(src, size, [src], B);
    expect(r.y + Math.min(r.h, B.h - 2 * MARGIN)).toBeLessThanOrEqual(B.h - MARGIN);
  });
});

describe('snap', () => {
  const other = { x: 500, y: 100, w: 400, h: 300 };

  it('snaps beside another card, leaving the gap', () => {
    const r = { x: 905 + GAP, y: 240, w: 300, h: 200 };
    expect(snap(r, [other], B).x).toBe(900 + GAP);
  });

  it('aligns top edges', () => {
    const r = { x: 1000, y: 105, w: 300, h: 200 };
    expect(snap(r, [other], B).y).toBe(100);
  });

  it('snaps to the board margin', () => {
    expect(snap({ x: 3, y: 300, w: 300, h: 200 }, [], B)).toEqual({ x: MARGIN, y: 300 });
    expect(snap({ x: B.w - 300 - 4, y: 300, w: 300, h: 200 }, [], B).x).toBe(B.w - 300 - MARGIN);
  });

  it('leaves the card alone outside the threshold', () => {
    const r = { x: 700, y: 520, w: 300, h: 200 };
    expect(snap(r, [other], B, 8)).toEqual({ x: 700, y: 520 });
  });
});

describe('clampToBounds', () => {
  it('keeps the title bar reachable', () => {
    const r = clampToBounds({ x: 5000, y: -50, w: 400, h: 500 }, B);
    expect(r.x).toBeLessThanOrEqual(B.w - 80);
    expect(r.y).toBe(0);
    expect(clampToBounds({ x: -1000, y: 5000, w: 400, h: 500 }, B)).toMatchObject({ x: 80 - 400, y: B.h - 36 });
  });

  it('returns the same object when nothing changes', () => {
    const r = { x: 100, y: 100, w: 400, h: 500 };
    expect(clampToBounds(r, B)).toBe(r);
  });
});

describe('tidy', () => {
  it('fills columns top to bottom in order, right-aligned', () => {
    const items = ['a', 'b', 'c'].map((key) => ({ key, w: 400, h: 400 }));
    const pos = tidy(items, B);
    expect(pos.get('a')).toEqual({ x: pos.get('b')!.x, y: MARGIN });
    expect(pos.get('b')!.y).toBe(MARGIN + 400 + GAP);
    // a third 400px card does not fit under the first two on a 900px board
    expect(pos.get('c')).toEqual({ x: pos.get('a')!.x + 400 + GAP, y: MARGIN });
    expect(pos.get('c')!.x + 400).toBe(B.w - MARGIN);
  });

  it('uses the widest card for the column width', () => {
    const pos = tidy(
      [
        { key: 'wide', w: 600, h: 800 },
        { key: 'next', w: 300, h: 200 },
      ],
      B,
    );
    expect(pos.get('next')!.x - pos.get('wide')!.x).toBe(600 + GAP);
  });

  it('keeps overflowing columns on the board', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ key: i, w: 400, h: 850 }));
    for (const p of tidy(items, B).values()) expect(p.x + 400).toBeLessThanOrEqual(B.w - MARGIN);
  });
});
