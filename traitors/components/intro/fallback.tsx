import type { CSSProperties } from "react";

import styles from "./fallback.module.css";

// Seeded so the embers rise the same way on every visit.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const next = random(11);
const EMBERS = Array.from({ length: 18 }, () => ({
  x: 14 + next() * 72,
  drift: (next() - 0.5) * 14,
  size: 1.5 + next() * 2.5,
  delay: next() * 5200,
  life: 2600 + next() * 2200,
}));

/**
 * The intro without WebGL, made from the scene's own opening frame: the
 * poster under it pushes in slowly on the lead while fog drifts through the
 * fire's light, then the dark spreads from where the lead's face would be and
 * the title burns in inside it. Every layer is a transform or an opacity.
 */
export function Fallback() {
  return (
    <div aria-hidden="true" className={styles.room}>
      <div className={styles.fire} />
      <div className={`${styles.fog} ${styles.near}`} />
      <div className={`${styles.fog} ${styles.far}`} />
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className={styles.ember}
          style={
            {
              "--x": `${e.x}%`,
              "--drift": `${e.drift}vw`,
              "--size": `${e.size}px`,
              animationDelay: `${e.delay}ms`,
              animationDuration: `${e.life}ms`,
            } as CSSProperties
          }
        />
      ))}
      <div className={styles.dark} />
    </div>
  );
}
