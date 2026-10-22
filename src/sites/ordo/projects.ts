import {
  otherWork,
  selectedWork,
  sprachwegCase,
  type CaseStudy,
} from "@/data/portfolio";
import { tetrisCase } from "./projectShowcase";

/** How a project's animated icon is drawn (see ProjectArt). */
export type ProjectArtKind =
  | { type: "visual"; visual: string }
  | { type: "language" }
  | { type: "arcade" };

export interface OrdoProject {
  /** URL segment: /work/<slug>. */
  slug: string;
  /** Key into projectShowcase for screenshots and highlights. */
  showcaseId: string;
  study: CaseStudy;
  /** Short label shown in the card's top-right corner. */
  tag: string;
  /** Verb-first label for the card's call to action. */
  action: string;
  art: ProjectArtKind;
}

/** The six projects on the monochrome site, in display order. */
export const ordoProjects: OrdoProject[] = [
  ...selectedWork.map(
    (project): OrdoProject => ({
      slug: project.id,
      showcaseId: project.id,
      study: project,
      tag: project.stack[0],
      action: "View project",
      art: { type: "visual", visual: project.visual },
    }),
  ),
  {
    slug: "sprachweg",
    showcaseId: "sprachweg",
    study: sprachwegCase,
    tag: otherWork[0].category,
    action: "View project",
    art: { type: "language" },
  },
  {
    slug: "arcade",
    showcaseId: "tetris",
    study: tetrisCase,
    tag: otherWork[1].category,
    action: "View and play",
    art: { type: "arcade" },
  },
];

export const findProject = (slug: string | undefined) =>
  ordoProjects.find((project) => project.slug === slug);
