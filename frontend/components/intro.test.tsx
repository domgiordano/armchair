import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./intro-scene/intro-scene", () => ({
  IntroScene: ({ start }: { start: number }) => <div data-testid="scene" data-start={start} />,
}));

import { Intro } from "./intro";

function webgl() {
  vi.stubGlobal("WebGLRenderingContext", class {});
  const lose = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    getExtension: () => ({ loseContext: lose }),
  } as unknown as ImageBitmapRenderingContext);
  return lose;
}

const stage = () => screen.getByRole("region", { name: "Intro" }).getAttribute("data-stage");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Intro", () => {
  it("plays the 2D ballroom when there's no WebGL", () => {
    render(<Intro onDone={() => {}} />);
    expect(stage()).toBe("2d");
    expect(screen.queryByTestId("scene")).toBeNull();
    expect(screen.getByText("armchair judge")).toBeTruthy();
  });

  it("loads the 3D scene over the poster when WebGL works, and hands the probe context back", async () => {
    const lose = webgl();
    const { container } = render(<Intro onDone={() => {}} />);
    expect(stage()).toBe("3d");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/intro/poster.webp");
    expect(lose).toHaveBeenCalled();
    expect(await screen.findByTestId("scene")).toBeTruthy();
  });

  it("ends on its own after the scene, or at once on Skip", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Intro onDone={onDone} />);
    act(() => vi.advanceTimersByTime(5199));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Skip intro" }));
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  // Last: it resets the module registry.
  it("falls back to the 2D ballroom when the 3D chunk won't load", async () => {
    vi.resetModules();
    vi.doMock("./intro-scene/intro-scene", () => {
      throw new Error("ChunkLoadError");
    });
    const { Intro: Fresh } = await import("./intro");
    webgl();
    render(<Fresh onDone={() => {}} />);
    expect(await screen.findAllByText("10")).toHaveLength(3);
  });
});
