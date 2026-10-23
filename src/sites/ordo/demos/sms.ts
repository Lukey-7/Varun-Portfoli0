/**
 * A simplified, bank-agnostic SMS parser written for the FinTrack demo.
 *
 * It reads a message for amount, direction, counterparty, reference and
 * account, gives it a flow, and records why. A whole inbox is then checked
 * for duplicates. FinTrack's own parser (Kotlin, on the phone) handles many
 * more bank formats; this one runs in the browser and calls no server.
 */

export type Flow = "expense" | "income" | "refund" | "transfer" | "investment" | "cash" | "settlement";
export type Direction = "out" | "in";
/** What a highlighted stretch of the message was read as. */
export type MarkField = "amount" | "direction" | "counterparty" | "reference" | "account" | "flow" | "skip";

export interface Mark {
  start: number;
  end: number;
  field: MarkField;
}

export interface Reference {
  /** Only UPI and IMPS references are used to find duplicates. */
  kind: "UPI" | "IMPS" | "Ref";
  value: string;
}

export interface ParsedSms {
  /** Ignored: not a transaction. Review: a transaction whose direction is unclear. */
  kind: "transaction" | "review" | "ignored";
  amount: number | null;
  direction: Direction | null;
  counterparty: string | null;
  reference: Reference | null;
  /** The visitor's account, e.g. "XX1234". */
  account: string | null;
  flow: Flow | null;
  /** Short label for an ignored message, e.g. "One-time password". */
  ignoredAs: string | null;
  reasons: string[];
  marks: Mark[];
}

export interface SmsMessage {
  id: string;
  sender: string;
  /** Local time, "YYYY-MM-DDTHH:MM". */
  receivedAt: string;
  body: string;
}

export type EntryStatus = "counted" | "duplicate" | "ignored" | "review";

export interface InboxEntry {
  message: SmsMessage;
  /** 1-based position in the inbox, oldest first. */
  number: number;
  parsed: ParsedSms;
  status: EntryStatus;
  duplicateOf: number | null;
  duplicateReasons: string[];
}

export type ReviewDecision = "expense" | "dismissed";

export interface LedgerSummary {
  income: number;
  spending: number;
  refunds: number;
  /** spending - refunds */
  netSpend: number;
  /** Money that moved but is neither income nor spending. */
  outside: Record<"transfer" | "investment" | "cash" | "settlement", number>;
  counted: number;
  duplicates: number;
  ignored: number;
  pending: number;
}

/** The visitor's own accounts and card in this demo, by last four digits. */
export const OWN_ACCOUNTS: readonly string[] = ["1234", "5678", "9012"];
export const DUPLICATE_WINDOW_MINUTES = 10;

export const FLOW_LABELS: Record<Flow, string> = {
  expense: "Expense",
  income: "Income",
  refund: "Refund",
  transfer: "Transfer",
  investment: "Investment",
  cash: "Cash",
  settlement: "Settlement",
};

/**
 * A synthetic inbox. Kestrel Bank, Larkspur Bank, Tidepay and every merchant
 * and person here are made up; the formats imitate common Indian bank alerts.
 */
export const SAMPLE_INBOX: readonly SmsMessage[] = [
  {
    id: "salary",
    sender: "AX-KESTRL",
    receivedAt: "2026-10-01T09:02",
    body: "Kestrel Bank: INR 82,500.00 credited to A/c XX1234 on 01-Oct-26 by NEFT from FERNWAY SYSTEMS PVT LTD (SALARY). Avl Bal INR 96,410.25.",
  },
  {
    id: "sip",
    sender: "AX-KESTRL",
    receivedAt: "2026-10-03T07:30",
    body: "Kestrel Bank: Rs.5,000.00 debited from A/c XX1234 on 03-Oct-26 to ALDER FLEXICAP FUND for SIP. NACH Ref ALDR0521984. Avl Bal Rs.91,410.25.",
  },
  {
    id: "cafe",
    sender: "AX-KESTRL",
    receivedAt: "2026-10-06T13:41",
    body: "Kestrel Bank: Rs 349.00 debited from A/c XX1234 on 06-Oct-26 to VPA cafelumen@okkestrel (CAFE LUMEN). UPI Ref No 627913550421.",
  },
  {
    id: "cafe-app",
    sender: "JM-TIDEPY",
    receivedAt: "2026-10-06T13:42",
    body: "Tidepay: You paid ₹349.00 to CAFE LUMEN from Kestrel Bank a/c XX1234. UPI Ref 627913550421.",
  },
  {
    id: "groceries",
    sender: "VM-LRKSPR",
    receivedAt: "2026-10-08T19:20",
    body: "Larkspur Bank: INR 2,340.00 spent on Credit Card XX9012 at MARIGOLD GROCERS on 08-Oct-26 19:20. Avl limit INR 57,660.00.",
  },
  {
    id: "refund",
    sender: "AX-KESTRL",
    receivedAt: "2026-10-10T11:05",
    body: "Kestrel Bank: Refund of Rs.499.00 from TINKERBOX ONLINE credited to A/c XX1234 on 10-Oct-26. Ref 912045778310.",
  },
  {
    id: "transfer",
    sender: "AX-KESTRL",
    receivedAt: "2026-10-12T08:15",
    body: "Kestrel Bank: INR 10,000.00 debited from A/c XX1234 on 12-Oct-26 by IMPS to A/c XX5678 (self). IMPS Ref No 628508811234.",
  },
  {
    id: "atm",
    sender: "VM-LRKSPR",
    receivedAt: "2026-10-14T18:47",
    body: "Larkspur Bank: Rs.3,000.00 withdrawn from A/c XX5678 at MG ROAD ATM on 14-Oct-26 18:47. Avl Bal Rs.18,250.00.",
  },
  {
    id: "split",
    sender: "VM-LRKSPR",
    receivedAt: "2026-10-15T21:10",
    body: "Larkspur Bank: A/c XX5678 credited with Rs.850.00 on 15-Oct-26 from RIYA SEN (riya.sen@oklark). UPI Ref 628821334567. Remark: dinner split.",
  },
  {
    id: "otp",
    sender: "VM-LRKSPR",
    receivedAt: "2026-10-16T10:02",
    body: "483920 is your OTP for a payment of Rs 4,999.00 at TINKERBOX ONLINE on Larkspur Bank card XX9012. Valid for 5 minutes. Do not share it with anyone.",
  },
  {
    id: "unclear",
    sender: "AX-KESTRL",
    receivedAt: "2026-10-18T16:25",
    body: "Kestrel Bank: UPI transaction of Rs.1,150.00 on A/c XX1234 with M S TRADERS on 18-Oct-26. UPI Ref 629114002233.",
  },
];

// ---------- Patterns ----------

const IGNORE_RULES: { pattern: RegExp; label: string; why: string }[] = [
  {
    pattern: /\b(?:OTP|one[- ]time password|verification code)\b/i,
    label: "One-time password",
    why: "a one-time password, not a payment",
  },
  {
    pattern: /\b(?:has requested|requested|collect request|payment request)\b/i,
    label: "Payment request",
    why: "a request to pay, not a payment",
  },
  {
    pattern: /\b(?:will be (?:debited|deducted|charged)|is due|due on|due by)\b/i,
    label: "Reminder",
    why: "a reminder, so no money has moved yet",
  },
  {
    pattern: /\b(?:failed|declined|unsuccessful)\b/i,
    label: "Failed payment",
    why: "a failed payment moves no money",
  },
];
const PROMO = /\b(?:offer|cashback|voucher|use code|apply now|pre-approved|congratulations)\b/i;

const AMOUNT = /(?:₹|\bRs\.?|\bINR)\s?(\d+(?:,\d{2,3})*(?:\.\d{1,2})?)/gi;
/** Some banks drop the currency: "debited by 250.0". */
const BARE_AMOUNT = /\b(?:debited|credited)\s+(?:by|with|for)\s+(\d+(?:,\d{2,3})*(?:\.\d{1,2})?)\b/i;
/** Text just before an amount that makes it a balance or limit, not the payment. */
const BALANCE_BEFORE = /(?:\bbal(?:ance)?|\blimit|\bavl|\bavailable)\.?\s*(?:is\s*)?[:-]?\s*$/i;

const OUT_WORDS = /\b(?:debited|spent|withdrawn|paid|sent|deducted|purchase)\b/gi;
const IN_WORDS = /\b(?:credited|received|deposited|refunded|refund)\b/gi;
/** A direction word attached to an account, as in "Acct XX123 debited" or "debited from A/c". */
const TIED_TO_ACCOUNT =
  /\b(?:a\/c|acct|account|card)\s*(?:no\.?\s*)?[x*]+\d{3,6}\s+(?:is\s+|has been\s+|was\s+)?(debited|credited)\b|\b(debited|credited)\s+(?:from|to)\s+(?:your\s+)?(?:a\/c|acct|account)\b/i;

const ACCOUNT = /\b(?:a\/c|acct|account|card)(?:\s*no\.?)?\s*(?:ending\s*(?:with|in)?\s*)?[:-]?\s*([x*]+\s?\d{3,6})\b/gi;

/** UPI and IMPS reference numbers (RRNs) are twelve digits. */
const UPI_REF = /\b(UPI|IMPS)\b[^0-9\n]{0,14}?(\d{12})\b/i;
const OTHER_REF = /\b(?:ref(?:erence|no)?|txn\s*id|utr)\b\.?\s*(?:no\.?|number)?\s*[:#-]?\s*((?=[a-z]*\d)[a-z0-9]{6,22})\b/i;

const NAME = "([A-Za-z][A-Za-z0-9&'. -]{1,40}?)";
const NAME_END =
  "(?=\\s+(?:on|via|using|from|to|for|with|by|at|ref\\w*|upi|imps|neft|credited|debited|is|has|was|a\\/c|acct|avl|towards)\\b|\\s*[,;:()]|\\.(?:\\s|$)|\\s*$)";
const NOT_A_NAME = "(?!(?:a\\/c|acct|account|your|you|vpa|own|neft|imps|upi|rtgs|card|credit card|debit card|self)\\b)";
const VPA_THEN_NAME = /\bVPA\s+[\w.-]+@[a-z]+\s*\(([^)]{2,40})(?=\))/i;
const NAME_THEN_VPA = /\b(?:from|to)\s+([A-Za-z][A-Za-z0-9&'. -]{1,40}?)(?=\s*\([\w.-]+@[a-z]+\))/i;
const PAYEE_CREDITED = /;\s*([A-Z][A-Z0-9&'. -]{1,40}?)(?=\s+credited\b)/;
const VPA_ONLY = /\bVPA\s+([\w.-]+@[a-z]+)/i;
const NAME_AFTER = {
  out: new RegExp(`\\b(?:to|at)\\s+${NOT_A_NAME}${NAME}${NAME_END}`, "i"),
  in: new RegExp(`\\b(?:from|by)\\s+${NOT_A_NAME}${NAME}${NAME_END}`, "i"),
  unknown: new RegExp(`\\b(?:with|to|at|from)\\s+${NOT_A_NAME}${NAME}${NAME_END}`, "i"),
};

const CUES = {
  cash: /\b(?:ATM|cash withdrawal|cash deposit)\b/i,
  investment: /\b(?:SIP|mutual fund|systematic investment|redemption)\b/i,
  refund: /\b(?:refund(?:ed)?|reversal|reversed)\b/i,
  settlement: /\b(?:split|your share|settle(?:d|ment)?|paid back)\b/i,
  self: /\b(?:self|own a\/c|own account)\b/i,
  salary: /\b(?:salary|payroll|stipend)\b/i,
};

// ---------- Small helpers ----------

interface Hit {
  text: string;
  start: number;
  end: number;
}

const hitOf = (match: RegExpExecArray | RegExpMatchArray): Hit => {
  const start = match.index ?? 0;
  return { text: match[0], start, end: start + match[0].length };
};

/** The span of a capture group that ends exactly where its match ends. */
const tailHit = (match: RegExpExecArray | RegExpMatchArray, group: string): Hit => {
  const end = (match.index ?? 0) + match[0].length;
  return { text: group, start: end - group.length, end };
};

const quote = (text: string) => `'${text}'`;

const exact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "₹82,500" for whole rupees, "₹1,150.50" otherwise, in Indian digit grouping. */
export const formatInr = (amount: number) => (Number.isInteger(amount) ? whole : exact).format(amount);

/** Always with paise, as read from the message: "₹349.00". */
export const formatInrExact = (amount: number) => exact.format(amount);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "6 Oct, 13:41" */
export function formatReceived(receivedAt: string): string {
  const [, , month, day, time] = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(receivedAt) ?? [];
  return month ? `${Number(day)} ${MONTHS[Number(month) - 1]}, ${time}` : receivedAt;
}

function minutesOf(receivedAt: string): number {
  const [, y, mo, d, h, mi] = (/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(receivedAt) ?? []).map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) / 60_000;
}

// ---------- Field readers ----------

function findAmount(body: string): (Hit & { value: number }) | null {
  for (const match of body.matchAll(AMOUNT)) {
    const start = match.index ?? 0;
    if (BALANCE_BEFORE.test(body.slice(Math.max(0, start - 16), start))) continue;
    return { ...hitOf(match), value: Number(match[1].replace(/,/g, "")) };
  }
  const bare = BARE_AMOUNT.exec(body);
  return bare ? { ...tailHit(bare, bare[1]), value: Number(bare[1].replace(/,/g, "")) } : null;
}

type DirectionRead =
  | { direction: Direction; hit: Hit; reason: string }
  | { direction: null; hit: null; reason: string };

function findDirection(body: string): DirectionRead {
  const outs = [...body.matchAll(OUT_WORDS)];
  // "Refund" names the flow; prefer a verb like "credited" as the direction word.
  const ins = [...body.matchAll(IN_WORDS)].sort((a, b) => Number(/^refund$/i.test(a[0])) - Number(/^refund$/i.test(b[0])));
  if (outs.length && !ins.length) {
    return { direction: "out", hit: hitOf(outs[0]), reason: `Matched ${quote(outs[0][0])} → money out` };
  }
  if (ins.length && !outs.length) {
    return { direction: "in", hit: hitOf(ins[0]), reason: `Matched ${quote(ins[0][0])} → money in` };
  }
  if (!outs.length) {
    return {
      direction: null,
      hit: null,
      reason: "No word like 'debited', 'credited', 'spent' or 'received', so the direction is unclear",
    };
  }
  const tied = TIED_TO_ACCOUNT.exec(body);
  if (tied) {
    const word = tied[1] ?? tied[2];
    const start = tied[1] ? (tied.index ?? 0) + tied[0].length - word.length : tied.index ?? 0;
    const direction: Direction = /debited/i.test(word) ? "out" : "in";
    return {
      direction,
      hit: { text: word, start, end: start + word.length },
      reason: `Found ${quote(outs[0][0])} and ${quote(ins[0][0])}; ${quote(word)} is tied to your account → money ${direction}`,
    };
  }
  return {
    direction: null,
    hit: null,
    reason: `Found both ${quote(outs[0][0])} and ${quote(ins[0][0])}, and neither is tied to your account`,
  };
}

interface AccountHit extends Hit {
  digits: string;
  before: string;
}

function findAccounts(body: string): AccountHit[] {
  return [...body.matchAll(ACCOUNT)].map((match) => {
    const start = match.index ?? 0;
    return {
      ...tailHit(match, match[1]),
      digits: match[1].replace(/\D/g, ""),
      before: body.slice(Math.max(0, start - 12), start),
    };
  });
}

function findReference(body: string): (Hit & { reference: Reference }) | null {
  const upi = UPI_REF.exec(body);
  if (upi) {
    return { ...tailHit(upi, upi[2]), reference: { kind: upi[1].toUpperCase() as "UPI" | "IMPS", value: upi[2] } };
  }
  const other = OTHER_REF.exec(body);
  return other ? { ...tailHit(other, other[1]), reference: { kind: "Ref", value: other[1].toUpperCase() } } : null;
}

function findName(body: string, direction: Direction | null): Hit | null {
  const patterns = [
    VPA_THEN_NAME,
    NAME_THEN_VPA,
    ...(direction === "out" ? [PAYEE_CREDITED] : []),
    NAME_AFTER[direction ?? "unknown"],
    VPA_ONLY,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(body);
    if (!match) continue;
    const hit = tailHit(match, match[1]);
    const name = hit.text.replace(/[\s.-]+$/, "");
    return { text: name, start: hit.start, end: hit.start + name.length };
  }
  return null;
}

// ---------- Parsing one message ----------

/** Read one SMS. Pure: the same text always gives the same result. */
export function parseSms(body: string, ownAccounts: readonly string[] = OWN_ACCOUNTS): ParsedSms {
  const marks: Mark[] = [];
  const mark = (hit: Hit | null, field: MarkField) => {
    if (!hit || hit.end <= hit.start) return;
    // Keep the first reading of any stretch of text.
    if (marks.some((m) => hit.start < m.end && m.start < hit.end)) return;
    marks.push({ start: hit.start, end: hit.end, field });
  };
  const result = (fields: Omit<ParsedSms, "marks">): ParsedSms => ({
    ...fields,
    marks: [...marks].sort((a, b) => a.start - b.start),
  });

  const amount = findAmount(body);
  const reference = findReference(body);
  const accounts = findAccounts(body);

  const skip = IGNORE_RULES.map((rule) => ({ rule, match: rule.pattern.exec(body) })).find(({ match }) => match);
  const promo = !skip && !body.match(OUT_WORDS) && !body.match(IN_WORDS) ? PROMO.exec(body) : null;
  if (skip || promo || !amount) {
    const cue = skip?.match ?? promo;
    mark(amount, "amount");
    mark(accounts[0] ?? null, "account");
    mark(reference, "reference");
    if (cue) mark(hitOf(cue), "skip");
    const counterparty = findName(body, null);
    mark(counterparty, "counterparty");
    const ignoredAs = skip?.rule.label ?? (promo ? "Promotion" : "No amount");
    const reason = skip
      ? `Matched ${quote(skip.match[0])}: ${skip.rule.why}`
      : promo
        ? `Matched ${quote(promo[0])} with no 'debited' or 'credited': a promotion`
        : "No amount found: looked for ₹, Rs or INR before a number that is not a balance or limit";
    return result({
      kind: "ignored",
      amount: amount?.value ?? null,
      direction: null,
      counterparty: counterparty?.text ?? null,
      reference: reference?.reference ?? null,
      account: accounts[0] ? `XX${accounts[0].digits}` : null,
      flow: null,
      ignoredAs,
      reasons: [reason],
    });
  }

  const read = findDirection(body);
  const { direction } = read;
  // "to A/c" on money out, or "from A/c" on money in, is the other side.
  const otherSide =
    direction === null
      ? undefined
      : accounts.find((a) => new RegExp(`\\b${direction === "out" ? "to" : "from"}\\s+(?:own\\s+|your\\s+|the\\s+)?$`, "i").test(a.before));
  const mine = accounts.find((a) => a !== otherSide) ?? null;

  mark(amount, "amount");
  mark(read.hit, "direction");
  mark(mine, "account");
  mark(reference, "reference");
  const name = findName(body, direction);
  mark(name ?? otherSide ?? null, "counterparty");
  const counterparty = name?.text ?? (otherSide ? `A/c XX${otherSide.digits}` : null);

  const base = {
    amount: amount.value,
    direction,
    counterparty,
    reference: reference?.reference ?? null,
    account: mine ? `XX${mine.digits}` : null,
    ignoredAs: null,
  };

  if (!direction) {
    return result({ ...base, kind: "review", flow: null, reasons: [read.reason, "Held for review instead of guessed"] });
  }

  const cue = (key: keyof typeof CUES) => {
    const match = CUES[key].exec(body);
    if (match) mark(hitOf(match), "flow");
    return match ? match[0] : null;
  };
  const ownOther = otherSide && ownAccounts.includes(otherSide.digits) ? `XX${otherSide.digits}` : null;
  const decide = (): [Flow, string] => {
    let hit: string | null;
    if (direction === "out") {
      if ((hit = cue("cash"))) return ["cash", `Matched ${quote(hit)} → cash`];
      if ((hit = cue("investment"))) return ["investment", `Matched ${quote(hit)} → investment`];
      if (ownOther) return ["transfer", `${ownOther} is one of your accounts → transfer`];
      if ((hit = cue("self"))) return ["transfer", `Matched ${quote(hit)} → transfer`];
      return ["expense", "No ATM, investment or own-account cue → expense"];
    }
    if ((hit = cue("refund"))) return ["refund", `Matched ${quote(hit)} → refund`];
    if (ownOther) return ["transfer", `${ownOther} is one of your accounts → transfer`];
    if ((hit = cue("self"))) return ["transfer", `Matched ${quote(hit)} → transfer`];
    if ((hit = cue("investment"))) return ["investment", `Matched ${quote(hit)} → investment`];
    if ((hit = cue("cash"))) return ["cash", `Matched ${quote(hit)} → cash`];
    if ((hit = cue("settlement"))) return ["settlement", `Matched ${quote(hit)} → settlement, a share paid back`];
    if ((hit = cue("salary"))) return ["income", `Matched ${quote(hit)} → income`];
    return ["income", "No refund, transfer or split cue → income"];
  };
  const [flow, why] = decide();
  return result({ ...base, kind: "transaction", flow, reasons: [read.reason, why] });
}

// ---------- A whole inbox ----------

const pad = (n: number) => String(n).padStart(2, "0");

/** Why `candidate` repeats `earlier`, or an empty list if it does not. */
export function duplicateReasons(
  candidate: { message: SmsMessage; parsed: ParsedSms },
  earlier: InboxEntry,
): string[] {
  const a = candidate.parsed;
  const b = earlier.parsed;
  const reasons: string[] = [];
  if (a.reference && b.reference && a.reference.kind !== "Ref" && b.reference.kind !== "Ref" && a.reference.value === b.reference.value) {
    reasons.push(`Same ${a.reference.kind} Ref ${a.reference.value} as message ${pad(earlier.number)}`);
  }
  const gap = Math.abs(minutesOf(candidate.message.receivedAt) - minutesOf(earlier.message.receivedAt));
  if (
    a.amount !== null &&
    a.amount === b.amount &&
    a.direction !== null &&
    a.direction === b.direction &&
    candidate.message.sender !== earlier.message.sender &&
    gap <= DUPLICATE_WINDOW_MINUTES
  ) {
    const when = gap === 0 ? "in the same minute as" : `${gap} min after`;
    reasons.push(`Same ${formatInr(a.amount)} from a different sender, ${when} message ${pad(earlier.number)}`);
  }
  return reasons;
}

/** Parse every message, oldest first, and mark repeats of counted ones. */
export function processInbox(
  messages: readonly SmsMessage[],
  ownAccounts: readonly string[] = OWN_ACCOUNTS,
): InboxEntry[] {
  const ordered = [...messages].sort((a, b) => minutesOf(a.receivedAt) - minutesOf(b.receivedAt));
  const entries: InboxEntry[] = [];
  ordered.forEach((message, index) => {
    const parsed = parseSms(message.body, ownAccounts);
    const entry: InboxEntry = { message, number: index + 1, parsed, status: "counted", duplicateOf: null, duplicateReasons: [] };
    if (parsed.kind === "ignored") entry.status = "ignored";
    else if (parsed.kind === "review") entry.status = "review";
    else {
      for (const earlier of entries) {
        if (earlier.status !== "counted") continue;
        const reasons = duplicateReasons({ message, parsed }, earlier);
        if (!reasons.length) continue;
        entry.status = "duplicate";
        entry.duplicateOf = earlier.number;
        entry.duplicateReasons = reasons;
        break;
      }
    }
    entries.push(entry);
  });
  return entries;
}

/** A counted inbox entry with the same UPI or IMPS reference, if any. */
export function findReferenceMatch(parsed: ParsedSms, entries: readonly InboxEntry[]): InboxEntry | null {
  const reference = parsed.reference;
  if (!reference || reference.kind === "Ref") return null;
  return (
    entries.find(
      (entry) =>
        entry.status === "counted" &&
        entry.parsed.reference?.kind !== "Ref" &&
        entry.parsed.reference?.value === reference.value,
    ) ?? null
  );
}

const cents = (amount: number) => Math.round(amount * 100) / 100;

/**
 * Totals for the ledger. Net spend = spending - refunds. Transfers,
 * investments, cash and settlements are kept out of income and spending.
 */
export function summarise(
  entries: readonly InboxEntry[],
  decisions: Readonly<Record<string, ReviewDecision>> = {},
): LedgerSummary {
  const totals: Record<Flow, number> = {
    expense: 0,
    income: 0,
    refund: 0,
    transfer: 0,
    investment: 0,
    cash: 0,
    settlement: 0,
  };
  const summary = { counted: 0, duplicates: 0, ignored: 0, pending: 0 };
  for (const entry of entries) {
    const { amount, flow } = entry.parsed;
    if (entry.status === "counted" && flow && amount !== null) {
      totals[flow] += amount;
      summary.counted += 1;
    } else if (entry.status === "duplicate") {
      summary.duplicates += 1;
    } else if (entry.status === "ignored") {
      summary.ignored += 1;
    } else if (entry.status === "review") {
      const decision = decisions[entry.message.id];
      if (decision === "expense" && amount !== null) {
        totals.expense += amount;
        summary.counted += 1;
      } else if (decision === "dismissed") {
        summary.ignored += 1;
      } else {
        summary.pending += 1;
      }
    }
  }
  return {
    income: cents(totals.income),
    spending: cents(totals.expense),
    refunds: cents(totals.refund),
    netSpend: cents(totals.expense - totals.refund),
    outside: {
      transfer: cents(totals.transfer),
      investment: cents(totals.investment),
      cash: cents(totals.cash),
      settlement: cents(totals.settlement),
    },
    ...summary,
  };
}
