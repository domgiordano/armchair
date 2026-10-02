import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { WaxSeal } from "./wax-seal";

afterEach(() => {
  Reflect.deleteProperty(navigator, "vibrate");
});

it("buzzes, stays busy while the pick saves, and frees up again if it fails", async () => {
  const vibrate = vi.fn();
  Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  let fail: (e: Error) => void = () => {};
  const onSeal = vi.fn(() => new Promise<void>((_, reject) => (fail = reject)));
  render(<WaxSeal label="Seal your slate" sealed={false} onSeal={onSeal} />);

  fireEvent.click(screen.getByRole("button", { name: "Seal your slate" }));
  expect(vibrate).toHaveBeenCalledWith(20);
  const busy = screen.getByRole("button", { name: "Sealing..." }) as HTMLButtonElement;
  expect(busy.disabled).toBe(true);

  fail(new Error("409"));
  const again = (await screen.findByRole("button", { name: "Seal your slate" })) as HTMLButtonElement;
  expect(again.disabled).toBe(false);
});

it("works where the phone can't vibrate", async () => {
  const onSeal = vi.fn(async () => {});
  render(<WaxSeal label="Seal it" sealed={false} onSeal={onSeal} />);
  fireEvent.click(screen.getByRole("button", { name: "Seal it" }));
  expect(onSeal).toHaveBeenCalledOnce();
});

it("shows a sealed pick as final, with no button", () => {
  render(<WaxSeal label="Seal it" sealed onSeal={vi.fn()} />);
  expect(screen.getByText("Sealed. Final.")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
