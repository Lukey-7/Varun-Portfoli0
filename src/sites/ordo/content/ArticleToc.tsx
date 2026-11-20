import type { MouseEvent } from "react";
import { useScrollSpy } from "./hooks";

export interface TocItem {
  id: string;
  text: string;
}

/**
 * The write-up's sections, built from its own headings. The reader's current
 * section is marked as they scroll; a link glides to its heading and moves
 * focus there, so keyboard and screen-reader users land in the same place.
 */
export function ArticleToc({ items }: { items: TocItem[] }) {
  const active = useScrollSpy(items.map((item) => item.id));
  const activeIndex = items.findIndex((item) => item.id === active);

  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const heading = document.getElementById(id);
    if (!heading) return;
    event.preventDefault();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    heading.focus({ preventScroll: true });
    // Keep the address shareable without a router navigation (and its instant jump).
    window.history.replaceState(window.history.state, "", `#${id}`);
  };

  const list = (
    <ol>
      {items.map((item, index) => (
        <li key={item.id} className={item.id === active ? "is-active" : index < activeIndex ? "is-read" : undefined}>
          <a
            href={`#${item.id}`}
            aria-current={item.id === active ? "location" : undefined}
            onClick={(event) => go(event, item.id)}
          >
            <span className="mono" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <nav className="ct-toc" aria-label="In this write-up">
      <div className="ct-toc-wide">
        <span className="ct-toc-label mono">In this write-up</span>
        {list}
      </div>
      <details className="ct-toc-narrow">
        <summary className="mono">
          <span>In this write-up</span>
          <span aria-hidden="true">{items.length} sections</span>
        </summary>
        {list}
      </details>
    </nav>
  );
}
