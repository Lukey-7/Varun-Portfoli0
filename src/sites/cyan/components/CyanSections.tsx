import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search } from "lucide-react";
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import {
  evidence,
  memoryConversation,
  memoryStrategies,
  otherWork,
  research,
  selectedWork,
  testCounts,
} from "@/data/portfolio";
import { trackPointer } from "@/lib/pointer";
import type { PaletteActions } from "./PaletteMenu";

/* ------------------------------------------------------------ Results */

function CountUp({
  to,
  from = 0,
  decimals = 0,
  run,
}: {
  to: number;
  from?: number;
  decimals?: number;
  run: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!run || reduced) {
      node.textContent = (run || reduced ? to : from).toFixed(decimals);
      return;
    }
    const controls = animate(from, to, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (value) => {
        node.textContent = value.toFixed(decimals);
      },
    });
    return () => controls.stop();
  }, [run, reduced, to, from, decimals]);
  return (
    <span ref={ref} aria-hidden="true">
      {from.toFixed(decimals)}
    </span>
  );
}

export function CyanEvidence() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  return (
    <section ref={ref} id="results" className="cyan-evidence section-wrap">
      <div className="section-heading">
        <h2>
          Results<span className="heading-period">,</span>
          <br />
          <span>with their scope.</span>
        </h2>
        <p>
          Each change measured against a baseline on a labelled set. These
          numbers describe those evaluations, not every document.
        </p>
      </div>
      <div className="evidence-list">
        {evidence.map((item, index) => (
          <div
            className={`evidence-row${inView ? " is-live" : ""}`}
            key={item.project + item.metric}
            style={{ "--delay": `${index * 0.12}s` } as React.CSSProperties}
            onPointerMove={trackPointer}
          >
            <div className="evidence-name">
              <strong>{item.project}</strong>
              <span className="mono">{item.metric}</span>
            </div>
            <div className="evidence-track" aria-hidden="true">
              <i
                className="evidence-before"
                style={{ width: `${item.before * 100}%` }}
              />
              <i
                className="evidence-after"
                style={
                  {
                    width: `${item.after * 100}%`,
                    "--start": item.before / item.after,
                  } as React.CSSProperties
                }
              />
              <b style={{ left: `${item.before * 100}%` }} />
            </div>
            <div className="evidence-value">
              <span className="sr-only">
                {item.metric} improved from {item.before} to {item.after} on{" "}
                {item.scope}.
              </span>
              <strong>
                <CountUp
                  from={item.before}
                  to={item.after}
                  decimals={item.after === 1 ? 2 : 3}
                  run={inView}
                />
              </strong>
              <span className="mono" aria-hidden="true">
                from {item.before}
              </span>
            </div>
            <p className="evidence-scope mono">{item.scope}</p>
          </div>
        ))}
      </div>
      <div className="test-counts">
        {testCounts.map((item) => (
          <div key={item.project}>
            <strong>
              <CountUp to={item.count} run={inView} />
              <span aria-hidden="true">{item.suffix}</span>
              <span className="sr-only">
                {item.count}
                {item.suffix} tests
              </span>
            </strong>
            <span>
              {item.project} tests · {item.note}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Signal map */

const mapProjects = [
  ...selectedWork.map((p) => ({ name: p.name, tools: [...p.stack] })),
  ...otherWork
    .slice(0, 2)
    .map((p) => ({ name: p.name.split(" / ")[0], tools: p.tech.split(" / ") })),
];
const mapTools = Array.from(new Set(mapProjects.flatMap((p) => p.tools)));

export function CyanSignalMap() {
  const [focus, setFocus] = useState<{ kind: "project" | "tool"; name: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<{ project: string; tool: string; d: string }[]>([]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const base = wrap.getBoundingClientRect();
      const next: { project: string; tool: string; d: string }[] = [];
      for (const project of mapProjects) {
        const a = nodes.current.get(`p:${project.name}`)?.getBoundingClientRect();
        if (!a) continue;
        for (const tool of project.tools) {
          const b = nodes.current.get(`t:${tool}`)?.getBoundingClientRect();
          if (!b) continue;
          const x1 = a.right - base.left,
            y1 = a.top + a.height / 2 - base.top;
          const x2 = b.left - base.left,
            y2 = b.top + b.height / 2 - base.top;
          const mid = (x1 + x2) / 2;
          next.push({
            project: project.name,
            tool,
            d: `M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`,
          });
        }
      }
      setPaths(next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, []);

  const lit = (project: string, tool: string) =>
    focus
      ? focus.kind === "project"
        ? focus.name === project
        : focus.name === tool
      : false;
  const projectLit = (name: string) =>
    focus?.kind === "project"
      ? focus.name === name
      : focus?.kind === "tool"
        ? mapProjects.some((p) => p.name === name && p.tools.includes(focus.name))
        : false;
  const toolLit = (tool: string) =>
    focus?.kind === "tool"
      ? focus.name === tool
      : focus?.kind === "project"
        ? mapProjects.some((p) => p.name === focus.name && p.tools.includes(tool))
        : false;
  const register = (key: string) => (node: HTMLElement | null) => {
    if (node) nodes.current.set(key, node);
    else nodes.current.delete(key);
  };

  return (
    <section id="signal" className="cyan-signal section-wrap">
      <div className="section-heading">
        <h2>
          Signal map<span className="heading-period">.</span>
        </h2>
        <p>
          Every project and the tools it runs on. Hover or focus a project to
          trace its stack, or a tool to see where it appears.
        </p>
      </div>
      <div
        ref={wrapRef}
        className={`signal-board${focus ? " has-focus" : ""}`}
        onPointerLeave={() => setFocus(null)}
      >
        <svg className="signal-wires" aria-hidden="true">
          {paths.map((path) => (
            <path
              key={path.project + path.tool}
              d={path.d}
              className={lit(path.project, path.tool) ? "is-lit" : ""}
            />
          ))}
        </svg>
        <ul className="signal-projects" aria-label="Projects">
          {mapProjects.map((project) => (
            <li key={project.name}>
              <button
                ref={register(`p:${project.name}`)}
                className={projectLit(project.name) ? "is-lit" : ""}
                aria-pressed={focus?.kind === "project" && focus.name === project.name}
                onPointerEnter={() => setFocus({ kind: "project", name: project.name })}
                onFocus={() => setFocus({ kind: "project", name: project.name })}
                onBlur={() => setFocus(null)}
                aria-describedby={`signal-${project.name.replace(/\W/g, "")}`}
              >
                {project.name}
                <span id={`signal-${project.name.replace(/\W/g, "")}`} className="sr-only">
                  Uses {project.tools.join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <ul className="signal-tools" aria-label="Tools">
          {mapTools.map((tool) => (
            <li key={tool}>
              <button
                ref={register(`t:${tool}`)}
                className={toolLit(tool) ? "is-lit" : ""}
                onPointerEnter={() => setFocus({ kind: "tool", name: tool })}
                onFocus={() => setFocus({ kind: "tool", name: tool })}
                onBlur={() => setFocus(null)}
              >
                {tool}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Research */

export function CyanResearch() {
  const [strategyId, setStrategyId] = useState("window");
  const strategy = memoryStrategies.find((s) => s.id === strategyId)!;
  const reduced = useReducedMotion();
  const retry = research.studies[1];
  return (
    <section id="research" className="cyan-research section-wrap">
      <div className="research-intro">
        <span className="mono about-label">Prospective researcher</span>
        <h2>
          The cost of remembering<span className="heading-period">.</span>
        </h2>
        <p>
          My research proposal, <em>{research.title.toLowerCase()}</em>, asks
          how an assistant can keep a user's changing requirements without
          resending the whole conversation. Choose a memory strategy to see
          what the model would receive.
        </p>
        <span className="research-badge mono">{research.status}</span>
      </div>

      <div className="memory-lab">
        <div
          className="memory-strategies"
          role="radiogroup"
          aria-label="Memory strategy"
        >
          {memoryStrategies.map((item) => (
            <button
              key={item.id}
              role="radio"
              aria-checked={item.id === strategyId}
              onClick={() => setStrategyId(item.id)}
            >
              {item.name}
              <span className="mono">
                {item.sends.length} msg
                {item.records.length ? ` + ${item.records.length} records` : ""}
                {item.summary ? " + summary" : ""}
              </span>
            </button>
          ))}
        </div>
        <ol className="memory-thread" aria-label="Example conversation">
          {memoryConversation.map((message) => {
            const sent = strategy.sends.includes(message.id);
            return (
              <motion.li
                key={message.id}
                layout={!reduced}
                className={`${message.role}${sent ? " is-sent" : ""}${message.id === 3 ? " is-key" : ""}`}
              >
                <span className="mono">#{message.id}</span>
                <p>{message.text}</p>
                <span className="memory-state mono">{sent ? "sent" : "dropped"}</span>
              </motion.li>
            );
          })}
        </ol>
        <div className="memory-context" aria-live="polite">
          <span className="mono">Context sent to the model</span>
          {strategy.summary && (
            <div className="memory-chip is-summary">
              <span className="mono">summary</span>
              {strategy.summary}
            </div>
          )}
          {strategy.records.map((record) => (
            <div className="memory-chip" key={record}>
              <span className="mono">record</span>
              {record}
            </div>
          ))}
          <div className="memory-chip is-plain">
            <span className="mono">messages</span>
            {strategy.sends.length === 11
              ? "All 11"
              : `#${strategy.sends[0]}–#${strategy.sends[strategy.sends.length - 1]}`}
          </div>
          <p>{strategy.note}</p>
          <small>Illustration of the research question. Not a measured result.</small>
        </div>
      </div>

      <div className="retry-strip">
        <div>
          <span className="mono">Second study</span>
          <h3>{retry.name}</h3>
          <p>{retry.summary}</p>
        </div>
        <p>{retry.question}</p>
        <p className="mono">{retry.measure}</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------ Command palette */

// The menu (and cmdk) loads on first open, keeping it out of the landing bundle.
const loadMenu = () => import("./PaletteMenu");
const PaletteMenu = lazy(loadMenu);





export function CommandPalette({ actions }: { actions: PaletteActions }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const isMac = useMemo(
    () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform),
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest("input, textarea, [contenteditable=true]"));
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "/" && !typing && !open) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector("input")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Actions run from the dialog's close event: closing restores focus to the
  // opener, which would otherwise cancel a scroll or steal a new dialog's focus.
  const pending = useRef<(() => void) | null>(null);
  // Fetch the menu once the page has settled, so the first open is instant.
  useEffect(() => {
    const timer = setTimeout(loadMenu, 2500);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = () => {
      setOpen(false);
      const action = pending.current;
      pending.current = null;
      action?.();
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);
  const run = (fn: () => void) => {
    pending.current = fn;
    setOpen(false);
  };

  return (
    <>
      <button
        className="palette-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
      >
        <Search size={14} />
        <span className="mono">{isMac ? "⌘K" : "Ctrl K"}</span>
      </button>
      <dialog
        ref={ref}
        className="palette-dialog"
        aria-label="Command palette"
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        {open && (
          <Suspense fallback={null}>
            <PaletteMenu actions={actions} run={run} />
          </Suspense>
        )}
      </dialog>
    </>
  );
}
