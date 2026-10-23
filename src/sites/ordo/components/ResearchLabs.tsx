import { useState, type KeyboardEvent } from "react";
import { research } from "@/data/portfolio";
import { MemoryLab, RetryLab } from "./ResearchLab";

const LABS = [
  { id: "memory", tag: "Study 01", name: research.studies[0].name, Lab: MemoryLab },
  { id: "retry", tag: "Study 02", name: research.studies[1].name, Lab: RetryLab },
] as const;

/** Both studies' explainers behind one tab bar, so the section stays a readable length. */
export function ResearchLabs() {
  const [active, setActive] = useState(0);
  const { Lab } = LABS[active];

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
        <span className="mono">Try the idea behind each study</span>
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
              <span className="mono">{lab.tag}</span>
              {lab.name}
            </button>
          ))}
        </div>
      </div>
      <div id="research-lab-panel" role="tabpanel" aria-labelledby={`lab-tab-${LABS[active].id}`}>
        <Lab />
      </div>
    </div>
  );
}
