/**
 * The two editions are separate sites. Each links to the other through these
 * addresses; set VITE_CYAN_URL and VITE_ORDO_URL when deploying.
 */
export const CYAN_URL = (import.meta.env.VITE_CYAN_URL ?? "http://127.0.0.1:4173").replace(/\/$/, "");
export const ORDO_URL = (import.meta.env.VITE_ORDO_URL ?? "http://127.0.0.1:4175").replace(/\/$/, "");
