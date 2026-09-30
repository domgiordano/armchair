import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The stand-in scene "draws its first frame" when clicked.
vi.mock("./intro-scene/intro-scene", () => ({
  IntroScene: ({ onReady }: { onReady: () => void }) => <button type="button" data-testid="scene" onClick={onReady} />,
}));

// intro.tsx probes WebGL once per page load, so each test loads a fresh copy.
async function load({ webgl }: { webgl: boolean }) {
  const lose = vi.fn();
  if (webgl) {
    vi.stubGlobal("WebGLRenderingContext", class {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      getExtension: () => ({ loseContext: lose }),
    } as unknown as ImageBitmapRenderingContext);
  }
  vi.resetModules();
  const { Intro } = await import("./intro");
  return { Intro, lose };
}

const region = () => screen.getByRole("region", { name: "Intro" });
const stage = () => region().getAttribute("data-stage");
const playing = () => region().hasAttribute("data-playing");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Intro", () => {
  it("plays the 2D ballroom when there's no WebGL", async () => {
    const { Intro } = await load({ webgl: false });
    render(<Intro onDone={() => {}} />);
    expect(stage()).toBe("2d");
    expect(playing()).toBe(true);
    expect(screen.getAllByText("9")).toHaveLength(1);
    expect(screen.getAllByText("10")).toHaveLength(2);
    expect(screen.getByText("29")).toBeTruthy();
    expect(screen.queryByTestId("scene")).toBeNull();
    expect(screen.getByText("armchair judge")).toBeTruthy();
  });

  it("loads the 3D scene over the poster when WebGL works, and hands the probe context back", async () => {
    const { Intro, lose } = await load({ webgl: true });
    const { container } = render(<Intro onDone={() => {}} />);
    expect(stage()).toBe("3d");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/intro/poster.webp");
    expect(lose).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId("scene")).toBeTruthy();
  });

  it("holds on the poster until the scene's first frame, then starts the show's clock", async () => {
    const { Intro } = await load({ webgl: true });
    const onDone = vi.fn();
    render(<Intro onDone={onDone} />);
    const scene = await screen.findByTestId("scene");
    vi.useFakeTimers();
    expect(playing()).toBe(false);
    expect(screen.queryByText("armchair judge")).toBeNull();

    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(scene);
    expect(playing()).toBe(true);
    expect(screen.getByText("armchair judge")).toBeTruthy();

    act(() => vi.advanceTimersByTime(5799));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("plays the 2D ballroom when the scene never draws", async () => {
    const { Intro } = await load({ webgl: true });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Intro onDone={() => {}} />);
    await screen.findByTestId("scene");
    act(() => vi.advanceTimersByTime(3000));
    expect(stage()).toBe("2d");
    expect(playing()).toBe(true);
    expect(screen.queryByTestId("scene")).toBeNull();
    expect(screen.getByText("29")).toBeTruthy();
  });

  it("falls back to the 2D ballroom when the 3D chunk won't load", async () => {
    vi.doMock("./intro-scene/intro-scene", () => {
      throw new Error("ChunkLoadError");
    });
    const { Intro } = await load({ webgl: true });
    const { container } = render(<Intro onDone={() => {}} />);
    expect(await screen.findAllByText("10")).toHaveLength(2);
    expect(stage()).toBe("2d");
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByTestId("scene")).toBeNull();
    vi.doUnmock("./intro-scene/intro-scene");
  });

  it("server-renders without probing WebGL or picking a backdrop", async () => {
    const { Intro } = await load({ webgl: true });
    const { renderToString } = await import("react-dom/server");
    const html = renderToString(<Intro onDone={() => {}} />);
    expect(html).toContain("Skip intro");
    expect(html).not.toContain("data-stage");
    expect(html).not.toContain("poster");
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  });

  it("ends on its own after the scene, or at once on Skip", async () => {
    const { Intro } = await load({ webgl: false });
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Intro onDone={onDone} />);
    act(() => vi.advanceTimersByTime(5799));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Skip intro" }));
    expect(onDone).toHaveBeenCalledTimes(2);
  });
});
