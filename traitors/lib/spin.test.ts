import { describe, expect, it } from "vitest";

import { arcOf, HEAD, headShare, offset, perimeter, pointAt, ringFor, SEAT, snapIndex, turnToward } from "./spin";

describe("spin", () => {
  it("brings a seat to the head the short way round", () => {
    expect(turnToward(0, 3, 12)).toBe(3);
    expect(turnToward(0, 10, 12)).toBe(-2);
    expect(turnToward(11, 0, 12)).toBe(12);
    // From mid-turn, still the nearer way.
    expect(turnToward(5.4, 1, 12)).toBeCloseTo(1);
    expect(turnToward(-1, 5, 12)).toBe(5);
  });

  it("snaps a turn to the nearest seat, wrapping past the last", () => {
    expect(snapIndex(2.4, 12)).toBe(2);
    expect(snapIndex(2.6, 12)).toBe(3);
    expect(snapIndex(-0.6, 12)).toBe(11);
    expect(snapIndex(23.7, 12)).toBe(0);
  });

  it("counts seats from the head clockwise, either side", () => {
    expect(offset(3, 3, 12)).toBe(0);
    expect(offset(4, 3, 12)).toBe(1);
    expect(offset(2, 3, 12)).toBe(-1);
    expect(offset(0, 11, 12)).toBe(1);
    expect(offset(5, 0.5, 12)).toBe(4.5);
    expect(headShare(0)).toBe(1);
    expect(headShare(0.25)).toBe(0.75);
    expect(headShare(-2)).toBe(0);
  });

  it("puts the head at the top and the next seat clockwise to its right", () => {
    const r = ringFor(343, 12);
    const top = pointAt(r, arcOf(r, 0, 12));
    const right = pointAt(r, arcOf(r, 1, 12));
    const left = pointAt(r, arcOf(r, -1, 12));
    expect(top.x).toBeCloseTo(r.cx);
    expect(top.y).toBeCloseTo(r.cy - r.ry);
    expect(right.x).toBeGreaterThan(r.cx);
    expect(left.x).toBeLessThan(r.cx);
    expect(right.y).toBeCloseTo(left.y);
  });

  for (const width of [288, 343, 398, 440]) {
    for (const n of [12, 22]) {
      it(`fits ${n} faces in ${width}px, a tap target apart`, () => {
        const r = ringFor(width, n);
        expect(r.width).toBe(width);
        const spots = Array.from({ length: n }, (_, i) => {
          const k = offset(i, 0, n);
          return { ...pointAt(r, arcOf(r, k, n)), size: SEAT + (HEAD - SEAT) * headShare(k) };
        });
        for (const s of spots) {
          expect(s.x - s.size / 2).toBeGreaterThanOrEqual(0);
          expect(s.x + s.size / 2).toBeLessThanOrEqual(width);
          expect(s.y - s.size / 2).toBeGreaterThanOrEqual(0);
          expect(s.y + s.size / 2).toBeLessThanOrEqual(r.height);
        }
        // Round faces: centres at least the two radii apart never overlap.
        spots.forEach((a, i) => {
          const b = spots[(i + 1) % n];
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual((a.size + b.size) / 2);
        });
      });
    }
  }

  it("keeps a dozen round and stretches a big cast into an oval", () => {
    const twelve = ringFor(343, 12);
    expect(twelve.ry).toBeLessThan(twelve.rx);
    const big = ringFor(288, 22);
    expect(big.ry).toBeGreaterThan(big.rx);
    expect(perimeter(big)).toBeGreaterThanOrEqual(22 * SEAT);
  });
});
