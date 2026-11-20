import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import ReconPilotDemo from "@/sites/ordo/demos/ReconPilotDemo";
import { setMotionPaused } from "@/lib/motion-pause";
import {
  AS_OF,
  GENESIS,
  PLANTABLE,
  USERS,
  appendAudit,
  canonicalJson,
  decide,
  generateDay,
  recordHash,
  releaseStatus,
  runDay,
  scoreRun,
  sha256Hex,
  signOff,
  tamperAudit,
  verifyAudit,
  type AuditEntry,
  type Case,
  type Category,
  type DayData,
} from "@/sites/ordo/demos/recon";

afterEach(() => {
  cleanup();
  setMotionPaused(false);
  vi.useRealTimers();
});

const [PRIYA, ANN, TOM] = USERS;
const nodeSha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** A fund small enough to size by hand: NAV is exactly 1,020,000.00. */
function tinyDay(): DayData {
  const equity = (id: string, name: string) => ({ id, name, currency: "USD" as const, assetClass: "EQUITY" as const });
  const pos = (securityId: string, quantity: number, price: number) => ({ securityId, quantity, price, priceDate: AS_OF, currency: "USD" as const });
  return {
    seed: 0,
    asOf: AS_OF,
    securities: { US1: equity("US1", "Alder Holdings"), US2: equity("US2", "Birch Energy"), US3: equity("US3", "Cobalt Foods") },
    fx: { USD: 1, EUR: 1.08, GBP: 1.27, JPY: 0.0067 },
    bookTrades: [],
    // Book: 1,000 x 100 + 10,000 x 50 + 1,000 x 20 = 620,000 of positions, plus 400,000 cash.
    positions: { US1: pos("US1", 1000, 100), US2: pos("US2", 10000, 50), US3: pos("US3", 1000, 20) },
    holdings: { US1: pos("US1", 1000, 102), US2: pos("US2", 10000, 50), US3: pos("US3", 1500, 20) },
    custodianCash: [
      { entryId: "CS000001", valueDate: AS_OF, securityId: "US2", reference: "DV000001", description: "CASH DIVIDEND US2", amount: 30 },
      { entryId: "CS000002", valueDate: AS_OF, securityId: "US3", reference: "CUS000001", description: "BUY 500 US3", amount: -10050 },
    ],
    bookOpeningCash: 400000,
    custodianOpeningCash: 400000,
    priorNavPerShare: 10.2,
    sharesOutstanding: 100000,
    accruedExpenses: 0,
    accruals: [],
    managementFeeRate: 0,
    dailyExpenseBudget: 0,
    planted: [],
  };
}

const caseOn = (cases: Case[], sid: string) => cases.find((c) => c.securityId === sid)!;

describe("ReconPilot engine: generator and matching", () => {
  it("builds the same fund-day from the same seed, and planting one more break leaves the rest alone", () => {
    expect(generateDay(11)).toEqual(generateDay(11));
    const six = generateDay(11);
    const seven = generateDay(11, [...PLANTABLE, "PRICE_MISMATCH"]);
    expect(seven.planted.slice(0, 6)).toEqual(six.planted);
    expect(seven.custodianCash.slice(0, six.custodianCash.length)).toEqual(six.custodianCash);
    expect(new Set(seven.planted.map((p) => p.securityId)).size).toBe(7);
  });

  it("finds no break on an ordinary day: rounding, netting, a missing reference and vendor price noise all match", () => {
    for (const seed of [11, 2, 6]) {
      const run = runDay(generateDay(seed, []));
      expect(run.recon.breaks).toEqual([]);
      expect(run.cases).toEqual([]);
      expect(run.recon.withinTolerance).toHaveLength(2);
      expect(run.recon.matches.length).toBeGreaterThan(0);
    }
    const kinds = new Set([2, 6, 11].flatMap((seed) => runDay(generateDay(seed, [])).recon.matches.map((m) => m.kind)));
    expect(kinds).toEqual(new Set(["EXACT", "TOLERANCE", "ATTRIBUTE", "MANY_TO_ONE"]));
  });

  it("applies the price tolerance by asset class: 15 bp breaks a bond but not an equity", () => {
    const day = tinyDay();
    day.holdings.US1 = { ...day.holdings.US1, price: 100.15 };
    expect(runDay(day).recon.breaks.filter((b) => b.securityId === "US1")).toEqual([]);
    day.securities.US1 = { ...day.securities.US1, assetClass: "BOND" };
    const breaks = runDay(day).recon.breaks.filter((b) => b.securityId === "US1");
    expect(breaks.map((b) => b.kind)).toEqual(["PRICE"]);
  });

  const expected: Record<Exclude<Category, "UNKNOWN">, { kinds: string[]; confidence: number }> = {
    MISSING_TRADE: { kinds: ["QUANTITY", "CASH_MISSING_IN_BOOK"], confidence: 0.9 },
    PRICE_MISMATCH: { kinds: ["PRICE"], confidence: 0.85 },
    STOCK_SPLIT: { kinds: ["QUANTITY", "PRICE"], confidence: 0.95 },
    DIVIDEND: { kinds: ["CASH_MISSING_IN_BOOK"], confidence: 0.9 },
    FX_DIFFERENCE: { kinds: ["CASH_AMOUNT"], confidence: 0.8 },
    TIMING: { kinds: ["QUANTITY", "CASH_MISSING_AT_CUSTODIAN"], confidence: 0.9 },
  };

  for (const category of PLANTABLE) {
    it(`detects a planted ${category.toLowerCase().replace(/_/g, " ")} and names its cause`, () => {
      for (const seed of [11, 3, 42]) {
        const day = generateDay(seed, [category]);
        const run = runDay(day);
        const [planted] = day.planted;
        expect(run.cases).toHaveLength(1);
        const [c] = run.cases;
        expect(c.securityId).toBe(planted.securityId);
        expect(c.category).toBe(category);
        expect(c.confidence).toBe(expected[category as keyof typeof expected].confidence);
        const kinds = run.recon.breaks.filter((b) => c.breakIds.includes(b.id)).map((b) => b.kind);
        expect(kinds).toEqual(expected[category as keyof typeof expected].kinds);
        expect(c.query).toMatch(/^Subject: /);
      }
    });
  }

  it("keeps a late settlement pending at the custodian with the next business day as its value date", () => {
    const run = runDay(generateDay(11, ["TIMING"]));
    expect(run.recon.pending).toHaveLength(1);
    expect(run.recon.pending[0].valueDate).toBe("2026-11-16");
    expect(run.cases[0].explanation).toContain("matches the trade exactly");
  });

  it("finds and names all six planted breaks across many seeds", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      let day: DayData;
      try {
        day = generateDay(seed);
      } catch {
        continue; // a few small universes have no free foreign security for the FX break
      }
      const score = scoreRun(runDay(day));
      expect(score.every((s) => s.found && s.right)).toBe(true);
    }
  });
});

describe("ReconPilot engine: NAV impact and materiality", () => {
  it("sizes each case against NAV in basis points, by hand", () => {
    const run = runDay(tinyDay());
    expect(run.nav.nav).toBe(1_020_000);
    expect(run.nav.navPerShare).toBe(10.2);

    // Custodian prices 1,000 units 2.00 higher: +2,000.00, 19.6078 bp of 1,020,000.
    const price = caseOn(run.cases, "US1");
    expect(price.category).toBe("PRICE_MISMATCH");
    expect(price.navImpact).toBe(2000);
    expect(price.navImpactBp).toBe(19.6078);
    expect(price.material).toBe(true);
    expect(price.escalated).toBe(true);

    // An unbooked dividend of 30.00: 0.2941 bp, below the 1 bp threshold.
    const dividend = caseOn(run.cases, "US2");
    expect(dividend.category).toBe("DIVIDEND");
    expect(dividend.navImpact).toBe(30);
    expect(dividend.navImpactBp).toBe(0.2941);
    expect(dividend.material).toBe(false);

    // A missing buy of 500 at 20.00 settled for 10,050.00: position +10,000, cash −10,050, net −50.
    const missing = caseOn(run.cases, "US3");
    expect(missing.category).toBe("MISSING_TRADE");
    expect(missing.confidence).toBe(0.9);
    expect(missing.navImpact).toBe(-50);
    expect(missing.grossExposure).toBe(20050);
    expect(missing.navImpactBp).toBe(-0.4902);

    // Ranked by absolute impact, largest first.
    expect(run.cases.map((c) => c.securityId)).toEqual(["US1", "US3", "US2"]);
  });

  it("explains the cash gap with the open cash breaks", () => {
    const run = runDay(tinyDay());
    const tie = run.checks.find((c) => c.name === "Cash tie-out")!;
    expect(tie.status).toBe("WARN");
    expect(tie.detail).toContain("leaving 0.00 unexplained");
  });

  it("gives an unapplied split almost no NAV impact", () => {
    const run = runDay(generateDay(11, ["STOCK_SPLIT"]));
    expect(Math.abs(run.cases[0].navImpactBp)).toBeLessThan(0.01);
    expect(run.cases[0].material).toBe(false);
  });
});

describe("ReconPilot engine: review, release and four-eyes", () => {
  const decideAll = (cases: Case[], audit: AuditEntry[], who = ANN) =>
    cases.reduce(
      (state, c) => {
        const out = decide(state.cases, state.audit, who, c.id, "approve");
        return { cases: out.cases, audit: out.audit };
      },
      { cases, audit },
    );

  it("blocks release while cases are pending and lets it through once material ones are approved", () => {
    const run = runDay(generateDay(11));
    expect(releaseStatus(run.cases, run.checks).reasons.map((r) => r.code)).toEqual([
      "PENDING_DECISIONS",
      "MATERIAL_NOT_APPROVED",
      "ESCALATED_NEEDS_APPROVER",
    ]);
    const { cases } = decideAll(run.cases, []);
    expect(releaseStatus(cases, run.checks)).toEqual({ ready: true, reasons: [] });
  });

  it("needs a note to reject, and a rejected material case still blocks release", () => {
    const run = runDay(generateDay(11));
    const material = run.cases.find((c) => c.material)!;
    const bare = decide(run.cases, [], ANN, material.id, "reject");
    expect(bare.ok).toBe(false);
    expect(bare.message).toMatch(/needs a note/);
    expect(bare.audit).toEqual([]);
    const rest = decideAll(run.cases.filter((c) => c.id !== material.id), []);
    const out = decide([...rest.cases, material], rest.audit, ANN, material.id, "reject", { note: "Price confirmed by vendor" });
    expect(out.ok).toBe(true);
    expect(releaseStatus(out.cases, run.checks).reasons.map((r) => r.code)).toEqual(["MATERIAL_NOT_APPROVED"]);
  });

  it("records an analyst's decision on an escalated case but still asks for an approver", () => {
    const run = runDay(generateDay(11));
    const { cases } = decideAll(run.cases, [], PRIYA);
    expect(releaseStatus(cases, run.checks).reasons.map((r) => r.code)).toEqual(["ESCALATED_NEEDS_APPROVER"]);
  });

  it("enforces four eyes: whoever decided cases cannot sign off, a second approver can", () => {
    const run = runDay(generateDay(11));
    const decided = decideAll(run.cases, []);

    const analyst = signOff(decided.cases, run.checks, decided.audit, PRIYA);
    expect(analyst.ok).toBe(false);
    expect(analyst.audit.at(-1)!.action).toBe("PERMISSION_DENIED");

    const own = signOff(decided.cases, run.checks, analyst.audit, ANN);
    expect(own.signedOff).toBe(false);
    expect(own.message).toMatch(/another approver must sign off/);
    expect(own.audit.at(-1)).toMatchObject({ action: "SIGN_OFF_BLOCKED", actor: "Ann Lee", payload: { reasons: ["FOUR_EYES"] } });

    const second = signOff(decided.cases, run.checks, own.audit, TOM);
    expect(second.signedOff).toBe(true);
    expect(second.audit.at(-1)).toMatchObject({ action: "DAY_SIGNED_OFF", actor: "Tom Reed" });
    expect(verifyAudit(second.audit).ok).toBe(true);
  });

  it("remembers every decider: re-deciding someone else's case does not free you to sign", () => {
    const run = runDay(generateDay(11));
    const decided = decideAll(run.cases, []);
    const redo = decide(decided.cases, decided.audit, TOM, run.cases[0].id, "reclassify", { category: "UNKNOWN" });
    expect(redo.cases[0].decidedBy).toEqual(["Ann Lee", "Tom Reed"]);
    expect(redo.cases[0].finalCategory).toBe("UNKNOWN");
    expect(signOff(redo.cases, run.checks, redo.audit, TOM).signedOff).toBe(false);
  });
});

describe("ReconPilot engine: hash-chained audit log", () => {
  it("computes SHA-256 exactly, including multi-block and non-ASCII input", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    for (const text of ["a".repeat(55), "a".repeat(56), "a".repeat(64), "x".repeat(1000), "Tom Reed → “approved” £1,000"]) {
      expect(sha256Hex(text)).toBe(nodeSha(text));
    }
  });

  it("hashes a canonical, key-sorted form of each entry and links it to the previous hash", () => {
    expect(canonicalJson({ b: 1, a: [true, null, "x"], c: { z: 1, y: 2 } })).toBe('{"a":[true,null,"x"],"b":1,"c":{"y":2,"z":1}}');
    let log: AuditEntry[] = [];
    log = appendAudit(log, "Ann Lee", "approver", "DAY_RUN", { cases: 6 });
    log = appendAudit(log, "Ann Lee", "approver", "CASE_APPROVED", { case_id: "EX-20261113-001", note: "" });
    expect(log[0].prev_hash).toBe(GENESIS);
    expect(log[1].prev_hash).toBe(log[0].hash);
    const { hash, ...body } = log[1];
    expect(hash).toBe(recordHash(body));
    expect(hash).toBe(nodeSha(canonicalJson(body)));
    expect(verifyAudit(log)).toEqual({ ok: true, firstBad: null, checked: 2 });
  });

  it("detects an edited, deleted or reordered entry", () => {
    let log: AuditEntry[] = [];
    for (const action of ["DAY_RUN", "CASE_APPROVED", "CASE_REJECTED", "SIGN_OFF_BLOCKED", "DAY_SIGNED_OFF"]) {
      log = appendAudit(log, "Ann Lee", "approver", action, { note: "" });
    }
    expect(verifyAudit(tamperAudit(log, 3))).toEqual({ ok: false, firstBad: 3, checked: 3 });
    expect(verifyAudit([...log.slice(0, 2), ...log.slice(3)]).firstBad).toBe(3);
    expect(verifyAudit([log[0], log[2], log[1], ...log.slice(3)]).firstBad).toBe(2);
    // Re-hashing the edited entry alone does not help: the next link no longer fits.
    const edited = tamperAudit(log, 3);
    const { hash: _old, ...body } = edited[2];
    edited[2] = { ...edited[2], hash: recordHash(body) };
    expect(verifyAudit(edited).firstBad).toBe(4);
  });
});

describe("ReconPilotDemo", () => {
  const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

  it("starts with the day loaded but not run", () => {
    render(<ReconPilotDemo seed={11} />);
    expect(screen.getByRole("region", { name: "ReconPilot demo" })).toBeInTheDocument();
    expect(screen.getAllByText("Not run").length).toBeGreaterThan(0);
    const users = screen.getByRole("group", { name: "Working as" });
    expect(within(users).getByRole("button", { name: /Ann Lee/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("region", { name: /^Case EX-/ })).not.toBeInTheDocument();
  });

  it("runs the pipeline stage by stage, then ranks the cases by NAV impact", () => {
    vi.useFakeTimers();
    render(<ReconPilotDemo seed={11} />);
    click("Run the day");
    expect(screen.getByText("Matching the book against the custodian…", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /^Queue/ })).not.toBeInTheDocument();
    // Each stage schedules the next after it renders.
    for (let step = 0; step < 8; step += 1) {
      act(() => {
        vi.advanceTimersByTime(400);
      });
    }
    const expected = runDay(generateDay(11)).cases;
    const queue = screen.getByRole("list", { name: /^Queue/ });
    const rows = within(queue).getAllByRole("button");
    expect(rows).toHaveLength(expected.length);
    expect(rows[0]).toHaveTextContent(expected[0].id);
    expect(rows[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: `Case ${expected[0].id}` })).toBeInTheDocument();
    expect(screen.getByText("Blocked", { selector: ".rp-pill" })).toBeInTheDocument();
  });

  it("works the queue, is stopped by four eyes, and signs off as the second approver", () => {
    setMotionPaused(true);
    render(<ReconPilotDemo seed={11} />);
    click("Run the day");
    const total = runDay(generateDay(11)).cases.length;

    click("Reject");
    expect(screen.getByText("A rejection needs a note explaining why.")).toBeInTheDocument();

    for (let i = 0; i < total; i += 1) click(/^Approve$/);
    expect(screen.getByText("Ready to sign off", { selector: ".rp-pill" })).toBeInTheDocument();

    click("Sign off NAV as Ann Lee");
    expect(screen.getByText(/Sign-off refused: Ann Lee decided \d+ cases today, so another approver must sign off\./)).toBeInTheDocument();
    click("Switch to Tom Reed, the second approver");
    const users = screen.getByRole("group", { name: "Working as" });
    expect(within(users).getByRole("button", { name: /Tom Reed/ })).toHaveAttribute("aria-pressed", "true");
    click("Sign off NAV as Tom Reed");
    expect(screen.getByText("NAV signed off by Tom Reed. The day is locked.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Approve$/ })).toBeDisabled();

    const log = screen.getByRole("list", { name: /^Audit trail/ });
    expect(within(log).getByText("DAY_SIGNED_OFF")).toBeInTheDocument();
    expect(within(log).getByText("SIGN_OFF_BLOCKED")).toBeInTheDocument();
  });

  it("verifies the audit chain and catches an entry edited in place", () => {
    setMotionPaused(true);
    render(<ReconPilotDemo seed={11} />);
    click("Run the day");
    click(/^Approve$/);
    click("Verify chain");
    expect(screen.getByText(/^Chain intact: 2 entries re-hashed/)).toBeInTheDocument();
    click("Edit an entry in place");
    expect(screen.getByText(/Entry 2 was edited in place/)).toBeInTheDocument();
    click("Verify chain");
    expect(screen.getByText(/^Chain broken at entry 2/)).toBeInTheDocument();
    click("Undo the edit");
    click("Verify chain");
    expect(screen.getByText(/^Chain intact/)).toBeInTheDocument();
  });

  it("plants another break and re-runs the day", () => {
    setMotionPaused(true);
    render(<ReconPilotDemo seed={11} />);
    click("Run the day");
    const before = within(screen.getByRole("list", { name: /^Queue/ })).getAllByRole("button").length;
    fireEvent.change(screen.getByLabelText("Break to plant"), { target: { value: "DIVIDEND" } });
    click("Plant and re-run");
    expect(within(screen.getByRole("list", { name: /^Queue/ })).getAllByRole("button")).toHaveLength(before + 1);
    expect(screen.getByText(/7 breaks planted/)).toBeInTheDocument();
  });
});
