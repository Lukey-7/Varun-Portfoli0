/**
 * A small, deterministic copy of ReconPilot's engine for the in-browser demo.
 *
 * It follows the real Python engine module by module, on a smaller fund:
 *
 *   generator.py  one synthetic fund-day, with known breaks planted on purpose
 *   matching.py   positions on quantity and price (per-asset-class tolerance),
 *                 cash in passes: exact, tolerance, attribute, many-to-one
 *   triage.py     breaks grouped by security into cases, first fitting rule wins
 *   nav.py        NAV = positions + book cash - accrued liabilities, and checks
 *   impact.py     each case's NAV impact in base currency and basis points
 *   review.py     approve / reject / reclassify, sign-off and the four-eyes rule
 *   audit.py      an append-only log where every entry holds the previous hash
 *
 * Everything here is synthetic and runs in the page; nothing is fetched.
 */

// ---------------------------------------------------------------- vocabulary

export const BASE_CURRENCY = "USD";
export type Ccy = "USD" | "EUR" | "GBP" | "JPY";
export type AssetClass = "EQUITY" | "BOND";

export type Category =
  | "MISSING_TRADE"
  | "PRICE_MISMATCH"
  | "STOCK_SPLIT"
  | "DIVIDEND"
  | "FX_DIFFERENCE"
  | "TIMING"
  | "UNKNOWN";

export const PLANTABLE: Category[] = [
  "MISSING_TRADE",
  "PRICE_MISMATCH",
  "STOCK_SPLIT",
  "DIVIDEND",
  "FX_DIFFERENCE",
  "TIMING",
];
export const CATEGORIES: Category[] = [...PLANTABLE, "UNKNOWN"];

/** The real web app's words for each cause. */
export const CATEGORY_LABEL: Record<Category, string> = {
  MISSING_TRADE: "Missing trade",
  TIMING: "Late settlement",
  PRICE_MISMATCH: "Price mismatch",
  STOCK_SPLIT: "Stock split",
  DIVIDEND: "Dividend",
  FX_DIFFERENCE: "FX difference",
  UNKNOWN: "Unexplained",
};

export type BreakKind =
  | "QUANTITY"
  | "PRICE"
  | "CASH_AMOUNT"
  | "CASH_MISSING_AT_CUSTODIAN"
  | "CASH_MISSING_IN_BOOK";

export const BREAK_LABEL: Record<BreakKind, string> = {
  QUANTITY: "Quantity",
  PRICE: "Price",
  CASH_AMOUNT: "Cash amount",
  CASH_MISSING_AT_CUSTODIAN: "Cash not at custodian",
  CASH_MISSING_IN_BOOK: "Cash not in book",
};

const CASH_KINDS = new Set<BreakKind>(["CASH_AMOUNT", "CASH_MISSING_AT_CUSTODIAN", "CASH_MISSING_IN_BOOK"]);

export interface Security {
  id: string;
  name: string;
  currency: Ccy;
  assetClass: AssetClass;
}

export interface Trade {
  id: string;
  tradeDate: string;
  settleDate: string;
  securityId: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  currency: Ccy;
  /** Units of base currency per unit of trade currency. */
  fxRate: number;
  /** Base currency. */
  fees: number;
}

export interface Position {
  securityId: string;
  quantity: number;
  price: number;
  priceDate: string;
  currency: Ccy;
}

export interface Holding {
  securityId: string;
  quantity: number;
  price: number;
  currency: Ccy;
}

/** One line of the custodian cash statement, in base currency. */
export interface CashLine {
  entryId: string;
  valueDate: string;
  securityId: string;
  reference: string;
  description: string;
  amount: number;
}

export interface Accrual {
  kind: "MANAGEMENT_FEE" | "EXPENSES";
  amount: number;
}

/** Answer-key entry: what was planted where. Used only to score the run. */
export interface PlantedBreak {
  category: Category;
  securityId: string;
  detail: string;
}

export interface DayData {
  seed: number;
  asOf: string;
  securities: Record<string, Security>;
  fx: Record<Ccy, number>;
  bookTrades: Trade[];
  positions: Record<string, Position>;
  holdings: Record<string, Holding>;
  custodianCash: CashLine[];
  bookOpeningCash: number;
  custodianOpeningCash: number;
  priorNavPerShare: number;
  sharesOutstanding: number;
  /** Accrued liabilities brought forward from the prior day. */
  accruedExpenses: number;
  /** Booked today. */
  accruals: Accrual[];
  managementFeeRate: number;
  dailyExpenseBudget: number;
  planted: PlantedBreak[];
}

// ---------------------------------------------------------------- numbers

const roundTo = (x: number, places: number) => {
  const f = 10 ** places;
  return Math.round(x * f) / f;
};
export const round2 = (x: number) => roundTo(x, 2);

export const signedQuantity = (t: Trade) => (t.side === "BUY" ? t.quantity : -t.quantity);
export const notionalBase = (t: Trade) => round2(t.quantity * t.price * t.fxRate);
/** Settlement cash in base currency: negative for buys, positive for sells. */
export const tradeCash = (t: Trade) => round2((t.side === "BUY" ? -notionalBase(t) : notionalBase(t)) - t.fees);

/** Prose figures use a true minus sign, like the rest of the demo. */
const minus = (text: string) => text.replace(/^-/, "−");
const money = (x: number) =>
  minus(x.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const qty = (x: number) => minus(x.toLocaleString("en-GB", { maximumFractionDigits: 0 }));
const px = (x: number) => x.toLocaleString("en-GB", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const pct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(2)}%`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function addDays(iso: string, days: number) {
  const date = parseIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function nextBusinessDay(iso: string) {
  let next = addDays(iso, 1);
  while ([0, 6].includes(parseIso(next).getUTCDay())) next = addDays(next, 1);
  return next;
}
/** "13 Nov 2026"; with the weekday, "Fri 13 Nov 2026". */
export function formatDate(iso: string, weekday = false) {
  const date = parseIso(iso);
  const text = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return weekday ? `${WEEKDAYS[date.getUTCDay()]} ${text}` : text;
}

// ---------------------------------------------------------------- seeded randomness

/** mulberry32: small, fast and the same in every browser. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    uniform: (lo: number, hi: number) => lo + (hi - lo) * next(),
    /** Integer in [lo, hi). */
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo)),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    shuffle: <T>(items: T[]) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
type Rng = ReturnType<typeof makeRng>;

/** A separate stream per purpose, so planting one more break leaves the rest of the day as it was. */
function stream(seed: number, tag: string) {
  let h = 0x811c9dc5;
  for (const ch of `${seed}:${tag}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return makeRng(h >>> 0);
}

// ---------------------------------------------------------------- generator.py

export const AS_OF = "2026-11-13";
export const FUND_NAME = "Demo Global Equity Fund";
const BASE_FX: Record<Ccy, number> = { USD: 1.0, EUR: 1.08, GBP: 1.27, JPY: 0.0067 };
const COUNTRY: Record<Ccy, string> = { USD: "US", EUR: "DE", GBP: "GB", JPY: "JP" };
const CCY_WEIGHTS: [Ccy, number][] = [
  ["USD", 60],
  ["EUR", 20],
  ["GBP", 12],
  ["JPY", 8],
];
const NAME_A = [
  "Alder", "Birch", "Cobalt", "Dunmore", "Ember", "Fairhaven", "Granite", "Harbour",
  "Ironvale", "Juniper", "Kestrel", "Larch", "Meridian", "Northgate", "Oakridge",
  "Pembrook", "Quarry", "Redfern", "Silverton", "Thornbury",
];
const NAME_B = [
  "Holdings", "Industries", "Capital", "Energy", "Systems", "Logistics", "Pharma",
  "Materials", "Networks", "Foods",
];
const DIVIDEND_TEXT = ["CASH DIVIDEND", "DIV PAYMENT", "INCOME DISTRIBUTION"];

export const GENERATOR = {
  securities: 18,
  /** Names with ordinary trading; the rest are kept free for planted breaks. */
  tradedNames: 6,
  trades: 10,
  aggregationRate: 0.5,
  roundingNoiseRate: 0.3,
  unreferencedRate: 0.12,
  bondShare: 0.2,
  openingCash: 6_000_000,
  sharesOutstanding: 2_000_000,
  managementFeeRate: 0.0075,
  dailyExpenseBudget: 400,
};
/** At most this many breaks can be planted: one free security each. */
export const MAX_PLANTS = GENERATOR.securities - GENERATOR.tradedNames;

export class PlantError extends Error {}

function pickCurrency(rng: Rng): Ccy {
  const total = CCY_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng.next() * total;
  for (const [ccy, w] of CCY_WEIGHTS) {
    roll -= w;
    if (roll < 0) return ccy;
  }
  return "USD";
}

/**
 * One fund-day with a break planted for each entry in `plants`, each on a
 * security of its own. Ordinary days are not perfectly clean: the custodian
 * rounds some amounts, nets trades into one line, leaves a reference off and
 * prices a few holdings a hair differently. None of those should be breaks.
 */
export function generateDay(seed: number, plants: Category[] = PLANTABLE): DayData {
  const cfg = GENERATOR;
  const asOf = AS_OF;
  const rng = makeRng(seed);
  const tradeDate = addDays(asOf, -2);
  const stamp = asOf.slice(2).replace(/-/g, "");

  const securities: Record<string, Security> = {};
  for (let i = 1; i <= cfg.securities; i += 1) {
    const ccy = pickCurrency(rng);
    const id = `${COUNTRY[ccy]}${String(i).padStart(6, "0")}${String(rng.int(0, 1000)).padStart(3, "0")}${i % 10}`;
    securities[id] = { id, name: `${rng.pick(NAME_A)} ${rng.pick(NAME_B)}`, currency: ccy, assetClass: "EQUITY" };
  }
  const ids = Object.keys(securities);
  const fx = {} as Record<Ccy, number>;
  for (const ccy of Object.keys(BASE_FX) as Ccy[]) {
    fx[ccy] = ccy === BASE_CURRENCY ? 1 : roundTo(BASE_FX[ccy] * (1 + rng.uniform(-0.01, 0.01)), 6);
  }
  const priorQty: Record<string, number> = {};
  const price: Record<string, number> = {};
  for (const id of ids) priorQty[id] = rng.int(10, 500) * 100;
  for (const id of ids) price[id] = round2(rng.uniform(5, 400) * (securities[id].currency === "JPY" ? 150 : 1));

  // Asset classes come from their own stream, as in the real generator.
  const side = stream(seed, "static");
  for (const id of ids) {
    if (side.next() < cfg.bondShare) {
      const coupon = side.pick([1.25, 2.0, 2.75, 3.5, 4.125, 4.75, 5.5]);
      const year = 2026 + side.int(2, 16);
      securities[id] = { ...securities[id], name: `${securities[id].name.split(" ")[0]} ${coupon}% ${year}`, assetClass: "BOND" };
      price[id] = roundTo(side.uniform(92, 108), 3);
    }
  }

  const pool = rng.shuffle(ids);
  const traded = pool.slice(0, cfg.tradedNames);
  const spare = pool.slice(cfg.tradedNames);

  const makeTrade = (r: Rng, sid: string, id: string): Trade => {
    const s = r.pick(["BUY", "SELL"] as const);
    let q = r.int(1, 50) * 100;
    if (s === "SELL") q = Math.min(q, priorQty[sid]);
    const p = round2(price[sid] * (1 + r.uniform(-0.01, 0.01)));
    const ccy = securities[sid].currency;
    return {
      id,
      tradeDate,
      settleDate: asOf,
      securityId: sid,
      side: s,
      quantity: q,
      price: p,
      currency: ccy,
      fxRate: fx[ccy],
      fees: round2(q * p * fx[ccy] * 0.0005),
    };
  };

  const cash: CashLine[] = [];
  let entryNo = 0;
  const addCash = (valueDate: string, sid: string, reference: string, description: string, amount: number) => {
    entryNo += 1;
    cash.push({ entryId: `CS${String(entryNo).padStart(6, "0")}`, valueDate, securityId: sid, reference, description, amount: round2(amount) });
  };
  const noise = () => (rng.next() < cfg.roundingNoiseRate ? round2(rng.uniform(-0.4, 0.4)) : 0);

  const bookTrades: Trade[] = [];
  for (let n = 1; n <= cfg.trades; n += 1) {
    bookTrades.push(makeTrade(rng, rng.pick(traded), `T${stamp}${String(n).padStart(4, "0")}`));
  }
  const bySecurity = new Map<string, Trade[]>();
  for (const t of bookTrades) bySecurity.set(t.securityId, [...(bySecurity.get(t.securityId) ?? []), t]);
  for (const [sid, trades] of bySecurity) {
    let rest = trades;
    if (trades.length >= 2 && rng.next() < cfg.aggregationRate) {
      const group = trades.slice(0, 4);
      rest = trades.slice(4);
      addCash(asOf, sid, `NET-${sid}`, "NET SETTLEMENT", group.reduce((sum, t) => sum + tradeCash(t), 0) + noise());
    }
    for (const t of rest) {
      const ref = rng.next() < cfg.unreferencedRate ? "" : t.id;
      addCash(asOf, sid, ref, `${t.side} ${t.quantity} ${sid}`, tradeCash(t) + noise());
    }
  }

  const bookQty = { ...priorQty };
  for (const t of bookTrades) bookQty[t.securityId] += signedQuantity(t);
  const custQty = { ...bookQty };
  const custPrice = { ...price };
  const priceDate: Record<string, string> = Object.fromEntries(ids.map((id) => [id, asOf]));
  priceDate[rng.pick(traded)] = addDays(asOf, -4);

  // Pricing vendors rarely agree to the last decimal: a couple of holdings
  // differ by less than their asset class's tolerance and must not break.
  const vendor = stream(seed, "vendor");
  for (const sid of vendor.shuffle(traded).slice(0, 2)) {
    const limit = TOLERANCES.priceRelByClass[securities[sid].assetClass];
    custPrice[sid] = roundTo(price[sid] * (1 + vendor.pick([-1, 1]) * limit * vendor.uniform(0.2, 0.7)), 4);
  }

  // Each planted break takes a free security of its own (an FX break needs a
  // foreign one, a split or dividend an equity) and its own random stream.
  const taken = new Set<string>();
  const planted: PlantedBreak[] = [];
  plants.forEach((cat, i) => {
    const free = spare.filter((s) => !taken.has(s));
    const sid =
      cat === "FX_DIFFERENCE"
        ? [...free].reverse().find((s) => securities[s].currency !== BASE_CURRENCY)
        : cat === "STOCK_SPLIT" || cat === "DIVIDEND"
          ? free.find((s) => securities[s].assetClass === "EQUITY")
          : free[0];
    if (!sid) throw new PlantError(`No free security left for a ${CATEGORY_LABEL[cat].toLowerCase()} break.`);
    if (cat === "UNKNOWN") throw new PlantError("Unexplained breaks are never planted.");
    taken.add(sid);
    const r = stream(seed, `plant-${i}`);
    const ccy = securities[sid].currency;
    let detail = "";
    if (cat === "MISSING_TRADE") {
      const t = makeTrade(r, sid, `X${stamp}${String(901 + i).padStart(4, "0")}`);
      custQty[sid] += signedQuantity(t);
      addCash(asOf, sid, `CUS${String(r.int(0, 1_000_000)).padStart(6, "0")}`, `${t.side} ${t.quantity} ${sid}`, tradeCash(t));
      detail = `Custodian settled a ${t.side.toLowerCase()} of ${qty(t.quantity)} that the book does not hold.`;
    } else if (cat === "PRICE_MISMATCH") {
      const dev = r.uniform(0.01, 0.08) * r.pick([-1, 1]);
      custPrice[sid] = roundTo(price[sid] * (1 + dev), 4);
      detail = `Custodian price off by ${pct(dev)}.`;
    } else if (cat === "STOCK_SPLIT") {
      const ratio = r.pick([2, 3, 4, 5]);
      custQty[sid] *= ratio;
      custPrice[sid] = roundTo(price[sid] / ratio, 6);
      detail = `${ratio}-for-1 split applied by the custodian only.`;
    } else if (cat === "DIVIDEND") {
      const dps = r.uniform(0.05, 2.0) * (ccy === "JPY" ? 150 : 1);
      const ref = `DV${String(r.int(0, 1_000_000)).padStart(6, "0")}`;
      addCash(asOf, sid, ref, `${r.pick(DIVIDEND_TEXT)} ${sid}`, bookQty[sid] * dps * fx[ccy]);
      detail = `Dividend of ${dps.toFixed(4)} ${ccy} a share not accrued in the book.`;
    } else if (cat === "FX_DIFFERENCE") {
      const t = makeTrade(r, sid, `T${stamp}${String(101 + i).padStart(4, "0")}`);
      bookTrades.push(t);
      bookQty[sid] += signedQuantity(t);
      custQty[sid] += signedQuantity(t);
      const dev = r.uniform(0.005, 0.025) * r.pick([-1, 1]);
      const notional = round2(t.quantity * t.price * fx[ccy] * (1 + dev));
      addCash(asOf, sid, t.id, `${t.side} ${t.quantity} ${sid}`, (t.side === "BUY" ? -notional : notional) - t.fees);
      detail = `Custodian converted ${ccy} at a rate ${pct(dev)} away from the book.`;
    } else {
      const t = makeTrade(r, sid, `T${stamp}${String(101 + i).padStart(4, "0")}`);
      bookTrades.push(t);
      bookQty[sid] += signedQuantity(t);
      addCash(nextBusinessDay(asOf), sid, t.id, "PENDING SETTLEMENT", tradeCash(t));
      detail = "Trade settles a business day late at the custodian.";
    }
    planted.push({ category: cat, securityId: sid, detail });
  });

  const positions: Record<string, Position> = {};
  const holdings: Record<string, Holding> = {};
  for (const id of ids) {
    const ccy = securities[id].currency;
    positions[id] = { securityId: id, quantity: bookQty[id], price: price[id], priceDate: priceDate[id], currency: ccy };
    holdings[id] = { securityId: id, quantity: custQty[id], price: custPrice[id], currency: ccy };
  }

  const day: DayData = {
    seed,
    asOf,
    securities,
    fx,
    bookTrades,
    positions,
    holdings,
    custodianCash: cash,
    bookOpeningCash: cfg.openingCash,
    custodianOpeningCash: cfg.openingCash,
    priorNavPerShare: 0,
    sharesOutstanding: cfg.sharesOutstanding,
    accruedExpenses: 0,
    accruals: [],
    managementFeeRate: cfg.managementFeeRate,
    dailyExpenseBudget: cfg.dailyExpenseBudget,
    planted,
  };
  const gross = grossAssets(day);
  day.accruedExpenses = round2(gross * 0.0002);
  const navPs = (gross + bookClosingCash(day) - day.accruedExpenses) / cfg.sharesOutstanding;
  day.priorNavPerShare = roundTo(navPs * (1 + stream(seed, "nav").uniform(-0.008, 0.008)), 6);
  const expected = expectedAccruals(day);
  day.accruals = (Object.keys(expected) as Accrual["kind"][]).map((kind) => ({ kind, amount: expected[kind]! }));
  return day;
}

/** Whether one more break of this kind can be planted on the day. */
export function canPlant(seed: number, plants: Category[], category: Category) {
  if (plants.length >= MAX_PLANTS) return false;
  try {
    generateDay(seed, [...plants, category]);
    return true;
  } catch {
    return false;
  }
}

export function bookClosingCash(day: DayData) {
  const settling = day.bookTrades.filter((t) => t.settleDate === day.asOf).reduce((s, t) => s + tradeCash(t), 0);
  return round2(day.bookOpeningCash + settling);
}
export function custodianClosingCash(day: DayData) {
  const settled = day.custodianCash.filter((l) => l.valueDate === day.asOf).reduce((s, l) => s + l.amount, 0);
  return round2(day.custodianOpeningCash + settled);
}
function grossAssets(day: DayData) {
  return Object.values(day.positions).reduce((s, p) => s + p.quantity * p.price * day.fx[p.currency], 0);
}

// ---------------------------------------------------------------- matching.py

export const TOLERANCES = {
  cashAbs: 1.0,
  /** 1 basis point of the amount. */
  cashRel: 0.0001,
  priceRelByClass: { EQUITY: 0.0025, BOND: 0.001 } as Record<AssetClass, number>,
  quantityAbs: 0,
  /** Largest netted group tried for many-to-one. */
  maxGroup: 4,
};

export interface Break {
  id: string;
  kind: BreakKind;
  securityId: string;
  bookValue: number | null;
  custodianValue: number | null;
  reference: string;
  note: string;
}
export const breakDifference = (b: Break) => roundTo((b.custodianValue ?? 0) - (b.bookValue ?? 0), 6);

export type MatchKind = "EXACT" | "TOLERANCE" | "ATTRIBUTE" | "MANY_TO_ONE";
export const MATCH_KINDS: MatchKind[] = ["EXACT", "TOLERANCE", "ATTRIBUTE", "MANY_TO_ONE"];

export interface CashMatch {
  kind: MatchKind;
  bookRefs: string[];
  custodianEntry: string;
  bookAmount: number;
  custodianAmount: number;
}

interface BookCashItem {
  reference: string;
  securityId: string;
  amount: number;
}

export interface ReconResult {
  matches: CashMatch[];
  breaks: Break[];
  /** Custodian lines value-dated later. */
  pending: CashLine[];
  /** Price differences inside their asset class's tolerance: compared, not broken. */
  withinTolerance: { securityId: string; rel: number; limit: number }[];
}

function within(a: number, b: number) {
  const limit = Math.max(TOLERANCES.cashAbs, TOLERANCES.cashRel * Math.max(Math.abs(a), Math.abs(b)));
  return Math.abs(a - b) <= limit + 1e-9;
}

function* combinations<T>(items: T[], size: number, start = 0, chosen: T[] = []): Generator<T[]> {
  if (chosen.length === size) {
    yield chosen;
    return;
  }
  for (let i = start; i < items.length; i += 1) yield* combinations(items, size, i + 1, [...chosen, items[i]]);
}

export function reconcile(day: DayData): ReconResult {
  let n = 0;
  const breaks: Break[] = [];
  const newBreak = (kind: BreakKind, securityId: string, bookValue: number | null, custodianValue: number | null, reference = "", note = "") => {
    n += 1;
    breaks.push({ id: `B${String(n).padStart(4, "0")}`, kind, securityId, bookValue, custodianValue, reference, note });
  };

  // Positions, security by security: quantity, then price against its class's tolerance.
  const withinTolerance: ReconResult["withinTolerance"] = [];
  for (const sid of [...new Set([...Object.keys(day.positions), ...Object.keys(day.holdings)])].sort()) {
    const book = day.positions[sid];
    const cust = day.holdings[sid];
    const bookQty = book?.quantity ?? 0;
    const custQty = cust?.quantity ?? 0;
    if (Math.abs(bookQty - custQty) > TOLERANCES.quantityAbs) newBreak("QUANTITY", sid, bookQty, custQty);
    if (book && cust && book.price > 0) {
      const limit = TOLERANCES.priceRelByClass[day.securities[sid]?.assetClass ?? "EQUITY"];
      const rel = Math.abs(cust.price - book.price) / book.price;
      if (rel > limit) newBreak("PRICE", sid, book.price, cust.price);
      else if (rel > 0) withinTolerance.push({ securityId: sid, rel, limit });
    }
  }

  // Cash, in passes from strictest to loosest.
  const bookItems: BookCashItem[] = day.bookTrades
    .filter((t) => t.settleDate === day.asOf)
    .map((t) => ({ reference: t.id, securityId: t.securityId, amount: tradeCash(t) }));
  const bookOpen = new Map(bookItems.map((i) => [i.reference, i]));
  const custOpen = new Map(day.custodianCash.filter((l) => l.valueDate === day.asOf).map((l) => [l.entryId, l]));
  const pending = day.custodianCash.filter((l) => l.valueDate > day.asOf);
  const matches: CashMatch[] = [];
  const close = (kind: MatchKind, items: BookCashItem[], line: CashLine) => {
    matches.push({
      kind,
      bookRefs: items.map((i) => i.reference),
      custodianEntry: line.entryId,
      bookAmount: round2(items.reduce((s, i) => s + i.amount, 0)),
      custodianAmount: line.amount,
    });
    for (const i of items) bookOpen.delete(i.reference);
    custOpen.delete(line.entryId);
  };

  // Passes 1 and 2: same reference, the amount exact to the cent, then within tolerance.
  const passes: [MatchKind, (a: number, b: number) => boolean][] = [
    ["EXACT", (a, b) => Math.abs(a - b) < 0.005],
    ["TOLERANCE", within],
  ];
  for (const [kind, same] of passes) {
    for (const line of [...custOpen.values()]) {
      const item = line.reference ? bookOpen.get(line.reference) : undefined;
      if (item && same(item.amount, line.amount)) close(kind, [item], line);
    }
  }
  // Pass 3: a custodian line without a reference, matched on security and amount.
  for (const line of [...custOpen.values()]) {
    if (line.reference) continue;
    const candidates = [...bookOpen.values()].filter((i) => i.securityId === line.securityId && within(i.amount, line.amount));
    if (candidates.length) {
      const best = candidates.reduce((a, b) => (Math.abs(b.amount - line.amount) < Math.abs(a.amount - line.amount) ? b : a));
      close("ATTRIBUTE", [best], line);
    }
  }
  // Pass 4: several book trades netted by the custodian into one line.
  for (const line of [...custOpen.values()]) {
    const candidates = [...bookOpen.values()].filter((i) => i.securityId === line.securityId);
    let found: BookCashItem[] | null = null;
    for (let size = 2; size <= Math.min(TOLERANCES.maxGroup, candidates.length) && !found; size += 1) {
      for (const combo of combinations(candidates, size)) {
        if (within(combo.reduce((s, i) => s + i.amount, 0), line.amount)) {
          found = combo;
          break;
        }
      }
    }
    if (found) close("MANY_TO_ONE", found, line);
  }
  // Pass 5: same reference, amount genuinely different.
  for (const line of [...custOpen.values()]) {
    const item = line.reference ? bookOpen.get(line.reference) : undefined;
    if (item) {
      newBreak("CASH_AMOUNT", line.securityId, item.amount, line.amount, line.reference);
      bookOpen.delete(item.reference);
      custOpen.delete(line.entryId);
    }
  }
  for (const item of bookOpen.values()) newBreak("CASH_MISSING_AT_CUSTODIAN", item.securityId, item.amount, null, item.reference);
  for (const line of custOpen.values()) {
    newBreak("CASH_MISSING_IN_BOOK", line.securityId, null, line.amount, line.reference || line.entryId, line.description);
  }
  return { matches, breaks, pending, withinTolerance };
}

// ---------------------------------------------------------------- triage.py

export type Status = "PENDING" | "APPROVED" | "REJECTED" | "RECLASSIFIED";
export type Role = "analyst" | "approver" | "viewer";

export interface Case {
  id: string;
  securityId: string;
  category: Category;
  confidence: number;
  explanation: string;
  /** Draft query to the custodian or trading desk. */
  query: string;
  breakIds: string[];
  /** Base currency: how far NAV moves if the custodian's view is right. */
  navImpact: number;
  navImpactBp: number;
  grossExposure: number;
  material: boolean;
  /** In one day, material cases are escalated and need an approver's decision. */
  escalated: boolean;
  status: Status;
  finalCategory: Category | null;
  reviewedBy: string;
  reviewedRole: Role | "";
  note: string;
  /** Everyone who has decided this case today, for the four-eyes rule. */
  decidedBy: string[];
}

interface Suggestion {
  category: Category;
  confidence: number;
  explanation: string;
  query: string;
}

const letter = (subject: string, body: string) => `Subject: ${subject}\n\nHello,\n\n${body}\n\nKind regards,\nFund Operations`;

class Context {
  sec: Security | undefined;
  name: string;
  ccy: Ccy;
  fx: number;
  pos: Position | undefined;
  hold: Holding | undefined;
  pending: Map<string, CashLine>;
  trades: Map<string, Trade>;
  qty: Break | undefined;
  price: Break | undefined;
  amount: Break[];
  missingAtCust: Break[];
  missingInBook: Break[];
  date: string;

  constructor(
    public day: DayData,
    recon: ReconResult,
    public sid: string,
    public breaks: Break[],
  ) {
    this.sec = day.securities[sid];
    this.name = this.sec ? `${this.sec.name} (${sid})` : sid || "an unidentified security";
    this.ccy = this.sec?.currency ?? BASE_CURRENCY;
    this.fx = day.fx[this.ccy] ?? 1;
    this.pos = day.positions[sid];
    this.hold = day.holdings[sid];
    this.pending = new Map(recon.pending.filter((l) => l.reference).map((l) => [l.reference, l]));
    this.trades = new Map(day.bookTrades.map((t) => [t.id, t]));
    const of = (kind: BreakKind) => breaks.filter((b) => b.kind === kind);
    this.qty = of("QUANTITY")[0];
    this.price = of("PRICE")[0];
    this.amount = of("CASH_AMOUNT");
    this.missingAtCust = of("CASH_MISSING_AT_CUSTODIAN");
    this.missingInBook = of("CASH_MISSING_IN_BOOK");
    this.date = formatDate(day.asOf);
  }

  get unitPrice() {
    if (this.pos && this.pos.price > 0) return this.pos.price;
    return this.hold?.price ?? 0;
  }
}

function ruleSplit(c: Context): Suggestion | null {
  if (!(c.qty && c.price && c.qty.bookValue && c.qty.custodianValue && c.price.custodianValue)) return null;
  const ratio = c.qty.custodianValue / c.qty.bookValue;
  const priceRatio = c.price.bookValue! / c.price.custodianValue;
  const forward = ratio >= 1.5 && Math.abs(ratio - Math.round(ratio)) < 0.001;
  const reverse = ratio > 0 && ratio < 0.67 && Math.abs(1 / ratio - Math.round(1 / ratio)) < 0.001;
  if (!(forward || reverse) || Math.abs(priceRatio / ratio - 1) > 0.005) return null;
  const label = forward ? `${Math.round(ratio)}-for-1 split` : `1-for-${Math.round(1 / ratio)} reverse split`;
  const valueBook = c.qty.bookValue * c.price.bookValue!;
  const valueCust = c.qty.custodianValue * c.price.custodianValue;
  return {
    category: "STOCK_SPLIT",
    confidence: 0.95,
    explanation:
      `The custodian holds ${qty(c.qty.custodianValue)} units of ${c.name} against ${qty(c.qty.bookValue)} in the book, ` +
      `and prices them at ${px(c.price.custodianValue)} against ${px(c.price.bookValue!)}. Quantity and price have moved ` +
      `by the same factor in opposite directions and the market value barely changes (${money(valueBook)} vs ` +
      `${money(valueCust)} ${c.ccy}), which points to a ${label} the custodian has processed and the book has not.`,
    query: letter(
      `Corporate action confirmation for ${c.sid}`,
      `Your statement for ${c.date} reflects what looks like a ${label} on ${c.name}. Could you confirm the event, ` +
        `the ratio, the ex-date and the source of the announcement so we can update our records?`,
    ),
  };
}

function ruleTiming(c: Context): Suggestion | null {
  if (!c.missingAtCust.length || c.missingInBook.length || c.amount.length) return null;
  if (!c.missingAtCust.every((b) => c.pending.has(b.reference))) return null;
  const refs = c.missingAtCust.map((b) => b.reference);
  const expectedGap = refs.reduce((s, r) => s + (c.trades.has(r) ? signedQuantity(c.trades.get(r)!) : 0), 0);
  const consistent = c.qty !== undefined && Math.abs(c.qty.bookValue! - c.qty.custodianValue! - expectedGap) < 1e-6;
  const later = [...new Set(refs.map((r) => formatDate(c.pending.get(r)!.valueDate)))].sort();
  let explanation =
    `Trade ${refs.join(", ")} in ${c.name} was due to settle on ${c.date} but the custodian shows it as pending ` +
    `with value date ${later.join(", ")}.`;
  if (c.qty) {
    explanation +=
      ` The position difference of ${qty(c.qty.bookValue! - c.qty.custodianValue!)} units ` +
      (consistent ? "matches the trade exactly." : "does not fully match the trade, so check for a second issue.");
  }
  return {
    category: "TIMING",
    confidence: consistent ? 0.9 : 0.7,
    explanation,
    query: letter(
      `Late settlement of ${refs.join(", ")}`,
      `Trade ${refs.join(", ")} in ${c.name} was due to settle on ${c.date} and is showing as pending on your ` +
        `statement. Could you confirm the reason for the delay (failed delivery, missing instruction or counterparty ` +
        `issue) and the expected settlement date?`,
    ),
  };
}

function ruleMissingTrade(c: Context): Suggestion | null {
  if (!c.qty) return null;
  const gap = c.qty.custodianValue! - c.qty.bookValue!;
  if (c.missingInBook.length) {
    const cash = c.missingInBook.reduce((s, b) => s + b.custodianValue!, 0);
    const implied = Math.abs(gap) * c.unitPrice * c.fx;
    const close = implied > 0 && Math.abs(Math.abs(cash) / implied - 1) < 0.03;
    const refs = c.missingInBook.map((b) => b.reference).join(", ");
    return {
      category: "MISSING_TRADE",
      confidence: close ? 0.9 : 0.6,
      explanation:
        `The custodian holds ${qty(gap)} more units of ${c.name} than the book and has settled cash entry ${refs} ` +
        `for ${money(cash)}. ` +
        (close
          ? `That amount is consistent with ${qty(Math.abs(gap))} units at about ${money(c.unitPrice)} ${c.ccy}, so a ` +
            `trade appears to be missing from the book.`
          : "The cash does not line up neatly with the quantity, so treat the cause as provisional."),
      query: letter(
        `Unrecognised settlement on ${c.sid}`,
        `Your statement for ${c.date} shows ${qty(c.qty.custodianValue!)} units of ${c.name} against ` +
          `${qty(c.qty.bookValue!)} in our records, together with cash entry ${refs} for ${money(cash)}. We hold no ` +
          `matching instruction. Could you send the trade details (trade date, broker and instructing party) so we ` +
          `can confirm whether it belongs to the fund?`,
      ),
    };
  }
  if (c.missingAtCust.length) {
    const refs = c.missingAtCust.map((b) => b.reference).join(", ");
    return {
      category: "MISSING_TRADE",
      confidence: 0.7,
      explanation:
        `The book expects trade ${refs} in ${c.name} to have settled today, but the custodian has neither the ` +
        `position change (${qty(-gap)} units) nor the cash, and shows nothing pending. The custodian may not have ` +
        `received the instruction.`,
      query: letter(
        `Missing settlement for ${refs}`,
        `We expected trade ${refs} in ${c.name} to settle on ${c.date}, but it does not appear on your holdings or ` +
          `cash statements, settled or pending. Could you confirm whether you have received the instruction?`,
      ),
    };
  }
  return {
    category: "MISSING_TRADE",
    confidence: 0.55,
    explanation:
      `Quantity of ${c.name} differs by ${qty(gap)} units (book ${qty(c.qty.bookValue!)}, custodian ` +
      `${qty(c.qty.custodianValue!)}) with no related cash today. Possible free-of-payment transfer or an older ` +
      `unbooked trade.`,
    query: letter(
      `Position difference on ${c.sid}`,
      `Our records show ${qty(c.qty.bookValue!)} units of ${c.name} and your statement shows ` +
        `${qty(c.qty.custodianValue!)}. Could you send the movement history for the last five business days?`,
    ),
  };
}

const DIVIDEND_WORDS = ["DIV", "DISTRIBUTION", "INCOME", "COUPON"];

function ruleDividend(c: Context): Suggestion | null {
  if (c.qty || c.amount.length || c.missingAtCust.length || !c.missingInBook.length) return null;
  const credits = c.missingInBook.filter((b) => (b.custodianValue ?? 0) > 0);
  if (credits.length !== c.missingInBook.length) return null;
  const held = c.hold?.quantity || c.pos?.quantity || 0;
  if (held <= 0) return null;
  const total = credits.reduce((s, b) => s + b.custodianValue!, 0);
  const perShare = total / (held * c.fx);
  if (!(perShare > 0.0001 && perShare < 50 * (c.ccy === "JPY" ? 150 : 1))) return null;
  const keyword = credits.some((b) => DIVIDEND_WORDS.some((w) => b.note.toUpperCase().includes(w)));
  return {
    category: "DIVIDEND",
    confidence: keyword ? 0.9 : 0.6,
    explanation:
      `The custodian credited ${money(total)} against ${c.name} with no matching entry in the book. Spread over the ` +
      `${qty(held)} units held, that is ${perShare.toFixed(4)} ${c.ccy} per share, which looks like an income payment` +
      (keyword ? " and the narrative says as much." : ", although the narrative does not say so.") +
      " The dividend has probably not been accrued.",
    query: letter(
      `Income received on ${c.sid}`,
      `We see a credit of ${money(total)} on ${c.date} against ${c.name}. Could you confirm the event type, the rate ` +
        `per share, the ex-date and any withholding tax applied?`,
    ),
  };
}

function ruleFx(c: Context): Suggestion | null {
  if (c.qty || !c.amount.length) return null;
  const brk = c.amount[0];
  const trade = c.trades.get(brk.reference);
  if (c.ccy === BASE_CURRENCY || !trade) return null;
  const book = brk.bookValue!;
  const cust = brk.custodianValue!;
  const rel = Math.abs(cust + trade.fees) / Math.abs(book + trade.fees) - 1;
  if (!(Math.abs(rel) >= 0.0005 && Math.abs(rel) <= 0.05)) return null;
  const implied = trade.fxRate * (1 + rel);
  return {
    category: "FX_DIFFERENCE",
    confidence: 0.8,
    explanation:
      `Trade ${trade.id} in ${c.name} settled for ${money(cust)} against ${money(book)} expected, a difference of ` +
      `${money(cust - book)}. Quantity and price agree, and the gap is ${pct(rel)} of the gross amount. Backing out ` +
      `the rate gives about ${implied.toFixed(6)} USD per ${c.ccy} against ${trade.fxRate.toFixed(6)} in the book, so ` +
      `the custodian appears to have converted at a different rate.`,
    query: letter(
      `FX rate applied to ${trade.id}`,
      `Trade ${trade.id} in ${c.name} settled for ${money(cust)}; we expected ${money(book)} using a ${c.ccy}/USD ` +
        `rate of ${trade.fxRate.toFixed(6)}. Could you confirm the rate you applied, its source and the time it was struck?`,
    ),
  };
}

function rulePrice(c: Context): Suggestion | null {
  if (c.qty || !c.price) return null;
  const book = c.price.bookValue!;
  const cust = c.price.custodianValue!;
  const rel = (cust - book) / book;
  const big = Math.abs(rel) > 0.25;
  return {
    category: "PRICE_MISMATCH",
    confidence: big ? 0.5 : 0.85,
    explanation:
      `Quantities agree on ${c.name}, but the custodian prices it at ${px(cust)} ${c.ccy} against ${px(book)} in the ` +
      `book (${pct(rel)}), which moves the market value by ${money((cust - book) * (c.pos?.quantity ?? 0) * c.fx)} USD.` +
      (big ? " A move this large may be a corporate action rather than a pricing difference." : ""),
    query: letter(
      `Price check on ${c.sid}`,
      `Your statement prices ${c.name} at ${px(cust)} ${c.ccy} on ${c.date}; our pricing source gives ${px(book)}. ` +
        `Could you confirm your price source and the time of the price?`,
    ),
  };
}

function ruleUnknown(c: Context): Suggestion {
  const kinds = [...new Set(c.breaks.map((b) => b.kind))].sort().join(", ");
  return {
    category: "UNKNOWN",
    confidence: 0.3,
    explanation: `Breaks on ${c.name} (${kinds}) do not fit a known pattern. Needs manual investigation.`,
    query: letter(
      `Reconciliation difference on ${c.sid || "cash"}`,
      `We have an unexplained difference on ${c.name} for ${c.date}. Could you send the supporting detail for the entries involved?`,
    ),
  };
}

/** The rules, in the real engine's order: the first that fits wins. */
export const RULE_ORDER: Category[] = ["STOCK_SPLIT", "TIMING", "MISSING_TRADE", "DIVIDEND", "FX_DIFFERENCE", "PRICE_MISMATCH"];
const RULES = [ruleSplit, ruleTiming, ruleMissingTrade, ruleDividend, ruleFx, rulePrice];

export function classify(day: DayData, recon: ReconResult, sid: string, breaks: Break[]): Suggestion {
  const ctx = new Context(day, recon, sid, breaks);
  for (const rule of RULES) {
    const s = rule(ctx);
    if (s) return s;
  }
  return ruleUnknown(ctx);
}

/** Breaks that share a security are one problem seen from several angles: one case each. */
export function triage(day: DayData, recon: ReconResult): Case[] {
  const groups = new Map<string, Break[]>();
  for (const b of recon.breaks) groups.set(b.securityId, [...(groups.get(b.securityId) ?? []), b]);
  const stamp = day.asOf.replace(/-/g, "");
  return [...groups.entries()].map(([sid, breaks], i) => {
    const s = classify(day, recon, sid, breaks);
    return {
      id: `EX-${stamp}-${String(i + 1).padStart(3, "0")}`,
      securityId: sid,
      category: s.category,
      confidence: roundTo(s.confidence, 2),
      explanation: s.explanation,
      query: s.query,
      breakIds: breaks.map((b) => b.id),
      navImpact: 0,
      navImpactBp: 0,
      grossExposure: 0,
      material: false,
      escalated: false,
      status: "PENDING",
      finalCategory: null,
      reviewedBy: "",
      reviewedRole: "",
      note: "",
      decidedBy: [],
    };
  });
}

// ---------------------------------------------------------------- nav.py

export type CheckStatus = "PASS" | "WARN" | "FAIL";
export interface Check {
  name: string;
  status: CheckStatus;
  detail: string;
}
export interface NavResult {
  grossAssets: number;
  cash: number;
  liabilities: number;
  nav: number;
  navPerShare: number;
  priorNavPerShare: number;
  movement: number;
}

export function expectedAccruals(day: DayData): Partial<Record<Accrual["kind"], number>> {
  const days = 1; // a Friday accrual covers one calendar day; Monday's would cover three
  const priorNav = day.priorNavPerShare * day.sharesOutstanding;
  return {
    MANAGEMENT_FEE: round2(((priorNav * day.managementFeeRate) / 365) * days),
    EXPENSES: round2(day.dailyExpenseBudget * days),
  };
}

export function computeNav(day: DayData): NavResult {
  const gross = grossAssets(day);
  const cash = bookClosingCash(day);
  const liabilities = round2(day.accruedExpenses + day.accruals.reduce((s, a) => s + a.amount, 0));
  const nav = round2(gross + cash - liabilities);
  const navPerShare = roundTo(nav / day.sharesOutstanding, 6);
  return {
    grossAssets: round2(gross),
    cash,
    liabilities,
    nav,
    navPerShare,
    priorNavPerShare: day.priorNavPerShare,
    movement: day.priorNavPerShare ? navPerShare / day.priorNavPerShare - 1 : 0,
  };
}

export function runChecks(day: DayData, nav: NavResult, recon: ReconResult, movementThreshold = 0.02): Check[] {
  const checks: Check[] = [];
  const cutoff = addDays(day.asOf, -1);
  const stale = Object.values(day.positions)
    .filter((p) => p.quantity && p.priceDate < cutoff)
    .map((p) => p.securityId)
    .sort();
  checks.push({
    name: "Stale prices",
    status: stale.length ? "WARN" : "PASS",
    detail: stale.length
      ? `${stale.length} held position(s) priced before ${formatDate(cutoff)}: ${stale.join(", ")}.`
      : "All held positions priced within the allowed age.",
  });
  const missing = Object.values(day.positions).filter((p) => p.quantity && p.price <= 0).map((p) => p.securityId);
  checks.push({
    name: "Missing prices",
    status: missing.length ? "FAIL" : "PASS",
    detail: missing.length ? `No usable price for: ${missing.join(", ")}.` : "Every held position has a price.",
  });
  const expected = expectedAccruals(day);
  const booked = day.accruals.reduce((s, a) => s + a.amount, 0);
  const wanted = Object.values(expected).reduce((s, a) => s + (a ?? 0), 0);
  checks.push({
    name: "Accruals",
    status: Math.abs(booked - wanted) > 0.01 ? "FAIL" : "PASS",
    detail: `Fee and expense accruals booked as expected: ${money(wanted)} for 1 day.`,
  });
  checks.push({
    name: "NAV movement",
    status: Math.abs(nav.movement) > movementThreshold ? "WARN" : "PASS",
    detail: `NAV per share moved ${pct(nav.movement)} against a threshold of ${(movementThreshold * 100).toFixed(2)}%.`,
  });
  const gap = round2(custodianClosingCash(day) - bookClosingCash(day));
  const explained = round2(
    recon.breaks.filter((b) => CASH_KINDS.has(b.kind)).reduce((s, b) => s + breakDifference(b), 0) +
      recon.matches.reduce((s, m) => s + (m.custodianAmount - m.bookAmount), 0),
  );
  const residual = round2(gap - explained);
  checks.push(
    Math.abs(gap) <= TOLERANCES.cashAbs
      ? { name: "Cash tie-out", status: "PASS", detail: "Book and custodian closing cash agree within 1.00." }
      : {
          name: "Cash tie-out",
          status: Math.abs(residual) > TOLERANCES.cashAbs ? "FAIL" : "WARN",
          detail: `Closing cash differs by ${money(gap)}, of which ${money(explained)} is explained by open cash breaks and matched rounding, leaving ${money(residual)} unexplained.`,
        },
  );
  return checks;
}

// ---------------------------------------------------------------- impact.py

export const MATERIALITY_BP = 1.0;

/** (net NAV impact, gross exposure) in base currency, as in impact.case_impact. */
export function caseImpact(day: DayData, recon: ReconResult, c: Pick<Case, "securityId" | "breakIds">): [number, number] {
  const ids = new Set(c.breakIds);
  const breaks = recon.breaks.filter((b) => ids.has(b.id));
  const sec = day.securities[c.securityId];
  const fx = sec ? day.fx[sec.currency] : 1;
  const pos = day.positions[c.securityId];
  const hold = day.holdings[c.securityId];
  let positionImpact = 0;
  let gross = 0;
  if (breaks.some((b) => b.kind === "QUANTITY" || b.kind === "PRICE")) {
    const bookMv = pos ? pos.quantity * pos.price * fx : 0;
    const custMv = hold ? hold.quantity * hold.price * fx : 0;
    positionImpact = custMv - bookMv;
    const price = pos && pos.price ? pos.price : (hold?.price ?? 0);
    for (const b of breaks) {
      if (b.kind === "QUANTITY") gross += Math.abs(breakDifference(b)) * price * fx;
      else if (b.kind === "PRICE") gross += Math.abs(breakDifference(b)) * (pos?.quantity ?? 0) * fx;
    }
  }
  const cashBreaks = breaks.filter((b) => CASH_KINDS.has(b.kind));
  const cashImpact = cashBreaks.reduce((s, b) => s + breakDifference(b), 0);
  gross += cashBreaks.reduce((s, b) => s + Math.abs(breakDifference(b)), 0);
  return [round2(positionImpact + cashImpact), round2(gross)];
}

export const sortByImpact = (cases: Case[]) =>
  [...cases].sort((a, b) => Math.abs(b.navImpact) - Math.abs(a.navImpact) || a.id.localeCompare(b.id));

export function applyImpacts(day: DayData, recon: ReconResult, cases: Case[], nav: NavResult, materialityBp = MATERIALITY_BP) {
  return sortByImpact(
    cases.map((c) => {
      const [impact, gross] = caseImpact(day, recon, c);
      const bp = nav.nav ? roundTo((impact / nav.nav) * 10_000, 4) : 0;
      const material = Math.abs(bp) >= materialityBp;
      return { ...c, navImpact: impact, grossExposure: gross, navImpactBp: bp, material, escalated: material };
    }),
  );
}

// ---------------------------------------------------------------- pipeline.py

export interface DayRun {
  day: DayData;
  recon: ReconResult;
  nav: NavResult;
  checks: Check[];
  cases: Case[];
}

export function runDay(day: DayData): DayRun {
  const recon = reconcile(day);
  const nav = computeNav(day);
  const checks = runChecks(day, nav, recon);
  const cases = applyImpacts(day, recon, triage(day, recon), nav);
  return { day, recon, nav, checks, cases };
}

export interface Evidence {
  security: Security | undefined;
  position: Position | undefined;
  holding: Holding | undefined;
  fx: number;
  breaks: Break[];
  pending: CashLine[];
  trades: Trade[];
}

/** Book against custodian for one case: the records the decision rests on. */
export function caseEvidence(run: DayRun, c: Case): Evidence {
  const ids = new Set(c.breakIds);
  const breaks = run.recon.breaks.filter((b) => ids.has(b.id));
  const refs = new Set(breaks.map((b) => b.reference).filter(Boolean));
  const security = run.day.securities[c.securityId];
  return {
    security,
    position: run.day.positions[c.securityId],
    holding: run.day.holdings[c.securityId],
    fx: security ? run.day.fx[security.currency] : 1,
    breaks,
    pending: run.recon.pending.filter((l) => refs.has(l.reference)),
    trades: run.day.bookTrades.filter((t) => refs.has(t.id)),
  };
}

/** The answer key against the run, as in evaluate.py: found, and named the right cause. */
export function scoreRun(run: DayRun) {
  return run.day.planted.map((p) => {
    const found = run.cases.find((c) => c.securityId === p.securityId);
    return { ...p, found: Boolean(found), caseId: found?.id ?? null, suggested: found?.category ?? null, right: found?.category === p.category };
  });
}

// ---------------------------------------------------------------- audit.py

export const GENESIS = "0".repeat(64);
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface AuditEntry {
  seq: number;
  ts: string;
  actor: string;
  role: string;
  action: string;
  payload: { [key: string]: Json };
  prev_hash: string;
  hash: string;
}

/** JSON with keys sorted and no spaces: the canonical form each entry's hash is taken over. */
export function canonicalJson(value: Json | undefined): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
];

/** SHA-256 (FIPS 180-4) in plain TypeScript, synchronous so the chain can be checked during render. */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const length = ((bytes.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(length);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = bytes.length * 8;
  view.setUint32(length - 8, Math.floor(bits / 2 ** 32));
  view.setUint32(length - 4, bits >>> 0);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < length; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => {
      h[i] = (h[i] + v) >>> 0;
    });
  }
  return h.map((v) => v.toString(16).padStart(8, "0")).join("");
}

/** SHA-256 of an entry without its own hash field. */
export function recordHash(entry: Omit<AuditEntry, "hash">) {
  const { seq, ts, actor, role, action, payload, prev_hash } = entry;
  return sha256Hex(canonicalJson({ seq, ts, actor, role, action, payload, prev_hash }));
}

/** The demo's desk clock: entries 53 seconds apart from 07:30 on the fund-day, so runs repeat exactly. */
export function deskTime(asOf: string, seq: number) {
  const seconds = 7.5 * 3600 + seq * 53;
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${asOf}T${hh}:${mm}:${ss}+00:00`;
}

/** Append one entry holding the previous entry's hash. Never edits an existing entry. */
export function appendAudit(
  log: AuditEntry[],
  actor: string,
  role: string,
  action: string,
  payload: { [key: string]: Json } = {},
  asOf = AS_OF,
): AuditEntry[] {
  const seq = log.length + 1;
  const body = { seq, ts: deskTime(asOf, seq), actor, role, action, payload, prev_hash: log.length ? log[log.length - 1].hash : GENESIS };
  return [...log, { ...body, hash: recordHash(body) }];
}

export interface Verification {
  ok: boolean;
  /** Sequence number of the first entry that does not fit, or null. */
  firstBad: number | null;
  checked: number;
}

/** Walk the log from the genesis hash; report the first entry whose order, link or hash does not fit. */
export function verifyAudit(log: AuditEntry[]): Verification {
  let prev = GENESIS;
  for (let i = 0; i < log.length; i += 1) {
    const entry = log[i];
    if (entry.seq !== i + 1 || entry.prev_hash !== prev || recordHash(entry) !== entry.hash) {
      return { ok: false, firstBad: i + 1, checked: i + 1 };
    }
    prev = entry.hash;
  }
  return { ok: true, firstBad: null, checked: log.length };
}

/**
 * Demo only: rewrite one entry's payload in place without re-hashing, as
 * someone editing the stored log directly would. The real log cannot be
 * edited at all: the database refuses updates and deletes.
 */
export function tamperAudit(log: AuditEntry[], seq: number): AuditEntry[] {
  return log.map((entry) =>
    entry.seq === seq ? { ...entry, payload: { ...entry.payload, note: "edited after the fact" } } : entry,
  );
}

// ---------------------------------------------------------------- review.py and release.py

export interface Actor {
  name: string;
  role: Role;
}

/** The real demo's one-click users: one analyst and two approvers, to show four-eyes. */
export const USERS: Actor[] = [
  { name: "Priya Shah", role: "analyst" },
  { name: "Ann Lee", role: "approver" },
  { name: "Tom Reed", role: "approver" },
];

const CAN_DECIDE: Role[] = ["analyst", "approver"];

export interface Outcome {
  ok: boolean;
  message: string;
  cases: Case[];
  audit: AuditEntry[];
}

export type DecisionKind = "approve" | "reject" | "reclassify";

/** Approve the suggested cause, reject it (a note is required) or reclassify it to another cause. */
export function decide(
  cases: Case[],
  audit: AuditEntry[],
  actor: Actor,
  caseId: string,
  kind: DecisionKind,
  options: { note?: string; category?: Category } = {},
): Outcome {
  if (!CAN_DECIDE.includes(actor.role)) {
    return {
      ok: false,
      message: `${actor.name} (${actor.role}) may not review cases.`,
      cases,
      audit: appendAudit(audit, actor.name, actor.role, "PERMISSION_DENIED", { attempted: "review cases" }),
    };
  }
  const target = cases.find((c) => c.id === caseId);
  if (!target) return { ok: false, message: `No case ${caseId}.`, cases, audit };
  const note = (options.note ?? "").trim();
  if (kind === "reject" && !note) {
    return { ok: false, message: "A rejection needs a note explaining why.", cases, audit };
  }
  if (kind === "reclassify" && !options.category) {
    return { ok: false, message: "Choose the cause to reclassify to.", cases, audit };
  }
  const status: Status = kind === "approve" ? "APPROVED" : kind === "reject" ? "REJECTED" : "RECLASSIFIED";
  const final = kind === "approve" ? target.category : kind === "reject" ? null : options.category!;
  const updated: Case = {
    ...target,
    status,
    finalCategory: final,
    reviewedBy: actor.name,
    reviewedRole: actor.role,
    note,
    decidedBy: target.decidedBy.includes(actor.name) ? target.decidedBy : [...target.decidedBy, actor.name],
  };
  return {
    ok: true,
    message: `${caseId} ${status.toLowerCase()} by ${actor.name}.`,
    cases: cases.map((c) => (c.id === caseId ? updated : c)),
    audit: appendAudit(audit, actor.name, actor.role, `CASE_${status}`, {
      case_id: caseId,
      suggested: target.category,
      final,
      before: { status: target.status, final_category: target.finalCategory },
      note,
      material: target.material,
      escalated: target.escalated,
    }),
  };
}

export type ReasonCode =
  | "PENDING_DECISIONS"
  | "MATERIAL_NOT_APPROVED"
  | "ESCALATED_NEEDS_APPROVER"
  | "CHECK_FAILED"
  | "FOUR_EYES";

export interface Reason {
  code: ReasonCode;
  message: string;
  caseIds: string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const RESOLVED: Status[] = ["APPROVED", "RECLASSIFIED"];

/** Material cases not yet approved or reclassified: they block release. */
export const blockingCases = (cases: Case[]) => cases.filter((c) => c.material && !RESOLVED.includes(c.status));

/** One release status for the day: ready, or blocked with every reason. */
export function releaseStatus(cases: Case[], checks: Check[]): { ready: boolean; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const pending = cases.filter((c) => c.status === "PENDING");
  if (pending.length) {
    reasons.push({ code: "PENDING_DECISIONS", message: `${plural(pending.length, "case")} still pending a decision.`, caseIds: pending.map((c) => c.id) });
  }
  const material = blockingCases(cases);
  if (material.length) {
    reasons.push({ code: "MATERIAL_NOT_APPROVED", message: `${plural(material.length, "material case")} not approved or reclassified.`, caseIds: material.map((c) => c.id) });
  }
  const escalated = cases.filter((c) => c.escalated && c.reviewedRole !== "approver");
  if (escalated.length) {
    reasons.push({
      code: "ESCALATED_NEEDS_APPROVER",
      message: `${plural(escalated.length, "escalated case")} ${escalated.length === 1 ? "needs" : "need"} a decision by an approver.`,
      caseIds: escalated.map((c) => c.id),
    });
  }
  for (const check of checks) {
    if (check.status === "FAIL") reasons.push({ code: "CHECK_FAILED", message: `${check.name} failed: ${check.detail}`, caseIds: [] });
  }
  return { ready: reasons.length === 0, reasons };
}

/** The day's reasons, plus four-eyes: whoever signs off must have decided none of the day's cases. */
export function signOffReasons(cases: Case[], checks: Check[], actor: Actor): Reason[] {
  const reasons = [...releaseStatus(cases, checks).reasons];
  const own = cases.filter((c) => c.decidedBy.includes(actor.name)).map((c) => c.id);
  if (own.length) {
    reasons.push({ code: "FOUR_EYES", message: `${actor.name} decided ${plural(own.length, "case")} today, so another approver must sign off.`, caseIds: own });
  }
  return reasons;
}

/** Close the day. Approvers only, every condition met, and four eyes. */
export function signOff(cases: Case[], checks: Check[], audit: AuditEntry[], actor: Actor): Outcome & { signedOff: boolean } {
  if (actor.role !== "approver") {
    return {
      ok: false,
      signedOff: false,
      message: `${actor.name} (${actor.role}) may not sign off the day.`,
      cases,
      audit: appendAudit(audit, actor.name, actor.role, "PERMISSION_DENIED", { attempted: "sign off the day" }),
    };
  }
  const reasons = signOffReasons(cases, checks, actor);
  if (reasons.length) {
    return {
      ok: false,
      signedOff: false,
      message: `Sign-off refused: ${reasons.map((r) => r.message).join(" ")}`,
      cases,
      audit: appendAudit(audit, actor.name, actor.role, "SIGN_OFF_BLOCKED", {
        reasons: reasons.map((r) => r.code),
        cases: [...new Set(reasons.flatMap((r) => r.caseIds))],
      }),
    };
  }
  return {
    ok: true,
    signedOff: true,
    message: `NAV signed off by ${actor.name}. The day is locked.`,
    cases,
    audit: appendAudit(audit, actor.name, actor.role, "DAY_SIGNED_OFF", { cases: cases.length }),
  };
}
