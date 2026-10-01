import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const SCENE = "./intro-scene/intro-scene";
let sceneLoads = 0;

// The stand-in scene "draws its first frame" when clicked.
function standIn() {
  sceneLoads += 1;
  return {
    IntroScene: ({ onReady }: { onReady: () => void }) => <button type="button" data-testid="scene" onClick={onReady} />,
  };
}

// intro.tsx probes WebGL once per page load, so each test loads a fresh copy.
async function load({ webgl, scene = standIn }: { webgl: boolean; scene?: () => object }) {
  vi.doMock(SCENE, scene);
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

// vitest.setup.ts stubs in jsdom's storage, and unstubAllGlobals would take it away again.
const storage = localStorage;

afterEach(() => {
  sceneLoads = 0;
  storage.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", storage);
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

  it("starts downloading the scene before the intro mounts, unless someone is signed in", async () => {
    await load({ webgl: true });
    await vi.waitFor(() => expect(sceneLoads).toBe(1));

    localStorage.setItem("CognitoIdentityServiceProvider.client.LastAuthUser", "someone");
    sceneLoads = 0;
    await load({ webgl: true });
    await new Promise((r) => setTimeout(r, 20));
    expect(sceneLoads).toBe(0);
  });

  it("holds the poster however long the scene takes to download", async () => {
    const { Intro } = await load({ webgl: true, scene: () => new Promise(() => {}) });
    vi.useFakeTimers();
    const { container } = render(<Intro onDone={() => {}} />);
    act(() => vi.advanceTimersByTime(30_000));
    expect(stage()).toBe("3d");
    expect(playing()).toBe(false);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/intro/poster.webp");
  });

  it("plays the 2D ballroom when the downloaded scene never draws", async () => {
    const { Intro } = await load({ webgl: true });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Intro onDone={() => {}} />);
    await screen.findByTestId("scene");
    // The patience clock starts from an effect of the resolved chunk, a render after the scene appears.
    await act(async () => {});
    // shouldAdvanceTime lets a little real time slip in, so leave slack either side of 8 s.
    act(() => vi.advanceTimersByTime(7500));
    expect(stage()).toBe("3d");
    act(() => vi.advanceTimersByTime(500));
    expect(stage()).toBe("2d");
    expect(playing()).toBe(true);
    expect(screen.queryByTestId("scene")).toBeNull();
    expect(screen.getByText("29")).toBeTruthy();
  });

  it("falls back to the 2D ballroom when the 3D chunk won't load", async () => {
    const { Intro } = await load({
      webgl: true,
      scene: () => {
        throw new Error("ChunkLoadError");
      },
    });
    const { container } = render(<Intro onDone={() => {}} />);
    expect(await screen.findAllByText("10")).toHaveLength(2);
    expect(stage()).toBe("2d");
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByTestId("scene")).toBeNull();
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
