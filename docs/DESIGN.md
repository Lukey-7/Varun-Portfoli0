# Two portfolio directions

## Brief and audit

Audience: engineering hiring teams and potential collaborators. Preserve the existing React 18 / Vite / Tailwind 3 / Framer Motion stack, all historical page routes and the VARUN.DEV wordmark. The user explicitly requested extensive content and visual changes, with two versions.

Original live site: black/cyan, all-monospace typography, glowing centred hero, generic status copy, custom cursor, boxed navigation and abstract page names. The source repository is newer than the deployed page. Keep its functional terminal, skill map and project archive; make the landing experience clearer, quieter and current.

1. Cyan: DESIGN_VARIANCE 7, MOTION_INTENSITY 5, VISUAL_DENSITY 3. Original cyan identity, off-black green neutrals, restrained sculptural hero, generous typography, staggered project grid.
2. ORDO-inspired monochrome: DESIGN_VARIANCE 7, MOTION_INTENSITY 6, VISUAL_DENSITY 3. Uploaded 80-second video is the main reference. Fine structural rules, monospaced hero typography, an interactive knot/sphere/wave particle study and flat project frames. Adapted to a personal portfolio, without copying the reference's brand or product claims.

Theme variants are implemented with scoped CSS custom properties and a manual toggle. Existing source and public URLs remain separate from client descriptions. Client deployments, credentials, addresses and private case-study screenshots are excluded.

## Assets

The original mesh sculpture was generated with the built-in image tool and saved as public/images/mesh-knot.webp. Prompt: 'A premium single metallic ribbon folded into a trefoil knot, dark silver and brushed aluminium, fine wire-mesh surface, neutral studio highlights, subtle cyan edge reflections, isolated on a transparent background, no text or UI.' public/images/mesh-knot-320.webp is a 320px copy for the 160px workflow thumbnail.

The monochrome hero is a real procedural canvas particle study with accessible shape and pause controls. Project visuals are labelled architecture/concept diagrams, not claimed to be product screenshots. Existing lucide-react provides icons. Fonts are self-hosted from installed Fontsource packages.

## Interaction and routes

- Two separate sites from one repository: cyan (src/sites/cyan, port 4173) and monochrome ORDO (src/sites/ordo, port 4175), each built and deployed on its own. The design switch links between them.
- On the cyan site, original /logs, /nexus, /vault and /terminal remain available with their prior functionality; /classic retains the previous home implementation.
- Project case-study dialogs use native modal focus containment and Escape behaviour.
- Workflow tabs and experience disclosure buttons expose their state and relationships.
- Contact links work through mailto; copy email reports success only after clipboard resolution.
- No contact form that pretends to send messages, analytics, trackers or client access links.
- Reduced-motion preference disables moving visuals; animation loops avoid React state and stop expensive drawing offscreen.

## ORDO motion, second pass

Matched to the reference film: the hero morphs between forms until a visitor picks one; tool chips dissolve into pixel noise on hover; six capability cards animate and respond to the pointer; the workflow tours four stages with a progress underline, stopping once a stage is chosen; the black section pins while particles scatter, assemble into the knot and release with scroll, parting around the cursor; a dotted wordmark swells near the pointer. The research section presents the October 2026 proposal as hypotheses, not results. The console reuses the original terminal commands. The cyan edition is unchanged.

## Cyan, second pass

The cyan edition leans on light and control rather than ORDO's mechanism: the knot tilts and its halo follows the pointer; project cards carry a soft cursor light; results animate from baseline to measured value, each labelled with its evaluation set; a signal map wires projects to their tools; the research section lets visitors switch memory strategies on the proposal's own example to see which messages a model would receive (labelled as an illustration, not a result); a command palette (Ctrl/⌘ K or /) recalls the original site's terminal. The palette menu loads on demand.

## Before public release

This is a local review build. The attached resume is the user's existing version and still contains earlier wording; updating it is a separate task. Confirm project links, deployment scope and any public client naming with the user before publishing. No remote push or deployment is part of this work.
