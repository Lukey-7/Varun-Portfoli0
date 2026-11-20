import type { CSSProperties } from "react";
import { ArrowUpRight, Github } from "lucide-react";
import type { ShowcaseMedia } from "@/sites/ordo/projectShowcase";
import { pointerLight } from "../kit";
import type { ArchiveEntry } from "./data";
import { D20Figure } from "./D20Figure";

const pad = (n: number) => String(n).padStart(2, "0");
const ratio = (media: ShowcaseMedia) => `${media.width} / ${media.height}`;

/** The card's window onto the project: its first screenshot, a phone fan, or the generated figure. */
function Thumb({ entry }: { entry: ArchiveEntry }) {
  const [first, ...rest] = entry.media;
  if (!first)
    return (
      <div className="nx-thumb-art nx-thumb-figure">
        <D20Figure />
        <span className="nx-figure-label mono">Generated figure · no screenshots</span>
      </div>
    );

  if (first.shape === "phone") {
    const phones = entry.media.filter((media) => media.shape === "phone").slice(0, 3);
    return (
      <div className="nx-thumb-art nx-fan" data-count={phones.length}>
        {phones.map((media, i) => (
          <span key={media.src} className="nx-fan-phone" style={{ "--i": i - (phones.length - 1) / 2 } as CSSProperties}>
            <img src={media.src} width={media.width} height={media.height} alt={media.alt} loading="lazy" decoding="async" />
          </span>
        ))}
      </div>
    );
  }

  const second = rest.find((media) => media.shape === first.shape);
  return (
    <div className="nx-thumb-art nx-wide" data-swap={Boolean(second)}>
      <img
        className="nx-shot nx-shot-a"
        src={first.src}
        width={first.width}
        height={first.height}
        alt={first.alt}
        loading="lazy"
        decoding="async"
        style={{ aspectRatio: ratio(first) }}
      />
      {second && (
        <img
          className="nx-shot nx-shot-b"
          src={second.src}
          width={second.width}
          height={second.height}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}

/**
 * One project in the archive. The whole card opens the detail (a stretched
 * button on the title); the stack tags filter the archive and the GitHub mark
 * goes straight to the repository.
 */
export function ArchiveCard({
  entry,
  activeTech,
  onOpen,
  onTech,
}: {
  entry: ArchiveEntry;
  activeTech: string | null;
  onOpen: (entry: ArchiveEntry, opener: HTMLElement) => void;
  onTech: (tech: string) => void;
}) {
  const { project, media } = entry;
  const first = media[0];
  return (
    <article className="nx-card lab-panel" data-group={entry.group} {...pointerLight}>
      <div className="nx-thumb">
        <Thumb entry={entry} />
        <span className="nx-tint" aria-hidden="true" />
        <span className="nx-scanlines" aria-hidden="true" />
        <span className="nx-sweep" aria-hidden="true" />
        <span className="nx-corners" aria-hidden="true" />
        <span className="nx-thumb-code mono" aria-hidden="true">
          CH.{entry.code}
        </span>
        <span className="nx-thumb-readout mono" aria-hidden="true">
          {first ? (
            <>
              <span>Open</span> {pad(media.length)} screenshots <b>{`${first.width}×${first.height}`}</b>
            </>
          ) : (
            <>
              <span>Open</span> write-up and source
            </>
          )}
        </span>
      </div>

      <div className="nx-card-body">
        <p className="nx-card-cat mono">{project.subtitle}</p>
        <h3 className="nx-card-title">
          <button
            type="button"
            className="nx-open"
            data-open={entry.id}
            onClick={(event) => onOpen(entry, event.currentTarget)}
            aria-haspopup="dialog"
          >
            {project.title}
          </button>
          <ArrowUpRight className="nx-card-arrow" size={20} aria-hidden="true" />
        </h3>
        <p className="nx-card-desc">{project.description}</p>

        <dl className="nx-card-facts">
          {project.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd className="lab-readout">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="nx-card-foot">
          <ul className="nx-stack" aria-label={`${project.title} stack`}>
            {project.technologies.map((tech) => (
              <li key={tech}>
                <button
                  type="button"
                  className="lab-chip"
                  aria-pressed={activeTech === tech}
                  title={`Show projects built with ${tech}`}
                  onClick={() => onTech(tech)}
                >
                  {tech}
                </button>
              </li>
            ))}
          </ul>
          {entry.github && (
            <a
              className="nx-card-gh"
              href={entry.github}
              target="_blank"
              rel="noreferrer"
              aria-label={`${project.title} on GitHub`}
              title="View on GitHub"
            >
              <Github size={17} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
