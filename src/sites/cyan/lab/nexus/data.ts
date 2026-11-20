import { projects, type Project } from "@/data/profile";
import { projectShowcase, type ProjectShowcase, type ShowcaseMedia } from "@/sites/ordo/projectShowcase";
import { ARCADE_URL, ORDO_URL } from "@/lib/sites";

/**
 * The archive's view of the projects: the shared project record, joined with
 * the monochrome site's screenshots and verified detail, plus where each one
 * can be read, run or played.
 */
export interface ArchiveEntry {
  id: string;
  /** Channel number on the instrument, "01" onwards. */
  code: string;
  project: Project;
  showcase?: ProjectShowcase;
  media: ShowcaseMedia[];
  github?: string;
  /** The project's page and interactive demo on the monochrome site. */
  demoUrl?: string;
  /** A playable copy hosted on this site. */
  playUrl?: string;
  group: "selected" | "also";
}

/** Archive ids whose showcase or demo page uses a different name. */
const SHOWCASE_KEY: Record<string, string> = { language: "sprachweg" };
const DEMO_SLUG: Record<string, string> = {
  studyforge: "studyforge",
  fintrack: "fintrack",
  mara: "mara",
  axiomquant: "axiomquant",
  language: "sprachweg",
  tetris: "arcade",
};

export const ARCHIVE: ArchiveEntry[] = projects.map((project, i) => {
  const showcase = projectShowcase[SHOWCASE_KEY[project.id] ?? project.id];
  const github =
    project.links.github ?? showcase?.links?.find((link) => link.href.startsWith("https://github.com/"))?.href;
  const slug = DEMO_SLUG[project.id];
  return {
    id: project.id,
    code: String(i + 1).padStart(2, "0"),
    project,
    showcase,
    media: showcase?.media ?? [],
    github,
    demoUrl: slug ? `${ORDO_URL}/work/${slug}` : undefined,
    playUrl: project.id === "tetris" ? ARCADE_URL : undefined,
    group: project.featured ? "selected" : "also",
  };
});

export const findEntry = (id: string | null) => ARCHIVE.find((entry) => entry.id === id) ?? null;

/** Every screenshot in the archive, in project order, for the contact sheet. */
export const FRAMES = ARCHIVE.flatMap((entry) =>
  entry.media.map((media, index) => ({ entry, media, index, key: `${entry.id}-${index}` })),
);

export const COUNTS = {
  projects: ARCHIVE.length,
  frames: FRAMES.length,
  repos: ARCHIVE.filter((entry) => entry.github).length,
  selected: ARCHIVE.filter((entry) => entry.group === "selected").length,
};

/* ---------------------------------------------------------------- filters */

/** "all", "group:selected", "group:also" or "tech:<name>". */
export type FilterKey = string;

export const matches = (entry: ArchiveEntry, filter: FilterKey) => {
  if (filter === "all") return true;
  const [kind, value] = [filter.slice(0, filter.indexOf(":")), filter.slice(filter.indexOf(":") + 1)];
  if (kind === "group") return entry.group === value;
  if (kind === "tech") return entry.project.technologies.includes(value);
  return true;
};

/** Technologies that more than one project uses: the stack the archive shares. */
export const SHARED_STACK = (() => {
  const counts = new Map<string, number>();
  for (const entry of ARCHIVE)
    for (const tech of entry.project.technologies) counts.set(tech, (counts.get(tech) ?? 0) + 1);
  return [...counts]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tech, count]) => ({ tech, count }));
})();

export const techCount = (tech: string) =>
  ARCHIVE.filter((entry) => entry.project.technologies.includes(tech)).length;
