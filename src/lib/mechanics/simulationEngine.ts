// Simulatie: Test (continu), Motor 1 rondje (exact), meetresultaten.
// De uitkomst wordt wiskundig berekend; de animatie volgt alleen dat resultaat.
import type { Analysis } from "./mechanismGraph";
import type { ComponentKind, Construction, Direction, Layer } from "./types";

export type Speed = "traag" | "normaal" | "snel";
export const SPEEDS: Speed[] = ["traag", "normaal", "snel"];
/** motorrondjes per seconde in Test-modus */
export const TEST_RATE: Record<Speed, number> = { traag: 0.1, normaal: 0.25, snel: 0.55 };
/** duur van "Motor 1 rondje" in ms */
export const ONE_TURN_MS: Record<Speed, number> = { traag: 4500, normaal: 2400, snel: 1300 };

export type SimStatus = "idle" | "test" | "paused" | "oneTurn";

export interface SimState {
  status: SimStatus;
  /** aantal motorrondjes sinds de laatste meting-start (de enige tijdvariabele) */
  theta: number;
  oneTurn: { from: number; to: number; startedAt: number; duration: number } | null;
  /** een volledig "Motor 1 rondje" is afgerond met deze constructie */
  oneTurnDone: boolean;
  hasRun: boolean;
}

export const initialSim = (): SimState => ({
  status: "idle",
  theta: 0,
  oneTurn: null,
  oneTurnDone: false,
  hasRun: false,
});

export function startTest(s: SimState): SimState {
  return { ...s, status: "test", oneTurn: null, hasRun: true };
}

export function pauseTest(s: SimState): SimState {
  if (s.status !== "test") return s;
  return { ...s, status: "paused" };
}

export function stopSim(s: SimState): SimState {
  return { ...s, status: "idle", oneTurn: null };
}

/** Meettellers voorbereiden en exact één motorrondje starten. */
export function startOneTurn(s: SimState, now: number, speed: Speed): SimState {
  return {
    status: "oneTurn",
    theta: 0,
    oneTurn: { from: 0, to: 1, startedAt: now, duration: ONE_TURN_MS[speed] },
    oneTurnDone: false,
    hasRun: true,
  };
}

/** Wist alleen de meetwaarden; de constructie blijft staan. */
export function clearMeasurement(s: SimState): SimState {
  if (s.status === "oneTurn") return { ...initialSim() };
  return { ...s, theta: 0, oneTurnDone: false };
}

export const smoothstep = (t: number) => t * t * (3 - 2 * t);

export interface TickResult {
  state: SimState;
  completedOneTurn: boolean;
  crossedOne: boolean;
}

export function tick(s: SimState, now: number, dtMs: number, speed: Speed): TickResult {
  if (s.status === "test") {
    const prev = s.theta;
    const theta = prev + (TEST_RATE[speed] * Math.min(dtMs, 100)) / 1000;
    return { state: { ...s, theta }, completedOneTurn: false, crossedOne: prev < 1 && theta >= 1 };
  }
  if (s.status === "oneTurn" && s.oneTurn) {
    const { from, to, startedAt, duration } = s.oneTurn;
    const t = Math.max(0, Math.min(1, (now - startedAt) / duration));
    if (t >= 1) {
      // Exact eindresultaat: geen afhankelijkheid van framerate of snelheid.
      return {
        state: { ...s, status: "idle", theta: to, oneTurn: null, oneTurnDone: true },
        completedOneTurn: true,
        crossedOne: true,
      };
    }
    const theta = from + (to - from) * smoothstep(t);
    return { state: { ...s, theta }, completedOneTurn: false, crossedOne: false };
  }
  return { state: s, completedOneTurn: false, crossedOne: false };
}

/** Rotatiehoek (graden) van een onderdeel bij een bepaalde motorstand. */
export function angleDeg(phase: number, omega: number, theta: number): number {
  return ((phase + 2 * Math.PI * omega * theta) * 180) / Math.PI;
}

export interface Measurement {
  id: string;
  letter: string;
  kind: ComponentKind;
  teeth: number;
  layer: Layer;
  /** gemaakte rondjes sinds de meting startte */
  revs: number;
  /** rondjes per motorrondje */
  revsPerTurn: number;
  direction: Direction | 0;
  connected: boolean;
  isMotor: boolean;
}

export function measure(c: Construction, a: Analysis, theta: number): Measurement[] {
  return a.order.map((id) => {
    const n = a.nodes[id];
    const dir: Direction | 0 = n.connected ? (n.omega > 0 ? 1 : n.omega < 0 ? -1 : 0) : 0;
    return {
      id,
      letter: n.letter,
      kind: n.kind,
      teeth: n.teeth,
      layer: n.layer,
      revs: Math.abs(n.omega) * theta,
      revsPerTurn: Math.abs(n.omega),
      direction: dir,
      connected: n.connected,
      isMotor: c.motorId === id,
    };
  });
}
