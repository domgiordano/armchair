"use client";

import { ContactShadows, MeshReflectorMaterial } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { BACK_TILT, CROWN_REST, PADDLE_HINGE, PADDLE_SIZE, chairGeometry, crownGeometry, paddleGeometry } from "./chair";
import { beam, bokeh, fabricNormals, floorRoughness, motes, studioEnvironment } from "./stage-fx";
import { CROWN_RELEASE, PADDLE_FLIP, SPOT_ON, crownDrop, easeOut, paddleAngle, smooth, spotLevel } from "./timeline";

interface IntroSceneProps {
  /** performance.now() at t = 0, shared with the CSS copy timeline. */
  origin: () => number;
  onReady: () => void;
}

const NIGHT = "#03081d";
const SPOT_POS = new THREE.Vector3(0.5, 6.4, 1.3);
const SPOT_ANGLE = 0.34;
const CROWN_DROP = 3.4;
// The chair centre sits this far above the middle of the viewport, leaving
// the lower part of the frame to the wordmark.
const LIFT = 0.14;

function plaqueTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 430;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const family = getComputedStyle(document.body).fontFamily;
  const draw = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f5f6ff";
    ctx.font = `800 250px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("10", 256, 196);
    const bar = ctx.createLinearGradient(136, 0, 376, 0);
    bar.addColorStop(0, "#3b5bff");
    bar.addColorStop(0.5, "#e83fd0");
    bar.addColorStop(1, "#ff9a3d");
    ctx.fillStyle = bar;
    ctx.beginPath();
    ctx.roundRect(136, 338, 240, 24, 12);
    ctx.fill();
    texture.needsUpdate = true;
  };
  draw();
  // Poppins 800 is already on the page for the wordmark; redraw once it lands.
  void document.fonts.load(`800 250px ${family}`).then(draw);
  return texture;
}

function Studio({ origin, onReady, lite }: IntroSceneProps & { lite: boolean }) {
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => studioEnvironment(gl), [gl]);

  const props = useMemo(() => {
    const kit = {
      chair: chairGeometry(),
      crown: crownGeometry(),
      paddle: paddleGeometry(),
      plaque: plaqueTexture(),
      beam: beam(9, SPOT_ANGLE * 0.82),
      motes: motes(lite ? 140 : 220, SPOT_POS, SPOT_ANGLE),
      bokeh: bokeh(),
      fabric: fabricNormals(),
      floor: floorRoughness(),
    };
    kit.floor.repeat.set(5, 5);
    // Layer 1 keeps the haze out of ContactShadows' depth pass, where the
    // dust rendered as dark specks on the floor.
    kit.beam.layers.set(1);
    kit.motes.layers.set(1);
    kit.bokeh.layers.set(1);
    return kit;
  }, [lite]);

  const spot = useRef<THREE.SpotLight>(null);
  const key = useRef<THREE.SpotLight>(null);
  const rimL = useRef<THREE.SpotLight>(null);
  const rimR = useRef<THREE.SpotLight>(null);
  const kicker = useRef<THREE.SpotLight>(null);
  const crown = useRef<THREE.Group>(null);
  const paddle = useRef<THREE.Group>(null);
  const face = useRef<THREE.MeshStandardMaterial>(null);
  const cone = useRef<ReturnType<typeof beam>>(null);
  const dust = useRef<ReturnType<typeof motes>>(null);
  const lens = useRef<ReturnType<typeof bokeh>>(null);
  const start = useRef<number | null>(null);
  const frames = useRef(0);
  const aim = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    start.current ??= origin();
    const t = (performance.now() - start.current) / 1000;
    const { camera, size, scene } = state;
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.layers.enable(1);

    // Camera: fit the chair to the viewport, dolly in on a slow arc, drift
    // like a handheld and calm down as it settles.
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fit = Math.max(2.4 / (2 * tan * 0.5), 2.1 / (2 * tan * (size.width / size.height) * 0.72));
    const dolly = easeOut(t / 4.6);
    const dist = fit * (1.3 - 0.3 * dolly);
    const orbit = 0.34 - 0.28 * dolly;
    const hand = (0.9 - 0.55 * smooth(3.4, 4.6, t)) * dist * 0.0022;
    const landing = crownDrop(t - CROWN_RELEASE, CROWN_DROP).impact;
    const thud = landing > 0 ? Math.exp(-14 * landing) * Math.sin(landing * 48) * dist * 0.0016 : 0;
    camera.position.set(
      Math.sin(orbit) * dist + hand * (Math.sin(t * 1.1) + 0.6 * Math.sin(t * 2.3 + 1.3)),
      1.5 + 1.2 * (1 - dolly) + hand * (Math.sin(t * 1.7 + 0.4) + 0.5 * Math.sin(t * 3.1)) + thud,
      Math.cos(orbit) * dist,
    );
    camera.lookAt(0, 1.1, 0);
    camera.rotateZ(0.0035 * Math.sin(t * 0.9 + 2) * (hand / (dist * 0.0022)));
    camera.setViewOffset(size.width, size.height, 0, size.height * LIFT, size.width, size.height);
    // Fog measured from the chair, not the camera: portrait framing sits the
    // camera farther back, and the stage should fade out behind the chair either way.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = dist - 0.5;
      scene.fog.far = dist + 7;
    }

    // Follow spot strikes off to the left and swings onto the chair.
    const lit = spotLevel(t);
    const swing = Math.max(0, t - SPOT_ON);
    aim.set(-1.5 * Math.exp(-4 * swing) * Math.cos(3 * swing), 0.7, 0);
    if (spot.current) {
      spot.current.intensity = 70 * lit;
      spot.current.target.position.copy(aim);
      spot.current.target.updateMatrixWorld();
    }
    if (key.current) key.current.intensity = 10 * smooth(0.6, 1.6, t);
    if (cone.current) {
      cone.current.lookAt(aim);
      cone.current.material.uniforms.uIntensity.value = 0.32 * lit;
      cone.current.material.uniforms.uTime.value = t;
    }
    if (dust.current) {
      const u = dust.current.material.uniforms;
      u.uTime.value = t;
      u.uIntensity.value = 1.4 * lit;
      u.uAxis.value.subVectors(aim, SPOT_POS).normalize();
      u.uPixel.value = (0.012 * size.height * state.viewport.dpr) / tan;
    }
    if (lens.current) {
      lens.current.material.uniforms.uIntensity.value = 0.16 * smooth(0.5, 1.8, t);
      lens.current.material.uniforms.uPixel.value = (0.5 * size.height * state.viewport.dpr) / tan;
    }
    scene.environmentIntensity = 0.06 + 1.1 * lit * smooth(0.5, 1.3, t);

    const wash = 0.3 * smooth(0.7, 1.5, t) + 0.7 * smooth(2.5, 3.5, t);
    if (rimL.current) rimL.current.intensity = 70 * wash;
    if (rimR.current) rimR.current.intensity = 70 * wash;

    // Crown falls from above frame, bounces and wobbles to rest.
    if (crown.current) {
      const { y, impact } = crownDrop(t - CROWN_RELEASE, CROWN_DROP);
      crown.current.position.set(CROWN_REST.x, CROWN_REST.y + y, CROWN_REST.z);
      crown.current.rotation.set(BACK_TILT, (y / CROWN_DROP) * 1.6, impact > 0 ? 0.14 * Math.exp(-5 * impact) * Math.sin(impact * 17) : 0);
    }

    // Scorecard paddle springs up off the seat; the rim light flares as it lands.
    if (paddle.current) paddle.current.rotation.x = BACK_TILT + paddleAngle(t - PADDLE_FLIP);
    const flare = smooth(PADDLE_FLIP + 0.1, PADDLE_FLIP + 0.3, t);
    if (kicker.current) kicker.current.intensity = 60 * flare * (0.45 + 0.55 * Math.exp(-2.5 * Math.max(0, t - PADDLE_FLIP - 0.3)));
    if (face.current) face.current.emissiveIntensity = 0.25 + 0.75 * flare;

    frames.current += 1;
    if (frames.current === 2) onReady();
  });

  return (
    <>
      <hemisphereLight args={["#27306b", "#000000", 0.25]} />
      <primitive object={env.texture} attach="environment" />
      <spotLight
        ref={spot}
        position={SPOT_POS}
        angle={SPOT_ANGLE}
        penumbra={0.55}
        decay={2}
        color="#fff0dc"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-camera-near={3}
        shadow-camera-far={10}
      />
      <spotLight ref={key} position={[3, 3.2, 5]} angle={0.5} penumbra={1} decay={2} color="#ffe2cc" />
      <spotLight ref={rimL} position={[-3.4, 2.8, -2.8]} angle={0.6} penumbra={1} decay={2} color="#4d6bff" />
      <spotLight ref={rimR} position={[3.4, 2.8, -2.8]} angle={0.6} penumbra={1} decay={2} color="#ff5fc8" />
      <spotLight ref={kicker} position={[0.4, 3, -1.7]} angle={0.4} penumbra={0.8} decay={2} color="#ffe6bf" />

      <mesh geometry={props.chair} castShadow receiveShadow>
        <meshPhysicalMaterial
          vertexColors
          normalMap={props.fabric}
          normalScale={[0.12, 0.12]}
          roughness={0.34}
          sheen={0.5}
          sheenRoughness={0.4}
          sheenColor="#ff9ee6"
          clearcoat={1}
          clearcoatRoughness={0.08}
        />
      </mesh>

      <group ref={paddle} position={PADDLE_HINGE} rotation-x={BACK_TILT + Math.PI / 2}>
        <mesh geometry={props.paddle} castShadow>
          <meshPhysicalMaterial color="#03051a" roughness={0.4} clearcoat={1} clearcoatRoughness={0.08} />
        </mesh>
        <mesh position={[0, PADDLE_SIZE.h / 2, 0.027]}>
          <planeGeometry args={[PADDLE_SIZE.w * 0.92, PADDLE_SIZE.h * 0.92]} />
          <meshStandardMaterial
            ref={face}
            map={props.plaque}
            emissiveMap={props.plaque}
            emissive="#ffffff"
            transparent
            roughness={0.35}
          />
        </mesh>
      </group>

      <group ref={crown} position={[CROWN_REST.x, CROWN_REST.y + CROWN_DROP, CROWN_REST.z]}>
        <mesh geometry={props.crown} castShadow>
          <meshPhysicalMaterial color="#ffc84a"
            metalness={1}
            roughness={0.14}
            clearcoat={0.4}
            envMap={env.texture}
            envMapIntensity={2.4} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <primitive ref={cone} object={props.beam} position={SPOT_POS} />
      <primitive ref={dust} object={props.motes} />
      <primitive ref={lens} object={props.bokeh} />

      {/* No shadow map on the floor: ContactShadows grounds the chair softly. */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[40, 40]} />
        <MeshReflectorMaterial
          resolution={lite ? 256 : 512}
          blur={[600, 200]}
          mixBlur={1}
          mixStrength={1.5}
          mirror={0.4}
          color="#12173d"
          roughnessMap={props.floor}
          roughness={0.6}
          metalness={0.2}
        />
      </mesh>
      <ContactShadows position={[0, 0.004, 0]} scale={4.5} blur={3.2} far={1.2} opacity={0.85} resolution={lite ? 256 : 512} color="#000208" />
    </>
  );
}

export function IntroScene({ origin, onReady }: IntroSceneProps) {
  // Phones get cheaper reflections and no MSAA; DPR is capped for everyone.
  const [lite] = useState(() => window.matchMedia("(max-width: 767px)").matches);

  return (
    <Canvas
      className="intro-canvas"
      style={{ position: "absolute", inset: 0 }}
      dpr={[1, 1.75]}
      shadows
      flat
      gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }}
      camera={{ fov: 28, near: 0.5, far: 40 }}
    >
      <color attach="background" args={[NIGHT]} />
      <fog attach="fog" args={[NIGHT, 10, 20]} />
      <Studio origin={origin} onReady={onReady} lite={lite} />
      <EffectComposer multisampling={lite ? 0 : 4} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.8} luminanceSmoothing={0.25} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette offset={0.28} darkness={0.75} />
        <Noise blendFunction={BlendFunction.OVERLAY} opacity={0.14} />
      </EffectComposer>
    </Canvas>
  );
}
