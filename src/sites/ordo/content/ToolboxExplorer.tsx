import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { deliveryWork, otherWork, selectedWork } from "@/data/portfolio";
import { experience } from "@/data/profile";
import { content } from "../content";
import { ordoProjects } from "../projects";
import { spotlight } from "../spotlight";

type Place =
  | { kind: "role"; key: string; label: string; target: string }
  | { kind: "project"; key: string; label: string; to: string }
  | { kind: "external"; key: string; label: string; href: string };

/** "C++20" and "C++" are the same tool; case never matters. */
const norm = (tool: string) => tool.trim().toLowerCase().replace(/(\+\+)\d+$/, "$1");

/**
 * Where each tool is tagged in the site's own data: role stacks, the current
 * role's delivery work, and project stacks. Nothing is inferred from prose.
 */
function buildIndex() {
  const index = new Map<string, Place[]>();
  const add = (tool: string, place: Place) => {
    const list = index.get(norm(tool)) ?? [];
    if (!list.some((item) => item.key === place.key)) list.push(place);
    index.set(norm(tool), list);
  };
  for (const job of experience) {
    const place: Place = { kind: "role", key: `role-${job.id}`, label: `${job.role}, ${job.company}`, target: job.id };
    job.stack.forEach((tool) => add(tool, place));
    if (job.current) deliveryWork.forEach((work) => work.tags.split(" / ").forEach((tool) => add(tool, place)));
  }
  for (const project of selectedWork) {
    const place: Place = { kind: "project", key: project.id, label: project.name, to: `/work/${project.id}` };
    project.stack.forEach((tool) => add(tool, place));
  }
  for (const project of otherWork) {
    const art = project.kind === "language" ? "language" : project.kind === "tetris" ? "arcade" : null;
    const slug = art ? ordoProjects.find((item) => item.art.type === art)?.slug : undefined;
    const place: Place = slug
      ? { kind: "project", key: slug, label: project.name, to: `/work/${slug}` }
      : { kind: "external", key: project.name, label: project.name, href: project.href };
    project.tech.split(" / ").forEach((tool) => add(tool, place));
  }
  return index;
}

/**
 * The toolbox as something to explore: each tool that is tagged on a role or
 * project can be chosen to list those places, with a way to each one.
 */
export function ToolboxExplorer() {
  const reduced = useReducedMotion();
  const index = useMemo(buildIndex, []);
  const [chosen, setChosen] = useState<string | null>(null);
  const places = chosen ? (index.get(norm(chosen)) ?? []) : [];

  return (
    <div className="toolbox ct-toolbox">
      <h3>What I work with</h3>
      {content.about.toolbox.map(([group, tools], groupIndex) => (
        <div className="toolbox-group" key={group}>
          <span>{group}</span>
          <p className="ct-chips">
            {tools.split(", ").map((tool, toolIndex) => {
              const count = index.get(norm(tool))?.length ?? 0;
              const enter = reduced
                ? {}
                : {
                    initial: { opacity: 0, y: 6 },
                    whileInView: { opacity: 1, y: 0 },
                    viewport: { once: true, amount: 0.6 },
                    transition: { duration: 0.4, delay: groupIndex * 0.08 + toolIndex * 0.03 },
                  };
              return count ? (
                <motion.button
                  key={tool}
                  type="button"
                  className="ct-chip"
                  aria-pressed={chosen === tool}
                  aria-controls="ct-tool-places"
                  onClick={() => setChosen(chosen === tool ? null : tool)}
                  {...enter}
                >
                  {tool}
                  <sup className="mono" aria-hidden="true">
                    {count}
                  </sup>
                  <span className="ct-sr">
                    , tagged on {count} {count === 1 ? "role or project" : "roles and projects"}
                  </span>
                </motion.button>
              ) : (
                <motion.span key={tool} className="ct-chip is-plain" {...enter}>
                  {tool}
                </motion.span>
              );
            })}
          </p>
        </div>
      ))}
      <div id="ct-tool-places" className="ct-tool-places" aria-live="polite">
        <motion.div
          key={chosen ?? "none"}
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {chosen ? (
            <>
              <span className="mono ct-tool-head">
                {chosen} · tagged on {places.length} {places.length === 1 ? "role or project" : "roles and projects"}
              </span>
              <ul>
                {places.map((place) => (
                  <li key={place.key}>
                    <span className="mono">{place.kind === "role" ? "Role" : "Project"}</span>
                    {place.kind === "role" ? (
                      <button type="button" onClick={() => spotlight(place.target, `Uses ${chosen}`)}>
                        {place.label} <span aria-hidden="true">↓</span>
                      </button>
                    ) : place.kind === "project" ? (
                      <Link to={place.to}>
                        {place.label} <ArrowUpRight size={13} aria-hidden="true" />
                      </Link>
                    ) : (
                      <a href={place.href} target="_blank" rel="noreferrer">
                        {place.label} <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <span className="mono ct-tool-head">
              Choose a numbered tool to see the roles and projects it is tagged on.
            </span>
          )}
        </motion.div>
      </div>
    </div>
  );
}
