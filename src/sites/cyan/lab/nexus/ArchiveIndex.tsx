import { useEffect, useState, type CSSProperties } from "react";
import { pointerLight } from "../kit";
import { ARCHIVE, COUNTS, matches, type ArchiveEntry, type FilterKey } from "./data";
import { useLiveMotion } from "./useLiveMotion";

const pad = (n: number) => String(n).padStart(2, "0");

/** A two-digit phosphor readout that counts up to its value once, on arrival. */
function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const live = useLiveMotion();
  const [shown, setShown] = useState(live ? 0 : value);

  useEffect(() => {
    if (!live) {
      setShown(value);
      return;
    }
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, Math.max(0, (now - start - delay) / 900));
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(eased * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, delay, live]);

  return (
    <>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">{pad(shown)}</span>
    </>
  );
}

/**
 * The hero's instrument: live counts as phosphor readouts, and one channel per
 * project whose bar height is its number of screenshots. Channels the current
 * filter hides go dark; any channel opens its project.
 */
export function ArchiveIndex({
  filter,
  onOpen,
}: {
  filter: FilterKey;
  onOpen: (entry: ArchiveEntry, opener: HTMLElement) => void;
}) {
  const [tuned, setTuned] = useState<ArchiveEntry | null>(null);
  const onScreen = ARCHIVE.filter((entry) => matches(entry, filter)).length;
  const tallest = Math.max(...ARCHIVE.map((entry) => entry.media.length));

  return (
    <div className="nx-index lab-panel lab-bracket" {...pointerLight}>
      <div className="nx-index-head mono">
        <span>Archive index</span>
        <span className="nx-index-sweep" aria-hidden="true" />
      </div>
      <dl className="nx-readouts">
        <div>
          <dt className="mono">Projects</dt>
          <dd className="lab-readout">
            <CountUp value={COUNTS.projects} />
          </dd>
        </div>
        <div>
          <dt className="mono">Screenshots</dt>
          <dd className="lab-readout">
            <CountUp value={COUNTS.frames} delay={120} />
          </dd>
        </div>
        <div>
          <dt className="mono">Public repos</dt>
          <dd className="lab-readout">
            <CountUp value={COUNTS.repos} delay={240} />
          </dd>
        </div>
        <div>
          <dt className="mono">On screen</dt>
          <dd className="lab-readout" aria-live="polite">
            {pad(onScreen)}
          </dd>
        </div>
      </dl>
      <div className="nx-channels" role="group" aria-label="Open a project by channel">
        {ARCHIVE.map((entry) => {
          const on = matches(entry, filter);
          return (
            <button
              key={entry.id}
              type="button"
              className="nx-channel"
              data-on={on}
              style={{ "--level": entry.media.length / tallest } as CSSProperties}
              aria-label={`Open ${entry.project.title}, ${entry.media.length} screenshots`}
              onPointerEnter={() => setTuned(entry)}
              onPointerLeave={() => setTuned(null)}
              onFocus={() => setTuned(entry)}
              onBlur={() => setTuned(null)}
              onClick={(event) => onOpen(entry, event.currentTarget)}
            >
              <span className="nx-channel-bar" aria-hidden="true">
                <span />
              </span>
              <span className="nx-channel-code mono" aria-hidden="true">
                {entry.code}
              </span>
            </button>
          );
        })}
      </div>
      <p className="nx-index-tuned mono" aria-hidden="true">
        {tuned ? (
          <>
            <span>CH.{tuned.code}</span> {tuned.project.title}{" "}
            <b className="lab-readout">{tuned.media.length ? `${pad(tuned.media.length)} FR` : "FIGURE"}</b>
          </>
        ) : (
          <>Bar height: screenshots per project. Pick a channel.</>
        )}
      </p>
    </div>
  );
}
