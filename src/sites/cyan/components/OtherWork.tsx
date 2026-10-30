import { useState } from "react";
import { ArrowUpRight, Gamepad2 } from "lucide-react";
import { otherWork } from "@/data/portfolio";
import { Lissajous } from "../motion/Lissajous";

/**
 * The "Also built" cards. The hovered or focused card is state of its own, so
 * a hover re-renders this section and not the whole page.
 */
export function OtherWork() {
  // The card being hovered or focused, by project name.
  const [signalled, setSignalled] = useState<string | null>(null);
  // Leaving one card must not clear the card that has since taken over.
  const release = (name: string) =>
    setSignalled((current) => (current === name ? null : current));

  return (
    <section className="other-section section-wrap">
      <h2>Also built.</h2>
      <div className="other-grid">
        {otherWork.map((project) => (
          <a
            className={`other-project ${project.kind}`}
            href={project.href}
            target={project.href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            key={project.name}
            onMouseEnter={() => setSignalled(project.name)}
            onMouseLeave={() => release(project.name)}
            onFocus={() => setSignalled(project.name)}
            onBlur={() => release(project.name)}
          >
            <div className="other-symbol">
              {project.kind === "language" ? (
                <span lang="de">ß</span>
              ) : project.kind === "tetris" ? (
                <div className="tetromino" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              ) : (
                <Gamepad2 size={38} strokeWidth={1.1} />
              )}
            </div>
            <div>
              <div className="other-name">
                <h3>{project.name}</h3>
                <ArrowUpRight size={18} />
              </div>
              <p>{project.description}</p>
              <span className="mono">{project.tech}</span>
              <Lissajous seed={project.name} active={signalled === project.name} />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
