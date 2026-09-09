# Varun Darji — Portfolio

A terminal-flavoured personal portfolio for **Varun Rajesh Darji**, AI/ML Engineer in Mumbai.
Ghost-cyan on near-black, glassmorphic cards, an interactive skill graph, and a working
shell you can actually type résumé commands into.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Framer Motion

---

## Pages

| Route       | Name       | What's there                                                                 |
| ----------- | ---------- | ---------------------------------------------------------------------------- |
| `/`         | **Home**   | Hero, current role, location, education and featured work in a bento grid     |
| `/logs`     | **Logs**   | Professional experience timeline, education, and how I work                   |
| `/nexus`    | **Nexus**  | Project archive — featured builds plus side projects, each with a deep-dive   |
| `/vault`    | **Vault**  | Technical stack as a connected graph (desktop) and grouped grid (mobile)      |
| `/terminal` | **Terminal** | An interactive shell: `about`, `experience`, `skills`, `projects`, `resume` |

### Terminal commands

```
help  about  whoami  experience  education  skills
projects  contact  resume  github  linkedin  email
clear  sudo  exit
```

`Tab` completes a command, `↑` / `↓` walk through history.

---

## Architecture notes

**One source of truth.** Every piece of résumé content — roles, dates, bullet points,
skills, projects, contact details — lives in [`src/data/profile.ts`](src/data/profile.ts).
The pages, the bento cards and the terminal all read from it, so updating a job title
in one place updates it everywhere. Adding a project means appending one object to the
`projects` array; no JSX to touch.

**Mobile is a first-class target, not a media query afterthought.**

- The custom cursor and the mouse-parallax nebula are gated behind
  `(hover: hover) and (pointer: fine)` — touch devices never load the listeners and
  keep every native affordance.
- The project detail view is a centred dialog on desktop and a bottom sheet on phones,
  with scroll locking, `Escape` to dismiss and safe-area padding.
- The skill graph's absolute positioning only renders at `lg` and above. Below that the
  same data appears as a category-grouped grid built for thumbs.
- Terminal input doesn't autofocus on touch, so the keyboard no longer ambushes you on
  page load. Quick-command chips sit above the window on mobile.
- Wide content (ASCII art, command output) scrolls inside its own container. The page
  body never scrolls sideways.
- `prefers-reduced-motion` is respected globally.

**Design tokens.** All colour, glow and glass values are CSS custom properties in
[`src/index.css`](src/index.css), extended into Tailwind via
[`tailwind.config.ts`](tailwind.config.ts). Shared layout primitives — `.page-shell`,
`.bento-card`, `.section-title`, `.glass` — keep spacing consistent across pages.

---

## Getting started

Requires Node 18+.

```bash
git clone https://github.com/Lukey-7/Varun-Portfoli0.git
cd Varun-Portfoli0
npm install
npm run dev
```

The dev server prints a local URL (usually `http://localhost:8080`).

### Scripts

| Command           | Does                                    |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Start the Vite dev server with HMR      |
| `npm run build`   | Production build into `dist/`           |
| `npm run preview` | Serve the production build locally      |
| `npm run lint`    | ESLint across the project               |
| `npm test`        | Run the Vitest suite                    |

---

## Project structure

```
src/
├── data/
│   └── profile.ts        # All résumé content — edit here first
├── components/
│   ├── Navigation.tsx    # Desktop bar + mobile sheet
│   ├── CustomCursor.tsx  # Fine-pointer devices only
│   ├── NebulaBackground.tsx
│   ├── NoiseOverlay.tsx
│   ├── PageTransition.tsx
│   └── ui/               # shadcn/ui primitives
├── hooks/
│   └── use-fine-pointer.ts   # Pointer + reduced-motion media queries
├── pages/
│   ├── Index.tsx  Logs.tsx  Nexus.tsx  Vault.tsx  Terminal.tsx  NotFound.tsx
└── index.css             # Design tokens + shared component classes
```

---

## Updating the content

Open `src/data/profile.ts`:

- **New job** → add an object to `experience` (newest first).
- **New project** → add to `projects`; set `featured: true` to surface it on the home
  page and the top of the Nexus.
- **New skill** → add to `skills` with a `short` code, a `category`, and `connections`
  listing related skill ids. Then add its coordinates to `nodePositions` in
  `src/pages/Vault.tsx` so it appears in the graph.
- **Contact details** → the `profile` object; the terminal and every contact card pick
  the change up automatically.

---

## Contact

- **Email** — varun.darji@somaiya.edu
- **GitHub** — [@Lukey-7](https://github.com/Lukey-7)
- **LinkedIn** — [varun-darji](https://www.linkedin.com/in/varun-darji-5713472a9/)

## License

MIT — see [LICENSE](LICENSE).
