// Geometrie van tandwielen: straal, tanden, contactafstand, in elkaar grijpen, snappen.
import {
  clamp,
  type ComponentKind,
  type Construction,
  type Layer,
  type MechComponent,
  WORLD,
} from "./types";

/** Module (tandsteek-eenheid). Overal dezelfde, dus steekdiameter ~ aantal tanden. */
export const MODULE = 6;
/** Steek langs de steekcirkel = ook de schakelsteek van de ketting. */
export const PITCH_ARC = Math.PI * MODULE;
/** Tolerantie waarbinnen twee tandwielen als "goed in elkaar grijpend" gelden. */
export const MESH_TOL = 1.2;
/** Afstand waarbinnen we magnetisch naar de juiste steekafstand snappen. */
export const MESH_SNAP = 20;
/** Afstand waarbinnen middelpunten op verschillende lagen naar één as snappen. */
export const SHAFT_SNAP = 28;
/** Minimale vrije ruimte tussen twee kettingtandwielen met een ketting. */
export const CHAIN_MIN_GAP = 10;

export const pitchRadius = (teeth: number) => (MODULE * teeth) / 2;
export const outerRadius = (kind: ComponentKind, teeth: number) =>
  pitchRadius(teeth) + (kind === "gear" ? MODULE : MODULE * 0.75);
export const rootRadius = (kind: ComponentKind, teeth: number) =>
  pitchRadius(teeth) - (kind === "gear" ? MODULE * 1.25 : MODULE * 0.9);
export const toothAngle = (teeth: number) => (2 * Math.PI) / teeth;
export const hubRadius = (teeth: number) => clamp(pitchRadius(teeth) * 0.34, 13, 30);

export interface Point {
  x: number;
  y: number;
}

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export type PairRelation = "mesh" | "overlap" | "none";

interface Placed {
  kind: ComponentKind;
  teeth: number;
  x: number;
  y: number;
  layer: Layer;
}

/** Bepaalt uit de geometrie of twee onderdelen grijpen, overlappen of niets doen. */
export function pairRelation(a: Placed, b: Placed): PairRelation {
  if (a.layer !== b.layer) return "none";
  const d = dist(a, b);
  const outerSum = outerRadius(a.kind, a.teeth) + outerRadius(b.kind, b.teeth);
  if (a.kind === "gear" && b.kind === "gear") {
    const meshD = pitchRadius(a.teeth) + pitchRadius(b.teeth);
    if (Math.abs(d - meshD) <= MESH_TOL) return "mesh";
    if (d < outerSum - 0.5) return "overlap";
    return "none";
  }
  if (d < outerSum - 0.5) return "overlap";
  return "none";
}

const outlineCache = new Map<string, string>();

/**
 * SVG-pad van de omtrek (met tanden) in lokale coördinaten.
 * Tand 0 staat gecentreerd op hoek 0 (naar rechts).
 */
export function gearOutline(kind: ComponentKind, teeth: number): string {
  const key = `${kind}:${teeth}`;
  const cached = outlineCache.get(key);
  if (cached) return cached;
  const r = pitchRadius(teeth);
  const ro = outerRadius(kind, teeth);
  const rr = rootRadius(kind, teeth);
  const p = toothAngle(teeth);
  const profile: Array<[number, number]> =
    kind === "gear"
      ? [
          [rr, -0.3],
          [r, -0.24],
          [ro, -0.12],
          [ro, 0.12],
          [r, 0.24],
          [rr, 0.3],
        ]
      : [
          [rr, -0.26],
          [r, -0.16],
          [ro, -0.05],
          [ro, 0.05],
          [r, 0.16],
          [rr, 0.26],
        ];
  const parts: string[] = [];
  for (let k = 0; k < teeth; k++) {
    const c = k * p;
    for (const [rad, f] of profile) {
      const a = c + f * p;
      parts.push(`${(rad * Math.cos(a)).toFixed(2)},${(rad * Math.sin(a)).toFixed(2)}`);
    }
  }
  const d = `M${parts.join("L")}Z`;
  outlineCache.set(key, d);
  return d;
}

export function circleIntersections(c1: Point, r1: number, c2: Point, r2: number): Point[] {
  const d = dist(c1, c2);
  if (d < 1e-9 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  const h = h2 > 0 ? Math.sqrt(h2) : 0;
  const mx = c1.x + (a * (c2.x - c1.x)) / d;
  const my = c1.y + (a * (c2.y - c1.y)) / d;
  const ox = (h * (c2.y - c1.y)) / d;
  const oy = (h * (c2.x - c1.x)) / d;
  return [
    { x: mx + ox, y: my - oy },
    { x: mx - ox, y: my + oy },
  ];
}

export interface SnapResult {
  x: number;
  y: number;
  /** Onderdeel op de andere laag waarmee een gedeelde as ontstaat */
  shaftWith: string | null;
  /** Tandwielen waarmee dit tandwiel nu correct grijpt */
  meshWith: string[];
}

function shaftPartnerOf(c: Construction, id: string): string | null {
  const l = c.shafts.find((s) => s.a === id || s.b === id);
  if (!l) return null;
  return l.a === id ? l.b : l.a;
}

/**
 * Berekent de gesnapte positie voor een onderdeel dat versleept wordt.
 * 1. As-snap: middelpunt bijna gelijk aan een onderdeel op de andere laag.
 * 2. Mesh-snap: tandwiel op de juiste steekafstand van één of twee tandwielen.
 */
export function computeSnap(c: Construction, movingId: string, raw: Point): SnapResult {
  const moving = c.components.find((k) => k.id === movingId);
  const result: SnapResult = {
    x: clamp(raw.x, WORLD.minX, WORLD.maxX),
    y: clamp(raw.y, WORLD.minY, WORLD.maxY),
    shaftWith: null,
    meshWith: [],
  };
  if (!moving) return result;
  const linkedPartner = shaftPartnerOf(c, movingId);
  const others = c.components.filter((k) => k.id !== movingId && k.id !== linkedPartner);

  // 1. As-snap (alleen als dit onderdeel nog niet op een as zit)
  if (!linkedPartner) {
    let best: MechComponent | null = null;
    let bestD = SHAFT_SNAP;
    for (const o of others) {
      if (o.layer === moving.layer) continue;
      if (shaftPartnerOf(c, o.id)) continue;
      const d = dist(raw, o);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    if (best) {
      result.x = best.x;
      result.y = best.y;
      result.shaftWith = best.id;
    }
  }

  // 2. Mesh-snap voor gewone tandwielen
  if (!result.shaftWith && moving.kind === "gear") {
    const rMoving = pitchRadius(moving.teeth);
    const cands = others
      .filter((o) => o.layer === moving.layer && o.kind === "gear")
      .map((o) => {
        const D = rMoving + pitchRadius(o.teeth);
        const d = dist(raw, o);
        return { o, D, d, err: Math.abs(d - D) };
      })
      .filter((k) => k.err <= MESH_SNAP)
      .sort((p, q) => p.err - q.err);
    let snapped = false;
    if (cands.length >= 2) {
      const [c1, c2] = cands;
      const pts = circleIntersections(c1.o, c1.D, c2.o, c2.D);
      let bestPt: Point | null = null;
      let bestD = MESH_SNAP * 1.8;
      for (const pt of pts) {
        const d = dist(pt, raw);
        if (d < bestD) {
          bestD = d;
          bestPt = pt;
        }
      }
      if (bestPt) {
        result.x = bestPt.x;
        result.y = bestPt.y;
        snapped = true;
      }
    }
    if (!snapped && cands.length >= 1) {
      const c1 = cands[0];
      let ux = raw.x - c1.o.x;
      let uy = raw.y - c1.o.y;
      const len = Math.hypot(ux, uy);
      if (len < 1e-6) {
        ux = 1;
        uy = 0;
      } else {
        ux /= len;
        uy /= len;
      }
      result.x = c1.o.x + ux * c1.D;
      result.y = c1.o.y + uy * c1.D;
    }
    result.x = clamp(result.x, WORLD.minX, WORLD.maxX);
    result.y = clamp(result.y, WORLD.minY, WORLD.maxY);
  }

  // Wie grijpt er nu werkelijk?
  if (moving.kind === "gear") {
    const placed: Placed = { ...moving, x: result.x, y: result.y };
    result.meshWith = others
      .filter((o) => o.kind === "gear" && pairRelation(placed, o) === "mesh")
      .map((o) => o.id);
  }
  return result;
}

/** Zoekt een vrije plek (spiraal) in de buurt van een punt, op een bepaalde laag. */
export function findFreeSpot(
  c: Construction,
  kind: ComponentKind,
  teeth: number,
  layer: Layer,
  near: Point
): Point {
  const ro = outerRadius(kind, teeth);
  const isFree = (p: Point) =>
    c.components.every((o) => {
      const need = ro + outerRadius(o.kind, o.teeth) + 14;
      // ook onderdelen op de andere laag ontwijken (anders lijkt het een as)
      return dist(p, o) >= (o.layer === layer ? need : ro + 20);
    });
  if (isFree(near)) return near;
  const step = 30;
  for (let i = 1; i < 400; i++) {
    const ang = i * 0.55;
    const rad = step * Math.sqrt(i) * 1.6;
    const p = {
      x: clamp(near.x + rad * Math.cos(ang), WORLD.minX + ro, WORLD.maxX - ro),
      y: clamp(near.y + rad * Math.sin(ang), WORLD.minY + ro, WORLD.maxY - ro),
    };
    if (isFree(p)) return p;
  }
  return near;
}

export function constructionBounds(c: Construction): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (c.components.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const k of c.components) {
    const ro = outerRadius(k.kind, k.teeth) + 20;
    minX = Math.min(minX, k.x - ro);
    minY = Math.min(minY, k.y - ro);
    maxX = Math.max(maxX, k.x + ro);
    maxY = Math.max(maxY, k.y + ro);
  }
  return { minX, minY, maxX, maxY };
}
