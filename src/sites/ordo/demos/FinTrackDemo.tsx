import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";
import DemoFrame from "./DemoFrame";
import {
  DUPLICATE_WINDOW_MINUTES,
  FLOW_LABELS,
  SAMPLE_INBOX,
  findReferenceMatch,
  formatInr,
  formatInrExact,
  formatReceived,
  parseSms,
  processInbox,
  summarise,
  type InboxEntry,
  type LedgerSummary,
  type Mark,
  type MarkField,
  type ParsedSms,
  type ReviewDecision,
} from "./sms";
import "./fintrack.css";

// Eleven messages at this pace take about five seconds: slow enough to follow.
const STEP_MS = 420;
const MINUS = "−";

const pad = (n: number) => String(n).padStart(2, "0");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const MARK_LABELS: Record<MarkField, string> = {
  amount: "amount",
  direction: "direction",
  counterparty: "counterparty",
  reference: "reference",
  account: "account",
  flow: "flow",
  skip: "skip",
};

const EXAMPLES = [
  {
    label: "Two-sided alert",
    text: "Acct XX1234 debited for Rs 640.00 on 19-Oct-26; QUICKSHIP LOGISTICS credited. UPI:629355102938.",
  },
  {
    label: "Payment request",
    text: "RAHUL K has requested Rs 1,200.00 from you on Tidepay. Pay only if you know them.",
  },
  {
    label: "Reminder",
    text: "Reminder: Rs.5,000.00 will be debited from A/c XX1234 on 03-Nov-26 for your SIP in ALDER FLEXICAP FUND.",
  },
];

/** "−₹349" for money out, "+₹82,500" for money in. */
function signedAmount(parsed: ParsedSms) {
  if (parsed.amount === null) return "";
  const text = formatInr(parsed.amount);
  if (parsed.kind !== "transaction") return text;
  return parsed.direction === "out" ? `${MINUS}${text}` : `+${text}`;
}

function entryTag(entry: InboxEntry, decision: ReviewDecision | undefined) {
  if (entry.status === "counted" && entry.parsed.flow) return FLOW_LABELS[entry.parsed.flow];
  if (entry.status === "duplicate") return "Duplicate";
  if (entry.status === "ignored") return "Ignored";
  if (decision === "expense") return "Expense";
  if (decision === "dismissed") return "Not counted";
  return "Needs review";
}

/** Tag style: solid for counted, dashed for duplicates, plain for ignored, filled for review. */
function tagStyle(entry: InboxEntry, decision: ReviewDecision | undefined) {
  if (entry.status !== "review") return entry.status;
  if (decision === "expense") return "counted";
  return decision === "dismissed" ? "ignored" : "review";
}

function entryLabel(entry: InboxEntry) {
  const { parsed } = entry;
  if (entry.status === "ignored") return parsed.ignoredAs ?? "Not a transaction";
  return parsed.counterparty ?? (parsed.flow ? FLOW_LABELS[parsed.flow] : "Unclear message");
}

function statusLine(entry: InboxEntry, decision: ReviewDecision | undefined) {
  const { parsed } = entry;
  if (entry.status === "counted" && parsed.flow) return `Counted · ${FLOW_LABELS[parsed.flow]}`;
  if (entry.status === "duplicate") return `Duplicate of message ${pad(entry.duplicateOf ?? 0)} · counted once`;
  if (entry.status === "ignored") return `Ignored · ${parsed.ignoredAs ?? "not a transaction"}`;
  if (decision === "expense") return "Needs review · you added it as an expense";
  if (decision === "dismissed") return "Needs review · you marked it as not a transaction";
  return "Needs review · direction unclear";
}

/** The message text, with every stretch the rules read underlined and named. */
function MarkedText({ text, marks }: { text: string; marks: Mark[] }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  marks.forEach((mark, i) => {
    if (mark.start > cursor) parts.push(<Fragment key={`t${i}`}>{text.slice(cursor, mark.start)}</Fragment>);
    // The field list below says the same in words, so the inline tags stay out of the accessibility tree.
    parts.push(
      <Fragment key={`m${i}`}>
        <mark className={`ft-mark is-${mark.field}`}>{text.slice(mark.start, mark.end)}</mark>
        <span className="ft-mark-tag" aria-hidden="true">
          {MARK_LABELS[mark.field]}
        </span>
      </Fragment>,
    );
    cursor = mark.end;
  });
  if (cursor < text.length) parts.push(<Fragment key="end">{text.slice(cursor)}</Fragment>);
  return <p className="ft-sms">{parts}</p>;
}

function Fields({
  parsed,
  decision,
  pending = "Waiting for you",
  countedIn,
}: {
  parsed: ParsedSms;
  decision?: ReviewDecision;
  /** Flow text for a message held for review that nobody has decided on. */
  pending?: string;
  /** For a duplicate: the message where this payment was counted. */
  countedIn?: number;
}) {
  const direction =
    parsed.kind === "transaction"
      ? parsed.direction === "out"
        ? "Money out"
        : "Money in"
      : parsed.kind === "review"
        ? "Unclear"
        : "None";
  const flow =
    parsed.kind === "transaction" && parsed.flow
      ? `${FLOW_LABELS[parsed.flow]}${countedIn ? `, counted in ${pad(countedIn)}` : ""}`
      : parsed.kind === "review"
        ? decision === "expense"
          ? "Expense, your choice"
          : decision === "dismissed"
            ? "None, your choice"
            : pending
        : "None";
  const rows: [string, string | null][] = [
    [parsed.kind === "ignored" ? "Amount named" : "Amount", parsed.amount === null ? null : formatInrExact(parsed.amount)],
    ["Direction", direction],
    ["Counterparty", parsed.counterparty],
    ["Reference", parsed.reference ? `${parsed.reference.kind} ${parsed.reference.value}` : null],
    ["Account", parsed.account],
    ["Flow", flow],
  ];
  return (
    <dl className="ft-fields">
      {rows.map(([name, value], i) => (
        <div key={name} style={{ "--i": i } as CSSProperties}>
          <dt>{name}</dt>
          <dd className={value ? undefined : "is-empty"}>{value ?? "Not found"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Why({ reasons }: { reasons: string[] }) {
  return (
    <ul className="ft-why" aria-label="Why">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}

function Rules() {
  return (
    <div className="ft-rules">
      <p className="ft-detail-head">How this demo reads a message</p>
      <ol>
        <li>Skip one-time passwords, payment requests, reminders and promotions.</li>
        <li>Take the first ₹, Rs or INR amount that is not a balance or a limit.</li>
        <li>
          Debited, spent, paid, sent or withdrawn is money out; credited, received or refund is money in. If
          the direction is unclear, hold the message for review.
        </li>
        <li>
          Pick a flow from cues: ATM is cash, SIP an investment, one of your accounts (XX1234, XX5678, card
          XX9012) a transfer, a refund a refund, a split a settlement. Anything else is an expense or income.
        </li>
        <li>
          Count a payment once: the same UPI or IMPS reference, or the same amount within{" "}
          {DUPLICATE_WINDOW_MINUTES} minutes from a different sender, is a duplicate.
        </li>
      </ol>
    </div>
  );
}

function EntryDetail({
  entry,
  read,
  decision,
}: {
  entry: InboxEntry;
  read: boolean;
  decision: ReviewDecision | undefined;
}) {
  const { message, parsed } = entry;
  return (
    <>
      <div className="ft-detail-top">
        <p className="ft-detail-head">
          Message {pad(entry.number)} · {message.sender} · {formatReceived(message.receivedAt)}
        </p>
        {read && <p className={`ft-status is-${entry.status}`}>{statusLine(entry, decision)}</p>}
      </div>
      {read ? (
        <>
          <MarkedText text={message.body} marks={parsed.marks} />
          <Fields parsed={parsed} decision={decision} countedIn={entry.duplicateOf ?? undefined} />
          <Why reasons={[...parsed.reasons, ...entry.duplicateReasons]} />
        </>
      ) : (
        <>
          <p className="ft-sms">{message.body}</p>
          <p className="ft-hint">Not read yet. Press Process inbox.</p>
        </>
      )}
    </>
  );
}

function OwnResult({ parsed, text, match }: { parsed: ParsedSms; text: string; match: InboxEntry | null }) {
  const status =
    parsed.kind === "transaction" && parsed.flow
      ? `Would count · ${FLOW_LABELS[parsed.flow]}`
      : parsed.kind === "review"
        ? "Would wait in Needs review · direction unclear"
        : `Ignored · ${parsed.ignoredAs ?? "not a transaction"}`;
  const reasons = match
    ? [...parsed.reasons, `Same ${parsed.reference?.kind} Ref as message ${pad(match.number)} in the inbox, so it would count once`]
    : parsed.reasons;
  return (
    <>
      <div className="ft-detail-top">
        <p className="ft-detail-head">Your message</p>
        <p className={`ft-status is-${parsed.kind === "transaction" ? "counted" : parsed.kind}`}>{status}</p>
      </div>
      <MarkedText text={text} marks={parsed.marks} />
      <Fields parsed={parsed} pending="Held for review" />
      <Why reasons={reasons} />
    </>
  );
}

function Ledger({ summary, labelId, live }: { summary: LedgerSummary; labelId: string; live: boolean }) {
  const outside = Object.entries(summary.outside).filter(([, amount]) => amount > 0);
  return (
    <div className="ft-ledger" role="group" aria-labelledby={labelId}>
      <span className="demo-label" id={labelId}>
        Ledger
      </span>
      <dl className="ft-totals">
        <div>
          <dt>Income</dt>
          <dd>{formatInr(summary.income)}</dd>
        </div>
        <div>
          <dt>Spending</dt>
          <dd>{formatInr(summary.spending)}</dd>
        </div>
        <div>
          <dt>Refunds</dt>
          <dd>{formatInr(summary.refunds)}</dd>
        </div>
        <div className="is-net">
          <dt>Net spend</dt>
          <dd>{formatInr(summary.netSpend)}</dd>
        </div>
      </dl>
      {/* Announced after a review decision; quiet while the inbox is being read. */}
      <p className="ft-formula" aria-live={live ? "polite" : "off"}>
        Net spend = spending {formatInr(summary.spending)} {MINUS} refunds {formatInr(summary.refunds)} ={" "}
        {formatInr(summary.netSpend)}
      </p>
      <p className="ft-outside">
        {outside.length
          ? `Kept out of income and spending: ${outside.map(([flow, amount]) => `${flow} ${formatInr(amount)}`).join(" · ")}`
          : "Transfers, investments, cash and settlements are kept out of income and spending."}
      </p>
    </div>
  );
}

function ReviewQueue({
  entries,
  decisions,
  onDecide,
  labelId,
}: {
  entries: InboxEntry[];
  decisions: Record<string, ReviewDecision>;
  onDecide: (id: string, decision: ReviewDecision) => void;
  labelId: string;
}) {
  const pending = entries.filter((entry) => !decisions[entry.message.id]).length;
  return (
    <div className="ft-review" role="group" aria-labelledby={labelId}>
      <span className="demo-label" id={labelId}>
        Needs review · {pending}
      </span>
      {entries.length === 0 ? (
        <p className="ft-review-empty">Messages whose direction is unclear wait here instead of being guessed.</p>
      ) : (
        entries.map((entry) => {
          const { message, parsed } = entry;
          const decision = decisions[message.id];
          return (
            <div key={message.id} className="ft-review-item">
              <p className="ft-review-what">
                <strong>{parsed.amount === null ? "No amount" : formatInrExact(parsed.amount)}</strong>
                {parsed.account && ` on ${parsed.account}`}
                {parsed.counterparty && ` with ${parsed.counterparty}`}
              </p>
              <p className="ft-review-meta">
                Message {pad(entry.number)} · {formatReceived(message.receivedAt)} · neither debited nor credited
              </p>
              <div className="ft-review-actions">
                <button
                  type="button"
                  className="ft-choice"
                  aria-pressed={decision === "expense"}
                  onClick={() => onDecide(message.id, "expense")}
                >
                  Add as expense
                </button>
                <button
                  type="button"
                  className="ft-choice"
                  aria-pressed={decision === "dismissed"}
                  onClick={() => onDecide(message.id, "dismissed")}
                >
                  Not a transaction
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/** FinTrack: a synthetic SMS inbox read into a ledger, one message at a time. */
export default function FinTrackDemo() {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const still = Boolean(reduced) || paused;
  const ids = useId();
  const entries = useMemo(() => processInbox(SAMPLE_INBOX), []);
  const total = entries.length;

  const [processed, setProcessed] = useState(0);
  const [running, setRunning] = useState(false);
  const [follow, setFollow] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [mode, setMode] = useState<"inbox" | "own">("inbox");
  const [own, setOwn] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  // One message per step. When motion is reduced or paused, show the end state.
  useEffect(() => {
    if (!running) return;
    if (still) {
      setProcessed(total);
      setRunning(false);
      return;
    }
    const timer = setTimeout(
      () => {
        if (processed >= total) setRunning(false);
        else setProcessed(processed + 1);
      },
      processed === 0 ? 150 : STEP_MS,
    );
    return () => clearTimeout(timer);
  }, [running, processed, still, total]);

  // Keep the message being read in view inside the list, without moving the page.
  useEffect(() => {
    const list = listRef.current;
    if (!follow || !list || processed === 0) return;
    const row = list.querySelector<HTMLElement>(`[data-row="${processed}"]`);
    if (!row) return;
    const bottom = row.offsetTop + row.offsetHeight;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [processed, follow]);

  const readEntries = entries.slice(0, processed);
  const summary = summarise(readEntries, decisions);
  const reviewEntries = readEntries.filter((entry) => entry.status === "review");
  const activeId = follow && processed > 0 ? entries[processed - 1].message.id : selectedId;
  const active = entries.find((entry) => entry.message.id === activeId) ?? null;
  const animate = !still && running;

  const ownParsed = useMemo(() => (own.trim() ? parseSms(own) : null), [own]);
  const ownMatch = ownParsed ? findReferenceMatch(ownParsed, entries) : null;
  const ownSummary = !ownParsed
    ? ""
    : ownParsed.kind === "transaction" && ownParsed.flow
      ? `Would count as ${FLOW_LABELS[ownParsed.flow].toLowerCase()}, ${formatInrExact(ownParsed.amount ?? 0)} ${ownParsed.direction === "out" ? "out" : "in"}${ownParsed.counterparty ? `, ${ownParsed.counterparty}` : ""}.`
      : ownParsed.kind === "review"
        ? "Would wait for review: the direction is unclear."
        : `Ignored: ${(ownParsed.ignoredAs ?? "not a transaction").toLowerCase()}.`;

  const status = running
    ? "Reading the inbox…"
    : processed === 0
      ? `${total} messages, not read yet`
      : `${summary.counted} counted · ${plural(summary.duplicates, "duplicate")} · ${summary.ignored} ignored · ${summary.pending} to review`;

  const process = () => {
    if (running) {
      setProcessed(total);
      setRunning(false);
      return;
    }
    setDecisions({});
    setMode("inbox");
    setSelectedId(null);
    setFollow(true);
    setProcessed(0);
    setRunning(true);
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  const select = (id: string) => {
    setFollow(false);
    setSelectedId(id);
  };

  // Pressing the chosen option again takes the choice back.
  const decide = (id: string, decision: ReviewDecision) =>
    setDecisions((current) => {
      const next = { ...current };
      if (next[id] === decision) delete next[id];
      else next[id] = decision;
      return next;
    });

  const reset = () => {
    setRunning(false);
    setProcessed(0);
    setFollow(false);
    setSelectedId(null);
    setDecisions({});
    setMode("inbox");
    setOwn("");
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  const detailId = `${ids}-detail`;

  return (
    <DemoFrame
      project="FinTrack"
      title="Turn a messy SMS inbox into a clean ledger"
      intro="Eleven synthetic bank and UPI alerts. Process them to see how each is read, and why."
      note="Simplified rules written for this demo, over a synthetic inbox: the banks, merchants and people are made up. FinTrack's own parser handles many more bank formats, and runs on your phone."
      onReset={reset}
      className={`ft-demo${still ? " is-still" : ""}`}
    >
      <div className="ft-toolbar">
        <div className="ft-actions">
          <button type="button" className={`demo-btn${processed === total && !running ? " is-ghost" : ""}`} onClick={process}>
            {running ? "Show all now" : processed === total ? "Replay" : "Process inbox"}
          </button>
          <div className="demo-chips" role="group" aria-label="View">
            <button type="button" className="demo-chip" aria-pressed={mode === "inbox"} onClick={() => setMode("inbox")}>
              Inbox
            </button>
            <button type="button" className="demo-chip" aria-pressed={mode === "own"} onClick={() => setMode("own")}>
              Try your own message
            </button>
          </div>
        </div>
        <p className="ft-status-line" aria-live="polite">
          {status}
        </p>
      </div>

      {mode === "inbox" ? (
        <div className="ft-panes">
          <div className="ft-pane">
            <span className="demo-label" id={`${ids}-inbox`}>
              Inbox · synthetic
            </span>
            <ol className="ft-list" ref={listRef} aria-labelledby={`${ids}-inbox`}>
              {entries.map((entry) => {
                const { message, parsed } = entry;
                const read = entry.number <= processed;
                const decision = decisions[message.id];
                const muted = entry.status === "duplicate" || entry.status === "ignored" || decision === "dismissed";
                const fresh = animate && entry.number === processed;
                return (
                  <li key={message.id} data-row={entry.number}>
                    <button
                      type="button"
                      className={`ft-row${fresh ? " is-fresh" : ""}`}
                      aria-pressed={message.id === activeId}
                      aria-controls={detailId}
                      onClick={() => select(message.id)}
                    >
                      <span className="ft-row-num" aria-hidden="true">
                        {pad(entry.number)}
                      </span>
                      <span className="ft-sr">Message {entry.number}: </span>
                      {read ? (
                        <>
                          <span className="ft-row-main">
                            <span className="ft-row-label">{entryLabel(entry)}</span>
                            <span className="ft-row-sub">
                              {entry.status === "duplicate"
                                ? `Same as ${pad(entry.duplicateOf ?? 0)} · ${message.sender}`
                                : `${formatReceived(message.receivedAt)} · ${message.sender}`}
                            </span>
                          </span>
                          <span className="ft-row-side">
                            <span className={`ft-row-amount${muted ? " is-void" : ""}`}>
                              {signedAmount(parsed)}
                              {muted && parsed.amount !== null && <span className="ft-sr"> not counted</span>}
                            </span>
                            <span className={`ft-tag is-${tagStyle(entry, decision)}`}>{entryTag(entry, decision)}</span>
                          </span>
                        </>
                      ) : (
                        <span className="ft-row-main">
                          <span className="ft-row-sub">
                            {message.sender} · {formatReceived(message.receivedAt)}
                          </span>
                          <span className="ft-row-raw">{message.body}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="ft-pane">
            <span className="demo-label">Read as</span>
            <div
              key={animate ? activeId ?? "rules" : "still"}
              className={`ft-detail${animate && active ? " is-fresh" : ""}`}
              id={detailId}
              role="region"
              aria-label="Parsed message"
              tabIndex={0}
            >
              {active ? (
                <EntryDetail entry={active} read={active.number <= processed} decision={decisions[active.message.id]} />
              ) : (
                <Rules />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="ft-panes">
          <div className="ft-pane ft-own">
            <label className="demo-label" htmlFor={`${ids}-own`}>
              Paste or type a bank SMS
            </label>
            <textarea
              id={`${ids}-own`}
              className="demo-input"
              rows={6}
              maxLength={600}
              spellCheck={false}
              value={own}
              placeholder="Rs 250.00 debited from A/c XX1234 to VPA shop@okbank (CORNER SHOP). UPI Ref 629400112233."
              onChange={(event) => setOwn(event.target.value)}
            />
            <p className="ft-privacy">Read on this page as you type. Nothing is sent anywhere or saved.</p>
            <span className="demo-label">Or start from an example</span>
            <div className="demo-chips">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  className="demo-chip"
                  aria-pressed={own === example.text}
                  onClick={() => setOwn(example.text)}
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ft-pane">
            <span className="demo-label">Read as</span>
            <div className="ft-detail" role="region" aria-label="Your message, parsed" tabIndex={0}>
              {ownParsed ? (
                <OwnResult parsed={ownParsed} text={own} match={ownMatch} />
              ) : (
                <p className="ft-hint">
                  The amount, direction, counterparty, reference, account and flow these rules find will appear here.
                </p>
              )}
            </div>
            <p className="ft-sr" aria-live="polite">
              {ownSummary}
            </p>
          </div>
        </div>
      )}

      <div className="ft-bottom">
        <Ledger summary={summary} labelId={`${ids}-ledger`} live={!running} />
        <ReviewQueue entries={reviewEntries} decisions={decisions} onDecide={decide} labelId={`${ids}-review`} />
      </div>
    </DemoFrame>
  );
}
