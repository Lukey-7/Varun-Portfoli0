import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { content } from "../content";
import { ArcadeCabinet } from "../demos/ArcadeDemo";
import { MaskTitle } from "../content/MaskTitle";
import { useStill } from "../content/hooks";
import "../content/content.css";

/**
 * Waits two frames, so a "before" state is painted before the "after" state
 * transitions from it. A timer backs the frames up, so a throttled tab never
 * leaves the cabinet in its "before" state.
 */
function afterPaint(callback: () => void) {
  let second = 0;
  let called = false;
  const run = () => {
    if (called) return;
    called = true;
    callback();
  };
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(run);
  });
  const fallback = window.setTimeout(run, 120);
  return () => {
    cancelAnimationFrame(first);
    cancelAnimationFrame(second);
    window.clearTimeout(fallback);
  };
}

/**
 * Lukey Arcade: both games in a cabinet sized to each one, not squeezed into a
 * page. On arrival the cartridges slide into the rack and the screen powers
 * on; choosing another cartridge powers the screen on again. CSS transitions
 * do the work, so nothing runs once the moment has played.
 */
export default function PlayPage() {
  const { playPage } = content;
  const still = useStill();
  // Only animate when motion is welcome; a paused or reduced page shows the cabinet as it is.
  const [boot, setBoot] = useState<"pending" | "done">(() => (still ? "done" : "pending"));
  const [swap, setSwap] = useState<"pending" | "done">("done");
  const swapCancel = useRef<() => void>(() => {});
  useEffect(() => {
    document.title = "Play | Varun Darji";
  }, []);
  useEffect(() => {
    if (boot === "done") return;
    return afterPaint(() => setBoot("done"));
  }, [boot]);
  useEffect(() => () => swapCancel.current(), []);

  const onChooseCapture = (event: MouseEvent<HTMLElement>) => {
    if (still) return;
    const cart = (event.target as HTMLElement).closest(".arcade-cabinet__cart");
    if (!cart || cart.getAttribute("aria-pressed") === "true") return;
    swapCancel.current();
    setSwap("pending");
    swapCancel.current = afterPaint(() => setSwap("done"));
  };

  return (
    <article className="play-page">
      <header className="page-hero section-wrap">
        <div className="ordo-section-label">
          <span>{playPage.label[0]}</span>
          <span>{playPage.label[1]}</span>
        </div>
        <div className="play-head">
          <MaskTitle lines={playPage.title} />
          <div>
            <p className="project-lede">{playPage.intro}</p>
            <Link to="/work/arcade" className="section-link">
              {playPage.link} <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>
      <section
        className="section-wrap play-stage"
        aria-label="Arcade"
        data-boot={boot}
        data-swap={swap}
        onClickCapture={onChooseCapture}
      >
        <ArcadeCabinet size="full" />
      </section>
    </article>
  );
}
