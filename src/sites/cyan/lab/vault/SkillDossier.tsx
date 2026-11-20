import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { pointerLight } from "../kit";
import { DecodeText } from "../../motion/DecodeText";
import { NODES, NODE_BY_ID, TOTALS, usedIn } from "./graph";

const pad2 = (n: number) => String(n).padStart(2, "0");
const pad3 = (n: number) => String(Math.round(n) % 360).padStart(3, "0");

/**
 * The readout beside the scope: the selected skill's code, area, links and
 * description, the skills it links to (each one moves the selection) and the
 * featured projects whose stack names it. With nothing selected it shows the
 * chart's totals and how to use it.
 */
export function SkillDossier({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const reduced = useReducedMotion();
  const node = selected ? NODE_BY_ID.get(selected) : undefined;
  const projects = node ? usedIn(node.skill) : [];

  return (
    <aside className="vault-dossier lab-panel lab-bracket" aria-label="Selected skill" {...pointerLight}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={node?.id ?? "none"}
          className="vault-dossier-inner"
          initial={reduced ? false : { opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduced ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          {node ? (
            <>
              <div className="vault-dossier-head">
                <span className="vault-dossier-code mono" aria-hidden="true">
                  <DecodeText text={node.skill.short} duration={420} />
                </span>
                <div>
                  <p className="vault-dossier-area mono">{node.skill.category}</p>
                  <h3 className="vault-dossier-name">{node.skill.name}</h3>
                </div>
                <button
                  type="button"
                  className="vault-dossier-close"
                  aria-label="Close and show the full chart"
                  onClick={() => onSelect(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <dl className="vault-dossier-readouts mono">
                <div>
                  <dt>Links</dt>
                  <dd className="lab-readout">{pad2(node.links.length)}</dd>
                </div>
                <div>
                  <dt>Bearing</dt>
                  <dd className="lab-readout">{pad3(node.bearing)}°</dd>
                </div>
                {/* Only an exact stack match counts, so no count is shown rather than a misleading zero. */}
                {projects.length > 0 && (
                  <div>
                    <dt>Projects</dt>
                    <dd className="lab-readout">{pad2(projects.length)}</dd>
                  </div>
                )}
              </dl>

              <p className="vault-dossier-text">{node.skill.description}</p>

              <div className="vault-dossier-block">
                <p className="vault-dossier-label mono">Linked skills</p>
                <ul className="vault-dossier-chips">
                  {node.links.map((id) => {
                    const other = NODE_BY_ID.get(id);
                    if (!other) return null;
                    return (
                      <li key={id}>
                        <button type="button" className="lab-chip vault-link-chip" onClick={() => onSelect(id)}>
                          <span className="vault-link-code" aria-hidden="true">
                            {other.skill.short}
                          </span>
                          {other.skill.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {projects.length > 0 && (
                <div className="vault-dossier-block">
                  <p className="vault-dossier-label mono">Used in</p>
                  <ul className="vault-dossier-projects">
                    {projects.map((project) => (
                      <li key={project.id}>
                        <Link to="/nexus">
                          <span>{project.name}</span>
                          <span className="mono">{project.match.join(" · ")}</span>
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="vault-dossier-area mono">No star selected</p>
              <h3 className="vault-dossier-name">Pick a skill to centre the chart on it.</h3>
              <p className="vault-dossier-text">
                Lines join related skills. Hover or tab across the chart to trace them, then select one to see what it
                covers, what it links to and which featured projects list it in their stack.
              </p>
              <dl className="vault-dossier-readouts mono">
                <div>
                  <dt>Skills</dt>
                  <dd className="lab-readout">{pad2(TOTALS.skills)}</dd>
                </div>
                <div>
                  <dt>Links</dt>
                  <dd className="lab-readout">{pad2(TOTALS.links)}</dd>
                </div>
                <div>
                  <dt>Areas</dt>
                  <dd className="lab-readout">{pad2(TOTALS.areas)}</dd>
                </div>
              </dl>
              <div className="vault-dossier-block">
                <p className="vault-dossier-label mono">Most linked</p>
                <ul className="vault-dossier-chips">
                  {[...NODES]
                    .sort((a, b) => b.links.length - a.links.length || a.index - b.index)
                    .slice(0, 4)
                    .map((other) => (
                      <li key={other.id}>
                        <button type="button" className="lab-chip vault-link-chip" onClick={() => onSelect(other.id)}>
                          <span className="vault-link-code" aria-hidden="true">
                            {other.skill.short}
                          </span>
                          {other.skill.name}
                          <span className="lab-readout">{pad2(other.links.length)}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}
