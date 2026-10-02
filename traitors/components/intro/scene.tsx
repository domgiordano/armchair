"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Mesh, MeshBasicMaterial, type PerspectiveCamera, Vector3 } from "three";

import { Castle } from "./castle";
import { Figures } from "./figures";
import { Fire } from "./fire";
import { camera as cameraAt, coverFov, dip, VOID, voidOpen } from "./timeline";

interface Clocked {
  now: () => number;
}

interface RigProps extends Clocked {
  title: RefObject<HTMLElement | null>;
}

// The void's radius in metres at full open, for sizing the title over it.
const VOID_RADIUS = 0.42;

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

const blackout = new MeshBasicMaterial({ color: "#000000", transparent: true, depthTest: false, depthWrite: false, fog: false });

/** The dip to black over the cut, held just in front of the lens. */
function Dip({ now }: Clocked) {
  const mesh = useRef<Mesh>(null);
  const forward = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m) return;
    const d = dip(now());
    m.visible = d > 0;
    blackout.opacity = d;
    camera.getWorldDirection(forward);
    m.position.copy(camera.position).addScaledVector(forward, 0.3);
    m.quaternion.copy(camera.quaternion);
  });
  return (
    <mesh ref={mesh} material={blackout} renderOrder={20} frustumCulled={false}>
      <planeGeometry args={[4, 4]} />
    </mesh>
  );
}

interface WarmupProps {
  onWarm: () => void;
}

// Compile every shader before anything is drawn (in parallel where the browser
// offers KHR_parallel_shader_compile), so the first frames don't stall.
function Warmup({ onWarm }: WarmupProps) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    let live = true;
    const { gl, scene, camera } = get();
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

function Effects({ low }: { low: boolean }) {
  return (
    <EffectComposer multisampling={low ? 0 : 4}>
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={1.15} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.25} darkness={0.72} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.35} />
    </EffectComposer>
  );
}

interface IntroSceneProps {
  /** Called on the first drawn frame. The scene's clock starts then, at the poster's pose. */
  onReady: () => void;
  /** The DOM title, which the scene centres on the void. */
  title: RefObject<HTMLElement | null>;
}

/** The procession: down a torch-lit corridor to the round table, where the lead's hood falls. */
export function IntroScene({ onReady, title }: IntroSceneProps) {
  const [warm, setWarm] = useState(false);
  const [ready, setReady] = useState(false);
  // Phones start a step down; PerformanceMonitor takes anything else down when it drops frames.
  const [low, setLow] = useState(() => window.innerWidth < 700);
  const start = useRef<number | null>(null);
  const now = useCallback(() => (start.current === null ? 0 : (performance.now() - start.current) / 1000), []);
  const onWarm = useCallback(() => setWarm(true), []);
  const onDrawn = useCallback(() => {
    start.current = performance.now();
    setReady(true);
    onReady();
  }, [onReady]);
  const onDecline = useCallback(() => setLow(true), []);

  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: ready ? 1 : 0, transition: "opacity 350ms ease-out" }}>
      <Canvas
        dpr={low ? 1 : [1, 1.75]}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 42, near: 0.05, far: 60 }}
      >
        <PerformanceMonitor onDecline={onDecline} flipflops={1} />
        <color attach="background" args={["#040504"]} />
        <fogExp2 attach="fog" args={["#080604", 0.07]} />
        <hemisphereLight args={["#2b3a48", "#170f08", 0.35]} />
        <Rig now={now} title={title} />
        <group visible={warm}>
          <Castle />
          <Fire now={now} low={low} />
          <Figures now={now} />
        </group>
        <Dip now={now} />
        <Effects low={low} />
        <Warmup onWarm={onWarm} />
        {warm && !ready && <FirstFrame onDrawn={onDrawn} />}
      </Canvas>
    </div>
  );
}
