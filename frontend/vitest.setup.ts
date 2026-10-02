import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { clearCache } from "@armchair/app-core/api/cache";

// Node 25 defines empty global localStorage/sessionStorage stubs that shadow jsdom's.
const jsdomWindow = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
vi.stubGlobal("localStorage", jsdomWindow.localStorage);
vi.stubGlobal("sessionStorage", jsdomWindow.sessionStorage);

// Outside a Next app router these hooks return null. Tests that care mock their own.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Page tests mock the API functions they expect a page to call; the shell's
// prefetch would call more of them. prefetch.test.ts unmocks it.
vi.mock("@/lib/api/prefetch", () => ({ prefetchPage: () => {} }));

// Testing Library only auto-cleans when the runner exposes a global afterEach;
// vitest does not unless `globals: true`.
afterEach(cleanup);
// API reads are cached per tab; each test starts with none.
afterEach(clearCache);

// jsdom has <dialog> but no showModal/close. Enough of both for the phone menu.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};
