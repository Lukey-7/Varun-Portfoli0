import { useEffect, useRef } from "react";
import ProjectArt from "../components/ProjectArt";
import type { ProjectArtKind } from "../projects";
import { pad, useMotionAllowed } from "./hooks";

/**
 * The project page's header art inside a measured frame: corner marks, a
 * figure label, and a crosshair with coordinates that follows a fine pointer
 * while the artwork leans gently away from it. One frame is drawn per pointer
 * move; nothing runs while the pointer is elsewhere.
 */
export default function HeroFigure({
  art,
  name,
  number,
}: {
  art: ProjectArtKind;
  name: string;
  number: number;
}) {
  const figure = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const allowed = useMotionAllowed();

  useEffect(() => {
    const node = figure.current;
    if (!node || !allowed || !window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    let x = 0.5;
    let y = 0.5;
    const draw = () => {
      frame = 0;
      node.style.setProperty("--px", x.toFixed(3));
      node.style.setProperty("--py", y.toFixed(3));
      if (readout.current) readout.current.textContent = `X ${x.toFixed(2)}  Y ${y.toFixed(2)}`;
    };
    const onMove = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
      node.dataset.tracking = "";
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      delete node.dataset.tracking;
      node.style.removeProperty("--px");
      node.style.removeProperty("--py");
    };
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  }, [allowed]);

  return (
    <div ref={figure} className="work-hero-figure" aria-hidden="true">
      <div className={`project-hero-art ordo-card-art${art.type === "visual" ? "" : " ordo-personal-art"}`}>
        <ProjectArt art={art} />
      </div>
      <div className="work-hud">
        <i className="work-hud-corner tl" />
        <i className="work-hud-corner tr" />
        <i className="work-hud-corner bl" />
        <i className="work-hud-corner br" />
        <i className="work-hud-x" />
        <i className="work-hud-y" />
        <span className="work-hud-label mono">FIG. {pad(number)}</span>
        <span className="work-hud-name mono">{name.toUpperCase()}</span>
        <span ref={readout} className="work-hud-readout mono">
          X 0.50 Y 0.50
        </span>
      </div>
    </div>
  );
}
