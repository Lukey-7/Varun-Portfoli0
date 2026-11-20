import { glyphPath, type WaveKind } from "./waves";

/** A kind's waveform drawn small, as a legend beside its label. Decorative. */
export function WaveGlyph({ kind, width = 28, height = 12 }: { kind: WaveKind; width?: number; height?: number }) {
  return (
    <svg
      className="logs-glyph"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={glyphPath(kind, width, height)} />
    </svg>
  );
}
