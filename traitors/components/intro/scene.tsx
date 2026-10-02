"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, GodRays, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, type DepthOfFieldEffect, KernelSize, ToneMappingMode } from "postprocessing";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DataTexture, type Mesh, type PerspectiveCamera, VSMShadowMap, Vector2, Vector3 } from "three";

import { Figures } from "./figures";
import { Fire } from "./fire";
import { Grade } from "./grade";
import { Hall } from "./hall";
import { loadSurfaces, noise, type Surfaces } from "./textures";
import { camera as cameraAt, coverFov, focus, VOID, voidOpen } from "./timeline";

interface Clocked {
  now: () => number;
}

interface RigProps extends Clocked {
  title: RefObject<HTMLElement | null>;
}

// The void's radius in metres at full spread, for sizing the title inside it.
const VOID_RADIUS = 0.3;

/** Moves the camera, and keeps the DOM title centred on the void at the size it appears. */
function Rig({ now, title }: RigProps) {
  const scratch = useMemo(() => ({ eye: new Vector3(), look: new Vector3(), at: new Vector3(), edge: new Vector3() }), []);
  useFrame(({ camera, size }) => {
    const cam = camera as PerspectiveCamera;
    const fov = coverFov(size.width / size.height);
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    const t = now();
    const { eye, look, at, edge } = scratch;
    cameraAt(t, eye, look);
    cam.position.copy(eye);
    cam.lookAt(look);
    cam.updateMatrixWorld();

    const el = title.current;
    if (!el || voidOpen(t) === 0) return;
    at.copy(VOID).project(cam);
    edge.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(VOID_RADIUS).add(VOID).project(cam);
    const x = ((at.x + 1) / 2) * size.width;
    const y = ((1 - at.y) / 2) * size.height;
    const r = Math.abs(edge.x - at.x) * 0.5 * size.width;
    el.style.setProperty("--vx", `${x.toFixed(1)}px`);
    el.style.setProperty("--vy", `${y.toFixed(1)}px`);
    el.style.setProperty("--vr", `${r.toFixed(1)}px`);
  }, -1);
  return null;
}

interface WarmupProps {
  onWarm: () => void;
}

// Upload every texture and compile every shader before anything is drawn (in
// parallel where the browser offers KHR_parallel_shader_compile), so the
// first frames don't stall.
function Warmup({ onWarm }: WarmupProps) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    let live = true;
    const { gl, scene, camera } = get();
    scene.traverse((o) => {
      const m = (o as Mesh).material;
      if (!m || Array.isArray(m)) return;
      for (const v of Object.values(m)) if (v && typeof v === "object" && "isTexture" in v) gl.initTexture(v);
    });
    gl.compileAsync(scene, camera).then(() => {
      if (live) onWarm();
    });
    return () => {
      live = false;
    };
  }, [get, onWarm]);
  return null;
}

interface FirstFrameProps {
  onDrawn: () => void;
}

function FirstFrame({ onDrawn }: FirstFrameProps) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    // The frame this runs in draws after the callback; the next call means it's on screen.
    if (frames.current === 2) onDrawn();
  });
  return null;
}

interface EffectsProps extends Clocked {
  low: boolean;
  sun: RefObject<Mesh | null>;
}

const ABERRATION = new Vector2(0.0011, 0.0007);

/** The lens and the film: light shafts, focus, bloom, the grade, fringing, vignette and grain. */
function Effects({ now, low, sun }: EffectsProps) {
  const dof = useRef<DepthOfFieldEffect>(null);
  const target = useMemo(() => new Vector3(), []);
  const grade = useMemo(() => new Grade(), []);
  useFrame(() => {
    const d = dof.current;
    if (d?.target) d.target.copy(focus(now(), target));
  });
  return (
    <EffectComposer multisampling={low ? 0 : 4} autoClear={false}>
      <GodRays
        sun={sun as RefObject<Mesh>}
        samples={low ? 36 : 60}
        density={0.95}
        decay={0.93}
        weight={0.5}
        exposure={0.42}
        clampMax={1}
        blur
        kernelSize={KernelSize.SMALL}
        resolutionScale={low ? 0.35 : 0.5}
      />
      <DepthOfField ref={dof} target={target} focusRange={0.9} bokehScale={low ? 2.5 : 4} resolutionScale={low ? 0.35 : 0.5} />
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.3} intensity={0.75} radius={0.62} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <primitive object={grade} />
      <ChromaticAberration offset={ABERRATION} radialModulation modulationOffset={0.25} />
      <Vignette offset={0.22} darkness={0.78} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.42} />
    </EffectComposer>
  );
}

interface IntroSceneProps {
  /** Called on the first drawn frame. The scene's clock starts then, at the poster's pose. */
  onReady: () => void;
  /** The DOM title, which the scene centres on the void. */
  title: RefObject<HTMLElement | null>;
}

/** The procession down the hall to the lens, then the lead's hood slides back on darkness. */
export function IntroScene({ onReady, title }: IntroSceneProps) {
  const [surfaces, setSurfaces] = useState<Surfaces | null>(null);
  const [warm, setWarm] = useState(false);
  const [ready, setReady] = useState(false);
  // Phones start a step down; PerformanceMonitor takes anything else down when it drops frames.
  const [low, setLow] = useState(() => window.innerWidth < 700);
  const fog = useMemo<DataTexture>(() => noise(), []);
  const sun = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  const now = useCallback(() => (start.current === null ? 0 : (performance.now() - start.current) / 1000), []);
  const onWarm = useCallback(() => setWarm(true), []);
  const onDrawn = useCallback(() => {
    start.current = performance.now();
    setReady(true);
    onReady();
  }, [onReady]);
  const onDecline = useCallback(() => setLow(true), []);

  useEffect(() => {
    let live = true;
    loadSurfaces().then((s) => {
      if (live) setSurfaces(s);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: ready ? 1 : 0, transition: "opacity 350ms ease-out" }}>
      <Canvas
        dpr={low ? 1 : [1, 1.75]}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        shadows={{ type: VSMShadowMap }}
        camera={{ fov: 42, near: 0.05, far: 40 }}
      >
        <PerformanceMonitor onDecline={onDecline} flipflops={1} />
        <color attach="background" args={["#030303"]} />
        <fogExp2 attach="fog" args={["#0b0805", 0.045]} />
        <hemisphereLight args={["#24323a", "#0e0905", 0.12]} />
        <Rig now={now} title={title} />
        {surfaces && (
          <group visible={warm}>
            <Hall surfaces={surfaces} />
            <Fire now={now} low={low} noise={fog} sun={sun} />
            <Figures now={now} />
            <Warmup onWarm={onWarm} />
          </group>
        )}
        {warm && <Effects now={now} low={low} sun={sun} />}
        {warm && !ready && <FirstFrame onDrawn={onDrawn} />}
      </Canvas>
    </div>
  );
}
