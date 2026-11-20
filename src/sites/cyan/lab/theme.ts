/** The cyan theme choice, shared by the home page and the lab pages. */
export type LabTheme = "dark" | "light";

export const THEME_KEY = "cyan-theme";

/** Dark unless the visitor has chosen light. */
export function readTheme(): LabTheme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Only an explicit choice is stored, so first-time visitors still get dark. */
export function saveTheme(theme: LabTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage is blocked; the choice lasts for this visit */
  }
}
