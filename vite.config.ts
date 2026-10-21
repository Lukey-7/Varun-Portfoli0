import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
      "Varun Darji, AI engineer and prospective researcher in Mumbai. Retrieval, agents, evaluation and the applications around them.",
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

export default defineConfig(({ mode }) => {
  const site: Site = mode === "ordo" ? "ordo" : "cyan";
  const meta = SITES[site];
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
    plugins: [react(), siteHtml(site)],
    resolve: {
      alias: {
        "@site": path.resolve(__dirname, `./src/sites/${site}`),
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
