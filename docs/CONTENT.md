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
| The private CV at `/cv` (multi-page site) | Built from `src/data/profile.ts` and `selectedWork` in `src/data/portfolio.ts` by `src/sites/ordo/cv/cvDocument.ts`; see [The private CV](#the-private-cv) |
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

## The private CV

`/cv` shows a one-page CV to the people you give a passphrase to. The build encrypts it (AES-GCM 256, with the key derived from the passphrase by PBKDF2-SHA256 at 600,000 iterations) and the visitor's browser decrypts it, so the page source, crawlers and scrapers only ever get ciphertext. It has no phone number: email, GitHub and LinkedIn only. It is not in the navigation or the sitemap, robots.txt disallows it, and both the page and its response headers ask search engines not to index it. The public résumé PDF on the About page is separate and unchanged.

The content comes from `profile`, `experience`, `education` and `skills` in `src/data/profile.ts` and `selectedWork` in `src/data/portfolio.ts`, so it changes with the rest of the site. To change what the CV includes, edit `buildCvDocument` in `src/sites/ordo/cv/cvDocument.ts`. Only `vite.config.ts` may import that file; if the app imported it, the CV would ship unencrypted.

The passphrase is the `CV_PASSPHRASE` environment variable, read at build time only. Without it the build still works and `/cv` says "This page is not set up."

- **Locally:** add `CV_PASSPHRASE="your passphrase"` to `.env.local` in the repo root (git ignores `*.local` files), or run `CV_PASSPHRASE="your passphrase" npm run build:ordo`. Then run `npm run preview:ordo` and open `http://127.0.0.1:4176/cv`. `npm run dev:ordo` reads `.env.local` too.
- **On Vercel:** Project Settings → Environment Variables → add `CV_PASSPHRASE` for Production (and Preview if you want the CV there), marked Sensitive, then redeploy. The CV is encrypted during the build, so a new passphrase or a change to the CV only takes effect with a new deployment.
- Never call it `VITE_CV_PASSPHRASE` or pass it through `define`: Vite copies those into the JavaScript, and the passphrase would ship with the ciphertext.
- Use a long passphrase, such as five random words. The ciphertext is public, so anyone can try guesses against it offline; the 600,000 iterations make each guess slow, not impossible.
- Share it directly, in person or in a private message, never on a public page.

**The honest limit:** the encryption keeps the CV from bots, scrapers and anyone without the passphrase. Anyone you give the passphrase to can read, screenshot, copy, print or forward the CV once it is unlocked, and no website can prevent that. A new passphrase protects new deployments only: a copy someone saved, or an older deployment that is still online, still opens with the old one.
