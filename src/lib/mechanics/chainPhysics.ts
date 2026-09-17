// Kettingoverbrenging: verhouding, richting en het visuele kettingpad met schakels.
import { CHAIN_MIN_GAP, outerRadius, PITCH_ARC, pitchRadius, toothAngle, type Point } from "./gearGeometry";

/**
 * Verhouding bij een gewone (niet-gekruiste) ketting: beide draaien dezelfde kant op.
 * 40 tanden drijft 20 tanden aan: ratio = +2.
 */
export function chainRatio(driverTeeth: number, drivenTeeth: number): number {
  return driverTeeth / drivenTeeth;
}

export interface SprocketPose {
  x: number;
  y: number;
  teeth: number;
  /** huidige rotatiehoek in radialen */
  angle: number;
}

/** Kunnen twee kettingtandwielen (zelfde laag) door een ketting verbonden worden? */
export function chainDistanceOk(a: { x: number; y: number; teeth: number }, b: { x: number; y: number; teeth: number }): boolean {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  return d >= outerRadius("sprocket", a.teeth) + outerRadius("sprocket", b.teeth) + CHAIN_MIN_GAP;
}

export interface ChainGeometry {
  alpha: number;
  beta: number;
  d: number;
  rA: number;
  rB: number;
  lineLength: number;
  /** raakpunten */
  pA1: Point; // A(alpha - beta) begin lijn 1
  pB1: Point; // B(alpha - beta) einde lijn 1
  pB2: Point; // B(alpha + beta) begin lijn 2
  pA2: Point; // A(alpha + beta) einde lijn 2
  totalLength: number;
}

export function chainGeometry(a: SprocketPose, b: SprocketPose): ChainGeometry | null {
  const rA = pitchRadius(a.teeth);
  const rB = pitchRadius(b.teeth);
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d < 1e-6) return null;
  const alpha = Math.atan2(b.y - a.y, b.x - a.x);
  const cosb = (rA - rB) / d;
  if (cosb <= -1 || cosb >= 1) return null;
  const beta = Math.acos(cosb);
  const lineLength = Math.sqrt(Math.max(0, d * d - (rA - rB) * (rA - rB)));
  const pt = (c: Point, r: number, ang: number): Point => ({ x: c.x + r * Math.cos(ang), y: c.y + r * Math.sin(ang) });
  const wrapA = 2 * Math.PI - 2 * beta;
  const wrapB = 2 * beta;
  return {
    alpha,
    beta,
    d,
    rA,
    rB,
    lineLength,
    pA1: pt(a, rA, alpha - beta),
    pB1: pt(b, rB, alpha - beta),
    pB2: pt(b, rB, alpha + beta),
    pA2: pt(a, rA, alpha + beta),
    totalLength: wrapA * rA + wrapB * rB + 2 * lineLength,
  };
}

function normalizeInto(angle: number, start: number): number {
  const twoPi = 2 * Math.PI;
  let a = angle - start;
  a = a - Math.floor(a / twoPi) * twoPi;
  return start + a;
}

/** Tandruimte-hoeken van een kettingtandwiel binnen een boog [start, end]. */
function gapsInArc(s: SprocketPose, start: number, end: number): number[] {
  const p = toothAngle(s.teeth);
  const out: number[] = [];
  for (let k = 0; k < s.teeth; k++) {
    const g = normalizeInto(s.angle + (k + 0.5) * p, start);
    if (g <= end + 1e-9) out.push(g);
  }
  out.sort((x, y) => x - y);
  return out;
}

function lineRollers(from: Point, to: Point, sStart: number, sEnd: number): Point[] {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len < 1e-6) return [];
  const ux = (to.x - from.x) / len;
  const uy = (to.y - from.y) / len;
  const span = sEnd - sStart;
  if (span < -PITCH_ARC * 0.5) return [];
  const n = Math.max(1, Math.round(span / PITCH_ARC) + 1);
  const pts: Point[] = [];
  if (n === 1) {
    const s = (sStart + sEnd) / 2;
    pts.push({ x: from.x + ux * s, y: from.y + uy * s });
    return pts;
  }
  for (let i = 0; i < n; i++) {
    const s = sStart + (span * i) / (n - 1);
    pts.push({ x: from.x + ux * s, y: from.y + uy * s });
  }
  return pts;
}

/**
 * Berekent de posities van alle rollers van de ketting, in volgorde langs de lus.
 * Op de tandwielen liggen de rollers exact in de tandruimtes; op de rechte
 * stukken worden ze gelijkmatig verdeeld. Zo beweegt de ketting synchroon mee.
 */
export function chainRollers(a: SprocketPose, b: SprocketPose): Point[] {
  const g = chainGeometry(a, b);
  if (!g) return [];
  const { alpha, beta, rA, rB, lineLength } = g;
  // Boog op A: van alpha+beta tot alpha-beta+2pi (door alpha+pi)
  const sA = alpha + beta;
  const eA = alpha - beta + 2 * Math.PI;
  const gapsA = gapsInArc(a, sA, eA);
  // Boog op B: van alpha-beta tot alpha+beta (door alpha)
  const sB = alpha - beta;
  const eB = alpha + beta;
  const gapsB = gapsInArc(b, sB, eB);

  const ptA = (ang: number): Point => ({ x: a.x + rA * Math.cos(ang), y: a.y + rA * Math.sin(ang) });
  const ptB = (ang: number): Point => ({ x: b.x + rB * Math.cos(ang), y: b.y + rB * Math.sin(ang) });

  const deltaAExit = gapsA.length ? (eA - gapsA[gapsA.length - 1]) * rA : PITCH_ARC / 2;
  const deltaAEntry = gapsA.length ? (gapsA[0] - sA) * rA : PITCH_ARC / 2;
  const deltaBEntry = gapsB.length ? (gapsB[0] - sB) * rB : PITCH_ARC / 2;
  const deltaBExit = gapsB.length ? (eB - gapsB[gapsB.length - 1]) * rB : PITCH_ARC / 2;

  const rollers: Point[] = [];
  for (const ang of gapsA) rollers.push(ptA(ang));
  rollers.push(...lineRollers(g.pA1, g.pB1, PITCH_ARC - deltaAExit, lineLength - (PITCH_ARC - deltaBEntry)));
  for (const ang of gapsB) rollers.push(ptB(ang));
  rollers.push(...lineRollers(g.pB2, g.pA2, PITCH_ARC - deltaBExit, lineLength - (PITCH_ARC - deltaAEntry)));
  return rollers;
}

/** Pad-string (SVG) van een gesloten polygoon door punten. */
export function polygonPath(points: Point[]): string {
  if (points.length === 0) return "";
  return `M${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")}Z`;
}

/** Pad-string (SVG) met een cirkeltje per punt (één DOM-element voor alle rollers). */
export function circlesPath(points: Point[], r: number): string {
  const parts: string[] = [];
  for (const p of points) {
    const x = p.x;
    const y = p.y;
    parts.push(
      `M${(x - r).toFixed(1)},${y.toFixed(1)}a${r},${r} 0 1,0 ${(2 * r).toFixed(1)},0a${r},${r} 0 1,0 ${(-2 * r).toFixed(1)},0`
    );
  }
  return parts.join("");
}
