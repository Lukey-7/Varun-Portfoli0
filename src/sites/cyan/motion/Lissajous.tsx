import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";
import "./lissajous.css";

/*
 * A small signal signature for each "Also built" card: a Lissajous figure
 * whose frequency ratio and phase come from a hash of the project's name, the
 * kind of figure an oscilloscope draws when two signals meet. It is a signature,
 * not a measurement, so it is drawn in the accent colour and its readout is not
 * amber. At rest the whole figure shows dimly. When the card is hovered or
 * focused, a bright trace draws itself over it and the ratio and phase appear.
 * Under reduced motion or the site-wide pause the full figure appears at once.
 */

/** The figure's side in SVG units; the viewBox adds a margin for the stroke. */
const SIZE = 40;
const MARGIN = 3;
const PHASE_STEPS = 180;
const STEPS = 240;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Every ratio a:b with both in 1..5, different from each other and with no common factor. */
const RATIOS: ReadonlyArray<readonly [number, number]> = [1, 2, 3, 4, 5].flatMap((a) =>
  [1, 2, 3, 4, 5].filter((b) => a !== b && gcd(a, b) === 1).map((b) => [a, b] as const),
);

/** FNV-1a over the string, then a finaliser so near-identical names spread out. */
function hashSeed(seed: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * The same name always gives the same figure: coprime whole frequencies a and b
 * in 1..5 that differ, and a phase in [0, π) that is a whole number of degrees,
 * so the readout shows exactly the phase that was drawn.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the figure's maths and its tests share these helpers
export function lissajousFor(seed: string): { a: number; b: number; phase: number } {
  const hash = hashSeed(seed);
  const [a, b] = RATIOS[hash % RATIOS.length];
  const degrees = Math.floor(hash / RATIOS.length) % PHASE_STEPS;
  return { a, b, phase: (degrees * Math.PI) / PHASE_STEPS };
}

const round = (value: number) => String(Math.round(value * 100) / 100);

/**
 * An SVG path `d` for x = sin(a·t + phase), y = sin(b·t) over one turn of t,
 * scaled to fill a `size` square. It has `steps + 1` points, so it ends where
 * it began. Up on the screen is up in the figure.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the figure's maths and its tests share these helpers
export function lissajousPath(a: number, b: number, phase: number, size: number, steps = STEPS): string {
  const half = size / 2;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = half + half * Math.sin(a * t + phase);
    const y = half - half * Math.sin(b * t);
    d += `${i === 0 ? "M" : "L"}${round(x)} ${round(y)}`;
  }
  return d;
}

/**
 * The signature for one project. `active` is the card being hovered or focused.
 * The wrapper and the figure are hidden from assistive technology: the card's
 * own text already says everything the figure and its readout would.
 */
export function Lissajous({ seed, active }: { seed: string; active: boolean }) {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const still = Boolean(reduced) || paused;
  const { d, readout } = useMemo(() => {
    const { a, b, phase } = lissajousFor(seed);
    return {
      d: lissajousPath(a, b, phase, SIZE),
      readout: `${a}:${b} · φ ${Math.round((phase * 180) / Math.PI)}°`,
    };
  }, [seed]);
  const box = SIZE + MARGIN * 2;

  return (
    <span
      className="lissajous"
      aria-hidden="true"
      data-active={active ? "" : undefined}
      data-still={still ? "" : undefined}
    >
      <svg
        className="lissajous-figure"
        aria-hidden="true"
        focusable="false"
        viewBox={`${-MARGIN} ${-MARGIN} ${box} ${box}`}
        width={box}
        height={box}
      >
        <path className="lissajous-ghost" d={d} />
        {/* pathLength makes the dash pattern one unit long, so offset 1 hides the trace and 0 shows it all. */}
        <path
          className="lissajous-trace"
          d={d}
          pathLength={1}
          style={{ strokeDashoffset: active ? 0 : 1 }}
        />
      </svg>
      <span className="lissajous-readout">{readout}</span>
    </span>
  );
}
