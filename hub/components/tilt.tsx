"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

interface TiltProps {
  children: ReactNode;
  className?: string;
}

/** Tilts its child toward a mouse pointer; app/motion.css reads --tx/--ty. Touch and pen are left alone. */
export function Tilt({ children, className = "" }: TiltProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reduced || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--tx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty("--ty", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    el.setAttribute("data-active", "");
  };

  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty("--tx");
    el.style.removeProperty("--ty");
    el.removeAttribute("data-active");
  };

  return (
    <div ref={ref} className={`tilt ${className}`} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </div>
  );
}
