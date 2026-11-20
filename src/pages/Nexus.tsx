import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LabHero, LabSectionTitle, Reveal } from "@/sites/cyan/lab/LabParts";
import { ArchiveIndex } from "@/sites/cyan/lab/nexus/ArchiveIndex";
import { ArchiveCard } from "@/sites/cyan/lab/nexus/ArchiveCard";
import { ArchiveDialog } from "@/sites/cyan/lab/nexus/ArchiveDialog";
import { ContactSheet } from "@/sites/cyan/lab/nexus/ContactSheet";
import { useLiveMotion } from "@/sites/cyan/lab/nexus/useLiveMotion";
import {
  ARCHIVE,
  COUNTS,
  SHARED_STACK,
  findEntry,
  matches,
  techCount,
  type ArchiveEntry,
  type FilterKey,
} from "@/sites/cyan/lab/nexus/data";
import "@/sites/cyan/lab/nexus.css";

const GROUPS: { key: FilterKey; label: string; count: number }[] = [
  { key: "all", label: "All", count: COUNTS.projects },
  { key: "group:selected", label: "Selected work", count: COUNTS.selected },
  { key: "group:also", label: "Also built", count: COUNTS.projects - COUNTS.selected },
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The cyan site's project archive: every project with its screenshots, a
 * filter that re-lays the cards, a contact sheet of every frame, and a detail
 * dialog with a gallery and links to the source. ?project=<id> opens one.
 */
const Nexus = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [frame, setFrame] = useState(0);
  const opener = useRef<{ element: HTMLElement | null; id: string | null }>({ element: null, id: null });
  const closing = useRef<string | null>(null);
  const live = useLiveMotion();

  const selected = findEntry(searchParams.get("project"));
  const visible = ARCHIVE.filter((entry) => matches(entry, filter));
  const activeTech = filter.startsWith("tech:") ? filter.slice(5) : null;
  const stackChips = SHARED_STACK.map((item) => item.tech);
  if (activeTech && !stackChips.includes(activeTech)) stackChips.push(activeTech);

  const setProject = useCallback(
    (id: string | null) =>
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (id) next.set("project", id);
          else next.delete("project");
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const open = (entry: ArchiveEntry, element: HTMLElement, startFrame = 0) => {
    opener.current = { element, id: entry.id };
    setFrame(startFrame);
    setProject(entry.id);
  };

  const step = (by: 1 | -1) => {
    if (!selected) return;
    const i = ARCHIVE.indexOf(selected);
    setFrame(0);
    setProject(ARCHIVE[(i + by + ARCHIVE.length) % ARCHIVE.length].id);
  };

  const close = () => {
    if (!searchParams.get("project")) return;
    closing.current = selected?.id ?? null;
    setProject(null);
  };

  // Once the dialog has closed (its own effect runs first), focus goes back where it came
  // from, or to the card of the project last shown.
  const selectedId = selected?.id ?? null;
  useEffect(() => {
    const closingId = closing.current;
    if (selectedId || !closingId) return;
    closing.current = null;
    const { element, id } = opener.current;
    const card = document.querySelector<HTMLElement>(`[data-open="${closingId}"]`);
    const target = element?.isConnected && id === closingId ? element : (card ?? element);
    target?.focus();
  }, [selectedId]);

  const toggleFilter = (key: FilterKey) => setFilter((current) => (current === key && key !== "all" ? "all" : key));

  return (
    <>
      <LabHero
        code="01"
        eyebrow="Project archive"
        title="The work,"
        muted="frame by frame."
        intro={
          <>
            <p>
              AI systems, retrieval pipelines, a quantitative engine, fund-operations controls and a
              reinforcement-learning study — the work that best represents how I build.
            </p>
            <p>
              {COUNTS.projects} projects and {COUNTS.frames} screenshots. Open any card to flip through its screens, read
              the full write-up and go straight to the code.
            </p>
          </>
        }
        aside={<ArchiveIndex filter={filter} onOpen={(entry, element) => open(entry, element)} />}
      />

      <section className="lab-section" aria-labelledby="nx-work-title">
        <LabSectionTitle index="01" id="nx-work-title">
          Projects
        </LabSectionTitle>

        <div className="nx-filters">
          <div className="nx-filter-row" role="group" aria-label="Show projects">
            <span className="nx-filter-label mono">Show</span>
            {GROUPS.map((group) => (
              <button
                key={group.key}
                type="button"
                className="lab-chip"
                aria-pressed={filter === group.key}
                onClick={() => toggleFilter(group.key)}
              >
                {group.label} <span className="nx-chip-count">{pad(group.count)}</span>
              </button>
            ))}
          </div>
          <div className="nx-filter-row" role="group" aria-label="Filter by technology">
            <span className="nx-filter-label mono">Stack</span>
            {stackChips.map((tech) => (
              <button
                key={tech}
                type="button"
                className="lab-chip"
                aria-pressed={activeTech === tech}
                onClick={() => toggleFilter(`tech:${tech}`)}
              >
                {tech} <span className="nx-chip-count">{pad(techCount(tech))}</span>
              </button>
            ))}
          </div>
          <p className="nx-filter-status mono" aria-live="polite">
            <b className="lab-readout">{pad(visible.length)}</b> of {pad(ARCHIVE.length)} on screen
            {activeTech && <> · built with {activeTech}</>}
          </p>
        </div>

        <motion.ul className="nx-grid" layout={live ? "position" : false}>
          <AnimatePresence mode="popLayout">
            {visible.map((entry, i) => (
              <motion.li
                key={entry.id}
                className="nx-cell"
                data-group={entry.group}
                layout={live ? "position" : false}
                initial={live ? { opacity: 0, y: 28, scale: 0.97 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={live ? { opacity: 0, scale: 0.94, transition: { duration: 0.22 } } : { opacity: 0, transition: { duration: 0 } }}
                transition={{ duration: live ? 0.55 : 0, delay: live ? Math.min(i, 6) * 0.04 : 0, ease: [0.16, 1, 0.3, 1] }}
              >
                <ArchiveCard entry={entry} activeTech={activeTech} onOpen={open} onTech={(tech) => toggleFilter(`tech:${tech}`)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </section>

      <Reveal as="section" className="lab-section nx-sheet-section">
        <LabSectionTitle index="02">Contact sheet</LabSectionTitle>
        <p className="nx-sheet-intro">
          Every screenshot in the archive on one sheet, {COUNTS.frames} frames in all. Pick a frame to open its project
          at that screen.
        </p>
        <ContactSheet filter={filter} onOpen={open} />
      </Reveal>

      <ArchiveDialog entry={selected} frame={frame} onFrame={setFrame} onStep={step} onClose={close} />
    </>
  );
};

export default Nexus;
