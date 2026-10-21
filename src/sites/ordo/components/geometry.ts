export type Point = [number, number, number];

/** Surface point (u, v) of form 0 knot, 1 sphere or 2 wave. */
export function position(u: number, v: number, form: number): Point {
  if (form === 1) {
    const phi = Math.acos((2 * v) / (Math.PI * 2) - 1);
    return [
      1.65 * Math.sin(phi) * Math.cos(u),
      1.65 * Math.cos(phi),
      1.65 * Math.sin(phi) * Math.sin(u),
    ];
  }
  if (form === 2) {
    const x = (u / Math.PI - 1) * 2;
    const z = (v / Math.PI - 1) * 2;
    return [x, Math.sin(x * 2 + z) * Math.cos(z * 1.6) * 0.65, z];
  }
  const r = 1.05 + 0.38 * Math.cos(3 * u);
  const cx = r * Math.cos(2 * u),
    cy = r * Math.sin(2 * u),
    cz = 0.62 * Math.sin(3 * u);
  const tangent: Point = [
    -2 * r * Math.sin(2 * u) - 1.14 * Math.sin(3 * u) * Math.cos(2 * u),
    2 * r * Math.cos(2 * u) - 1.14 * Math.sin(3 * u) * Math.sin(2 * u),
    1.86 * Math.cos(3 * u),
  ];
  const length = Math.hypot(...tangent);
  const t = tangent.map((n) => n / length) as Point;
  const norm = Math.hypot(t[0], t[1]);
  const n: Point = [-t[1] / norm, t[0] / norm, 0];
  const b: Point = [-t[2] * n[1], t[2] * n[0], t[0] * n[1] - t[1] * n[0]];
  const thickness = 0.36;
  return [
    cx + thickness * (Math.cos(v) * n[0] + Math.sin(v) * b[0]),
    cy + thickness * (Math.cos(v) * n[1] + Math.sin(v) * b[1]),
    cz + thickness * Math.sin(v) * b[2],
  ];
}
