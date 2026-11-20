import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, Lock, Play, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useMotionPaused } from "@/lib/motion-pause";
import DemoFrame from "./DemoFrame";
import {
  BREAK_LABEL,
  CATEGORIES,
  CATEGORY_LABEL,
  FUND_NAME,
  MATCH_KINDS,
  MATERIALITY_BP,
  MAX_PLANTS,
  PLANTABLE,
  TOLERANCES,
  USERS,
  appendAudit,
  canPlant,
  caseEvidence,
  decide,
  formatDate,
  generateDay,
  releaseStatus,
  runDay,
  scoreRun,
  signOff,
  signOffReasons,
  tamperAudit,
  verifyAudit,
  type Actor,
  type AuditEntry,
  type Break,
  type Case,
  type Category,
  type DayData,
  type DayRun,
  type DecisionKind,
  type ReasonCode,
  type Verification,
} from "./recon";
import "./reconpilot.css";

const DEFAULT_SEED = 11;
const STEP_MS = 320;
const SCAN_MS = 70;
const MINUS = "−";

const nf2 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf4 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const nf0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const sign = (x: number, zero = "") => (x > 0 ? "+" : x < 0 ? MINUS : zero);
const money = (x: number) => `${x < 0 ? MINUS : ""}${nf2.format(Math.abs(x))}`;
const signedMoney = (x: number) => `${sign(Math.round(x * 100))}${nf2.format(Math.abs(x))}`;
const signedQty = (x: number) => `${sign(x)}${nf0.format(Math.abs(x))}`;
const bp = (x: number) => (Math.abs(x) < 0.005 ? "0.00 bp" : `${sign(x)}${Math.abs(x).toFixed(2)} bp`);
const pad = (n: number, width = 2) => String(n).padStart(width, "0");
const clock = (ts: string) => ts.slice(11, 19);
const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const STEPS = [
  "Load the day's files",
  "Match positions",
  "Match cash",
  "Triage breaks into cases",
  "Value NAV and impact",
  "Run release checks",
] as const;

const MATCH_LABEL = { EXACT: "exact", TOLERANCE: "within tolerance", ATTRIBUTE: "by security and amount", MANY_TO_ONE: "netted" };

/** A seed whose fund has room for the six default breaks (a few small universes do not). */
function usableSeed(start: number) {
  let seed = start;
  for (let tries = 0; tries < 50; tries += 1) {
    try {
      generateDay(seed);
      return seed;
    } catch {
      seed = (seed % 9999) + 1;
    }
  }
  return DEFAULT_SEED;
}

function stepSummary(index: number, day: DayData, run: DayRun) {
  const { recon } = run;
  const kinds = (k: Break["kind"]) => recon.breaks.filter((b) => b.kind === k).length;
  switch (index) {
    case 0:
      return `${Object.keys(day.positions).length} positions, ${day.bookTrades.length} trades · ${day.custodianCash.length} custodian cash lines`;
    case 1:
      return `${plural(kinds("QUANTITY"), "quantity break")}, ${plural(kinds("PRICE"), "price break")} · ${recon.withinTolerance.length} inside tolerance`;
    case 2: {
      const counts = MATCH_KINDS.map((k) => [k, recon.matches.filter((m) => m.kind === k).length] as const).filter(([, n]) => n);
      const cash = recon.breaks.length - kinds("QUANTITY") - kinds("PRICE");
      return `${counts.map(([k, n]) => `${n} ${MATCH_LABEL[k]}`).join(", ")} · ${plural(cash, "cash break")}`;
    }
    case 3:
      return `${plural(recon.breaks.length, "break")} into ${plural(run.cases.length, "case")}`;
    case 4:
      return `NAV ${money(run.nav.nav)} · ${run.cases.filter((c) => c.material).length} at or above ${MATERIALITY_BP} bp`;
    default: {
      const n = (s: string) => run.checks.filter((c) => c.status === s).length;
      return `${n("PASS")} pass, ${plural(n("WARN"), "warning")}, ${n("FAIL")} failed`;
    }
  }
}

function statusLabel(c: Case) {
  if (c.status === "PENDING") return "Pending";
  if (c.status === "RECLASSIFIED") return `Reclassified · ${CATEGORY_LABEL[c.finalCategory ?? "UNKNOWN"]}`;
  return c.status === "APPROVED" ? "Approved" : "Rejected";
}

function auditSummary(entry: AuditEntry) {
  const p = entry.payload;
  switch (entry.action) {
    case "DAY_RUN":
      return `${p.cases} cases, ${p.material} material${p.planted ? ` · planted ${p.planted}` : ""}`;
    case "SIGNED_IN":
      return `working as ${entry.role}`;
    case "SIGN_OFF_BLOCKED":
      return Array.isArray(p.reasons) ? p.reasons.join(", ").toLowerCase().replace(/_/g, " ") : "";
    case "PERMISSION_DENIED":
      return `tried to ${p.attempted}`;
    case "DAY_SIGNED_OFF":
      return `${p.cases} cases`;
    default:
      return `${p.case_id}${p.final && p.final !== p.suggested ? ` → ${CATEGORY_LABEL[p.final as Category]}` : ""}${p.note ? ` · “${p.note}”` : ""}`;
  }
}

function breakValue(b: Break, v: number | null) {
  if (v === null) return "none";
  if (b.kind === "QUANTITY") return nf0.format(v);
  if (b.kind === "PRICE") return nf4.format(v);
  return money(v);
}
function breakDiff(b: Break) {
  const d = (b.custodianValue ?? 0) - (b.bookValue ?? 0);
  if (b.kind === "QUANTITY") return signedQty(d);
  if (b.kind === "PRICE") return `${sign(d)}${nf4.format(Math.abs(d))}`;
  return signedMoney(d);
}

function Evidence({ run, c }: { run: DayRun; c: Case }) {
  const ev = caseEvidence(run, c);
  const { position: pos, holding: hold, security: sec, fx } = ev;
  const priceRel = pos && hold && pos.price ? (hold.price - pos.price) / pos.price : 0;
  const limit = sec ? TOLERANCES.priceRelByClass[sec.assetClass] : 0;
  const bookMv = pos ? pos.quantity * pos.price * fx : 0;
  const custMv = hold ? hold.quantity * hold.price * fx : 0;
  return (
    <div className="rp-evidence">
      {pos && hold && sec && (
        <div className="rp-table-wrap">
          <table className="rp-table">
            <caption className="rp-sr">Position, book against custodian</caption>
            <thead>
              <tr>
                <th scope="col">Position</th>
                <th scope="col">Book</th>
                <th scope="col">Custodian</th>
                <th scope="col">Difference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Quantity</th>
                <td>{nf0.format(pos.quantity)}</td>
                <td>{nf0.format(hold.quantity)}</td>
                <td className={hold.quantity !== pos.quantity ? "is-off" : "is-quiet"}>
                  {hold.quantity !== pos.quantity ? signedQty(hold.quantity - pos.quantity) : "agrees"}
                </td>
              </tr>
              <tr>
                <th scope="row">Price, {sec.currency}</th>
                <td>{nf4.format(pos.price)}</td>
                <td>{nf4.format(hold.price)}</td>
                <td className={Math.abs(priceRel) > limit ? "is-off" : "is-quiet"}>
                  {priceRel === 0
                    ? "agrees"
                    : Math.abs(priceRel) > limit
                      ? `${sign(priceRel)}${Math.abs(priceRel * 100).toFixed(2)}%`
                      : "in tolerance"}
                </td>
              </tr>
              <tr>
                <th scope="row">Value, USD</th>
                <td>{money(bookMv)}</td>
                <td>{money(custMv)}</td>
                <td className={Math.abs(custMv - bookMv) >= 0.005 ? "is-off" : "is-quiet"}>
                  {Math.abs(custMv - bookMv) >= 0.005 ? signedMoney(custMv - bookMv) : "agrees"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {sec && pos && (
        <p className="rp-fine">
          {sec.assetClass === "BOND" ? "Bond" : "Equity"} · price tolerance {(limit * 10_000).toFixed(0)} bp · book price
          dated {formatDate(pos.priceDate)}
          {sec.currency !== "USD" && ` · ${sec.currency}/USD ${fx.toFixed(6)}`}
        </p>
      )}
      <div className="rp-table-wrap">
        <table className="rp-table">
          <caption className="rp-sr">Breaks on this case</caption>
          <thead>
            <tr>
              <th scope="col">{plural(ev.breaks.length, "break")}</th>
              <th scope="col">Book</th>
              <th scope="col">Custodian</th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            {ev.breaks.map((b) => (
              <tr key={b.id}>
                <th scope="row">
                  {BREAK_LABEL[b.kind]}
                  <span className="rp-ref">
                    {b.id}
                    {b.reference && ` · ${b.reference}`}
                  </span>
                </th>
                <td>{breakValue(b, b.bookValue)}</td>
                <td>{breakValue(b, b.custodianValue)}</td>
                <td className="is-off">{breakDiff(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ev.pending.map((line) => (
        <p key={line.entryId} className="rp-fine">
          Pending at the custodian: {line.entryId} · {line.reference} · value {formatDate(line.valueDate)} · {money(line.amount)}
        </p>
      ))}
    </div>
  );
}

/** ReconPilot: one synthetic fund-day, reconciled, triaged, decided and signed off under four eyes. */
export default function ReconPilotDemo({ seed: firstSeed }: { seed?: number }) {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const still = Boolean(reduced) || paused;
  const ids = useId();

  const [startSeed] = useState(() => usableSeed(firstSeed ?? DEFAULT_SEED));
  const [seed, setSeed] = useState(startSeed);
  const [plants, setPlants] = useState<Category[]>(PLANTABLE);
  const day = useMemo(() => generateDay(seed, plants), [seed, plants]);
  const [run, setRun] = useState<DayRun | null>(null);
  const [stage, setStage] = useState(0);
  const [cases, setCases] = useState<Case[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [actor, setActor] = useState<Actor>(USERS[1]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reclass, setReclass] = useState<Category>("UNKNOWN");
  const [caseNews, setCaseNews] = useState<{ ok: boolean; text: string } | null>(null);
  const [signNews, setSignNews] = useState<{ ok: boolean; text: string; codes: ReasonCode[] } | null>(null);
  const [signedOffBy, setSignedOffBy] = useState<string | null>(null);
  const [plantChoice, setPlantChoice] = useState<Category>("PRICE_MISMATCH");
  const [tamperSeq, setTamperSeq] = useState<number | null>(null);
  const [check, setCheck] = useState<{ result: Verification; key: string; scanned: number } | null>(null);

  const done = Boolean(run) && stage >= STEPS.length;
  const shownAudit = useMemo(() => (tamperSeq ? tamperAudit(audit, tamperSeq) : audit), [audit, tamperSeq]);
  const logKey = `${audit.length}:${tamperSeq ?? 0}`;

  // The pipeline reveals one stage at a time; reduced or paused motion shows the end state.
  useEffect(() => {
    if (!run || stage >= STEPS.length) return;
    if (still) {
      setStage(STEPS.length);
      return;
    }
    const timer = setTimeout(() => setStage((s) => s + 1), stage === 0 ? 120 : STEP_MS);
    return () => clearTimeout(timer);
  }, [run, stage, still]);

  // Verification walks the chain entry by entry, then shows its verdict.
  useEffect(() => {
    if (!check || check.scanned >= check.result.checked) return;
    if (still) {
      setCheck({ ...check, scanned: check.result.checked });
      return;
    }
    const timer = setTimeout(() => setCheck({ ...check, scanned: check.scanned + 1 }), SCAN_MS);
    return () => clearTimeout(timer);
  }, [check, still]);

  const selected = cases.find((c) => c.id === selectedId) ?? null;
  const locked = signedOffBy !== null;
  const release = run ? releaseStatus(cases, run.checks) : null;
  const myReasons = run ? signOffReasons(cases, run.checks, actor) : [];
  const fourEyes = myReasons.find((r) => r.code === "FOUR_EYES");
  const freeApprover = USERS.find((u) => u.role === "approver" && !cases.some((c) => c.decidedBy.includes(u.name)));
  const score = useMemo(() => (run ? scoreRun(run) : []), [run]);
  const reclassTo = reclass !== selected?.category ? reclass : CATEGORIES.find((c) => c !== selected?.category)!;

  const clearNews = () => {
    setCaseNews(null);
    setSignNews(null);
  };

  const startRun = (nextDay: DayData, payload: Record<string, string>) => {
    const result = runDay(nextDay);
    setRun(result);
    setCases(result.cases);
    setSelectedId(result.cases[0]?.id ?? null);
    setStage(0);
    setNote("");
    clearNews();
    setAudit((log) =>
      appendAudit(log, actor.name, actor.role, "DAY_RUN", {
        as_of: nextDay.asOf,
        seed: nextDay.seed,
        breaks: result.recon.breaks.length,
        cases: result.cases.length,
        material: result.cases.filter((c) => c.material).length,
        nav: result.nav.nav.toFixed(2),
        ...payload,
      }),
    );
  };

  const runTheDay = () => startRun(day, {});

  const plant = () => {
    if (locked || !canPlant(seed, plants, plantChoice)) return;
    const next = [...plants, plantChoice];
    setPlants(next);
    if (run) startRun(generateDay(seed, next), { planted: CATEGORY_LABEL[plantChoice].toLowerCase() });
  };

  const newDay = () => {
    let next = (seed * 7919 + 13) % 9973 || 1;
    if (next === seed) next += 1;
    setSeed(usableSeed(next));
    setPlants(PLANTABLE);
    setRun(null);
    setStage(0);
    setCases([]);
    setAudit([]);
    setSelectedId(null);
    setSignedOffBy(null);
    setTamperSeq(null);
    setCheck(null);
    setNote("");
    clearNews();
  };

  const reset = () => {
    newDay();
    setSeed(startSeed);
    setActor(USERS[1]);
    setPlantChoice("PRICE_MISMATCH");
  };

  const switchTo = (user: Actor) => {
    if (user.name === actor.name) return;
    setActor(user);
    setAudit((log) => appendAudit(log, user.name, user.role, "SIGNED_IN"));
    clearNews();
  };

  const act = (kind: DecisionKind) => {
    if (!selected || locked) return;
    const out = decide(cases, audit, actor, selected.id, kind, { note, category: reclassTo });
    setAudit(out.audit);
    setCases(out.cases);
    setCaseNews({ ok: out.ok, text: out.message });
    setSignNews(null);
    if (!out.ok) return;
    setNote("");
    // Move on to the next case still waiting, in queue order.
    const at = out.cases.findIndex((c) => c.id === selected.id);
    const ordered = [...out.cases.slice(at + 1), ...out.cases.slice(0, at)];
    const next = ordered.find((c) => c.status === "PENDING");
    if (next) setSelectedId(next.id);
  };

  const trySignOff = () => {
    if (!run || locked) return;
    const codes = signOffReasons(cases, run.checks, actor).map((r) => r.code);
    const out = signOff(cases, run.checks, audit, actor);
    setAudit(out.audit);
    setSignNews({ ok: out.ok, text: out.message, codes });
    setCaseNews(null);
    if (out.signedOff) setSignedOffBy(actor.name);
  };

  const verify = () => setCheck({ result: verifyAudit(shownAudit), key: logKey, scanned: 0 });

  const toggleTamper = () => {
    if (tamperSeq) {
      setTamperSeq(null);
      return;
    }
    const decisions = audit.filter((e) => e.action.startsWith("CASE_"));
    const target = decisions.length ? decisions[0] : audit[0];
    if (target) setTamperSeq(target.seq);
  };

  const pillState = !run ? "idle" : locked ? "done" : release?.ready ? "ready" : "blocked";
  const pillText = !run ? "Not run" : locked ? "Signed off" : release?.ready ? "Ready to sign off" : "Blocked";
  const pillReason = !run
    ? "The day has not been run."
    : locked
      ? `Signed off by ${signedOffBy}. The day is locked.`
      : release?.ready
        ? "Every release condition is met."
        : (release?.reasons[0]?.message ?? "");

  const codes = new Set(myReasons.map((r) => r.code));
  const nChecks = (s: string) => run?.checks.filter((c) => c.status === s).length ?? 0;
  const material = cases.filter((c) => c.material);
  const conditions = run
    ? [
        {
          label: "Every open case decided",
          met: !codes.has("PENDING_DECISIONS"),
          detail: codes.has("PENDING_DECISIONS")
            ? `${cases.filter((c) => c.status === "PENDING").length} of ${cases.length} cases still pending.`
            : `All ${cases.length} cases have a decision.`,
        },
        {
          label: "Material cases approved or reclassified",
          met: !codes.has("MATERIAL_NOT_APPROVED"),
          detail: codes.has("MATERIAL_NOT_APPROVED")
            ? myReasons.find((r) => r.code === "MATERIAL_NOT_APPROVED")!.message
            : `${plural(material.length, "material case")} approved or reclassified.`,
        },
        {
          label: "Escalated cases decided by an approver",
          met: !codes.has("ESCALATED_NEEDS_APPROVER"),
          detail: codes.has("ESCALATED_NEEDS_APPROVER")
            ? myReasons.find((r) => r.code === "ESCALATED_NEEDS_APPROVER")!.message
            : `${plural(material.length, "escalated case")} decided by an approver.`,
        },
        {
          label: "No release check failed",
          met: !codes.has("CHECK_FAILED"),
          detail: `${nChecks("PASS")} pass, ${plural(nChecks("WARN"), "warning")}. Warnings do not block release.`,
        },
        {
          label: "Four-eyes: the signer decided no case today",
          met: !fourEyes,
          detail: fourEyes
            ? fourEyes.message
            : actor.role === "approver"
              ? `${actor.name} decided no case today.`
              : `${actor.name} decided no case, but only an approver may sign off.`,
        },
      ]
    : [];
  const met = conditions.filter((c) => c.met).length;

  const caseRegion = `${ids}-case`;
  const reasonId = `${ids}-reason`;
  const plantable = !locked && canPlant(seed, plants, plantChoice);
  const freshVerdict = check && check.key === logKey && check.scanned >= check.result.checked ? check.result : null;

  return (
    <DemoFrame
      project="ReconPilot"
      title="Work one fund's morning reconciliation"
      intro="Run a synthetic fund-day, work the breaks it finds from the largest NAV impact down, then try to release the NAV. Whoever decided cases cannot sign off."
      note="A simplified TypeScript port of ReconPilot's engine over one synthetic fund-day: 18 securities instead of 80 and a single day, so no ageing, SLAs or clearing across days, and fewer release checks. The users are the real demo's made-up people; switching between them stands in for signing in. The audit chain links SHA-256 hashes the way the real log does, but lives only in this page's memory, where the real one is append-only in PostgreSQL. The optional model second opinion is left out. Nothing leaves your browser."
      onReset={reset}
      className={`rp-demo${still ? " is-still" : ""}`}
    >
      <div className="rp-desk">
        {/* ---------- Fund-day, user and controls ---------- */}
        <div className="rp-top">
          <p className="rp-fund">
            <strong>{FUND_NAME}</strong>
            <span>
              {formatDate(day.asOf, true)} · seed {pad(seed, 4)} · {plural(plants.length, "break")} planted
            </span>
          </p>
          <div className="rp-users" role="group" aria-label="Working as">
            <span className="demo-label">Working as</span>
            <div className="demo-chips">
              {USERS.map((u) => (
                <button key={u.name} type="button" className="demo-chip rp-user" aria-pressed={u.name === actor.name} onClick={() => switchTo(u)}>
                  {u.name}
                  <span>{u.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rp-controls">
          <button type="button" className={`demo-btn${run ? " is-ghost" : ""}`} onClick={runTheDay} disabled={locked}>
            <Play size={14} aria-hidden="true" /> {run ? "Run the day again" : "Run the day"}
          </button>
          <button type="button" className="demo-btn is-ghost" onClick={newDay}>
            <RefreshCw size={14} aria-hidden="true" /> New fund-day
          </button>
          <div className="rp-plant">
            <label className="rp-sr" htmlFor={`${ids}-plant`}>
              Break to plant
            </label>
            <select
              id={`${ids}-plant`}
              className="rp-select"
              value={plantChoice}
              onChange={(e) => setPlantChoice(e.target.value as Category)}
              disabled={locked}
            >
              {PLANTABLE.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <button type="button" className="demo-btn is-ghost" onClick={plant} disabled={!plantable}>
              <Plus size={14} aria-hidden="true" /> {run ? "Plant and re-run" : "Plant a break"}
            </button>
          </div>
        </div>
        {plants.length >= MAX_PLANTS && <p className="rp-fine">Every free security already carries a planted break.</p>}

        {/* ---------- Pipeline ---------- */}
        <ol className="rp-steps" aria-label="Run of the day">
          {STEPS.map((label, i) => {
            const state = !run ? "wait" : i < stage ? "done" : i === stage ? "now" : "wait";
            return (
              <li key={label} className={`is-${state}`} style={{ "--i": i } as CSSProperties}>
                <span className="rp-step-mark" aria-hidden="true">
                  {state === "done" ? <Check size={11} /> : pad(i + 1)}
                </span>
                <span className="rp-step-name">{label}</span>
                <span className="rp-step-out">
                  {run && state === "done" ? stepSummary(i, day, run) : state === "now" ? "running…" : ""}
                </span>
              </li>
            );
          })}
        </ol>

        {/* ---------- NAV strip and release status ---------- */}
        <div className="rp-strip">
          <div>
            <span className="demo-label">NAV, USD</span>
            <strong>{done && run ? money(run.nav.nav) : "—"}</strong>
          </div>
          <div>
            <span className="demo-label">NAV per share</span>
            <strong>{done && run ? run.nav.navPerShare.toFixed(6) : "—"}</strong>
            {done && run && (
              <small>
                {sign(run.nav.movement)}
                {Math.abs(run.nav.movement * 100).toFixed(3)}% on {run.nav.priorNavPerShare.toFixed(6)}
              </small>
            )}
          </div>
          <div className="rp-release" aria-live="polite">
            <span className="demo-label">Release</span>
            <span className={`rp-pill is-${done ? pillState : "idle"}`}>
              {done && pillState === "done" && <Lock size={11} aria-hidden="true" />}
              {done ? pillText : run ? "Running" : "Not run"}
            </span>
            <small id={reasonId}>{done ? pillReason : run ? "Matching the book against the custodian…" : "The day has not been run."}</small>
          </div>
        </div>

        {/* ---------- Queue and case ---------- */}
        {done && run ? (
          <div className="rp-work">
            <div className="rp-pane">
              <span className="demo-label" id={`${ids}-queue`}>
                Queue · {cases.length} cases · {cases.filter((c) => c.status === "PENDING").length} pending · largest NAV impact first
              </span>
              <ol className="rp-queue" aria-labelledby={`${ids}-queue`}>
                {cases.map((c, i) => {
                  const sec = run.day.securities[c.securityId];
                  return (
                    <li key={c.id} style={{ "--i": i } as CSSProperties}>
                      <button
                        type="button"
                        className="rp-row"
                        aria-pressed={c.id === selectedId}
                        aria-controls={caseRegion}
                        onClick={() => {
                          setSelectedId(c.id);
                          setCaseNews(null);
                        }}
                      >
                        <span className="rp-row-main">
                          <span className="rp-row-id">{c.id}</span>
                          <span className="rp-row-name">{sec?.name ?? c.securityId}</span>
                          <span className="rp-row-tags">
                            <span className={`rp-tag is-${c.status.toLowerCase()}`}>{statusLabel(c)}</span>
                            {c.material && <span className="rp-tag is-material">Material</span>}
                          </span>
                        </span>
                        <span className="rp-row-side">
                          <span className="rp-row-impact">{signedMoney(c.navImpact)}</span>
                          <span className="rp-row-bp">{bp(c.navImpactBp)}</span>
                          <span className="rp-row-cause">{CATEGORY_LABEL[c.category]}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="rp-fine">
                Material: {MATERIALITY_BP} bp of NAV or more ({money((run.nav.nav * MATERIALITY_BP) / 10_000)} USD). Material cases are
                escalated and need an approver's decision.
              </p>
            </div>

            <div className="rp-pane">
              <span className="demo-label">Case</span>
              <div className="rp-case" id={caseRegion} role="region" aria-label={selected ? `Case ${selected.id}` : "Case"}>
                {selected ? (
                  <>
                    <div key={selected.id} className="rp-case-body">
                      <p className="rp-case-head">
                        <strong>{selected.id}</strong> {run.day.securities[selected.securityId]?.name} ({selected.securityId})
                      </p>
                      <div className="rp-impact">
                        <span className="demo-label">NAV impact if the custodian is right</span>
                        <p>
                          <strong>{signedMoney(selected.navImpact)}</strong> USD
                        </p>
                        <p className="rp-fine">
                          {bp(selected.navImpactBp)} of NAV · gross exposure {money(selected.grossExposure)} USD
                        </p>
                        <p className="rp-row-tags">
                          <span className={`rp-tag is-${selected.status.toLowerCase()}`}>{statusLabel(selected)}</span>
                          {selected.material && <span className="rp-tag is-material">Material</span>}
                          {selected.escalated && <span className="rp-tag is-escalated">Escalated</span>}
                        </p>
                      </div>
                      <p className="rp-cause">
                        <span className="demo-label">Rules suggest</span>
                        <strong>{CATEGORY_LABEL[selected.category]}</strong> · confidence {selected.confidence.toFixed(2)}
                      </p>
                      <p className="rp-explain">{selected.explanation}</p>
                      <span className="demo-label">Evidence · book against custodian</span>
                      <Evidence run={run} c={selected} />
                      <details className="rp-query">
                        <summary>Draft query to the custodian</summary>
                        <pre>{selected.query}</pre>
                      </details>
                    </div>

                    <div className="rp-decide">
                      {selected.status !== "PENDING" && (
                        <p className="rp-decided">
                          {statusLabel(selected)} by {selected.reviewedBy} ({selected.reviewedRole})
                          {selected.note && ` · “${selected.note}”`}
                        </p>
                      )}
                      <label className="demo-label" htmlFor={`${ids}-note`}>
                        Note (required to reject)
                      </label>
                      <textarea
                        id={`${ids}-note`}
                        className="demo-input"
                        rows={2}
                        maxLength={160}
                        value={note}
                        placeholder="What you checked, and what you found"
                        onChange={(e) => setNote(e.target.value)}
                        disabled={locked}
                      />
                      <div className="rp-decide-row">
                        <button type="button" className="demo-btn" onClick={() => act("approve")} disabled={locked}>
                          <Check size={14} aria-hidden="true" /> Approve
                        </button>
                        <button type="button" className="demo-btn is-ghost" onClick={() => act("reject")} disabled={locked}>
                          <X size={14} aria-hidden="true" /> Reject
                        </button>
                        <span className="rp-reclass">
                          <label className="rp-sr" htmlFor={`${ids}-reclass`}>
                            Reclassify to
                          </label>
                          <select
                            id={`${ids}-reclass`}
                            className="rp-select"
                            value={reclassTo}
                            onChange={(e) => setReclass(e.target.value as Category)}
                            disabled={locked}
                          >
                            {CATEGORIES.filter((c) => c !== selected.category).map((c) => (
                              <option key={c} value={c}>
                                {CATEGORY_LABEL[c]}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="demo-btn is-ghost" onClick={() => act("reclassify")} disabled={locked}>
                            Reclassify
                          </button>
                        </span>
                      </div>
                      <p className={`rp-news${caseNews && !caseNews.ok ? " is-bad" : ""}`} role="status">
                        {caseNews?.text ?? ""}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="rp-empty">No breaks today: every position and cash line agrees.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="rp-empty rp-wait">
            {run
              ? "Matching the book against the custodian…"
              : "Run the day to compare the fund's book with the custodian's holdings and cash, and see what does not agree."}
          </p>
        )}

        {/* ---------- Sign-off and audit trail ---------- */}
        <div className="rp-bottom">
          <div className="rp-pane">
            <span className="demo-label">NAV sign-off</span>
            <div className="rp-sign">
              {done && run ? (
                <>
                  <p className="rp-sign-head">
                    {pillText}
                    <span>
                      {met} of {conditions.length} conditions met for {actor.name}
                    </span>
                  </p>
                  <ul className="rp-conditions">
                    {conditions.map((c) => (
                      <li key={c.label} className={c.met ? "is-met" : "is-not"}>
                        <span className="rp-cond-mark">{c.met ? "Met" : "Not met"}</span>
                        <span>
                          <strong>{c.label}</strong>
                          <small>{c.detail}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <details className="rp-checks">
                    <summary>Release checks · {run.checks.length}</summary>
                    <ul>
                      {run.checks.map((c) => (
                        <li key={c.name}>
                          <span className={`rp-tag is-${c.status.toLowerCase()}`}>{c.status}</span>
                          <span>
                            <strong>{c.name}.</strong> {c.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                  <button type="button" className="demo-btn rp-sign-btn" onClick={trySignOff} disabled={locked} aria-describedby={reasonId}>
                    <Lock size={14} aria-hidden="true" /> {locked ? `Signed off by ${signedOffBy}` : `Sign off NAV as ${actor.name}`}
                  </button>
                  <p className={`rp-news${signNews && !signNews.ok ? " is-bad" : ""}`} role="status">
                    {signNews?.text ?? ""}
                  </p>
                  {!locked && signNews && !signNews.ok && freeApprover && freeApprover.name !== actor.name && (
                    <button type="button" className="demo-btn is-ghost rp-switch" onClick={() => switchTo(freeApprover)}>
                      Switch to {freeApprover.name}, {signNews.codes.includes("FOUR_EYES") ? "the second approver" : "an approver"}
                    </button>
                  )}
                </>
              ) : (
                <p className="rp-empty">Sign-off opens once the day has run.</p>
              )}
            </div>
          </div>

          <div className="rp-pane">
            <span className="demo-label" id={`${ids}-audit`}>
              Audit trail · hash-chained · {plural(shownAudit.length, "entry", "entries")}
            </span>
            <div className="rp-audit">
              <div className="rp-audit-actions">
                <button type="button" className="demo-btn is-ghost" onClick={verify} disabled={!shownAudit.length}>
                  <ShieldCheck size={14} aria-hidden="true" /> Verify chain
                </button>
                <button type="button" className="demo-btn is-ghost" onClick={toggleTamper} disabled={!audit.length} aria-pressed={tamperSeq !== null}>
                  {tamperSeq ? "Undo the edit" : "Edit an entry in place"}
                </button>
              </div>
              <p className={`rp-verdict${freshVerdict && !freshVerdict.ok ? " is-bad" : ""}`} role="status">
                {freshVerdict
                  ? freshVerdict.ok
                    ? `Chain intact: ${plural(freshVerdict.checked, "entry", "entries")} re-hashed from the genesis hash, every link fits.`
                    : `Chain broken at entry ${freshVerdict.firstBad}: its contents no longer match its hash, so everything after it is suspect.`
                  : check && check.key === logKey
                    ? `Re-hashing entry ${check.scanned + 1} of ${check.result.checked}…`
                    : tamperSeq
                      ? `Entry ${tamperSeq} was edited in place, without re-hashing. Verify the chain.`
                      : ""}
              </p>
              {shownAudit.length ? (
                <ol className="rp-log" aria-labelledby={`${ids}-audit`}>
                  {[...shownAudit].reverse().map((e, i) => {
                    const scanning = check && check.key === logKey;
                    const state =
                      freshVerdict && !freshVerdict.ok && e.seq === freshVerdict.firstBad
                        ? " is-bad"
                        : scanning && e.seq <= check.scanned
                          ? " is-checked"
                          : "";
                    return (
                      <li key={e.seq} className={`${i === 0 ? "is-new" : ""}${state}${e.seq === tamperSeq ? " is-edited" : ""}`}>
                        <span className="rp-log-seq">{pad(e.seq)}</span>
                        <span className="rp-log-main">
                          <span className="rp-log-what">
                            <strong>{e.action}</strong> {auditSummary(e)}
                          </span>
                          <span className="rp-log-meta">
                            {clock(e.ts)} · {e.actor} · prev {shortHash(e.prev_hash)} · hash {shortHash(e.hash)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="rp-empty">Every run, decision and sign-off attempt lands here.</p>
              )}
              <p className="rp-fine">
                Each entry stores the SHA-256 of the one before it, computed here in plain TypeScript over a sorted-key JSON
                form, as the real audit.py does. Verifying re-hashes every entry from the genesis hash.
              </p>
            </div>
          </div>
        </div>

        {/* ---------- Answer key ---------- */}
        {done && run && (
          <details className="rp-key">
            <summary>
              Answer key · {score.length} planted · {score.filter((s) => s.found).length} found ·{" "}
              {score.filter((s) => s.right).length} named right
            </summary>
            <ul>
              {score.map((s) => (
                <li key={s.securityId}>
                  <strong>{CATEGORY_LABEL[s.category]}</strong> on {run.day.securities[s.securityId]?.name}: {s.detail}{" "}
                  <span className="rp-fine">
                    {s.found
                      ? `Found as ${s.caseId}; the rules said ${CATEGORY_LABEL[s.suggested ?? "UNKNOWN"].toLowerCase()}${s.right ? "." : ", which is wrong."}`
                      : "Not found."}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </DemoFrame>
  );
}
