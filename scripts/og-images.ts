/**
 * Draws the share images in public/og (1200×630 PNG), one per page listed in
 * src/sites/ordo/share.ts, with a local Chrome or Edge in headless mode and the
 * site's own fonts. Run `npm run og` after changing a page's title, the content
 * file or a project's first screenshot, then commit the images.
 * Set CHROME_PATH if your browser is not in a standard location.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sharePages, type SharePage } from "../src/sites/ordo/share.ts";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "public", "og");
const browser = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((path) => path && existsSync(path));
if (!browser) throw new Error("No Chrome or Edge found. Set CHROME_PATH to one.");

const asset = (path: string) => pathToFileURL(join(root, path)).href;
const fonts = `
  @font-face { font-family: "Grotesk"; font-weight: 300 700;
    src: url("${asset("node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2")}") format("woff2"); }
  @font-face { font-family: "Plex Mono"; font-weight: 400;
    src: url("${asset("node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2")}") format("woff2"); }
  @font-face { font-family: "Plex Mono"; font-weight: 500;
    src: url("${asset("node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2")}") format("woff2"); }`;

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The site's monochrome card: wordmark, label, the page's two-line heading, its description. */
function card(page: SharePage) {
  const shot = page.card.screenshot;
  const width = shot ? 600 : 1000;
  // Monospace glyphs are about 0.6em wide; size the heading so its longest line fits.
  const longest = Math.max(...page.card.heading.map((line) => line.length));
  const size = Math.max(44, Math.min(76, Math.floor(width / (longest * 0.6))));
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative;
    background: #fafaf8; color: #222420; font-family: "Grotesk", sans-serif; }
  .grid { position: absolute; inset: 0; opacity: 0.5;
    background-image: linear-gradient(#e6e6e0 1px, transparent 1px), linear-gradient(90deg, #e6e6e0 1px, transparent 1px);
    background-size: 60px 60px; }
  .frame { position: absolute; inset: 36px; border: 1px solid #222420; }
  .top, .foot { position: absolute; left: 72px; right: 72px; display: flex; justify-content: space-between;
    align-items: center; font-family: "Plex Mono", monospace; font-size: 19px; letter-spacing: 0.04em; }
  .top { top: 64px; }
  .mark { font-weight: 500; letter-spacing: 0.02em; }
  .mark b { font-size: 30px; letter-spacing: -0.06em; margin-right: 10px; }
  .label { color: #646660; }
  .main { position: absolute; left: 72px; top: 140px; bottom: 128px; width: ${width}px;
    display: flex; flex-direction: column; justify-content: center; gap: 26px; }
  h1 { font-family: "Plex Mono", monospace; font-weight: 400; font-size: ${size}px;
    line-height: 1.1; letter-spacing: -0.045em; }
  h1 span { display: block; color: #646660; }
  p { font-size: 24px; line-height: 1.45; color: #646660; max-height: 140px; overflow: hidden; }
  .foot { bottom: 64px; padding-top: 16px; border-top: 1px solid #dddfd7; font-size: 17px; }
  .shot { position: absolute; right: 72px; top: 140px; bottom: 128px; width: 400px;
    border: 1px dashed #7e8478; background: #f1f1ed; display: grid; place-items: center; overflow: hidden; }
  .shot img { max-width: 100%; max-height: 100%; object-fit: contain; }
  </style></head><body>
  <div class="grid"></div><div class="frame"></div>
  <div class="top"><span class="mark"><b>v.</b>VARUN DARJI</span><span class="label">${escape(page.card.label)}</span></div>
  <div class="main">
    <h1>${escape(page.card.heading[0])}<span>${escape(page.card.heading[1])}</span></h1>
    <p>${escape(page.description)}</p>
  </div>
  ${shot ? `<div class="shot"><img src="${asset(`public${shot}`)}" alt=""></div>` : ""}
  <div class="foot"><span>AI engineer · Mumbai</span><span class="label">${escape(page.path === "/" ? "PORTFOLIO" : page.path.toUpperCase())}</span></div>
  </body></html>`;
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string) {
  const bytes = readFileSync(file);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

mkdirSync(out, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "ordo-og-"));
try {
  for (const page of sharePages) {
    const html = join(work, `${page.image}.html`);
    const png = join(out, `${page.image}.png`);
    writeFileSync(html, card(page));
    execFileSync(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--window-size=1200,630",
        "--virtual-time-budget=4000",
        "--allow-file-access-from-files",
        `--user-data-dir=${join(work, "profile")}`,
        `--screenshot=${png}`,
        pathToFileURL(html).href,
      ],
      { stdio: "ignore" },
    );
    const [width, height] = pngSize(png);
    if (width !== 1200 || height !== 630) throw new Error(`${png} is ${width}×${height}, expected 1200×630`);
    console.log(`og/${page.image}.png  ${page.path}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
