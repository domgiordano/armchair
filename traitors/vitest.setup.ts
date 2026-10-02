import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Node 25 defines empty global localStorage/sessionStorage stubs that shadow jsdom's.
const jsdomWindow = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
vi.stubGlobal("localStorage", jsdomWindow.localStorage);
vi.stubGlobal("sessionStorage", jsdomWindow.sessionStorage);

// Testing Library only auto-cleans when the runner exposes a global afterEach;
// vitest does not unless `globals: true`.
afterEach(cleanup);
