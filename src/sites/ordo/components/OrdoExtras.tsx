import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { aiCapabilities, research } from "@/data/portfolio";
import { useCanvasLoop, type CanvasFrame } from "@/hooks/use-canvas-loop";
import {
  ASCII_ART,
  completeCommand,
  runCommand,
  type CommandOutput,
} from "@/lib/terminal-commands";
import { CYAN_URL } from "@/lib/sites";
import CapabilityArt from "./CapabilityArt";

/** Hovering dissolves the label into pixel noise, then resolves it again. */
export function PixelSwap({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const [active, setActive] = useState(false);
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);
  const start = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelAnimationFrame(frameRef.current);
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    const ink = getComputedStyle(canvas).color;
    const cell = 5;
    const began = performance.now();
    setActive(true);
    const step = (now: number) => {
      const t = (now - began) / 520;
      ctx.clearRect(0, 0, w, h);
      if (t >= 1) {
        setActive(false);
        return;
      }
      // Density peaks a third of the way in, then clears to reveal the label.
      const density = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
      ctx.fillStyle = ink;
      for (let y = 0; y < h; y += cell)
        for (let x = 0; x < w; x += cell)
          if (Math.random() < density * 0.55 * (1 - Math.abs(x / w - 0.5)))
            ctx.fillRect(x, y, cell - 1, cell - 1);
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  };
  return (
    <span className={`pixel-swap${active ? " is-noisy" : ""}`} onPointerEnter={start}>
      <span className="pixel-swap-label">{children}</span>
      <canvas ref={canvasRef} aria-hidden="true" />
    </span>
  );
}

export function OrdoCapabilities() {
  const reduced = useReducedMotion();
  return (
    <section id="capabilities" className="ordo-capabilities section-wrap">
      <div className="ordo-section-label">
        <span>[ 02 / AI CAPABILITIES ]</span>
        <span>FROM PROJECTS AND CLIENT WORK</span>
      </div>
      <h2>
        Everything an AI feature needs.
        <br />
        <span>Nothing it doesn't.</span>
      </h2>
      <p className="ordo-section-intro">
        Retrieval, agents, evaluation and the applications around them.
        <br />
        Diagrams are illustrations of how each system works.
      </p>
      <div className="capability-grid">
        {aiCapabilities.map((item, index) => (
          <motion.article
            key={item.id}
            className="capability-card"
            initial={reduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, delay: (index % 3) * 0.06 }}
          >
            <div className="capability-top">
              <span>F/{String(index + 1).padStart(2, "0")}</span>
              <span>{item.source.toUpperCase()}</span>
            </div>
            <div className="capability-art">
              <CapabilityArt kind={item.id} />
              <div className="capability-meta">
                <span>{item.metaLeft}</span>
                <span>{item.metaRight}</span>
              </div>
            </div>
            <h3>{item.name}</h3>
            <p>{item.text}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function MemoryDiagram() {
  return (
    <svg viewBox="0 0 260 74" className="study-diagram" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => {
        const recent = i >= 8;
        const recalled = i === 2 || i === 5;
        return (
          <rect
            key={i}
            x={4 + i * 18}
            y={recalled ? 6 : 22}
            width="13"
            height="20"
            className={recent ? "is-recent" : recalled ? "is-recalled" : ""}
          />
        );
      })}
      <path d="M14 26V58H232 M68 26V58" className="study-wire" />
      <text x="4" y="70">CONSTRAINTS · ACTIVE / SUPERSEDED</text>
      <text x="148" y="54">LAST 6 MESSAGES</text>
    </svg>
  );
}

function RetryDiagram() {
  return (
    <svg viewBox="0 0 260 74" className="study-diagram" aria-hidden="true">
      <rect x="4" y="26" width="58" height="20" className="is-recent" />
      <text x="10" y="39" className="on-ink">ANSWER</text>
      <path d="M62 36H96 M96 36L126 14 M96 36L126 58" className="study-wire" />
      <rect x="126" y="4" width="76" height="20" />
      <text x="132" y="17">RETURN</text>
      <rect x="126" y="48" width="96" height="20" className="is-recalled" />
      <text x="132" y="61">RETRY · HIGHER BUDGET</text>
      <text x="4" y="60">P(BETTER) × COST</text>
    </svg>
  );
}

export function OrdoResearch() {
  return (
    <section id="research" className="ordo-research section-wrap">
      <div className="ordo-section-label">
        <span>[ 05 / RESEARCH ]</span>
        <span>PROSPECTIVE RESEARCHER</span>
      </div>
      <div className="research-heading">
        <h2>
          Lower inference cost.
          <br />
          <span>Same task quality.</span>
        </h2>
        <div>
          <p>
            I'm a prospective researcher working on the cost of LLM assistants.
            My proposal, <em>{research.title.toLowerCase()}</em>, sets out two
            experimental studies.
          </p>
          <span className="research-status">{research.status}</span>
        </div>
      </div>
      <div className="research-grid">
        {research.studies.map((study, index) => (
          <article className="research-card" key={study.id}>
            <div className="capability-top">
              <span>{study.tag.toUpperCase()}</span>
              <span>R/{String(index + 1).padStart(2, "0")}</span>
            </div>
            {index === 0 ? <MemoryDiagram /> : <RetryDiagram />}
            <h3>{study.name}</h3>
            <p className="research-summary">{study.summary}</p>
            <dl>
              <div>
                <dt>Question</dt>
                <dd>{study.question}</dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>{study.method}</dd>
              </div>
              <div>
                <dt>Evaluation</dt>
                <dd>{study.evaluation}</dd>
              </div>
              <div>
                <dt>Measured by</dt>
                <dd>{study.measure}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <p className="research-note">
        {research.costNote} {research.note}
      </p>
    </section>
  );
}

const CONSOLE_TABS = ["about", "projects", "ai", "research", "experience", "contact"];

export function OrdoConsole() {
  const [history, setHistory] = useState<CommandOutput[]>([
    { command: "", output: ASCII_ART },
    { command: "", output: 'Type "help", or pick a command above.\n' },
  ]);
  const [input, setInput] = useState("");
  const [past, setPast] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [tab, setTab] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll only the console, never the page.
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [history]);

  const run = (command: string) => {
    const trimmed = command.trim();
    if (!trimmed) return;
    setPast((value) => [...value, trimmed]);
    setCursor(-1);
    setTab(CONSOLE_TABS.includes(trimmed.toLowerCase()) ? trimmed.toLowerCase() : null);
    const result = runCommand(trimmed);
    setHistory((value) =>
      result ? [...value, result] : [{ command: "", output: "Console cleared.\n" }],
    );
  };

  return (
    <section id="console" className="ordo-console section-wrap">
      <div className="ordo-section-label">
        <span>[ 06 / CONSOLE ]</span>
        <span>THE ORIGINAL TERMINAL</span>
      </div>
      <div className="console-grid">
        <div className="console-copy">
          <h2>
            Prefer a command line?
            <br />
            <span>Ask the terminal.</span>
          </h2>
          <p>
            The same résumé, as commands. Every answer comes from the data
            behind this page.
          </p>
          <ol>
            <li>
              <span>01</span>
              <strong>Type a command</strong>
              <small>help lists everything, including research and ai.</small>
            </li>
            <li>
              <span>02</span>
              <strong>Move quickly</strong>
              <small>Tab completes. Up and down recall earlier commands.</small>
            </li>
            <li>
              <span>03</span>
              <strong>Go full screen</strong>
              <small>
                <a href={`${CYAN_URL}/terminal`}>
                  Open the original terminal <ArrowUpRight size={12} />
                </a>
              </small>
            </li>
          </ol>
        </div>
        <div className="console-window">
          <div className="console-tabs" role="group" aria-label="Quick commands">
            {CONSOLE_TABS.map((name) => (
              <button
                key={name}
                aria-pressed={tab === name}
                onClick={() => run(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <div
            ref={bodyRef}
            className="console-body"
            onClick={() => inputRef.current?.focus()}
          >
            {history.map((entry, index) => (
              <div key={index} className="console-entry">
                {entry.command && (
                  <p>
                    <span>❯</span> {entry.command}
                  </p>
                )}
                <pre className={entry.isError ? "is-error" : undefined}>
                  {entry.output}
                </pre>
              </div>
            ))}
            <label className="console-input">
              <span aria-hidden="true">❯</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    run(input);
                    setInput("");
                  } else if (event.key === "ArrowUp" && past.length) {
                    event.preventDefault();
                    const next = Math.min(cursor + 1, past.length - 1);
                    setCursor(next);
                    setInput(past[past.length - 1 - next]);
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    const next = cursor - 1;
                    setCursor(Math.max(next, -1));
                    setInput(next >= 0 ? past[past.length - 1 - next] : "");
                  } else if (event.key === "Tab" && input) {
                    const match = completeCommand(input);
                    if (match) {
                      event.preventDefault();
                      setInput(match);
                    }
                  }
                }}
                aria-label="Console command"
                placeholder="type a command..."
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="none"
              />
            </label>
          </div>
          <div className="console-status">
            <span>varun@portfolio:~</span>
            <span>{history.filter((entry) => entry.command).length} commands</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Dotted wordmark: letters sampled onto a dot grid that swells near the cursor. */
let wordmarkCache: { key: string; dots: Float32Array } | null = null;
function drawWordmark(f: CanvasFrame) {
  const { ctx, width: w, height: h, time, pointer } = f;
  const gap = w < 600 ? 6 : 9;
  const key = `${w}x${h}`;
  if (wordmarkCache?.key !== key) {
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.floor(w));
    off.height = Math.max(1, Math.floor(h));
    const o = off.getContext("2d");
    const dots: number[] = [];
    if (o) {
      o.fillStyle = "#000";
      o.textAlign = "center";
      o.textBaseline = "middle";
      let size = h * 0.82;
      o.font = `600 ${size}px "IBM Plex Mono", monospace`;
      const fit = (w * 0.92) / o.measureText("VARUN").width;
      if (fit < 1) {
        size *= fit;
        o.font = `600 ${size}px "IBM Plex Mono", monospace`;
      }
      o.fillText("VARUN", w / 2, h / 2);
      const data = o.getImageData(0, 0, off.width, off.height).data;
      for (let y = gap / 2; y < h; y += gap)
        for (let x = gap / 2; x < w; x += gap) {
          const inside = data[(Math.floor(y) * off.width + Math.floor(x)) * 4 + 3] > 128;
          dots.push(x, y, inside ? 1 : 0);
        }
    }
    wordmarkCache = { key, dots: Float32Array.from(dots) };
  }
  const { dots } = wordmarkCache;
  const reach = Math.min(w, h) * 0.45;
  for (let i = 0; i < dots.length; i += 3) {
    const x = dots[i],
      y = dots[i + 1],
      letter = dots[i + 2];
    const near = pointer.inside ? Math.max(0, 1 - Math.hypot(x - pointer.x, y - pointer.y) / reach) : 0;
    const shimmer = 0.5 + 0.5 * Math.sin(time * 0.0015 + x * 0.02 - y * 0.01);
    const alpha = letter ? 0.5 + 0.35 * shimmer + 0.15 * near : 0.08 + 0.3 * near;
    const size = (letter ? 2 : 1) + near * 2.2;
    ctx.fillStyle = f.ink(alpha);
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
}

export function DotWordmark() {
  const ref = useCanvasLoop(drawWordmark);
  return (
    <div className="dot-wordmark">
      <div className="section-wrap dot-wordmark-inner">
        <div className="dot-wordmark-labels">
          <span>VARUN.DEV / AI ENGINEER</span>
          <span>MUMBAI · IST</span>
        </div>
        <canvas ref={ref} role="img" aria-label="VARUN, drawn in dots" />
      </div>
    </div>
  );
}
