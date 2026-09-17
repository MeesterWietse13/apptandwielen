// De centrale mechanische engine: het mechanisme als netwerk (graaf).
// Nodes = tandwielen en kettingtandwielen. Verbindingen = grijpen, ketting, zelfde as.
// Vanaf de motor wordt de relatieve rotatie van alles berekend (graph propagation).
import { chainDistanceOk, chainRatio } from "./chainPhysics";
import { pairRelation } from "./gearGeometry";
import { meshPhase, meshRatio } from "./gearPhysics";
import { SHAFT_RATIO, shaftLinkValid } from "./shaftPhysics";
import type { ComponentKind, Construction, Layer } from "./types";

export type EdgeType = "mesh" | "chain" | "shaft";

export interface Edge {
  id: string;
  a: string;
  b: string;
  type: EdgeType;
}

export type ProblemType = "overlap" | "conflict" | "noMotor" | "chain";

export interface Problem {
  type: ProblemType;
  ids: string[];
  message: string;
}

export interface NodeAnalysis {
  id: string;
  letter: string;
  kind: ComponentKind;
  teeth: number;
  layer: Layer;
  x: number;
  y: number;
  /** rondjes per motorrondje, met teken (+ = rechtsom) */
  omega: number;
  connected: boolean;
  /** basishoek (radialen) zodat tanden mooi in elkaar grijpen */
  phase: number;
  depth: number;
  overlap: boolean;
  conflict: boolean;
  meshedWith: string[];
  chainedWith: string[];
  shaftWith: string | null;
}

export interface Analysis {
  nodes: Record<string, NodeAnalysis>;
  order: string[];
  edges: Edge[];
  problems: Problem[];
  /** motor aanwezig en geen fouten: de machine mag draaien */
  canRun: boolean;
  /** er is een motor, maar de machine kan niet draaien */
  blocked: boolean;
  hasConflict: boolean;
  motorId: string | null;
  /** gekozen doel, of automatisch: het verste verbonden onderdeel */
  targetId: string | null;
  targetAuto: boolean;
  connectedIds: string[];
}

const EPS = 1e-9;

export function analyze(c: Construction): Analysis {
  const nodes: Record<string, NodeAnalysis> = {};
  const order = [...c.components].sort((a, b) => a.letter.localeCompare(b.letter)).map((k) => k.id);
  for (const k of c.components) {
    nodes[k.id] = {
      id: k.id,
      letter: k.letter,
      kind: k.kind,
      teeth: k.teeth,
      layer: k.layer,
      x: k.x,
      y: k.y,
      omega: 0,
      connected: false,
      phase: 0,
      depth: Infinity,
      overlap: false,
      conflict: false,
      meshedWith: [],
      chainedWith: [],
      shaftWith: null,
    };
  }
  const edges: Edge[] = [];
  const problems: Problem[] = [];

  // 1. Rechtstreeks grijpen / overlappen (zelfde laag, uit de geometrie)
  const overlapPairs: Array<[string, string]> = [];
  const comps = c.components;
  for (let i = 0; i < comps.length; i++) {
    for (let j = i + 1; j < comps.length; j++) {
      const a = comps[i];
      const b = comps[j];
      const rel = pairRelation(a, b);
      if (rel === "mesh") {
        edges.push({ id: `m:${a.id}:${b.id}`, a: a.id, b: b.id, type: "mesh" });
        nodes[a.id].meshedWith.push(b.id);
        nodes[b.id].meshedWith.push(a.id);
      } else if (rel === "overlap") {
        overlapPairs.push([a.id, b.id]);
        nodes[a.id].overlap = true;
        nodes[b.id].overlap = true;
      }
    }
  }
  for (const [a, b] of overlapPairs) {
    const la = nodes[a].letter;
    const lb = nodes[b].letter;
    problems.push({
      type: "overlap",
      ids: [a, b],
      message: `${la} en ${lb} zitten door elkaar. Verplaats ze eerst.`,
    });
  }

  // 2. Kettingen
  for (const ch of c.chains) {
    const a = nodes[ch.a];
    const b = nodes[ch.b];
    if (!a || !b) continue;
    const ok =
      a.kind === "sprocket" && b.kind === "sprocket" && a.layer === b.layer && chainDistanceOk(a, b);
    if (ok) {
      edges.push({ id: `c:${ch.id}`, a: ch.a, b: ch.b, type: "chain" });
      a.chainedWith.push(b.id);
      b.chainedWith.push(a.id);
    } else {
      problems.push({
        type: "chain",
        ids: [ch.a, ch.b],
        message: `De ketting tussen ${a.letter} en ${b.letter} klopt niet. Zet de kettingtandwielen verder uit elkaar.`,
      });
    }
  }

  // 3. Gedeelde assen
  for (const link of c.shafts) {
    if (!shaftLinkValid(c, link)) continue;
    edges.push({ id: `s:${link.a}:${link.b}`, a: link.a, b: link.b, type: "shaft" });
    nodes[link.a].shaftWith = link.b;
    nodes[link.b].shaftWith = link.a;
  }

  // Adjacentie
  const adj = new Map<string, Array<{ to: string; edge: Edge }>>();
  for (const id of Object.keys(nodes)) adj.set(id, []);
  for (const e of edges) {
    adj.get(e.a)!.push({ to: e.b, edge: e });
    adj.get(e.b)!.push({ to: e.a, edge: e });
  }

  const ratioOf = (from: NodeAnalysis, to: NodeAnalysis, type: EdgeType): number => {
    if (type === "mesh") return meshRatio(from.teeth, to.teeth);
    if (type === "chain") return chainRatio(from.teeth, to.teeth);
    return SHAFT_RATIO;
  };
  const phaseOf = (from: NodeAnalysis, to: NodeAnalysis, type: EdgeType): number => {
    if (type === "mesh") {
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      return meshPhase(from.phase, from.teeth, to.teeth, ang);
    }
    return from.phase;
  };

  const visited = new Set<string>();
  const conflictPairs: Array<[string, string]> = [];

  const propagate = (rootId: string, rootOmega: number, connected: boolean) => {
    const root = nodes[rootId];
    root.omega = rootOmega;
    root.phase = 0;
    root.connected = connected;
    root.depth = connected ? 0 : Infinity;
    visited.add(rootId);
    const queue = [rootId];
    while (queue.length) {
      const id = queue.shift()!;
      const from = nodes[id];
      for (const { to, edge } of adj.get(id)!) {
        const target = nodes[to];
        const ratio = ratioOf(from, target, edge.type);
        const expected = from.omega * ratio;
        if (visited.has(to)) {
          if (connected && Math.abs(target.omega - expected) > EPS) {
            conflictPairs.push([id, to]);
          }
          continue;
        }
        visited.add(to);
        target.omega = expected;
        target.phase = phaseOf(from, target, edge.type);
        target.connected = connected;
        target.depth = connected ? from.depth + 1 : Infinity;
        queue.push(to);
      }
    }
  };

  const motorId = c.motorId && nodes[c.motorId] ? c.motorId : null;
  if (motorId) propagate(motorId, c.motorDirection, true);
  for (const id of order) {
    if (!visited.has(id)) propagate(id, 0, false);
  }

  const connectedIds = order.filter((id) => nodes[id].connected);
  const hasConflict = conflictPairs.length > 0;
  if (hasConflict) {
    for (const id of connectedIds) nodes[id].conflict = true;
    problems.push({
      type: "conflict",
      ids: connectedIds,
      message: "⚠️ Dit tandwielstelsel blokkeert.",
    });
  }
  if (!motorId) {
    problems.push({
      type: "noMotor",
      ids: [],
      message: "Er is nog geen motor. Selecteer een tandwiel en kies ⚡ Maak motor.",
    });
  }

  const hardProblems = problems.filter((p) => p.type !== "noMotor");
  const canRun = !!motorId && hardProblems.length === 0;
  const blocked = !!motorId && hardProblems.length > 0;

  // Doel bepalen
  let targetId: string | null = null;
  let targetAuto = false;
  if (c.targetId && nodes[c.targetId]) {
    targetId = c.targetId;
  } else if (motorId) {
    let best: NodeAnalysis | null = null;
    for (const id of connectedIds) {
      if (id === motorId) continue;
      const n = nodes[id];
      if (!best || n.depth > best.depth || (n.depth === best.depth && n.letter > best.letter)) best = n;
    }
    if (best) {
      targetId = best.id;
      targetAuto = true;
    }
  }

  return {
    nodes,
    order,
    edges,
    problems,
    canRun,
    blocked,
    hasConflict,
    motorId,
    targetId,
    targetAuto,
    connectedIds,
  };
}

/** Technische controle voor de knop "Controleer opstelling" (verklapt geen oplossingen). */
export function technicalReport(c: Construction, a: Analysis): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  if (c.components.length === 0) {
    return { ok: false, lines: ["De werkbank is nog leeg. Voeg een tandwiel toe."] };
  }
  for (const p of a.problems) lines.push(p.message);
  if (a.motorId) {
    const loose = a.order.filter((id) => !a.nodes[id].connected).map((id) => a.nodes[id].letter);
    if (loose.length) lines.push(`Deze onderdelen bewegen niet mee: ${loose.join(", ")}.`);
    if (c.targetId && a.nodes[c.targetId] && !a.nodes[c.targetId].connected) {
      lines.push(`Het doeltandwiel ${a.nodes[c.targetId].letter} beweegt niet mee.`);
    }
  }
  const sprockets = c.components.filter((k) => k.kind === "sprocket");
  for (const s of sprockets) {
    if (!c.chains.some((ch) => ch.a === s.id || ch.b === s.id) && !a.nodes[s.id].shaftWith) {
      lines.push(`Kettingtandwiel ${s.letter} heeft nog geen ketting.`);
    }
  }
  if (lines.length === 0) lines.push("Alles in orde! De motor kan draaien.");
  return { ok: lines.length === 1 && lines[0].startsWith("Alles"), lines };
}
