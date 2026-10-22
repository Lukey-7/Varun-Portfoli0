import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import "./demos.css";

/**
 * The shared shell for every in-browser project demo: a label bar, the demo
 * itself and a plain note on what is simplified. Demos never call a server.
 */
export default function DemoFrame({
  project,
  title,
  intro,
  note,
  onReset,
  className,
  children,
}: {
  /** Project name, shown in the label bar. */
  project: string;
  /** What the visitor can do, as a short sentence ("Ask your notes a question"). */
  title: string;
  /** One or two sentences on what the demo shows. */
  intro?: string;
  /** What is simplified compared with the real project. Always shown. */
  note: string;
  onReset?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`demo-frame${className ? ` ${className}` : ""}`} aria-label={`${project} demo`}>
      <header className="demo-bar mono">
        <span>
          <i className="demo-dot" aria-hidden="true" /> TRY IT / {project.toUpperCase()}
        </span>
        <span>RUNS IN YOUR BROWSER</span>
      </header>
      <div className="demo-head">
        <div>
          <h3>{title}</h3>
          {intro && <p>{intro}</p>}
        </div>
        {onReset && (
          <button type="button" className="demo-reset mono" onClick={onReset}>
            <RotateCcw size={13} aria-hidden="true" /> Reset
          </button>
        )}
      </div>
      <div className="demo-body">{children}</div>
      <p className="demo-note mono">{note}</p>
    </section>
  );
}
