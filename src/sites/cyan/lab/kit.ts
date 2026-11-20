import { resetPointer, trackPointer } from "@/lib/pointer";

/** The lab's own pages, in the order the header lists them. */
export const LAB_PAGES = [
  { to: "/nexus", label: "Archive", code: "01", title: "Project archive" },
  { to: "/logs", label: "Logs", code: "02", title: "Logs" },
  { to: "/vault", label: "Skills", code: "03", title: "Skill map" },
  { to: "/terminal", label: "Terminal", code: "04", title: "Terminal" },
] as const;

/** Props that give an element the cursor spotlight and tilt variables (see .lab-panel in lab.css). */
export const pointerLight = {
  onPointerMove: trackPointer,
  onPointerLeave: resetPointer,
};
