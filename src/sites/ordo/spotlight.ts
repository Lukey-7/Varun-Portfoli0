/**
 * Capability cards point at the project or role they come from. Clicking one
 * scrolls to that card, outlines it for a moment and gives it keyboard focus,
 * so the visitor can open it next. Targets carry the id `spot-<id>`.
 */
export const SPOTLIGHT_EVENT = "ordo:spotlight";

export interface SpotlightDetail {
  id: string;
  label: string;
}

export function spotlight(id: string, label: string) {
  const target = document.getElementById(`spot-${id}`);
  if (!target) return false;
  // Lets a section prepare the target first, e.g. expand a collapsed role.
  window.dispatchEvent(new CustomEvent<SpotlightDetail>(SPOTLIGHT_EVENT, { detail: { id, label } }));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    target.dataset.spotlight = label;
    target.classList.remove("is-spotlit");
    // Restart the outline animation when the same card is chosen twice.
    void target.offsetWidth;
    target.classList.add("is-spotlit");
    window.setTimeout(() => target.classList.remove("is-spotlit"), 2800);
    const focusable = target.querySelector<HTMLElement>("button, a[href]");
    focusable?.focus({ preventScroll: true });
  });
  return true;
}
