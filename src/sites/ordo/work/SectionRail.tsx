import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowUpRight, Github } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { pad } from "./hooks";

export interface RailSection {
  id: string;
  label: string;
}

/**
 * A sticky in-page rail under the site header: the page's sections with the
 * one being read marked, a hairline that fills as the reader moves through
 * the page, and the source link always one click away. Work happens only on
 * scroll and resize, one frame at a time.
 */
export default function SectionRail({
  name,
  sections,
  repo,
}: {
  name: string;
  sections: RailSection[];
  repo?: { label: string; href: string };
}) {
  const rail = useRef<HTMLElement>(null);
  const bar = useRef<HTMLElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const reduced = useReducedMotion();
  const ids = sections.map((section) => section.id).join(" ");

  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const article = node.closest("article");
    const header = document.querySelector<HTMLElement>(".portfolio-header");
    const targets = ids
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    let frame = 0;

    const update = () => {
      frame = 0;
      const top = header?.offsetHeight ?? 64;
      node.style.setProperty("--work-rail-top", `${top}px`);
      if (article && bar.current) {
        const box = article.getBoundingClientRect();
        const travel = Math.max(1, box.height - window.innerHeight);
        const progress = Math.min(1, Math.max(0, -box.top / travel));
        bar.current.style.transform = `scaleX(${progress.toFixed(4)})`;
      }
      const line = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const target of targets) if (target.getBoundingClientRect().top <= line) current = target.id;
      setActive(current);
      setStuck(node.getBoundingClientRect().top <= top + 1);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids]);

  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
  };

  return (
    <nav ref={rail} className="work-rail" data-stuck={stuck || undefined} aria-label="On this page">
      <div className="work-rail-inner section-wrap">
        <span className="work-rail-name mono" aria-hidden="true">
          {name}
        </span>
        <ol>
          {sections.map((section, i) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active === section.id ? "location" : undefined}
                onClick={(event) => jump(event, section.id)}
              >
                <span className="work-rail-num">{pad(i + 1)}</span>
                {section.label}
              </a>
            </li>
          ))}
        </ol>
        {repo && (
          <a className="work-rail-repo" href={repo.href} target="_blank" rel="noreferrer">
            <Github size={14} aria-hidden="true" />
            <span>{repo.label}</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        )}
      </div>
      <i ref={bar} className="work-rail-progress" aria-hidden="true" />
    </nav>
  );
}
