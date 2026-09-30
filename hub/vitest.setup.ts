import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Node 25 defines an empty global localStorage stub that shadows jsdom's.
vi.stubGlobal("localStorage", (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window.localStorage);

// jsdom has no matchMedia. Nothing matches unless a test stubs its own.
vi.stubGlobal("matchMedia", (media: string) => ({
  matches: false,
  media,
  addEventListener: () => {},
  removeEventListener: () => {},
}));

// Testing Library only auto-cleans when the runner exposes a global afterEach;
// vitest does not unless `globals: true`.
afterEach(cleanup);
