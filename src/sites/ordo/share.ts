/**
 * Share previews for every page of the multi-page site. Link previews (LinkedIn,
 * WhatsApp, Slack, X) read the HTML head without running JavaScript, so the
 * build writes one HTML file per route with its own title, description and
 * image (see `ordoSharePages` in vite.config.ts), and `npm run og` draws the
 * images into public/og.
 *
 * Imports use relative paths with extensions so vite.config.ts and the Node
 * image script can load this file as well as the app.
 */
import { content } from "./content.ts";
import { projectShowcase, tetrisCase } from "./projectShowcase.ts";
import { journey } from "./journey.ts";
import { posts } from "./writing.ts";
import { selectedWork, sprachwegCase } from "../../data/portfolio.ts";

export interface SharePage {
  /** Route path, e.g. "/work/studyforge". */
  path: string;
  /** The <title>, matching what the page sets at runtime. */
  title: string;
  description: string;
  /** File name in public/og, without extension. */
  image: string;
  type: "website" | "article";
  /** For the image: the label in the top corner and the two-line heading. */
  card: { label: string; heading: readonly [string, string]; screenshot?: string };
}

const SITE = "Varun Darji";

/** Project pages, in the order of the project grid. */
const projectPages = [
  ...selectedWork.map((project) => ({
    slug: project.id,
    showcase: project.id,
    name: project.name,
    category: project.category,
  })),
  { slug: "sprachweg", showcase: "sprachweg", name: sprachwegCase.name, category: sprachwegCase.category },
  { slug: "arcade", showcase: "tetris", name: tetrisCase.name, category: tetrisCase.category },
];

export const sharePages: SharePage[] = [
  {
    path: "/",
    title: `${SITE} | AI Engineer`,
    description:
      "AI engineer at LetsTute in Mumbai. Retrieval, agents and evaluation, a working demo for every project, and a research proposal on LLM inference cost.",
    image: "home",
    type: "website",
    card: { label: "[ AI ENGINEER / MUMBAI ]", heading: content.hero.title },
  },
  ...projectPages.map((project, index): SharePage => {
    const showcase = projectShowcase[project.showcase];
    return {
      path: `/work/${project.slug}`,
      title: `${project.name} | ${SITE}`,
      description: showcase?.pitch ?? project.category,
      image: `work-${project.slug}`,
      type: "website",
      card: {
        label: `[ WORK / ${String(index + 1).padStart(2, "0")} ]`,
        heading: [project.name, project.category],
        screenshot: showcase?.media[0]?.src,
      },
    };
  }),
  {
    path: "/research",
    title: `Research | ${SITE}`,
    description:
      "A research proposal on cutting the cost of LLM assistants: adaptive conversation memory and a calibrated retry policy, with an interactive version of each idea.",
    image: "research",
    type: "website",
    card: { label: "[ RESEARCH / PROPOSAL ]", heading: content.research.title },
  },
  {
    path: "/journey",
    title: `Journey | ${SITE}`,
    description: `A dated log of my work, projects, research and study, newest first. ${journey.length} entries so far.`,
    image: "journey",
    type: "website",
    card: { label: "[ JOURNEY / LOG ]", heading: content.journeyPage.title },
  },
  {
    path: "/writing",
    title: `Writing | ${SITE}`,
    description: content.writingPage.intro,
    image: "writing",
    type: "website",
    card: { label: "[ WRITING ]", heading: content.writingPage.title },
  },
  ...posts.map(
    (post): SharePage => ({
      path: `/writing/${post.slug}`,
      title: `${post.title.join(" ").replace(/\.$/, "")} | ${SITE}`,
      description: post.summary,
      image: `writing-${post.slug}`,
      type: "article",
      card: { label: "[ WRITING ]", heading: post.title },
    }),
  ),
  {
    path: "/about",
    title: `About | ${SITE}`,
    description: "AI engineer at LetsTute in Mumbai. Experience, education and the tools I work with.",
    image: "about",
    type: "website",
    card: { label: "[ ABOUT / VARUN DARJI ]", heading: content.about.title },
  },
  {
    path: "/play",
    title: `Play | ${SITE}`,
    description:
      "Tetris-89 and Star Vanguard, two games I built in plain JavaScript with every sound synthesised. Playable in the browser.",
    image: "play",
    type: "website",
    card: { label: "[ PLAY / LUKEY ARCADE ]", heading: content.playPage.title },
  },
];

/** The site's public address: SITE_URL, then VITE_ORDO_URL, then Vercel's production domain. */
export function siteUrl(env: Record<string, string | undefined>) {
  const url =
    env.SITE_URL ||
    env.VITE_ORDO_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://127.0.0.1:4176";
  return url.replace(/\/+$/, "");
}

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Replace the built index.html's title, description and social tags with this page's. */
export function applyShareHead(html: string, page: SharePage, base: string) {
  const url = `${base}${page.path === "/" ? "/" : page.path}`;
  const image = `${base}/og/${page.image}.png`;
  const tags = [
    `<link rel="canonical" href="${escape(url)}" />`,
    `<meta property="og:type" content="${page.type}" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    `<meta property="og:image" content="${escape(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escape(page.card.heading.join(" "))}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(page.title)}" />`,
    `<meta name="twitter:description" content="${escape(page.description)}" />`,
    `<meta name="twitter:image" content="${escape(image)}" />`,
  ].join("\n    ");
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(page.title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/, `<meta name="description" content="${escape(page.description)}" />`)
    .replace(/\s*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g, "")
    .replace(/\s*<link\s+rel="canonical"[^>]*>/g, "")
    .replace("</head>", `    ${tags}\n  </head>`);
}

/**
 * The head for a page that should not be found or previewed (the private CV):
 * a plain title, no description, keywords, share tags or canonical link, and
 * a request not to index it.
 */
export function privateHead(html: string) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>Private | ${SITE}</title>`)
    .replace(/\s*<meta\s+name="(?:description|keywords)"[^>]*>/g, "")
    .replace(/\s*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g, "")
    .replace(/\s*<link\s+rel="canonical"[^>]*>/g, "")
    .replace("</head>", `    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />\n  </head>`);
}

export function sitemap(base: string, lastmod: string) {
  const urls = sharePages
    .map((page) => `  <url><loc>${escape(`${base}${page.path}`)}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
