// Opdrachtenmotor: testrecords, voorwaarden en validatie van ontdekopdrachten en bouwuitdagingen.
// Er wordt NOOIT op coördinaten gecontroleerd, alleen op mechanische eigenschappen.
import { dist } from "@/lib/mechanics/gearGeometry";
import type { Analysis, NodeAnalysis } from "@/lib/mechanics/mechanismGraph";
import {
  cloneConstruction,
  type ComponentKind,
  type Construction,
  type Direction,
  type Layer,
} from "@/lib/mechanics/types";

export interface RecordNode {
  letter: string;
  kind: ComponentKind;
  teeth: number;
  layer: Layer;
  /** rondjes per motorrondje */
  revs: number;
  dir: Direction | 0;
  connected: boolean;
  isMotor: boolean;
  meshCount: number;
}

export interface TestRecord {
  id: string;
  at: number;
  kind: "oneTurn" | "test";
  hash: string;
  valid: boolean;
  motor: RecordNode | null;
  targetLetter: string | null;
  nodes: RecordNode[];
  gearCount: number;
  sprocketCount: number;
  chainCount: number;
  shaftCount: number;
  meshCount: number;
  layers: Layer[];
  allConnected: boolean;
  totalComponents: number;
  /** een gewone rij tandwielen: motor vooraan, elk grijpt in de volgende */
  series: boolean;
  motorTargetDistance: number;
  shaftPairs: Array<{ a: string; b: string }>;
  snapshot: Construction;
}

export function buildRecord(c: Construction, a: Analysis, kind: "oneTurn" | "test", hash: string): TestRecord {
  const conn = new Set(a.connectedIds);
  const nodes: RecordNode[] = a.order.map((id) => {
    const n = a.nodes[id];
    return {
      letter: n.letter,
      kind: n.kind,
      teeth: n.teeth,
      layer: n.layer,
      revs: Math.abs(n.omega),
      dir: n.connected ? (n.omega > 0 ? 1 : n.omega < 0 ? -1 : 0) : 0,
      connected: n.connected,
      isMotor: id === a.motorId,
      meshCount: n.meshedWith.filter((o) => conn.has(o)).length,
    };
  });
  const connNodes = a.connectedIds.map((id) => a.nodes[id]);
  const inConn = (e: { a: string; b: string }) => conn.has(e.a) && conn.has(e.b);
  const motor = nodes.find((n) => n.isMotor) ?? null;
  const motorNode = a.motorId ? a.nodes[a.motorId] : null;
  const targetNode = a.targetId ? a.nodes[a.targetId] : null;
  const connRecordNodes = nodes.filter((n) => n.connected);
  const series =
    connRecordNodes.length >= 2 &&
    connRecordNodes.every((n) => n.kind === "gear" && n.meshCount <= 2) &&
    a.edges.filter(inConn).every((e) => e.type === "mesh") &&
    connRecordNodes.filter((n) => n.meshCount === 1).length === 2 &&
    !!motor &&
    motor.meshCount === 1;
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    kind,
    hash,
    valid: a.canRun,
    motor,
    targetLetter: targetNode ? targetNode.letter : null,
    nodes,
    gearCount: connNodes.filter((n) => n.kind === "gear").length,
    sprocketCount: connNodes.filter((n) => n.kind === "sprocket").length,
    chainCount: a.edges.filter((e) => e.type === "chain" && inConn(e)).length,
    shaftCount: a.edges.filter((e) => e.type === "shaft" && inConn(e)).length,
    meshCount: a.edges.filter((e) => e.type === "mesh" && inConn(e)).length,
    layers: Array.from(new Set(connNodes.map((n) => n.layer))).sort() as Layer[],
    allConnected: c.components.length > 0 && a.connectedIds.length === c.components.length,
    totalComponents: c.components.length,
    series,
    motorTargetDistance: motorNode && targetNode ? dist(motorNode, targetNode) : 0,
    shaftPairs: a.edges
      .filter((e) => e.type === "shaft" && inConn(e))
      .map((e) => ({ a: a.nodes[e.a].letter, b: a.nodes[e.b].letter })),
    snapshot: cloneConstruction(c),
  };
}

/** Het doel binnen een record: liefst het nu gekozen doel, anders het doel van toen. */
export function recordTarget(rec: TestRecord, preferredLetter?: string | null): RecordNode | null {
  const pick = (letter: string | null | undefined) => {
    if (!letter) return null;
    const n = rec.nodes.find((k) => k.letter === letter);
    return n && n.connected && !n.isMotor ? n : null;
  };
  return pick(preferredLetter) ?? pick(rec.targetLetter);
}

export function recordNode(rec: TestRecord, letter: string): RecordNode | null {
  return rec.nodes.find((n) => n.letter === letter) ?? null;
}

// ---------- Opdrachtdefinities ----------

export interface LiveContext {
  construction: Construction;
  analysis: Analysis;
  hash: string;
}

export interface EvalCtx {
  live: LiveContext;
  /** record dat hoort bij de huidige constructie (indien getest) */
  current: TestRecord | null;
  records: TestRecord[];
  /** doel in het huidige record */
  target: RecordNode | null;
  liveTarget: NodeAnalysis | null;
  liveMotor: NodeAnalysis | null;
}

export interface ReqDef {
  id: string;
  label: string;
  test: (ctx: EvalCtx) => boolean;
  detail?: (ctx: EvalCtx) => string | null;
  hint?: string;
}

export interface Option {
  id: string;
  label: string;
}

export type MissionGroup = "gears" | "chains" | "layers";
export type MissionKind = "discovery" | "challenge";

export interface MissionDef {
  id: string;
  kind: MissionKind;
  group: MissionGroup;
  number: number;
  title: string;
  /** korte opdrachtzinnen */
  steps: string[];
  prediction?: { question: string; options: Option[] };
  answer?: { question: string; options: Option[]; truth: (ctx: EvalCtx) => string | null };
  conclusionPrompt?: string;
  conclusionPlaceholder?: string;
  /** de officiële ontdekking, pas zichtbaar na afronden */
  discovery?: string;
  hints: string[];
  requirements: ReqDef[];
}

export interface MissionProgress {
  prediction: string | null;
  answer: string | null;
  conclusion: string;
  records: TestRecord[];
  completed: boolean;
  completedAt: number | null;
  hintLevel: number;
  attempts: number;
  result: { record: TestRecord; targetLetter: string | null } | null;
}

export const emptyProgress = (): MissionProgress => ({
  prediction: null,
  answer: null,
  conclusion: "",
  records: [],
  completed: false,
  completedAt: null,
  hintLevel: 0,
  attempts: 0,
  result: null,
});

export interface ReqStatus {
  id: string;
  label: string;
  done: boolean;
  detail: string | null;
  hint: string | null;
}

export interface MissionEvaluation {
  requirements: ReqStatus[];
  mechanicsOk: boolean;
  truth: string | null;
  answerCorrect: boolean | null;
  predictionOk: boolean;
  conclusionOk: boolean;
  canComplete: boolean;
  nextTip: string | null;
  current: TestRecord | null;
}

export function makeCtx(progress: MissionProgress, live: LiveContext): EvalCtx {
  const a = live.analysis;
  const current = progress.records.find((r) => r.hash === live.hash) ?? null;
  const liveTarget = a.targetId ? a.nodes[a.targetId] : null;
  const liveMotor = a.motorId ? a.nodes[a.motorId] : null;
  const target = current ? recordTarget(current, liveTarget?.letter ?? null) : null;
  return { live, current, records: progress.records, target, liveTarget, liveMotor };
}

export function evaluateMission(def: MissionDef, progress: MissionProgress, live: LiveContext): MissionEvaluation {
  const ctx = makeCtx(progress, live);
  const requirements: ReqStatus[] = def.requirements.map((r) => {
    let done = false;
    try {
      done = r.test(ctx);
    } catch {
      done = false;
    }
    return {
      id: r.id,
      label: r.label,
      done,
      detail: r.detail ? r.detail(ctx) : null,
      hint: r.hint ?? null,
    };
  });
  const mechanicsOk = requirements.every((r) => r.done);
  const truth = def.answer && mechanicsOk ? def.answer.truth(ctx) : null;
  const answerCorrect = def.answer && progress.answer && truth ? progress.answer === truth : null;
  const predictionOk = !def.prediction || !!progress.prediction;
  const conclusionOk = !def.conclusionPrompt || (mechanicsOk && (!def.answer || answerCorrect === true));
  const canComplete =
    def.kind === "challenge"
      ? mechanicsOk
      : mechanicsOk && predictionOk && (!def.answer || answerCorrect === true) && conclusionOk;
  const firstFail = requirements.find((r) => !r.done);
  const nextTip = firstFail ? firstFail.detail ?? firstFail.hint : null;
  return {
    requirements,
    mechanicsOk,
    truth,
    answerCorrect,
    predictionOk,
    conclusionOk,
    canComplete,
    nextTip,
    current: ctx.current,
  };
}

export function addRecord(progress: MissionProgress, rec: TestRecord): MissionProgress {
  const records = progress.records.filter((r) => r.hash !== rec.hash);
  records.push(rec);
  while (records.length > 25) records.shift();
  return { ...progress, records };
}

export function completeMission(progress: MissionProgress, ev: MissionEvaluation, targetLetter: string | null): MissionProgress {
  const record = ev.current ?? progress.records[progress.records.length - 1] ?? null;
  return {
    ...progress,
    completed: true,
    completedAt: Date.now(),
    result: record ? { record, targetLetter } : null,
  };
}
