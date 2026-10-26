# Varun Darji portfolio

Two separate portfolio sites, cyan and monochrome (ORDO), built from one React 18, TypeScript and Vite repository. Each has its own app, styles, dev server, build output and deployment, so either can change without touching the other. **The multi-page monochrome site is the one to deploy.**

## Sites

| Site | Develop | Build output | Preview |
| --- | --- | --- | --- |
| Cyan | `npm run dev:cyan` → 127.0.0.1:4173 | `dist/cyan` | `npm run preview:cyan` → :4174 |
| Monochrome (ORDO) | `npm run dev:ordo` → 127.0.0.1:4175 | `dist/ordo` | `npm run preview:ordo` → :4176 |

Run `npm ci` first. `npm run dev` starts the cyan site; `npm run build` builds both.

**Cyan** (`src/sites/cyan`): pointer-lit hero, case studies, results with their scope, signal map, interactive research explainer and a command palette (Ctrl/⌘ K or /). It keeps the original pages: `/nexus` (project archive), `/logs`, `/vault` (skill map), `/terminal` and `/classic`. `/ordo` redirects to the monochrome site.

**Monochrome** (`src/sites/ordo`): a multi-page site following the ORDO reference film.
- `/` is the landing page: interactive hero shape, AI capability grid, project grid, GitHub activity, the process loop, the particle system, research teaser, console and the latest journey entries.
- `/work/<project>` has screenshots, the idea, a working in-browser demo, then the details.
- `/research` holds the proposal, interactive versions of both studies, and my research interests.
- `/journey` is a dated log, `/writing` holds write-ups, `/about` covers experience, education and toolbox, and `/play` runs the arcade.
- Unknown paths show its own 404.

Both have a light/dark toggle and respect reduced-motion preferences. The bottom-right design switch links to the other site.

### How the split works

- `vite.config.ts` reads the Vite mode (`cyan` by default, or `ordo`). It points the `@site` alias at `src/sites/<site>`, and sets the port, output folder and page title, description and theme colour.
- `src/main.tsx` renders `@site/App`, so each build contains only its own site.
- Each site has its own stylesheet: `src/sites/cyan/cyan.css`, and `src/sites/ordo/base.css` plus `ordo.css`.
- Shared on purpose: content in `src/data`, the terminal commands, `src/lib` helpers, and the case-study dialog and project diagrams in `src/components/portfolio`.

### Deploying

Deploy the monochrome site. On Vercel, create a project from this repository with:

| Setting | Value |
| --- | --- |
| Branch | this branch, or `main` once it is merged |
| Build command | `npm run build:ordo` |
| Output directory | `dist/ordo` |
| Environment variable | `SITE_URL`: the public address, e.g. `https://your-domain` |

`SITE_URL` goes into every page's canonical link and share image URL. Without it the build falls back to `VITE_ORDO_URL`, then to Vercel's production domain.

**Share previews.** Link previews (LinkedIn, WhatsApp, Slack, X) don't run JavaScript, so the build writes one HTML file per page with its own title, description and image, plus `sitemap.xml`, `robots.txt` and a `404.html` that boots the app. The page list lives in `src/sites/ordo/share.ts`; `vercel.json` routes each page to its file and everything else to the app. The images are in `public/og`: after changing a page's title, description or first screenshot, run `npm run og` (uses a local Chrome or Edge; set `CHROME_PATH` if it's elsewhere) and commit the new images.

**Second site (optional).** The cyan site builds with `npm run build:cyan` into `dist/cyan`. If you deploy it too, set `VITE_CYAN_URL` and `VITE_ORDO_URL` in both projects so the sites link to each other. Locally they default to 127.0.0.1:4173 and :4175.

## Content

- `src/data/profile.ts`: contact, work history, education and skills. Archive projects are derived from curated portfolio data.
- `src/data/portfolio.ts`: case-study narratives, public project links, personal projects, client-work summaries, AI capabilities and the research proposal.
- `src/lib/terminal-commands.ts`: command set shared by the cyan `/terminal` page and the ORDO console.
- `public/Varun-Darji-Resume.pdf`: supplied resume, unchanged.
- `src/sites/ordo/projectShowcase.ts`: the monochrome site's project galleries and verified highlights. Screenshots in `public/projects` come from each project's own repository and show demo or synthetic data only.
- `public/play/arcade`: a playable copy of Lukey Arcade (Tetris-89 and Star Vanguard) from the public Lukey-tetris repository, without its service worker. See its README to update it.
- `src/sites/ordo/content.ts`: every heading and intro on the monochrome site, plus the last-updated date.
- `src/sites/ordo/journey.ts` and `writing.ts`: the journey log and write-ups. `docs/CONTENT.md` explains how to add to them.
- `docs/DESIGN.md`: reference analysis, design decisions and generated artwork prompt.

Sprachweg is listed as a personal project. Its former public GitHub URL returned 404, so it opens an internal project detail without a broken source link on both sites. Other project repositories are public. Diagrams are conceptual illustrations, not product screenshots. Evaluation numbers retain their dataset scope.

Client systems remain private: no credentials, deployment URLs, client source or client data are included. Descriptions distinguish extending an existing platform from owning the whole platform.

## Checks

```sh
npx tsc -p tsconfig.app.json --noEmit
npm run lint
npm test -- --maxWorkers=1
npm run build
npm run preview:cyan
npm run preview:ordo
```

Interaction tests cover case-study opening/closing, workflow keyboard navigation, mobile navigation, appearance switching, clipboard success/failure and employment disclosures. Legacy pages load on demand. Unused starter providers no longer inflate the landing-page bundle.

Not deployed yet. See Deploying above.

## Contact

[varun.darji07@gmail.com](mailto:varun.darji07@gmail.com) · [GitHub](https://github.com/Lukey-7) · [LinkedIn](https://www.linkedin.com/in/varun-darji-5713472a9/)

MIT. See `LICENSE`.
