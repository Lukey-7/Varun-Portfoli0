import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { decryptJson, normalisePassphrase, type CvVault } from "./crypto";
import type { CvDocument } from "./cvDocument";

type Problem = "wrong" | "unsupported";

const PROBLEMS: Record<Problem, string> = {
  wrong: "That passphrase didn't work.",
  unsupported: "This browser can't unlock the page. Open it over https in an up-to-date browser.",
};

/** github.com/Lukey-7 rather than https://github.com/Lukey-7/, so it reads on paper too. */
const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");

/**
 * The private CV: a passphrase form until the vault opens, then the CV. The
 * decrypted CV lives in React state only, never in storage or the URL.
 */
export function CvGate({ vault }: { vault: CvVault | null }) {
  const [cv, setCv] = useState<CvDocument | null>(null);
  if (cv) return <CvSheet cv={cv} />;

  return (
    <section className="page-hero section-wrap cv-gate">
      <div className="ordo-section-label">
        <span>[ CV / PRIVATE ]</span>
        <span>{vault ? "ENCRYPTED IN THE PAGE" : "NOTHING TO UNLOCK"}</span>
      </div>
      {vault ? (
        <UnlockForm vault={vault} onUnlock={setCv} />
      ) : (
        <h1>
          This page is not set up.
          <br />
          <span>There is no CV here to unlock.</span>
        </h1>
      )}
    </section>
  );
}

function UnlockForm({ vault, onUnlock }: { vault: CvVault; onUnlock: (cv: CvDocument) => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const id = useId();
  // Stray spaces or a pasted newline must not make the right passphrase fail.
  const normalised = normalisePassphrase(passphrase);
  const ready = normalised !== "";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || working) return;
    setWorking(true);
    setProblem(null);
    try {
      onUnlock(await decryptJson<CvDocument>(vault, normalised));
    } catch {
      setProblem(globalThis.crypto?.subtle ? "wrong" : "unsupported");
      setWorking(false);
      // Back in the field with the cursor at the end, so one slip can be fixed
      // instead of the whole entry being selected and wiped by the next key.
      const input = field.current;
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  };

  return (
    <>
      <h1>
        A private CV.
        <br />
        <span>It opens with the passphrase I gave you.</span>
      </h1>
      <p className="project-lede">
        The CV is encrypted in this page. Your browser decrypts it with the passphrase, and the passphrase is never
        sent anywhere.
      </p>
      <form className="cv-unlock" onSubmit={submit} aria-busy={working}>
        <label htmlFor={`${id}-passphrase`}>Passphrase</label>
        <div className="cv-unlock-row">
          <input
            ref={field}
            id={`${id}-passphrase`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={passphrase}
            aria-invalid={problem === "wrong"}
            aria-describedby={problem ? `${id}-problem` : undefined}
            onChange={(event) => {
              setPassphrase(event.target.value);
              setProblem(null);
            }}
          />
          <button type="submit" className="primary-button" disabled={!ready || working}>
            {working ? "Unlocking…" : "Unlock"}
          </button>
        </div>
        {problem && (
          <p role="alert" id={`${id}-problem`} className="cv-problem">
            {PROBLEMS[problem]}
          </p>
        )}
      </form>
    </>
  );
}

function CvSheet({ cv }: { cv: CvDocument }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Screen readers land on the CV once it opens, instead of on a form that is gone.
  useEffect(() => heading.current?.focus(), []);

  return (
    <article className="cv-sheet section-wrap" aria-labelledby="cv-name">
      <div className="cv-toolbar">
        <span className="mono">[ CV / UNLOCKED ]</span>
        <button type="button" className="primary-button" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      <div className="cv-document">
        <header className="cv-head">
          <h1 id="cv-name" ref={heading} tabIndex={-1}>
            {cv.name}
          </h1>
          <p className="cv-role">
            {cv.role} · {cv.location}
          </p>
          <ul className="cv-contact">
            <li>
              <a href={`mailto:${cv.email}`}>{cv.email}</a>
            </li>
            <li>
              <a href={cv.github} target="_blank" rel="noreferrer">
                {shortUrl(cv.github)}
              </a>
            </li>
            <li>
              <a href={cv.linkedin} target="_blank" rel="noreferrer">
                {shortUrl(cv.linkedin)}
              </a>
            </li>
          </ul>
        </header>

        <section className="cv-section">
          <h2>Summary</h2>
          <p>{cv.summary}</p>
        </section>

        <section className="cv-section">
          <h2>Experience</h2>
          <div className="cv-items">
            {cv.experience.map((job) => (
              <div className="cv-item" key={`${job.company} ${job.period}`}>
                <div className="cv-item-head">
                  <h3>
                    {job.role}, {job.company}
                  </h3>
                  <span className="mono">{job.period}</span>
                </div>
                <ul>
                  {job.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="cv-section">
          <h2>Education</h2>
          <div className="cv-items">
            {cv.education.map((item) => (
              <div className="cv-item" key={`${item.degree} ${item.year}`}>
                <div className="cv-item-head">
                  <h3>
                    {item.degree}, {item.institution}
                  </h3>
                  <span className="mono">{item.year}</span>
                </div>
                {item.detail && <p>{item.detail}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="cv-section">
          <h2>Selected projects</h2>
          <ul className="cv-projects">
            {cv.projects.map((project) => (
              <li key={project.name}>
                <strong>{project.name}.</strong> {project.line}
              </li>
            ))}
          </ul>
        </section>

        <section className="cv-section">
          <h2>Skills</h2>
          <p>{cv.skills.join(" · ")}</p>
        </section>
      </div>
    </article>
  );
}
