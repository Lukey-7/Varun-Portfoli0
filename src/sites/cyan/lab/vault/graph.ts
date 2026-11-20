import { selectedWork } from "@/data/portfolio";
import { skillCategories, skills, type Skill, type SkillCategory } from "@/data/profile";

/*
 * The skill map as a star chart. Every skill sits on its own bearing, grouped
 * into one sector per area, and the more links a skill has the nearer the
 * centre it sits. Selecting a skill re-plots the chart around it: the skill at
 * the centre, its links on an inner ring, everything else pushed to the rim.
 * Positions are a pure function of the data, the selection and the size, so the
 * SVG lines and the nodes always agree, and the layout can be tested alone.
 *
 * Bearings are in degrees clockwise from north, as on an instrument dial:
 * x = r·sin(b), y = −r·cos(b).
 */

/** Half the viewBox: the chart is drawn in a square from −VIEW to +VIEW. */
export const VIEW = 540;
/** The dial's rim, where the ticks and area arcs sit. */
export const RIM = 470;
/** Below this many CSS pixels the chart drops its labels and grows its nodes. */
export const COMPACT_BELOW = 600;

export type LabelMode = "radial" | "below" | "none";

export type StarNode = {
  id: string;
  skill: Skill;
  index: number;
  /** Undirected neighbours, from either side's connections. */
  links: string[];
  /** The bearing of this skill on the full chart. */
  bearing: number;
  /** Lines of the label, wrapped at slashes and spaces. */
  lines: string[];
};

export type Edge = { id: string; a: string; b: string };

export type Placement = {
  x: number;
  y: number;
  /** Node size as a multiple of its base radius. */
  scale: number;
  /** The bearing the label is drawn along (radial labels only). */
  labelBearing: number;
  label: LabelMode;
};

export type Layout = Record<string, Placement>;

export type Sector = {
  category: SkillCategory;
  /** Bearings of the sector's edges; `to` may exceed 360. */
  from: number;
  to: number;
  count: number;
};

const SLOT = 1;
const GAP = 0.8;

export const norm = (deg: number) => ((deg % 360) + 360) % 360;
export const toXY = (bearing: number, r: number) => {
  const rad = (bearing * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) };
};
export const bearingOf = (x: number, y: number) => norm((Math.atan2(x, -y) * 180) / Math.PI);

/** Splits a name into at most two lines of about `max` characters, breaking at slashes first. */
export function wrapLabel(name: string, max = 16): string[] {
  if (name.length <= max) return [name];
  const words = name.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line && lines.length === 0) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

/** Every pair of linked skills once, whichever side lists the link. */
export function buildEdges(list: readonly Skill[] = skills): Edge[] {
  const ids = new Set(list.map((s) => s.id));
  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const skill of list) {
    for (const other of skill.connections) {
      if (!ids.has(other) || other === skill.id) continue;
      const [a, b] = [skill.id, other].sort();
      const id = `${a}~${b}`;
      if (seen.has(id)) continue;
      seen.add(id);
      edges.push({ id, a, b });
    }
  }
  return edges;
}

export const EDGES = buildEdges();

function neighbourMap(edges: readonly Edge[]) {
  const map = new Map<string, string[]>();
  for (const skill of skills) map.set(skill.id, []);
  for (const edge of edges) {
    map.get(edge.a)?.push(edge.b);
    map.get(edge.b)?.push(edge.a);
  }
  return map;
}
const NEIGHBOURS = neighbourMap(EDGES);

/** The sectors, sized by how many skills each area holds, with a gap between areas. The first area faces north. */
function buildSectors(): Sector[] {
  const counts = skillCategories.map((c) => skills.filter((s) => s.category === c).length);
  const units = counts.reduce((sum, n) => sum + n * SLOT, 0) + GAP * skillCategories.length;
  const perUnit = 360 / units;
  let at = -(counts[0] * SLOT * perUnit) / 2;
  return skillCategories.map((category, k) => {
    const from = at;
    const to = from + counts[k] * SLOT * perUnit;
    at = to + GAP * perUnit;
    return { category, from, to, count: counts[k] };
  });
}
export const SECTORS = buildSectors();

/** The skills in chart order: by area, and within an area the best-linked in the middle. */
function buildNodes(): StarNode[] {
  const nodes: StarNode[] = [];
  for (const sector of SECTORS) {
    const members = skills.filter((s) => s.category === sector.category);
    // Hubs go to the middle of their sector so their lines fan out evenly.
    const byLinks = [...members].sort(
      (a, b) => (NEIGHBOURS.get(b.id)?.length ?? 0) - (NEIGHBOURS.get(a.id)?.length ?? 0),
    );
    const ordered: Skill[] = [];
    byLinks.forEach((skill, k) => (k % 2 === 0 ? ordered.push(skill) : ordered.unshift(skill)));
    const step = (sector.to - sector.from) / members.length;
    ordered.forEach((skill, k) => {
      nodes.push({
        id: skill.id,
        skill,
        index: skills.indexOf(skill),
        links: NEIGHBOURS.get(skill.id) ?? [],
        bearing: norm(sector.from + step * (k + 0.5)),
        lines: wrapLabel(skill.name),
      });
    });
  }
  return nodes;
}
export const NODES = buildNodes();
export const NODE_BY_ID = new Map(NODES.map((node) => [node.id, node]));

const degrees = NODES.map((n) => n.links.length);
export const MAX_LINKS = Math.max(...degrees);
export const MIN_LINKS = Math.min(...degrees);

/** Base node radius in chart units, by how many links the skill has. */
export const nodeRadius = (node: StarNode, compact: boolean) =>
  (17 + node.links.length * 2.2) * (compact ? 1.4 : 1);

/** The full chart: each skill on its own bearing, hubs nearer the centre. */
export function skyLayout(compact: boolean): Layout {
  const layout: Layout = {};
  const span = MAX_LINKS - MIN_LINKS || 1;
  NODES.forEach((node, k) => {
    const pull = (node.links.length - MIN_LINKS) / span;
    const inner = compact ? 150 : 140;
    const outer = compact ? 300 : 275;
    const r = outer - pull * (outer - inner) + (k % 2 ? 16 : -16);
    const { x, y } = toXY(node.bearing, r);
    layout[node.id] = { x, y, scale: 1, labelBearing: node.bearing, label: compact ? "none" : "radial" };
  });
  return layout;
}

/**
 * The chart re-plotted around one skill: it moves to the centre, its links
 * spread evenly on an inner ring in their original order, and the rest wait at
 * the rim on their own bearings, small and unlabelled.
 */
export function focusLayout(centre: string, compact: boolean): Layout {
  const node = NODE_BY_ID.get(centre);
  if (!node) return skyLayout(compact);
  const layout: Layout = {};
  const ring = compact ? 230 : 190;
  const rim = compact ? 410 : 425;
  const around = [...node.links]
    .map((id) => NODE_BY_ID.get(id) as StarNode)
    .sort((a, b) => a.bearing - b.bearing);
  const step = 360 / Math.max(1, around.length);
  // Turn the ring so its skills sit as near their own bearings as they can.
  let sin = 0,
    cos = 0;
  around.forEach((n, k) => {
    const rad = ((n.bearing - k * step) * Math.PI) / 180;
    sin += Math.sin(rad);
    cos += Math.cos(rad);
  });
  const offset = around.length ? (Math.atan2(sin, cos) * 180) / Math.PI : 0;

  layout[centre] = { x: 0, y: 0, scale: 1.25, labelBearing: 180, label: compact ? "none" : "below" };
  around.forEach((n, k) => {
    const bearing = norm(offset + k * step);
    const { x, y } = toXY(bearing, ring);
    layout[n.id] = { x, y, scale: 1, labelBearing: bearing, label: compact ? "none" : "radial" };
  });
  for (const other of NODES) {
    if (layout[other.id]) continue;
    const { x, y } = toXY(other.bearing, rim);
    layout[other.id] = { x, y, scale: 0.62, labelBearing: other.bearing, label: "none" };
  }
  return layout;
}

/** A gentle bend towards the centre, so lines bundle like a chord diagram. */
export const BEND = 0.42;
export function edgeControl(ax: number, ay: number, bx: number, by: number) {
  return { x: ((ax + bx) / 2) * BEND, y: ((ay + by) / 2) * BEND };
}
export function edgePath(ax: number, ay: number, bx: number, by: number) {
  const c = edgeControl(ax, ay, bx, by);
  const f = (v: number) => Math.round(v * 10) / 10;
  return `M${f(ax)} ${f(ay)}Q${f(c.x)} ${f(c.y)} ${f(bx)} ${f(by)}`;
}
/** A point `t` of the way along an edge's curve. */
export function pointOnEdge(ax: number, ay: number, bx: number, by: number, t: number) {
  const c = edgeControl(ax, ay, bx, by);
  const u = 1 - t;
  return { x: u * u * ax + 2 * u * t * c.x + t * t * bx, y: u * u * ay + 2 * u * t * c.y + t * t * by };
}

/** The featured projects whose stack names this skill exactly, by its name, its short form or one part of a "A / B" name. */
export function usedIn(skill: Skill) {
  const names = new Set([skill.name, skill.short, ...skill.name.split(" / ")].map((s) => s.trim()));
  return selectedWork.flatMap((project) => {
    const match = project.stack.filter((entry) => names.has(entry));
    return match.length ? [{ id: project.id, name: project.name, match }] : [];
  });
}

/**
 * Keyboard travel: the nearest skill in the arrow's direction, preferring ones
 * close to the line of travel. Returns null at the edge of the chart.
 */
export function nextInDirection(
  from: string,
  dx: number,
  dy: number,
  layout: Layout,
  among: readonly string[],
): string | null {
  const start = layout[from];
  if (!start) return null;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const id of among) {
    if (id === from) continue;
    const p = layout[id];
    const vx = p.x - start.x;
    const vy = p.y - start.y;
    const along = vx * dx + vy * dy;
    if (along <= 1) continue;
    const across = Math.abs(vx * dy - vy * dx);
    const score = along + across * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

/** Counts for the readouts. */
export const TOTALS = {
  skills: skills.length,
  links: EDGES.length,
  areas: skillCategories.length,
  hub: [...NODES].sort((a, b) => b.links.length - a.links.length)[0],
};
