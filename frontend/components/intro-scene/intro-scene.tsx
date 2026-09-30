"use client";

import { Sparkles, SpotLight } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { useMemo, useRef, useState } from "react";
import { type PerspectiveCamera, type SpotLight as SpotLightImpl, Vector2, Vector3 } from "three";

import { LightSpots } from "./light-spots";
import { MirrorBall } from "./mirror-ball";
import { Paddles } from "./paddles";
import { Room } from "./room";
import { BALL, PADDLES_UP, PADDLE_Y, PADDLE_Z, camera as cameraAt, houseLights, phase } from "./timeline";

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
    // Portrait phones get a taller lens so the room isn't a keyhole.
    const fov = size.width < size.height ? 60 : 40;
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

interface BeamProps extends Clocked {
  from: [number, number, number];
  color: string;
  aim: (t: number, target: Vector3) => void;
  intensity: number;
  angle: number;
  distance: number;
  opacity: number;
  on?: (t: number) => number;
  /** False for a key light near the lens, whose cone would fog the whole frame. */
  volumetric?: boolean;
}

// A follow-spot: a real light for the pool it throws, plus drei's volumetric cone for the haze.
function Beam({ now, from, color, aim, intensity, angle, distance, opacity, on = houseLights, volumetric = true }: BeamProps) {
  const light = useRef<SpotLightImpl>(null);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const t = now();
    aim(t, l.target.position);
    l.target.updateMatrixWorld();
    l.intensity = intensity * on(t);
  });
  return (
    <SpotLight
      ref={light}
      position={from}
      color={color}
      angle={angle}
      penumbra={0.6}
      distance={distance}
      decay={0}
      attenuation={distance * 0.9}
      anglePower={4}
      radiusTop={0.12}
      opacity={opacity}
      volumetric={volumetric}
      castShadow={false}
    />
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    // Wait out the first frames, where shaders compile and the reflector warms up.
    if (frames.current === 3) onReady();
  });
  return null;
}

function Effects() {
  const mobile = useThree((s) => s.size.width < 700);
  const offset = useMemo(() => new Vector2(0.0007, 0.0009), []);
  return (
    <EffectComposer multisampling={mobile ? 0 : 4}>
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={1.1} radius={0.7} />
      <ChromaticAberration offset={offset} radialModulation modulationOffset={0.35} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Noise premultiply opacity={0.15} blendFunction={BlendFunction.SOFT_LIGHT} />
      <Vignette offset={0.28} darkness={0.72} />
    </EffectComposer>
  );
}

const SWEEP_A = (t: number, v: Vector3) => v.set(Math.sin(t * 0.55 + 0.4) * 5, 0, 1.5 + Math.cos(t * 0.4) * 3);
const SWEEP_B = (t: number, v: Vector3) => v.set(Math.sin(t * 0.47 + 2.6) * 6, 0, -1 + Math.cos(t * 0.52 + 1) * 3);
const AT_BALL = (_: number, v: Vector3) => v.copy(BALL);
const AT_PADDLES = (_: number, v: Vector3) => v.set(0, PADDLE_Y, PADDLE_Z);
const PADDLE_LIGHT = (t: number) => phase(t, PADDLES_UP - 0.3, PADDLES_UP + 0.5);

interface IntroSceneProps {
  /** performance.now() when the intro began; the scene joins at that point in the timeline. */
  start: number;
}

/** The ballroom: a mirror ball under follow-spots, light thrown across the room, paddles rising. */
export function IntroScene({ start }: IntroSceneProps) {
  const [ready, setReady] = useState(false);
  const now = useMemo(() => () => (performance.now() - start) / 1000, [start]);
  const random = useMemo(() => seeded(35), []);
  const [mobile] = useState(() => window.innerWidth < 700);

  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: ready ? 1 : 0, transition: "opacity 400ms" }}>
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 40, near: 0.1, far: 60 }}
      >
        <color attach="background" args={["#040a26"]} />
        <fogExp2 attach="fog" args={["#07102f", 0.028]} />
        <hemisphereLight args={["#27347a", "#05081a", 0.6]} />
        <Rig now={now} />
        <Room mobile={mobile} />
        <MirrorBall random={random} now={now} />
        <LightSpots random={random} now={now} />
        <Paddles now={now} />

        <Beam now={now} from={[-9, 0.2, -2]} color="#ffd594" aim={AT_BALL} intensity={90} angle={0.06} distance={13} opacity={0.3} />
        <Beam now={now} from={[9, 0.2, -1]} color="#bcd2ff" aim={AT_BALL} intensity={70} angle={0.06} distance={13} opacity={0.25} />
        <Beam now={now} from={[0, 0.4, -10]} color="#f0b8ff" aim={AT_BALL} intensity={50} angle={0.06} distance={14} opacity={0.2} />
        <Beam now={now} from={[-5, 10.8, -4]} color="#fff0d2" aim={SWEEP_A} intensity={9} angle={0.16} distance={15} opacity={0.18} />
        <Beam now={now} from={[6, 10.8, -5]} color="#c9d8ff" aim={SWEEP_B} intensity={7} angle={0.16} distance={15} opacity={0.15} />
        <Beam
          now={now}
          from={[0, 9, 7.5]}
          color="#ffe2a8"
          aim={AT_PADDLES}
          intensity={5}
          angle={0.16}
          distance={12}
          opacity={0}
          on={PADDLE_LIGHT}
          volumetric={false}
        />

        <Sparkles count={mobile ? 260 : 480} scale={[22, 10, 22]} position={[0, 5, 0]} size={1.3} speed={0.25} opacity={0.35} noise={0.6} color="#ffe6b8" />
        <Effects />
        <Ready onReady={() => setReady(true)} />
      </Canvas>
    </div>
  );
}
