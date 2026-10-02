"use client";

import { useEffect, useState } from "react";

/** The clock, re-read every `every` ms (30s by default) so "Airs Tue, Oct 13" opens at showtime without a reload. */
export function useNow(every = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}
