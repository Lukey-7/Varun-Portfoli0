# Updating the site's content

Words, facts and numbers each have one home, so a change in one place shows up everywhere it is used.

| What you want to change | File |
| --- | --- |
| Headings, intros and the hero on the monochrome site | `src/sites/ordo/content.ts` |
| Roles, education, skills, contact details | `src/data/profile.ts` |
| Project descriptions, case-study text, AI capability cards, research proposal | `src/data/portfolio.ts` |
| Each project's pitch line, screenshots, checked numbers and notes (monochrome site) | `src/sites/ordo/projectShowcase.ts` |
| GitHub activity snapshot | run `npm run sync:github` (needs the `gh` CLI signed in as the owner of the profile) |
| Terminal commands | `src/lib/terminal-commands.ts` (reads the data files above) |
| Project demos | `src/sites/ordo/demos/<Project>Demo.tsx`, registered in `demos/ProjectDemo.tsx` |

`src/data` is shared by both sites; `src/sites/ordo/*` is monochrome only.

## Writing rules

- Say what you built, for whom, and what changed because of it. If the sentence would fit anyone else's portfolio, rewrite it.
- A heading has two lines: the claim, then its context. The second line renders muted.
- Every number carries its scope: "Recall@1 1.00 on 33 labelled queries", not "100% recall".
- Don't use a number that needs an explanation to impress. Test counts belong in the details, not the headline.
- Client work: name your part and the stack, never the client's data or private details.
- Research is a proposal until there are results. Say "hypothesis" and "will test", never "shows".
- Demos run in the browser and are simplified. Each one says what it leaves out.
- British spelling (organised, summariser).

## Adding a project

1. Add it to `selectedWork` in `src/data/portfolio.ts` (facts, problem, approach, evidence, ownership).
2. Add its pitch, screenshots and highlights to `projectShowcase.ts`; put images in `public/projects/`.
3. Optional: add `src/sites/ordo/demos/<Name>Demo.tsx` wrapped in `DemoFrame`, then map the project id to it in `demos/ProjectDemo.tsx`.
4. If an AI capability card should point at it, set that card's `target` in `aiCapabilities`.
