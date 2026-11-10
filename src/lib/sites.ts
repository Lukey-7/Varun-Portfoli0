/**
 * The two editions are separate sites. Each links to the other through these
 * addresses; set VITE_CYAN_URL and VITE_ORDO_URL when deploying.
 */
export const CYAN_URL = (import.meta.env.VITE_CYAN_URL ?? "http://127.0.0.1:4173").replace(/\/$/, "");
export const ORDO_URL = (import.meta.env.VITE_ORDO_URL ?? "http://127.0.0.1:4175").replace(/\/$/, "");

/** The games are static pages outside the router, so they need a full page load. */
export const ARCADE_URL = "/play/arcade/index.html";
export const SPACE_GAME_URL = "/play/arcade/space.html";
