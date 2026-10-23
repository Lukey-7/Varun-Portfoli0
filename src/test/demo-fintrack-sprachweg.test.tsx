import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import FinTrackDemo from "@/sites/ordo/demos/FinTrackDemo";
import SprachwegDemo from "@/sites/ordo/demos/SprachwegDemo";
import {
  DEFAULT_WEIGHTS,
  dueQueue,
  formatInterval,
  initialDifficulty,
  nextInterval,
  nextState,
  previewReview,
  retrievability,
  type Grade,
  type MemoryState,
} from "@/sites/ordo/demos/fsrs";
import {
  SAMPLE_INBOX,
  formatInr,
  parseSms,
  processInbox,
  summarise,
  type SmsMessage,
} from "@/sites/ordo/demos/sms";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const intervals = (options: ReturnType<typeof previewReview>) =>
  ([1, 2, 3, 4] as Grade[]).map((grade) => options[grade].interval);

// Expected values were computed separately, straight from the published
// formulas, rather than taken from this module's own output.
describe("FSRS-4.5 scheduler", () => {
  it("uses the FSRS-4.5 forgetting curve: recall is 90% after S days", () => {
    expect(retrievability(0, 3.7)).toBe(1);
    expect(retrievability(12, 12)).toBeCloseTo(0.9, 12);
    expect(retrievability(4, 3.7145)).toBeCloseTo(0.8935, 4);
    expect(nextInterval(14.8081)).toBe(15);
    expect(nextInterval(0.4872)).toBe(1);
    expect(nextInterval(1e9)).toBe(36500);
  });

  it("schedules a new card from the default weights", () => {
    expect(DEFAULT_WEIGHTS).toHaveLength(17);
    const first = previewReview(null, 0);
    expect(intervals(first)).toEqual([1, 1, 4, 14]);
    expect(first[3].state.stability).toBe(3.7145);
    expect(([1, 2, 3, 4] as Grade[]).map((grade) => initialDifficulty(grade))).toEqual([
      expect.closeTo(7.6214, 4),
      expect.closeTo(6.3916, 4),
      expect.closeTo(5.1618, 4),
      expect.closeTo(3.932, 4),
    ]);
  });

  it("grows the interval when a due card is rated Good on time", () => {
    let state: MemoryState | null = null;
    let interval = 0;
    const seen: number[] = [];
    for (let review = 0; review < 5; review += 1) {
      const option = previewReview(state, interval)[3];
      state = option.state;
      interval = option.interval;
      seen.push(interval);
    }
    expect(seen).toEqual([4, 15, 49, 146, 393]);
    expect(state?.difficulty).toBeCloseTo(5.1618, 4);
  });

  it("updates stability and difficulty for every rating of a review card", () => {
    const afterGood = nextState(null, 3, 0);
    const options = previewReview(afterGood, 4);
    expect(intervals(options)).toEqual([1, 6, 15, 36]);
    expect(options[1].state.stability).toBeCloseTo(1.43323, 4);
    expect(options[1].state.difficulty).toBeCloseTo(6.90116, 4);
    expect(options[2].state.stability).toBeCloseTo(6.23497, 4);
    expect(options[3].state.stability).toBeCloseTo(14.8081, 4);
    expect(options[4].state.stability).toBeCloseTo(35.61415, 4);
    expect(options[4].state.difficulty).toBeCloseTo(4.29212, 4);
  });

  it("keeps Hard ≤ Good < Easy when rounding collides, and clamps difficulty", () => {
    const options = previewReview({ stability: 0.1, difficulty: 10 }, 1);
    expect(intervals(options).slice(1)).toEqual([1, 2, 3]);
    let hard: MemoryState = { stability: 2, difficulty: 9.9 };
    let easy: MemoryState = { stability: 2, difficulty: 1.1 };
    for (let i = 0; i < 20; i += 1) {
      hard = nextState(hard, 1, 1);
      easy = nextState(easy, 4, 1);
    }
    expect(hard.difficulty).toBeLessThanOrEqual(10);
    expect(easy.difficulty).toBeGreaterThanOrEqual(1);
  });

  it("queues due reviews first, then new cards, and can bring one card forward", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const schedule = { a: { due: 4 }, b: { due: 9 }, c: { due: 2 } };
    expect(dueQueue(items, schedule, 5).map((item) => item.id)).toEqual(["c", "a", "d"]);
    expect(dueQueue(items, schedule, 5, "d").map((item) => item.id)).toEqual(["d", "c", "a"]);
    expect(formatInterval(1)).toBe("1 day");
    expect(formatInterval(146)).toBe("5 months");
    expect(formatInterval(393)).toBe("1.1 years");
  });
});

describe("FinTrack demo parser", () => {
  const entries = processInbox(SAMPLE_INBOX);
  const byId = Object.fromEntries(entries.map((entry) => [entry.message.id, entry]));

  it("gives every synthetic message a flow, or says why it has none", () => {
    expect(
      Object.fromEntries(entries.map((entry) => [entry.message.id, entry.parsed.flow ?? entry.status])),
    ).toEqual({
      salary: "income",
      sip: "investment",
      cafe: "expense",
      "cafe-app": "expense",
      groceries: "expense",
      refund: "refund",
      transfer: "transfer",
      atm: "cash",
      split: "settlement",
      otp: "ignored",
      unclear: "review",
    });
    expect(byId.cafe.parsed).toMatchObject({
      amount: 349,
      direction: "out",
      counterparty: "CAFE LUMEN",
      reference: { kind: "UPI", value: "627913550421" },
      account: "XX1234",
    });
    expect(byId.cafe.parsed.reasons[0]).toBe("Matched 'debited' → money out");
    expect(byId.refund.parsed.reasons).toContain("Matched 'Refund' → refund");
    expect(byId.transfer.parsed.reasons).toContain("XX5678 is one of your accounts → transfer");
    // The available balance is never read as the payment.
    expect(byId.salary.parsed.amount).toBe(82500);
    expect(byId.otp.parsed.reasons[0]).toMatch(/^Matched 'OTP'/);
    expect(byId.unclear.parsed.reasons[0]).toMatch(/direction is unclear/);
  });

  it("counts a payment alerted by two senders once, by reference and by time", () => {
    expect(byId["cafe-app"]).toMatchObject({ status: "duplicate", duplicateOf: 3 });
    expect(byId["cafe-app"].duplicateReasons).toEqual([
      "Same UPI Ref 627913550421 as message 03",
      "Same ₹349 from a different sender, 1 min after message 03",
    ]);
    const alert = (id: string, sender: string, receivedAt: string): SmsMessage => ({
      id,
      sender,
      receivedAt,
      body: "Rs 120.00 debited from A/c XX1234 to VPA kiosk@okbank (TEA KIOSK).",
    });
    const status = (messages: SmsMessage[]) => processInbox(messages).map((entry) => entry.status);
    expect(status([alert("a", "AX-ONE", "2026-10-02T10:00"), alert("b", "JM-TWO", "2026-10-02T10:09")])).toEqual([
      "counted",
      "duplicate",
    ]);
    expect(status([alert("a", "AX-ONE", "2026-10-02T10:00"), alert("b", "JM-TWO", "2026-10-02T10:11")])).toEqual([
      "counted",
      "counted",
    ]);
    // Two real purchases from the same sender are not merged.
    expect(status([alert("a", "AX-ONE", "2026-10-02T10:00"), alert("b", "AX-ONE", "2026-10-02T10:02")])).toEqual([
      "counted",
      "counted",
    ]);
  });

  it("subtracts refunds for net spend and applies review decisions", () => {
    expect(summarise(entries)).toMatchObject({
      income: 82500,
      spending: 2689,
      refunds: 499,
      netSpend: 2190,
      outside: { transfer: 10000, investment: 5000, cash: 3000, settlement: 850 },
      counted: 8,
      duplicates: 1,
      ignored: 1,
      pending: 1,
    });
    expect(summarise(entries, { unclear: "expense" })).toMatchObject({ spending: 3839, netSpend: 3340, pending: 0 });
    expect(summarise(entries, { unclear: "dismissed" })).toMatchObject({ netSpend: 2190, ignored: 2, pending: 0 });
  });

  it("reads other common formats and skips what is not a payment", () => {
    const twoSided = parseSms("Acct XX1234 debited for Rs 640.00 on 19-Oct-26; QUICKSHIP LOGISTICS credited. UPI:629355102938.");
    expect(twoSided).toMatchObject({ kind: "transaction", direction: "out", flow: "expense", counterparty: "QUICKSHIP LOGISTICS" });
    expect(parseSms("Dear UPI user A/C X1234 debited by 250.0 on 03Oct26 trf to CORNER STORE Refno 427612345678.").amount).toBe(250);
    expect(parseSms("RAHUL K has requested Rs 1,200.00 from you.").ignoredAs).toBe("Payment request");
    expect(parseSms("Rs.5,000.00 will be debited from A/c XX1234 on 03-Nov-26 for your SIP.").ignoredAs).toBe("Reminder");
    expect(parseSms("Flat Rs.500 cashback on orders above Rs.2,999! Use code FEST500.").ignoredAs).toBe("Promotion");
    // Both words tied to accounts: the debit is yours, the credit lands in your other account.
    expect(parseSms("Rs 500.00 debited from A/c XX1234; Rs 500.00 credited to A/c XX5678.").flow).toBe("transfer");
    // Both words and no account to tie either to: held for review, not guessed.
    const untied = parseSms("Paid Rs 500.00 to ASHA. Received Rs 500.00 from ASHA.");
    expect(untied.kind).toBe("review");
    expect(untied.reasons[0]).toBe("Found both 'Paid' and 'Received', and neither is tied to your account");
    const { marks } = parseSms(SAMPLE_INBOX[2].body);
    marks.slice(1).forEach((mark, i) => expect(mark.start).toBeGreaterThanOrEqual(marks[i].end));
    expect(formatInr(102345.5)).toBe("₹1,02,345.50");
  });
});

// Role queries are slow in jsdom; allow for a busy machine.
describe("demo interactions", { timeout: 20_000 }, () => {
  it("FinTrack: processes the inbox, merges the duplicate and updates totals from the review queue", () => {
    vi.useFakeTimers();
    render(<FinTrackDemo />);
    fireEvent.click(screen.getByRole("button", { name: "Process inbox" }));
    expect(screen.getByText("Reading the inbox…")).toBeInTheDocument();
    // One message per timer step; the button reads "Replay" once all are read.
    for (let step = 0; step < 30 && !screen.queryByText("Replay"); step += 1) {
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }
    expect(screen.getByText("Replay")).toBeInTheDocument();
    const ledger = screen.getByRole("group", { name: "Ledger" });
    expect(within(ledger).getByText("Net spend = spending ₹2,689 − refunds ₹499 = ₹2,190")).toBeInTheDocument();
    expect(screen.getByText(/8 counted · 1 duplicate · 1 ignored · 1 to review/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Message 4:/ }));
    const detail = screen.getByRole("region", { name: "Parsed message" });
    expect(within(detail).getByText("Duplicate of message 03 · counted once")).toBeInTheDocument();
    expect(within(detail).getByText("Same UPI Ref 627913550421 as message 03")).toBeInTheDocument();

    const queue = screen.getByRole("group", { name: "Needs review · 1" });
    fireEvent.click(within(queue).getByRole("button", { name: "Add as expense" }));
    expect(within(queue).getByRole("button", { name: "Add as expense" })).toHaveAttribute("aria-pressed", "true");
    expect(within(ledger).getByText("Net spend = spending ₹3,839 − refunds ₹499 = ₹3,340")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try your own message" }));
    fireEvent.change(screen.getByLabelText("Paste or type a bank SMS"), {
      target: { value: "Rs 75.00 debited from A/c XX1234 to VPA chai@okbank (TEA KIOSK). UPI Ref 629400112233" },
    });
    const result = screen.getByRole("region", { name: "Your message, parsed" });
    expect(within(result).getByText("Would count · Expense")).toBeInTheDocument();
    expect(within(result).getByText("TEA KIOSK", { selector: "dd" })).toBeInTheDocument();
  });

  it("Sprachweg: flips, rates with a key, and shows the interval growing on the due day", () => {
    render(<SprachwegDemo />);
    const good = () => screen.getByRole("button", { name: /^Good/ });
    expect(good()).toBeDisabled();
    expect(good()).toHaveTextContent("4 days");
    expect(screen.getByRole("button", { name: /^Easy/ })).toHaveTextContent("14 days");

    const card = screen.getByRole("button", { name: /What is the German for the railway station/ });
    fireEvent.click(card);
    expect(card).toHaveAccessibleName(/der Bahnhof/);
    expect(good()).toBeEnabled();
    fireEvent.keyDown(card, { key: "3" });

    // The next card takes focus, and the rated one is scheduled four days out.
    expect(screen.getByRole("button", { name: /What is the German for the flat/ })).toHaveFocus();
    expect(screen.getByText("3.7 days")).toBeInTheDocument();
    expect(screen.getByText(/100% now · 89% on day 4/)).toBeInTheDocument();
    expect(screen.getByText("Day 4 · in 4 days")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review again on day 4" }));
    expect(screen.getByText(/Day 4 · review · last seen day 0, 4 days ago · recall now 89%/)).toBeInTheDocument();
    expect(good()).toHaveTextContent("15 days");
    fireEvent.click(screen.getByRole("button", { name: /What is the German for the railway station/ }));
    fireEvent.click(good());
    expect(screen.getByText(/Intervals so far: 4 → 15 days/)).toBeInTheDocument();
    expect(screen.getByText("Day 19 · in 15 days")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(screen.getByText("Day 0 · new card · 8 due")).toBeInTheDocument();
  });
});
