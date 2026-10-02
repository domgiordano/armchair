import type { ReactNode } from "react";

import { cn } from "@/lib/ui";

interface SlateProps {
  className?: string;
  children: ReactNode;
}

/** The voting slate the players chalk names on: dark stone in a gilt frame. */
export function Slate({ className, children }: SlateProps) {
  return <div className={cn("slate gilt-frame rounded-sm p-4 text-bone", className)}>{children}</div>;
}

/** A name written on the slate in chalk; it draws in left to right. */
export function Chalk({ children, className }: SlateProps) {
  return <span className={cn("font-hand text-2xl leading-none text-bone/90 animate-chalk", className)}>{children}</span>;
}
