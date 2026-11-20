import { deliveryWork, memoryStrategies, otherWork, research, selectedWork, type CaseStudy } from "@/data/portfolio";
import { experience } from "@/data/profile";

/**
 * Cyan's own wording for text it shares with the monochrome site. Those strings
 * live in src/data and must stay as they are there, so each one is restated here
 * by project or entry id. Anything without an entry falls back to the shared text.
 * Facts stay in src/data: a number changed there has to be changed here too.
 *
 * The example conversation and the summary and records of each memory strategy
 * are left shared on purpose: the token gauge counts their characters.
 */

type CaseText = Pick<CaseStudy, "description" | "problem" | "approach" | "evidence" | "ownership">;

const CASE_TEXT: Partial<Record<string, CaseText>> = {
  studyforge: {
    description:
      "Feed it your lecture notes and it writes a cited textbook and 16 study tools. Its chat points at the exact passage it used.",
    problem:
      "The failure I worry about is a wrong passage at rank 1. The answer then cites the wrong source and still sounds fluent.",
    approach:
      "Dense search and BM25 run side by side and rank fusion merges them. MMR drops near-duplicate chunks, then an LLM reranks what's left. A FastAPI backend generates the cited textbook and the study tools, with each tool's output checked against its schema. When you add a source, only the sections it changes get rewritten. In one run, a second source left 6 of 7 sections untouched.",
    evidence:
      "On 33 labelled questions over three short documents, dense search put the right passage first 27 times (Recall@1 0.82, MRR@10 0.89). Rank fusion and MMR left that count at 27. The LLM rerank layer took it to 33 of 33, with Recall@1 and MRR@10 both at 1.00. The questions and labels were written for the repo and used to compare layers. Nothing was held out, so this is a development check. The repository has 185 tests and Docker CI.",
    ownership:
      "Mine alone, including the Python API, the retrieval pipeline and the evaluation that scores it.",
  },
  fintrack: {
    description:
      "An Android ledger that reads bank SMS on the phone and tells a refund from a transfer. Anything unclear gets parked for review.",
    problem:
      "Every bank words its SMS differently. Count the refunds, the transfers and the second alert for the same payment as spending, and the expense total is fiction.",
    approach:
      "The SMS parser uses no per-bank templates and sorts every transaction into one of seven flows, from expense to settlement, which lets net spend subtract refunds. Two alerts sharing a UPI or IMPS reference count once. So does the same amount, in the same direction, from a different sender within 10 minutes, unless the two references differ. Anything the parser can't place waits in a review queue instead of being guessed. Statement import checks the running balance on every row and can be undone. OCR-assisted bill splitting counts only your share as spend. The interface is Kotlin and Jetpack Compose. Room sits on SQLCipher for encrypted local storage. ML Kit runs the bill OCR on the phone with bundled Latin and Devanagari models.",
    evidence:
      "I shipped 12 releases in a month, v1.0.0 to v1.5.2, with 786 unit tests across them.",
    ownership:
      "There was no team. The parser, data model, interface and tests are my code.",
  },
  mara: {
    description:
      "Five agents research a question together. A note survives only if its quote appears word for word in the source it cites.",
    problem:
      "Several agents on one question can produce a confident write-up with no idea where each claim came from. A sixth agent wouldn't fix that.",
    approach:
      "A planner, researcher, summariser, critic and writer share one state object, with a trace for every run. They retrieve through hybrid search and a cross-encoder reranker. Every note carries a quote. A note whose quote isn't in the cited chunk gets thrown out, which makes citation validity 1.0 by construction.",
    evidence:
      "On 35 labelled queries over 317 chunks, hybrid search with cross-encoder reranking moved Recall@5 from 0.857 to 0.929 and MRR@10 from 0.809 to 0.871 against a dense-only baseline. The reranker costs about 1.8 s per query on a CPU. The answer evaluation includes one deliberately unanswerable question. Every model replied that no evidence was found. The 112 tests run with a fake LLM, fake embeddings and fakeredis.",
    ownership: "The quote check was mine to get right, along with the agent orchestration and retrieval.",
  },
  axiomquant: {
    description:
      "A C++20 backtester that fills each order at the next bar's open and can limit a strategy to whatever was in the index that day.",
    problem:
      "Cross-sectional momentum returned +957.7% on five symbols picked with hindsight (four stocks and SPY) and +106.6% on the point-in-time S&P 500 over the same 11.5 years. The second run could rank a stock only on days it was really in the index.",
    approach:
      "In this event-driven backtester, an order placed on one bar fills at the next bar's open. The execution model charges commission, half the spread, slippage and square-root market impact. In the S&P 500 study, an index-membership calendar keeps the universe point-in-time, so a strategy can't hold tomorrow's winners. Walk-forward testing of an SMA crossover on 11.7 years of SPY, over 19 folds, put mean Sharpe at 1.03 in sample and 0.38 out of sample. Block-bootstrap intervals and deflated Sharpe test whether a result is more than luck. A Python notebook drives the C++ core through pybind11 bindings.",
    evidence:
      "The S&P 500 study covers 2,942 trading days across 606 assets. Missing prices for 166 past members still flatter any strategy that would have held them. CI cross-checks the portfolio optimiser against cvxpy to 1e-8. That check caught a real risk-parity bug. 89 C++ test cases run on Linux GCC, macOS Clang, Windows MSVC and a sanitizer build, with 34 Python tests on Linux. Historical research results are not investment recommendations.",
    ownership:
      "My own engineering and research project. I wrote the C++ numerical core, the Python integration and the validation around them.",
  },
  reconpilot: {
    description:
      "It checks a fund's books against the custodian's statements and sizes every disagreement in basis points of NAV. Whoever decided the day's cases can't be the one who releases the NAV.",
    problem:
      "Every business day, a fund administrator lines up the fund's own trades and positions against the custodian's holdings and cash statements. Anything that disagrees is a break. Each break needs a size against the NAV, an explanation and a sign-off before the NAV can go out.",
    approach:
      "The matching is deterministic. Rules compare positions and cash with a tolerance per asset class, group breaks into cases and size each case against the NAV. Open cases age and escalate from one day to the next until they clear. An optional LLM second opinion explains a case using its real figures and drafts the query to the custodian. It can't change a figure or close a case, and if its answer fails the schema check, the rules' own explanation stands. A person decides every case, a second approver releases the NAV, and each step goes into a hash-chained audit log. The web app is React on a FastAPI and PostgreSQL backend, and the four-eyes rule is enforced on the server and in the database.",
    evidence:
      "The synthetic data has 200 planted breaks over 20 business days. The rules found 190 and named the right cause for 178. With the second opinion beside them, the cause was right for all 190. Detection stayed at 190 because the model never raises a case. There are 404 Python tests, 120 for the engine and 284 for the web layer against a real PostgreSQL, plus 25 Playwright journeys.",
    ownership:
      "I built it on my own, from the reconciliation engine and its controls to the web app and the evaluation.",
  },
  "inventory-rl": {
    description:
      "A simulated shop where a PPO agent learns when to reorder stock. It's scored against the textbook (s, S) rule on seeds it never trained on.",
    problem:
      "The shop orders stock every day and deliveries take days to arrive. Run short and customers leave; overstock and the shelves cost money. The classic (s, S) rule already handles this well, so I wanted to know whether reinforcement learning could find anything better.",
    approach:
      "The Gymnasium environment has lost sales, an order lead time and a weekly demand cycle, at three difficulty settings. The hard one has a four-day lead time and a high fixed cost per order. A random policy, an (s, S) rule tuned by grid search and PPO from Stable-Baselines3 face identical customers on held-out seeds. PPO is trained three times per setting. In the Streamlit dashboard you can watch any policy, race two on the same days or run the shop yourself.",
    evidence:
      "Over 30 held-out seeds, PPO beat the tuned (s, S) rule only on the hard setting, by about 3% of cost (81.5 ± 26.4 units per 100 days), with all three training seeds ahead. It tied on medium. On easy it was about 1% worse, where (s, S) is already close to the right answer. My best guess at the reason is the weekly demand cycle, which a single fixed (s, S) pair can't follow. Demand is simulated and costs are in the environment's own units.",
    ownership:
      "Everything in it is mine: the environment, the baselines, the training runs, the evaluation and the dashboard.",
  },
};

const OTHER_WORK_TEXT: Partial<Record<string, string>> = {
  language:
    "German from A0 to B2. FSRS brings each word back just before it's likely to slip. Gemini runs the practice and feedback server-side.",
  tetris:
    "Tetris in five modes and a Galaga-style shooter, in plain JavaScript. There isn't a single audio file in it. Every sound is synthesised.",
  game: "An LLM game master, and my experiment in stopping it from losing the plot halfway through a tabletop campaign.",
};

const DELIVERY_TEXT: Partial<Record<string, string>> = {
  "Lead-generation platform":
    "Webex is LetsTute's lead-generation platform. I've worked on its agent workflows, retrieval and evaluation. Its supervisor and worker agents run inside token budgets and guardrails.",
  "ERP intelligence":
    "I lead implementation and testing of the AI features on a secured client ERP. Bills go through OCR on a self-hosted vision model, an LLM extracts the fields, validation checks them, and the assistant cites its sources.",
  "Enterprise ERP & deployment":
    "I'm building the iOS app for an enterprise ERP solution with AI integrations and deploying its containerised services on GCP. I'm learning AWS deployments for clients on the job.",
};

/** Whole lists, because a job's bullets are written as a set. LetsTute shows `deliveryWork` instead. */
const JOB_HIGHLIGHTS: Partial<Record<string, string[]>> = {
  techit: [
    "I wrote and maintained Java and Spring Boot services and REST APIs for a fintech platform.",
    "I wired in the PayPal AddTracking API for shipment and order tracking.",
  ],
  somaiya: [
    "I automated administrative workflows. By my own rough timing they took about 30% less manual effort, with about 20% fewer data errors than earlier staff reports.",
    "Each semester I managed and validated 500+ numerical and alphanumeric records.",
  ],
};

/** "window" has no entry: the shared note already names the message that gets lost. */
const STRATEGY_NOTES: Partial<Record<string, string>> = {
  full: "All 11 messages go out, including the formal tone from #1 that #3 overruled. The prompt grows with every turn.",
  summary:
    "Two messages and one line of summary. The line says formal and friendly at once, because compression can fuse an instruction with its replacement.",
  adaptive:
    "In this example, the policy I proposed sends recent messages plus four constraint records with their revision history. The tone record knows friendly replaced formal. Whether that upkeep pays for itself is the untested hypothesis.",
};

export const cyanWork = selectedWork.map((project) => ({ ...project, ...CASE_TEXT[project.id] }));

export const cyanOtherWork = otherWork.map((project) => ({
  ...project,
  description: OTHER_WORK_TEXT[project.kind] ?? project.description,
}));

export const cyanDeliveryWork = deliveryWork.map((item) => ({
  ...item,
  text: DELIVERY_TEXT[item.title] ?? item.text,
}));

export const cyanExperience = experience.map((job) => ({
  ...job,
  highlights: JOB_HIGHLIGHTS[job.id] ?? job.highlights,
}));

export const cyanMemoryStrategies = memoryStrategies.map((strategy) => ({
  ...strategy,
  note: STRATEGY_NOTES[strategy.id] ?? strategy.note,
}));

export const cyanRetryStudy = {
  ...research.studies[1],
  summary: "A retry costs money and can wreck a correct answer, so it should run only when it's likely to help.",
  question:
    "After a low-budget answer, the system either returns it or pays for one higher-budget attempt. My proposed retry rule weighs the odds of a better answer against the extra spend.",
};
