import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  memoryConversation,
  memoryStrategies,
  research,
} from "@/data/portfolio";
import { useMotionPaused } from "@/lib/motion-pause";
import type { PaletteActions } from "./PaletteMenu";
import { contextCost, savingPercent } from "./tokens";

/* ------------------------------------------------------------ Research */

/**
 * How much a strategy sends against the full history, as a bar and a reading.
 * The numbers are characters ÷ 4, so the caption says plainly that it is an
 * estimate. Under reduced motion or the site-wide pause the bar jumps to its
 * new width instead of easing (see `data-still` in cyan.css).
 */
function ContextGauge({ strategy }: { strategy: (typeof memoryStrategies)[number] }) {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const cost = contextCost(strategy);
  const share = cost.full > 0 ? Math.min(100, (cost.sent / cost.full) * 100) : 0;
  return (
    <div className="context-gauge" data-still={reduced || paused ? "" : undefined}>
      {/* The reading says the same in words, so the bar stays out of the accessibility tree. */}
      <div className="context-gauge-bar" aria-hidden="true">
        <span className="context-gauge-fill" style={{ width: `${Number(share.toFixed(2))}%` }} />
      </div>
      <output className="context-gauge-reading mono">
        {`≈ ${cost.sent} of ${cost.full} tokens · ${savingPercent(cost)}% fewer`}
      </output>
      <small className="context-gauge-caption">
        Rough estimate: characters ÷ 4. Illustration, not a measured result.
      </small>
    </div>
  );
}

export function CyanResearch() {
  const [strategyId, setStrategyId] = useState("window");
  const strategy = memoryStrategies.find((s) => s.id === strategyId)!;
  const reduced = useReducedMotion();
  const retry = research.studies[1];
  return (
    <section id="research" tabIndex={-1} className="cyan-research section-wrap">
      <div className="research-intro">
        <span className="mono about-label">Research proposal</span>
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
          <ContextGauge strategy={strategy} />
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
      // Another modal (the shortcuts sheet, a case study) is up: opening over it would stack two.
      // The palette's own dialog does not count, so Ctrl K can still close it.
      const covered = Array.from(document.querySelectorAll("dialog[open]")).some((dialog) => dialog !== ref.current);
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (!covered) setOpen((value) => !value);
      } else if (event.key === "/" && !typing && !open && !covered) {
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
