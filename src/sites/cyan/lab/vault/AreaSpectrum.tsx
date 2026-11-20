import type { SkillCategory } from "@/data/profile";
import { NODES, SECTORS, TOTALS } from "./graph";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The hero's instrument: one channel per area, a lamp for each of its skills
 * (taller for the better linked) and the count as a readout. The channel being
 * filtered on the chart stays lit.
 */
export function AreaSpectrum({ filter }: { filter: SkillCategory | null }) {
  return (
    <figure className="vault-spectrum lab-panel lab-bracket">
      <figcaption className="vault-spectrum-head mono">
        <span>Area spectrum</span>
        <span>
          <span className="lab-readout">{pad2(TOTALS.skills)}</span> skills ·{" "}
          <span className="lab-readout">{pad2(TOTALS.links)}</span> links
        </span>
      </figcaption>
      <ul>
        {SECTORS.map((sector) => {
          const members = NODES.filter((node) => node.skill.category === sector.category);
          return (
            <li
              key={sector.category}
              className={filter && filter !== sector.category ? "is-quiet" : filter ? "is-on" : undefined}
            >
              <span className="vault-spectrum-name mono">{sector.category}</span>
              <span className="vault-spectrum-lamps" aria-hidden="true">
                {members.map((node, k) => (
                  <i
                    key={node.id}
                    style={{ height: `${30 + node.links.length * 7}%`, animationDelay: `${(k * 0.37 + sector.from / 90).toFixed(2)}s` }}
                  />
                ))}
              </span>
              <span className="lab-readout">{pad2(sector.count)}</span>
            </li>
          );
        })}
      </ul>
      <p className="vault-spectrum-foot mono">
        Lamp height · links per skill · most linked <span className="lab-readout">{TOTALS.hub.skill.short}</span>{" "}
        <span className="lab-readout">{pad2(TOTALS.hub.links.length)}</span>
      </p>
    </figure>
  );
}
