import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from "react";

import { useMediaQuery } from "@/lib/motion";
import { snapIndex, turnToward, wrap } from "@/lib/spin";

const DURATION = 400;
// A drag must move this far before it's a turn, not a tap.
const SLOP = 8;
// How far a flick carries on after the finger lifts, in ms of its speed.
const CARRY = 140;
// In seats, and under half the table: past that the short way round runs the table backwards.
const MAX_CARRY = 3;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

interface Drag {
  id: number;
  x: number;
  turn: number;
  moved: boolean;
  last: { x: number; t: number };
  speed: number;
}

/**
 * The table's turn, in seats: seat `turn` sits at the head. Rotations ease over
 * 400ms (at once with reduced motion); a drag turns it with the finger and snaps
 * to the nearest seat on release. `head` is where the table is headed, so the
 * focus card can change before the table stops.
 */
export function useSpin(n: number, start = 0) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [turn, setTurnState] = useState(start);
  const [head, setHead] = useState(start);
  const [moving, setMoving] = useState(false);
  const live = useRef(start);
  const frame = useRef(0);
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);
  const wheel = useRef(0);

  const setTurn = (t: number) => {
    live.current = t;
    setTurnState(t);
  };

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const rotateTo = useCallback(
    (i: number) => {
      cancelAnimationFrame(frame.current);
      const from = live.current;
      const to = turnToward(from, i, n);
      setHead(wrap(i, n));
      if (reduced || from === to) {
        setTurn(to);
        setMoving(false);
        return;
      }
      setMoving(true);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION);
        setTurn(from + (to - from) * ease(t));
        if (t < 1) frame.current = requestAnimationFrame(tick);
        else setMoving(false);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [n, reduced],
  );

  const step = (by: number) => rotateTo(head + by);

  /** Pointer handlers for the table, given how many px of rim one seat takes. */
  const bind = (perSeat: number) => ({
    onPointerDown(e: PointerEvent<HTMLElement>) {
      dragged.current = false;
      if (e.button !== 0) return;
      const now = performance.now();
      drag.current = { id: e.pointerId, x: e.clientX, turn: live.current, moved: false, last: { x: e.clientX, t: now }, speed: 0 };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      if (!d.moved) {
        if (Math.abs(dx) < SLOP) return;
        d.moved = true;
        cancelAnimationFrame(frame.current);
        setMoving(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      const now = performance.now();
      const dt = now - d.last.t;
      // Over at least a frame, so two events a millisecond apart don't read as a hard flick.
      d.speed = (e.clientX - d.last.x) / Math.max(dt, 16);
      d.last = { x: e.clientX, t: now };
      // The head moves with the finger: drag right and the seat on its left comes up.
      const t = d.turn - dx / perSeat;
      setTurn(t);
      setHead(snapIndex(t, n));
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const d = drag.current;
      drag.current = null;
      if (!d?.moved || d.id !== e.pointerId) return;
      dragged.current = true;
      const most = Math.min(MAX_CARRY, Math.floor((n - 1) / 2));
      const carry = Math.max(-most, Math.min(most, (d.speed * CARRY) / perSeat));
      rotateTo(Math.round(live.current - carry));
    },
    onPointerCancel() {
      const d = drag.current;
      drag.current = null;
      if (d?.moved) rotateTo(Math.round(live.current));
    },
    // The click that ends a drag isn't a tap on the seat under the finger.
    onClickCapture(e: MouseEvent<HTMLElement>) {
      if (!dragged.current) return;
      dragged.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    // A trackpad's sideways swipe turns it a seat at a time; an up-down scroll stays the page's.
    onWheel(e: WheelEvent<HTMLElement>) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      wheel.current += e.deltaX;
      if (Math.abs(wheel.current) < perSeat) return;
      step(Math.sign(wheel.current));
      wheel.current = 0;
    },
  });

  return { turn, head, moving, rotateTo, step, bind };
}
