"use client";
// Eén centrale bron van waarheid voor de werkbank: constructie, geschiedenis, selectie, simulatie.
import { useReducer } from "react";
import { chainDistanceOk } from "@/lib/mechanics/chainPhysics";
import { computeSnap, findFreeSpot, outerRadius } from "@/lib/mechanics/gearGeometry";
import { cleanShafts, shaftPartnerId } from "@/lib/mechanics/shaftPhysics";
import {
  clearMeasurement,
  initialSim,
  pauseTest,
  startOneTurn,
  startTest,
  stopSim,
  tick,
  type SimState,
  type Speed,
} from "@/lib/mechanics/simulationEngine";
import {
  clamp,
  emptyConstruction,
  MAX_COMPONENTS,
  MAX_TEETH,
  MIN_TEETH,
  newId,
  nextLetter,
  type ComponentKind,
  type Construction,
  type Direction,
  type Layer,
  type MechComponent,
} from "@/lib/mechanics/types";

export type LayerView = "L1" | "L2" | "both";
export type Selection = { type: "component"; id: string } | { type: "chain"; id: string } | null;
export type Tool = "select" | "chain";

export interface ViewState {
  zoom: number;
  tx: number;
  ty: number;
  layerView: LayerView;
  activeLayer: Layer;
}

export interface Notice {
  id: number;
  text: string;
  kind: "info" | "warn" | "ok";
}

export interface DragPreview {
  id: string;
  shaftWith: string | null;
  meshWith: string[];
}

export interface WorkbenchState {
  construction: Construction;
  past: Construction[];
  future: Construction[];
  txSnapshot: Construction | null;
  selection: Selection;
  view: ViewState;
  sim: SimState;
  speed: Speed;
  tool: Tool;
  chainFrom: string | null;
  notice: Notice | null;
  dragPreview: DragPreview | null;
  /** telt op bij elke structurele wijziging */
  structureVersion: number;
}

export type Action =
  | { type: "LOAD"; construction: Construction; keepHistory?: boolean }
  | { type: "CLEAR_ALL" }
  | { type: "ADD"; kind: ComponentKind; teeth?: number; near: { x: number; y: number } }
  | { type: "SET_TEETH"; id: string; teeth: number }
  | { type: "SET_LAYER"; id: string; layer: Layer }
  | { type: "DELETE"; id: string }
  | { type: "DUPLICATE"; id: string }
  | { type: "SET_MOTOR"; id: string | null }
  | { type: "SET_DIRECTION"; direction: Direction }
  | { type: "SET_TARGET"; id: string | null }
  | { type: "ADD_CHAIN"; a: string; b: string }
  | { type: "REMOVE_CHAIN"; id: string }
  | { type: "REMOVE_SHAFT"; id: string }
  | { type: "DRAG_START"; id: string }
  | { type: "DRAG_MOVE"; id: string; raw: { x: number; y: number } }
  | { type: "DRAG_END" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SELECT"; selection: Selection }
  | { type: "SET_VIEW"; patch: Partial<ViewState> }
  | { type: "SET_TOOL"; tool: Tool }
  | { type: "CHAIN_CLICK"; id: string }
  | { type: "SIM_TEST" }
  | { type: "SIM_PAUSE" }
  | { type: "SIM_STOP" }
  | { type: "SIM_ONE_TURN"; now: number }
  | { type: "SIM_CLEAR" }
  | { type: "SIM_TICK"; now: number; dt: number }
  | { type: "SET_SPEED"; speed: Speed }
  | { type: "NOTICE"; text: string; kind?: Notice["kind"] }
  | { type: "CLEAR_NOTICE" };

let noticeId = 0;
const mkNotice = (text: string, kind: Notice["kind"] = "info"): Notice => ({ id: ++noticeId, text, kind });

export const initialWorkbenchState = (): WorkbenchState => ({
  construction: emptyConstruction(),
  past: [],
  future: [],
  txSnapshot: null,
  selection: null,
  view: { zoom: 1, tx: 0, ty: 0, layerView: "L1", activeLayer: 1 },
  sim: initialSim(),
  speed: "normaal",
  tool: "select",
  chainFrom: null,
  notice: null,
  dragPreview: null,
  structureVersion: 0,
});

/** Verwijdert verwijzingen die niet meer kloppen (ketting zonder tandwiel, as die niet meer samenvalt...). */
export function normalize(c: Construction): Construction {
  const ids = new Set(c.components.map((k) => k.id));
  const byId = new Map(c.components.map((k) => [k.id, k]));
  const chains = c.chains.filter((ch) => {
    const a = byId.get(ch.a);
    const b = byId.get(ch.b);
    return a && b && a.kind === "sprocket" && b.kind === "sprocket" && a.layer === b.layer;
  });
  const shafts = cleanShafts({ ...c, chains });
  return {
    ...c,
    chains,
    shafts,
    motorId: c.motorId && ids.has(c.motorId) ? c.motorId : null,
    targetId: c.targetId && ids.has(c.targetId) ? c.targetId : null,
  };
}

const MAX_HISTORY = 80;

function commit(state: WorkbenchState, next: Construction, notice?: Notice | null): WorkbenchState {
  const construction = normalize(next);
  return {
    ...state,
    construction,
    past: [...state.past.slice(-MAX_HISTORY + 1), state.construction],
    future: [],
    sim: initialSim(),
    dragPreview: null,
    structureVersion: state.structureVersion + 1,
    notice: notice === undefined ? state.notice : notice,
  };
}

function shaftLinkedIds(c: Construction, id: string): string[] {
  const p = shaftPartnerId(c, id);
  return p ? [id, p] : [id];
}

export function reducer(state: WorkbenchState, action: Action): WorkbenchState {
  const c = state.construction;
  switch (action.type) {
    case "LOAD": {
      const construction = normalize(action.construction);
      return {
        ...state,
        construction,
        past: action.keepHistory ? [...state.past, state.construction] : [],
        future: [],
        selection: null,
        sim: initialSim(),
        dragPreview: null,
        tool: "select",
        chainFrom: null,
        structureVersion: state.structureVersion + 1,
      };
    }
    case "CLEAR_ALL": {
      if (c.components.length === 0) return state;
      return { ...commit(state, emptyConstruction(), mkNotice("De werkbank is leeg. Bouw iets nieuws!", "info")), selection: null };
    }
    case "ADD": {
      if (c.components.length >= MAX_COMPONENTS) {
        return { ...state, notice: mkNotice(`Je kunt maximaal ${MAX_COMPONENTS} onderdelen gebruiken.`, "warn") };
      }
      const teeth = clamp(action.teeth ?? (action.kind === "gear" ? 20 : 20), MIN_TEETH, MAX_TEETH);
      const layer = state.view.activeLayer;
      const pos = findFreeSpot(c, action.kind, teeth, layer, action.near);
      const comp: MechComponent = {
        id: newId(),
        letter: nextLetter(c.components),
        kind: action.kind,
        teeth,
        x: pos.x,
        y: pos.y,
        layer,
      };
      const next: Construction = { ...c, components: [...c.components, comp] };
      let notice: Notice | null = null;
      if (!next.motorId) {
        next.motorId = comp.id;
        notice = mkNotice(`${comp.letter} is nu de motor ⚡. Je kunt dat later veranderen.`, "ok");
      }
      return { ...commit(state, next, notice), selection: { type: "component", id: comp.id } };
    }
    case "SET_TEETH": {
      const comp = c.components.find((k) => k.id === action.id);
      const teeth = clamp(Math.round(action.teeth), MIN_TEETH, MAX_TEETH);
      if (!comp || comp.teeth === teeth) return state;
      return commit(state, { ...c, components: c.components.map((k) => (k.id === action.id ? { ...k, teeth } : k)) });
    }
    case "SET_LAYER": {
      const comp = c.components.find((k) => k.id === action.id);
      if (!comp || comp.layer === action.layer) return state;
      const ids = new Set([action.id]);
      const next: Construction = {
        ...c,
        components: c.components.map((k) => (ids.has(k.id) ? { ...k, layer: action.layer } : k)),
        shafts: c.shafts.filter((s) => s.a !== action.id && s.b !== action.id),
      };
      return commit(state, next, mkNotice(`${comp.letter} ligt nu op Laag ${action.layer}.`, "info"));
    }
    case "DELETE": {
      const comp = c.components.find((k) => k.id === action.id);
      if (!comp) return state;
      const next: Construction = {
        ...c,
        components: c.components.filter((k) => k.id !== action.id),
        chains: c.chains.filter((ch) => ch.a !== action.id && ch.b !== action.id),
        shafts: c.shafts.filter((s) => s.a !== action.id && s.b !== action.id),
      };
      return { ...commit(state, next), selection: null };
    }
    case "DUPLICATE": {
      const comp = c.components.find((k) => k.id === action.id);
      if (!comp) return state;
      if (c.components.length >= MAX_COMPONENTS) {
        return { ...state, notice: mkNotice(`Je kunt maximaal ${MAX_COMPONENTS} onderdelen gebruiken.`, "warn") };
      }
      const ro = outerRadius(comp.kind, comp.teeth);
      const pos = findFreeSpot(c, comp.kind, comp.teeth, comp.layer, { x: comp.x + ro * 2 + 30, y: comp.y });
      const copy: MechComponent = { ...comp, id: newId(), letter: nextLetter(c.components), x: pos.x, y: pos.y };
      return { ...commit(state, { ...c, components: [...c.components, copy] }), selection: { type: "component", id: copy.id } };
    }
    case "SET_MOTOR": {
      if (c.motorId === action.id) return state;
      const comp = c.components.find((k) => k.id === action.id);
      const next: Construction = { ...c, motorId: action.id, targetId: c.targetId === action.id ? null : c.targetId };
      return commit(state, next, comp ? mkNotice(`${comp.letter} is nu de motor ⚡`, "ok") : null);
    }
    case "SET_DIRECTION": {
      if (c.motorDirection === action.direction) return state;
      return commit(state, { ...c, motorDirection: action.direction });
    }
    case "SET_TARGET": {
      if (c.targetId === action.id) return state;
      // Doel kiezen verandert de fysica niet: geen sim-reset
      const construction = { ...c, targetId: action.id === c.motorId ? null : action.id };
      return { ...state, construction, past: [...state.past, c], future: [] };
    }
    case "ADD_CHAIN": {
      const a = c.components.find((k) => k.id === action.a);
      const b = c.components.find((k) => k.id === action.b);
      if (!a || !b || a.id === b.id) return state;
      if (a.kind !== "sprocket" || b.kind !== "sprocket") return { ...state, notice: mkNotice("Een ketting hoort tussen twee kettingtandwielen.", "warn") };
      if (a.layer !== b.layer) return { ...state, notice: mkNotice("Een ketting verbindt twee kettingtandwielen op dezelfde laag.", "warn") };
      if (c.chains.some((ch) => (ch.a === a.id && ch.b === b.id) || (ch.a === b.id && ch.b === a.id))) {
        return { ...state, notice: mkNotice(`${a.letter} en ${b.letter} zijn al verbonden met een ketting.`, "warn") };
      }
      if (!chainDistanceOk(a, b)) return { ...state, notice: mkNotice("Zet de kettingtandwielen verder uit elkaar voor je een ketting plaatst.", "warn") };
      const chain = { id: newId("ch"), a: a.id, b: b.id };
      return {
        ...commit(state, { ...c, chains: [...c.chains, chain] }, mkNotice(`Ketting geplaatst tussen ${a.letter} en ${b.letter}.`, "ok")),
        selection: { type: "chain", id: chain.id },
        tool: "select",
        chainFrom: null,
      };
    }
    case "REMOVE_CHAIN": {
      if (!c.chains.some((ch) => ch.id === action.id)) return state;
      return { ...commit(state, { ...c, chains: c.chains.filter((ch) => ch.id !== action.id) }), selection: null };
    }
    case "REMOVE_SHAFT": {
      const partner = shaftPartnerId(c, action.id);
      if (!partner) return state;
      return commit(state, { ...c, shafts: c.shafts.filter((s) => s.a !== action.id && s.b !== action.id) }, mkNotice("Van de as gehaald. Sleep het onderdeel weg.", "info"));
    }
    case "DRAG_START": {
      if (!c.components.some((k) => k.id === action.id)) return state;
      return { ...state, txSnapshot: c, selection: { type: "component", id: action.id }, sim: stopSim(state.sim) };
    }
    case "DRAG_MOVE": {
      const comp = c.components.find((k) => k.id === action.id);
      if (!comp) return state;
      const snap = computeSnap(c, action.id, action.raw);
      const ids = new Set(shaftLinkedIds(c, action.id));
      const components = c.components.map((k) => (ids.has(k.id) ? { ...k, x: snap.x, y: snap.y } : k));
      return {
        ...state,
        construction: { ...c, components },
        sim: initialSim(),
        dragPreview: { id: action.id, shaftWith: snap.shaftWith, meshWith: snap.meshWith },
      };
    }
    case "DRAG_END": {
      const snapshot = state.txSnapshot;
      if (!snapshot) return { ...state, dragPreview: null };
      const changed = JSON.stringify(snapshot.components) !== JSON.stringify(c.components);
      if (!changed) return { ...state, txSnapshot: null, dragPreview: null };
      const preview = state.dragPreview;
      let shafts = c.shafts;
      let notice: Notice | null = null;
      if (preview?.shaftWith) {
        shafts = [...shafts.filter((s) => s.a !== preview.id && s.b !== preview.id && s.a !== preview.shaftWith && s.b !== preview.shaftWith), { a: preview.id, b: preview.shaftWith }];
        const a = c.components.find((k) => k.id === preview.id);
        const b = c.components.find((k) => k.id === preview.shaftWith);
        if (a && b) notice = mkNotice(`${a.letter} en ${b.letter} zitten nu op dezelfde as.`, "ok");
      }
      const next = normalize({ ...c, shafts });
      return {
        ...state,
        construction: next,
        past: [...state.past.slice(-MAX_HISTORY + 1), snapshot],
        future: [],
        txSnapshot: null,
        dragPreview: null,
        sim: initialSim(),
        structureVersion: state.structureVersion + 1,
        notice: notice ?? state.notice,
      };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        construction: prev,
        past: state.past.slice(0, -1),
        future: [c, ...state.future].slice(0, MAX_HISTORY),
        sim: initialSim(),
        selection: null,
        dragPreview: null,
        structureVersion: state.structureVersion + 1,
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        construction: next,
        past: [...state.past, c],
        future: rest,
        sim: initialSim(),
        selection: null,
        dragPreview: null,
        structureVersion: state.structureVersion + 1,
      };
    }
    case "SELECT":
      return { ...state, selection: action.selection };
    case "SET_VIEW":
      return { ...state, view: { ...state.view, ...action.patch } };
    case "SET_TOOL": {
      if (action.tool === "chain") {
        const sprockets = c.components.filter((k) => k.kind === "sprocket");
        if (sprockets.length < 2) {
          return { ...state, notice: mkNotice("Je hebt twee kettingtandwielen nodig voor een ketting. Druk op + Kettingtandwiel.", "warn") };
        }
        return { ...state, tool: "chain", chainFrom: null, notice: mkNotice("Klik op het eerste kettingtandwiel.", "info") };
      }
      return { ...state, tool: "select", chainFrom: null };
    }
    case "CHAIN_CLICK": {
      const comp = c.components.find((k) => k.id === action.id);
      if (!comp) return state;
      if (comp.kind !== "sprocket") return { ...state, notice: mkNotice(`${comp.letter} is een gewoon tandwiel. Kies een kettingtandwiel.`, "warn") };
      if (!state.chainFrom) {
        return { ...state, chainFrom: comp.id, notice: mkNotice(`${comp.letter} gekozen. Klik nu op het tweede kettingtandwiel.`, "info") };
      }
      if (state.chainFrom === comp.id) return { ...state, chainFrom: null, notice: mkNotice("Klik op het eerste kettingtandwiel.", "info") };
      return reducer(state, { type: "ADD_CHAIN", a: state.chainFrom, b: comp.id });
    }
    case "SIM_TEST":
      return { ...state, sim: startTest(state.sim) };
    case "SIM_PAUSE":
      return { ...state, sim: pauseTest(state.sim) };
    case "SIM_STOP":
      return { ...state, sim: stopSim(state.sim) };
    case "SIM_ONE_TURN":
      return { ...state, sim: startOneTurn(state.sim, action.now, state.speed) };
    case "SIM_CLEAR":
      return { ...state, sim: clearMeasurement(state.sim) };
    case "SIM_TICK": {
      const r = tick(state.sim, action.now, action.dt, state.speed);
      if (r.state === state.sim) return state;
      return { ...state, sim: r.state };
    }
    case "SET_SPEED":
      return { ...state, speed: action.speed };
    case "NOTICE":
      return { ...state, notice: mkNotice(action.text, action.kind ?? "info") };
    case "CLEAR_NOTICE":
      return state.notice ? { ...state, notice: null } : state;
    default:
      return state;
  }
}

export function useWorkbench() {
  return useReducer(reducer, undefined, initialWorkbenchState);
}
