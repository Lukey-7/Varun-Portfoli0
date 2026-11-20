import { skillCategories } from "@/data/profile";
import { pointerLight } from "../kit";
import { NODES, NODE_BY_ID, usedIn } from "./graph";

/**
 * Every skill as plain text, grouped by area: the chart's accessible twin and
 * the easier view on a phone. "Show on chart" centres the scope on a skill.
 */
export function SkillIndex({
  selected,
  onShow,
}: {
  selected: string | null;
  onShow: (id: string) => void;
}) {
  return (
    <div className="vault-index">
      {skillCategories.map((category, c) => {
        const group = NODES.filter((node) => node.skill.category === category).sort((a, b) => a.index - b.index);
        if (!group.length) return null;
        const headingId = `vault-index-${category.replace(/\W/g, "")}`;
        return (
          <section key={category} className="vault-index-group" aria-labelledby={headingId}>
            <h3 id={headingId} className="vault-index-heading">
              <span className="mono">{String(c + 1).padStart(2, "0")}</span>
              {category}
              <span className="lab-readout">{String(group.length).padStart(2, "0")}</span>
            </h3>
            <ul>
              {group.map((node) => {
                const projects = usedIn(node.skill);
                return (
                  <li
                    key={node.id}
                    className={`vault-index-item lab-panel${selected === node.id ? " is-selected" : ""}`}
                    {...pointerLight}
                  >
                    <div className="vault-index-top">
                      <span className="vault-index-code mono" aria-hidden="true">
                        {node.skill.short}
                      </span>
                      <h4>{node.skill.name}</h4>
                    </div>
                    <p>{node.skill.description}</p>
                    <p className="vault-index-meta mono">
                      Links to{" "}
                      {node.links
                        .map((id) => NODE_BY_ID.get(id)?.skill.name)
                        .filter(Boolean)
                        .join(", ")}
                      {projects.length > 0 && <> · Used in {projects.map((p) => p.name).join(", ")}</>}
                    </p>
                    <button type="button" className="vault-index-show mono" onClick={() => onShow(node.id)}>
                      Show on chart<span className="sr-only">: {node.skill.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
