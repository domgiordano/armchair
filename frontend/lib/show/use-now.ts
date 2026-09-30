"use client";

import { useEffect, useState } from "react";

/** The clock, re-read every 30s so "Airs Tue, Oct 13" opens at showtime without a reload. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
