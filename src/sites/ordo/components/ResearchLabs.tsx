import { useState, type KeyboardEvent } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { research } from "@/data/portfolio";
import { MemoryLab, RetryLab } from "./ResearchLab";

const LABS = [
  {
    id: "memory",
    tag: "Study 01",
    name: research.studies[0].name,
    Lab: MemoryLab,
    cues: ["Step or play the turns", "Choose a strategy row"],
  },
  {
    id: "retry",
    tag: "Study 02",
    name: research.studies[1].name,
    Lab: RetryLab,
    cues: ["Move the sliders", "Tap or drag the map", "Load a toy question"],
  },
] as const;

/** Both studies' explainers behind one tab bar, so the section stays a readable length. */
export function ResearchLabs() {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const { Lab, cues } = LABS[active];

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % LABS.length,
      ArrowLeft: (index - 1 + LABS.length) % LABS.length,
      Home: 0,
      End: LABS.length - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    setActive(keys[event.key]);
    document.getElementById(`lab-tab-${LABS[keys[event.key]].id}`)?.focus();
  };

  return (
    <div className="research-labs">
      <div className="research-labs-head">
        <div className="research-labs-intro">
          <span className="ct-live-tag mono">
            <i aria-hidden="true" /> Interactive
          </span>
          <span className="mono">Try the idea behind each study</span>
          <span className="ct-illustration-tag mono">Illustrations, not results</span>
        </div>
        <LayoutGroup id="research-lab-tabs">
          <div role="tablist" aria-label="Study explainers">
            {LABS.map((lab, index) => (
              <button
                key={lab.id}
                role="tab"
                id={`lab-tab-${lab.id}`}
                aria-selected={index === active}
                aria-controls="research-lab-panel"
                tabIndex={index === active ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                {index === active && (
                  <motion.span
                    className="ct-tab-ink"
                    layoutId="research-lab-tab-ink"
                    aria-hidden="true"
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 38 }}
                  />
                )}
                <span className="ct-tab-text">
                  <span className="mono">{lab.tag}</span>
                  {lab.name}
                </span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </div>
      <ul className="ct-lab-cues mono" aria-label="Ways to use this explainer">
        {cues.map((cue, index) => (
          <li key={cue}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span> {cue}
          </li>
        ))}
      </ul>
      <motion.div
        key={LABS[active].id}
        id="research-lab-panel"
        role="tabpanel"
        aria-labelledby={`lab-tab-${LABS[active].id}`}
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <Lab />
      </motion.div>
    </div>
  );
}
