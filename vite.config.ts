import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { applyShareHead, sharePages, siteUrl, sitemap } from "./src/sites/ordo/share.ts";

/**
 * Two independent sites share this repository. `--mode cyan` (the default) and
 * `--mode ordo` choose the app, dev port, output folder and page metadata.
 */
const SITES = {
  cyan: {
    port: 4173,
    previewPort: 4174,
    themeColor: "#091110",
    title: "Varun Darji | AI Engineer",
    description:
      "Varun Darji, AI engineer in Mumbai. Retrieval systems, agent workflows and applications, with results shown alongside their evaluation scope.",
    preload: '<link rel="preload" as="image" href="/images/mesh-knot.webp" fetchpriority="high" />',
  },
  ordo: {
    port: 4175,
    previewPort: 4176,
    themeColor: "#fafaf8",
    title: "Varun Darji | AI Engineer",
    description:
      "Varun Darji, AI engineer at LetsTute in Mumbai. Retrieval, agents and evaluation, a working demo for every project, and a research proposal on LLM inference cost.",
    preload: "",
  },
} as const;

type Site = keyof typeof SITES;

function siteHtml(site: Site): Plugin {
  const meta = SITES[site];
  return {
    name: "site-html",
    transformIndexHtml: (html) =>
      html
        .split("__SITE_TITLE__").join(meta.title)
        .split("__SITE_DESCRIPTION__").join(meta.description)
        .split("__SITE_THEME__").join(meta.themeColor)
        .replace("<!--__SITE_PRELOAD__-->", meta.preload),
  };
}

/**
 * Every built site gets a 404.html that boots the app, so unknown paths show
 * the site's own "not found" page instead of the host's.
 */
function spaNotFound(): Plugin {
  let outDir = "";
  return {
    name: "spa-not-found",
    apply: "build",
    configResolved: (config) => {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle: () => {
      fs.copyFileSync(path.join(outDir, "index.html"), path.join(outDir, "404.html"));
    },
  };
}

/**
 * The multi-page site writes one HTML file per page, each with its own title,
 * description and share image, because link previews don't run JavaScript.
 * Also writes sitemap.xml and robots.txt. Images come from `npm run og`.
 */
function ordoSharePages(env: Record<string, string | undefined>): Plugin {
  let outDir = "";
  return {
    name: "ordo-share-pages",
    apply: "build",
    configResolved: (config) => {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle: () => {
      const base = siteUrl(env);
      const template = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
      for (const page of sharePages) {
        const html = applyShareHead(template, page, base);
        if (page.path === "/") {
          fs.writeFileSync(path.join(outDir, "index.html"), html);
          continue;
        }
        // Both forms, so /about resolves on hosts that map it to about/index.html
        // and on those (like vite preview) that try about.html.
        fs.mkdirSync(path.join(outDir, page.path), { recursive: true });
        fs.writeFileSync(path.join(outDir, page.path, "index.html"), html);
        fs.writeFileSync(path.join(outDir, `${page.path}.html`), html);
      }
      fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemap(base, new Date().toISOString().slice(0, 10)));
      fs.writeFileSync(path.join(outDir, "robots.txt"), `User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const site: Site = mode === "ordo" ? "ordo" : "cyan";
  const meta = SITES[site];
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    server: {
      host: "127.0.0.1",
      port: meta.port,
      strictPort: true,
      hmr: { overlay: false },
      // Vite ignores only this site's own output; a build of the other site
      // rewriting dist/ must not crash this dev server's watcher.
      watch: { ignored: ["**/dist/**", "**/.playwright-mcp/**"] },
    },
    preview: {
      host: "127.0.0.1",
      port: meta.previewPort,
      strictPort: true,
    },
    // cmdk is only imported by the lazily loaded palette; pre-bundle it so the
    // first open in dev doesn't trigger a dependency re-optimisation.
    optimizeDeps: { include: ["cmdk"] },
    build: {
      outDir: `dist/${site}`,
      emptyOutDir: true,
    },
    // spaNotFound runs first so 404.html keeps the generic head.
    plugins: [react(), siteHtml(site), spaNotFound(), ...(site === "ordo" ? [ordoSharePages(env)] : [])],
    resolve: {
      alias: {
        "@site": path.resolve(__dirname, `./src/sites/${site}`),
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
