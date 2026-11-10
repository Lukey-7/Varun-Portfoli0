export type Rgb = readonly [number, number, number];

/** Any CSS colour as RGB, using the canvas's own parser. Unset or unparseable values use the fallback. */
export function toRgb(ctx: CanvasRenderingContext2D, value: string, fallback: Rgb): Rgb {
  if (!value) return fallback;
  const sentinel = "#010203";
  ctx.fillStyle = sentinel;
  ctx.fillStyle = value;
  const parsed = String(ctx.fillStyle);
  if (parsed === sentinel) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(parsed)) {
    const n = parseInt(parsed.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const parts = parsed.match(/[\d.]+/g);
  return parsed.startsWith("rgb") && parts && parts.length >= 3
    ? [Number(parts[0]), Number(parts[1]), Number(parts[2])]
    : fallback;
}
