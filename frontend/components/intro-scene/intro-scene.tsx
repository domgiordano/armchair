"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type PerspectiveCamera, Vector3 } from "three";

import { Dancers } from "./dancers";
import { LightSpots } from "./light-spots";
import { MirrorBall } from "./mirror-ball";
import { Paddles } from "./paddles";
import { Room } from "./room";
import { camera as cameraAt, coverFov } from "./timeline";

// Seeded so every visit throws the same room of light.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Clocked {
  now: () => number;
}

function Rig({ now }: Clocked) {
  const eye = useMemo(() => new Vector3(), []);
  const look = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const cam = camera as PerspectiveCamera;
    const fov = coverFov(size.width / size.height);
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cameraAt(now(), eye, look);
    cam.position.copy(eye);
    cam.lookAt(look);
  }, -1);
  return null;
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

function Effects() {
  const mobile = useThree((s) => s.size.width < 700);
  return (
    <EffectComposer multisampling={mobile ? 0 : 4}>
      <Bloom mipmapBlur luminanceThreshold={0.8} luminanceSmoothing={0.25} intensity={0.9} radius={0.65} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.6} />
    </EffectComposer>
  );
}

interface IntroSceneProps {
  /** Called on the first drawn frame. The scene's clock starts then, at the poster's pose. */
  onReady: () => void;
}

/** The ballroom: a mirror ball, the couples on the floor, the judges' cards. */
export function IntroScene({ onReady }: IntroSceneProps) {
  const [warm, setWarm] = useState(false);
  const [ready, setReady] = useState(false);
  const start = useRef<number | null>(null);
  const now = useCallback(() => (start.current === null ? 0 : (performance.now() - start.current) / 1000), []);
  const random = useMemo(() => seeded(35), []);
  const onWarm = useCallback(() => setWarm(true), []);
  const onDrawn = useCallback(() => {
    start.current = performance.now();
    setReady(true);
    onReady();
  }, [onReady]);

  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: ready ? 1 : 0, transition: "opacity 350ms ease-out" }}>
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 40, near: 0.1, far: 60 }}
      >
        <color attach="background" args={["#030824"]} />
        <fogExp2 attach="fog" args={["#050b2c", 0.022]} />
        <Rig now={now} />
        <group visible={warm}>
          <Room now={now} />
          <MirrorBall random={random} now={now} />
          <LightSpots random={random} now={now} />
          <Dancers now={now} />
          <group scale={[1, -1, 1]}>
            <Dancers now={now} />
          </group>
          <Paddles now={now} />
        </group>
        <Effects />
        <Warmup onWarm={onWarm} />
        {warm && !ready && <FirstFrame onDrawn={onDrawn} />}
      </Canvas>
    </div>
  );
}
