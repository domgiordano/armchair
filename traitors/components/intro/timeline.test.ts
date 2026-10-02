import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { camera, CUT, FIGURES, flicker, HOOD, hoodSlide, LENGTH, type Pose, pose, shot, titleIn, VOID, voidOpen } from "./timeline";

const times = Array.from({ length: LENGTH * 100 + 1 }, (_, i) => i / 100);
const fresh = (): Pose => ({ position: new Vector3(), yaw: 0, walk: 0 });

describe("intro timeline", () => {
  it("only burns the title in once the dark has taken most of the head", () => {
    for (const t of times.filter((t) => titleIn(t) > 0)) {
      expect(voidOpen(t)).toBeGreaterThan(0.5);
      expect(hoodSlide(t)).toBeGreaterThan(0.6);
    }
    expect(titleIn(LENGTH)).toBe(1);
  });

  it("slides the hood back once, steadily, and never before the lead has stopped", () => {
    expect(hoodSlide(HOOD[0])).toBe(0);
    expect(hoodSlide(HOOD[1])).toBe(1);
    let last = 0;
    for (const t of times) {
      const k = hoodSlide(t);
      expect(k).toBeGreaterThanOrEqual(last);
      if (k > 0) expect(pose(0, t, fresh()).walk).toBe(0);
      last = k;
    }
  });

  it("ends with the camera close on the void, level with it and looking straight at it", () => {
    const eye = new Vector3();
    const look = new Vector3();
    camera(LENGTH, eye, look);
    const ahead = look.clone().sub(eye).normalize();
    const toVoid = VOID.clone().sub(eye).normalize();
    expect(ahead.dot(toVoid)).toBeGreaterThan(0.999);
    expect(eye.distanceTo(VOID)).toBeLessThan(0.6);
    expect(Math.abs(eye.y - VOID.y)).toBeLessThan(0.08);
  });

  it("stands the lead where the void opens before the hood moves", () => {
    const p = pose(0, HOOD[0], fresh());
    expect(p.position.x).toBeCloseTo(VOID.x);
    expect(p.position.z).toBeCloseTo(VOID.z);
  });

  it("walks the procession towards the lens until the lead's cloak fills it at the cut", () => {
    const eye = new Vector3();
    const look = new Vector3();
    for (let i = 0; i < FIGURES; i++) {
      const a = pose(i, 0, fresh());
      const b = pose(i, CUT - 0.01, fresh());
      expect(b.position.z).toBeGreaterThan(a.position.z);
    }
    camera(CUT - 0.01, eye, look);
    const lead = pose(0, CUT - 0.01, fresh()).position;
    expect(eye.z - lead.z).toBeGreaterThan(0.2);
    expect(eye.z - lead.z).toBeLessThan(0.7);
    expect(shot(CUT - 0.01)).toBe("procession");
    expect(shot(CUT)).toBe("reveal");
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
