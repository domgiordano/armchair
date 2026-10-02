import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { camera, CUT, dip, FIGURES, flicker, hoodFall, LENGTH, type Pose, pose, shot, titleIn, VOID, voidOpen } from "./timeline";

const times = Array.from({ length: LENGTH * 100 + 1 }, (_, i) => i / 100);
const fresh = (): Pose => ({ position: new Vector3(), yaw: 0, walk: 0 });

describe("intro timeline", () => {
  it("only shows the title once the hood is all the way down and the void is open", () => {
    for (const t of times.filter((t) => titleIn(t) > 0)) {
      expect(hoodFall(t)).toBeGreaterThanOrEqual(0.999);
      expect(voidOpen(t)).toBeGreaterThan(0.5);
    }
    expect(titleIn(LENGTH)).toBe(1);
    expect(hoodFall(0)).toBe(0);
    expect(hoodFall(4)).toBe(0);
  });

  it("ends with the camera close on the lead's void, looking straight at it", () => {
    const eye = new Vector3();
    const look = new Vector3();
    camera(LENGTH, eye, look);
    expect(look.distanceTo(VOID)).toBeLessThan(0.01);
    expect(eye.distanceTo(VOID)).toBeLessThan(1.6);
    // Level with the head across the table, never looking down on it from above.
    expect(Math.abs(eye.y - VOID.y)).toBeLessThan(0.1);
  });

  it("stands the lead where the void opens, stopped, before the hood moves", () => {
    const p = pose(0, 4.2, fresh());
    expect(p.walk).toBe(0);
    expect(p.position.x).toBeCloseTo(VOID.x);
    expect(p.position.z).toBeCloseTo(VOID.z);
  });

  it("walks the procession toward the camera down the corridor", () => {
    const eye = new Vector3();
    const look = new Vector3();
    for (let i = 0; i < FIGURES; i++) {
      const a = pose(i, 0, fresh());
      const b = pose(i, CUT - 0.01, fresh());
      camera(CUT - 0.01, eye, look);
      expect(b.position.z).toBeGreaterThan(a.position.z);
      // Still in front of the lens when the shot cuts.
      expect(b.position.z).toBeLessThan(eye.z - 1);
    }
  });

  it("cuts to the hall at the darkest point of the dip", () => {
    expect(shot(CUT - 0.01)).toBe("corridor");
    expect(shot(CUT)).toBe("hall");
    expect(dip(CUT)).toBeCloseTo(1);
    expect(dip(0)).toBe(0);
    expect(dip(4)).toBe(0);
  });

  it("is a pure function of time", () => {
    const a = new Vector3();
    const b = new Vector3();
    const l = new Vector3();
    camera(3.3, a, l);
    camera(5.1, b, l);
    camera(3.3, b, l);
    expect(b.equals(a)).toBe(true);
    expect(flicker(1.23, 4)).toBe(flicker(1.23, 4));
  });

  it("keeps every flame flickering within a steady band", () => {
    for (const t of times) {
      const f = flicker(t, 2.7);
      expect(f).toBeGreaterThan(0.6);
      expect(f).toBeLessThan(1.1);
    }
  });
});
