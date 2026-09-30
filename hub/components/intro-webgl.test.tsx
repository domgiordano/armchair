import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { Intro } from "@/components/intro";

// Its own file: Intro probes WebGL once per module load, and intro.test.tsx
// covers the browser without it.
let gpuFails = false;
vi.mock("@/components/intro-3d/scene", () => ({
  IntroScene: ({ onReady }: { onReady: () => void }) => {
    if (gpuFails) throw new Error("Error creating WebGL context.");
    useEffect(onReady, [onReady]);
    return <div data-testid="scene" />;
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ getExtension: () => null } as unknown as RenderingContext);
});

afterEach(() => {
  gpuFails = false;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("loads the 3D stage and hands the poster over once it has drawn", async () => {
  render(<Intro />);
  const stage = screen.getByRole("region", { name: "Armchair Judge intro" });
  expect(stage.dataset.scene).toBeUndefined();

  await act(() => vi.advanceTimersByTimeAsync(0));

  expect(screen.getByTestId("scene")).not.toBeNull();
  expect(stage.dataset.scene).toBe("ready");
});

it("falls back to the static mark when the 3D stage fails to start", async () => {
  gpuFails = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<Intro />);
  await act(() => vi.advanceTimersByTimeAsync(0));

  const stage = screen.getByRole("region", { name: "Armchair Judge intro" });
  expect(stage.querySelector("svg.intro-poster")).not.toBeNull();
  expect(stage.dataset.scene).toBeUndefined();
  expect(screen.getByRole("button", { name: "Skip" })).not.toBeNull();
});
