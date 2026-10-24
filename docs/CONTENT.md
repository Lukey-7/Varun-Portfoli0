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
| Journey log (multi-page site) | `src/sites/ordo/journey.ts`, one entry per line, newest first |
| Write-ups (multi-page site) | `src/sites/ordo/writing.ts` |
| Research log on `/research` (multi-page site) | `src/sites/ordo/researchLog.ts`, one entry per line, newest first; its heading and intro are `researchLog` in `src/sites/ordo/content.ts` |
| Share previews: page titles, descriptions, images | `src/sites/ordo/share.ts`, then `npm run og` |
| "Last updated" date | `UPDATED` at the top of `src/sites/ordo/content.ts` |

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

## Keeping it current

Every time something ships, starts or changes:
1. Add a line to the top of `journey.ts`: a date (`"2026-11"`), a kind (work, project, research, writing, education or site), a title and, if there is one, a link.
2. Change `UPDATED` in `content.ts`.
3. If a page's title or description changed, run `npm run og` and commit the new images.

## Adding a write-up

Add an entry to `posts` in `writing.ts`: a slug, a two-line title, a date, a one-sentence summary and the body as blocks (`p`, `h2`, `list`, `table`, `bars`). Set `project` to a project's slug and its page links to the write-up. It gets its own share preview automatically; run `npm run og` for the image, and add a journey entry.

## Adding to the research log

Add an entry to the top of `researchLog` in `researchLog.ts` (a commented example sits below the list): a date (`"2026-11"`, or just `"2026"`), a kind (`proposal`, `write-up`, `reading` or `experiment`), a title and, if you want them, one sentence of `text` and a link. Use `to` for a page on this site (a write-up, or `#studies`) and `href` for anywhere else. Leave out any field you do not have; nothing is drawn for it. Only log what is done: something read, run or written, with the date it happened. The log lives at `/research#research-log`.

## Adding a project

1. Add it to `selectedWork` in `src/data/portfolio.ts` (facts, problem, approach, evidence, ownership).
2. Add its pitch, screenshots and highlights to `projectShowcase.ts`; put images in `public/projects/`.
3. Optional: add `src/sites/ordo/demos/<Name>Demo.tsx` wrapped in `DemoFrame`, then map the project id to it in `demos/ProjectDemo.tsx`.
4. If an AI capability card should point at it, set that card's `target` in `aiCapabilities`.
