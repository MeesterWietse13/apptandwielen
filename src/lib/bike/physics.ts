import { chainRatio } from "@/lib/mechanics/chainPhysics";

export const REAR_TEETH = [11, 13, 15, 17, 20, 23, 26, 30, 34] as const;
export type BikeMode = "flat" | "hill" | "sprint";
export const BIKE = Object.freeze({ front: 40, pedalForce: 240, crank: 0.17, radius: 0.34, mass: 65, gravity: 9.81, rolling: 0.006, drag: 0.32, sustainableCadence: 90, hillCadenceFadeStart: 80, fatigueResetCadence: 89.5, maxCadence: 120, overCadenceSeconds: 3, fatigueDropSeconds: 1.2 });
export const ROUTES = { flat: { length: Infinity, rear: 4 }, hill: { length: 180, rear: 3 }, sprint: { length: 300, rear: 7 } };
export interface BikeState {
  mode: BikeMode; rear: number; speed: number; distance: number; elapsed: number;
  crankTurns: number; wheelTurns: number; running: boolean; finished: boolean;
  oneTurnRemaining: number; measured: boolean; shifts: number;
  highCadenceTime: number; fatigued: boolean;
}
export const initialBike = (mode: BikeMode = "flat"): BikeState => ({ mode, rear: ROUTES[mode].rear, speed: 0, distance: 0, elapsed: 0, crankTurns: 0, wheelTurns: 0, running: false, finished: false, oneTurnRemaining: 0, measured: false, shifts: 0, highCadenceTime: 0, fatigued: false });
export const ratio = (rear: number) => chainRatio(BIKE.front, REAR_TEETH[rear]);
export const gradeAt = (mode: BikeMode, distance: number) => mode === "hill" ? 0.012 + 0.13 * Math.min(1, distance / ROUTES.hill.length) : mode === "sprint" ? -0.012 : 0;
export const cadence = (s: BikeState) => s.speed / (2 * Math.PI * BIKE.radius * ratio(s.rear)) * 60;
export const targetCadence = (mode: BikeMode) => mode === "hill" ? 70 : 90;
export const maximumCadenceForMode = (mode: BikeMode) => mode === "hill" ? 90 : BIKE.maxCadence;
export const speedAtCadence = (rear: number, rpm: number) => 2 * Math.PI * BIKE.radius * ratio(rear) * rpm / 60;
export const maximumSpeed = (rear: number, mode: BikeMode = "flat") => speedAtCadence(rear, maximumCadenceForMode(mode));
export const wheelForce = (rear: number) => BIKE.pedalForce * BIKE.crank / ratio(rear) / BIKE.radius;
function cadenceEngagement(s: BikeState) {
  const rpm = cadence(s);
  if (s.mode === "hill") {
    const range = BIKE.sustainableCadence - BIKE.hillCadenceFadeStart;
    const progress = Math.max(0, Math.min(1, (rpm - BIKE.hillCadenceFadeStart) / range));
    const smoothProgress = progress * progress * (3 - 2 * progress);
    return 1 - smoothProgress;
  }
  const cadenceCeiling = s.fatigued ? BIKE.sustainableCadence : maximumCadenceForMode(s.mode);
  return Math.max(0, Math.min(1, cadenceCeiling - rpm));
}
export function forces(s: BikeState) {
  const grade = gradeAt(s.mode, s.distance);
  const gravity = BIKE.mass * BIKE.gravity * Math.sin(Math.atan(grade));
  const resistance = gravity + BIKE.mass * BIKE.gravity * BIKE.rolling + BIKE.drag * s.speed * s.speed;
  // Bergop neemt de effectieve duwkracht geleidelijk af wanneer de renner
  // zijn maximale traptempo nadert. Zo wordt een te licht verzet voelbaar
  // zonder een plotse sprong vlak voor 90 rpm.
  const engagement = cadenceEngagement(s);
  return { available: wheelForce(s.rear), drive: wheelForce(s.rear) * engagement, resistance, engagement };
}
function applyCadenceLimit(s: BikeState, proposedSpeed: number, seconds: number) {
  const modeMaximumSpeed = maximumSpeed(s.rear, s.mode);
  const cappedProposedSpeed = Math.min(proposedSpeed, modeMaximumSpeed);
  const proposedCadence = cappedProposedSpeed / (2 * Math.PI * BIKE.radius * ratio(s.rear)) * 60;
  if (s.fatigued) {
    if (proposedCadence < BIKE.sustainableCadence) return { speed: cappedProposedSpeed, highCadenceTime: 0, fatigued: false };
    const resetSpeed = speedAtCadence(s.rear, BIKE.fatigueResetCadence);
    const dropPerSecond = speedAtCadence(s.rear, BIKE.maxCadence - BIKE.fatigueResetCadence) / BIKE.fatigueDropSeconds;
    const speed = Math.max(resetSpeed, cappedProposedSpeed - dropPerSecond * seconds);
    const recovered = speed <= resetSpeed + 1e-9;
    return { speed, highCadenceTime: recovered ? 0 : BIKE.overCadenceSeconds, fatigued: !recovered };
  }
  const highCadenceTime = proposedCadence > BIKE.sustainableCadence ? Math.min(BIKE.overCadenceSeconds, s.highCadenceTime + seconds) : 0;
  if (highCadenceTime >= BIKE.overCadenceSeconds) {
    const dropPerSecond = speedAtCadence(s.rear, BIKE.maxCadence - BIKE.fatigueResetCadence) / BIKE.fatigueDropSeconds;
    return { speed: cappedProposedSpeed - dropPerSecond * seconds, highCadenceTime, fatigued: true };
  }
  return { speed: cappedProposedSpeed, highCadenceTime, fatigued: false };
}
export function shiftBike(s: BikeState, rear: number): BikeState {
  if (s.oneTurnRemaining > 0 || s.finished) return s;
  const next = Math.max(0, Math.min(8, rear));
  if (next === s.rear) return s;
  const speed = s.mode === "flat" && !s.running ? 0 : s.speed;
  const shiftedCadence = speed / (2 * Math.PI * BIKE.radius * ratio(next)) * 60;
  const recovered = shiftedCadence < BIKE.sustainableCadence;
  return { ...s, rear: next, speed, measured: false, shifts: s.shifts + 1, highCadenceTime: recovered ? 0 : s.highCadenceTime, fatigued: recovered ? false : s.fatigued };
}
export function oneTurn(s: BikeState): BikeState {
  return s.mode !== "flat" ? s : { ...s, speed: 0, distance: 0, elapsed: 0, running: true, oneTurnRemaining: 1, crankTurns: 0, wheelTurns: 0, measured: false, highCadenceTime: 0, fatigued: false };
}
export function stepBike(s: BikeState, dt: number): BikeState {
  if (!s.running || s.finished) return s;
  const h = Math.max(0, Math.min(dt, 0.05));
  if (s.mode === "flat") {
    const f = forces(s);
    const limited = applyCadenceLimit(s, Math.max(0, s.speed + (f.drive - f.resistance) / BIKE.mass * h), h);
    const nextSpeed = limited.speed;
    const possibleTravel = (s.speed + nextSpeed) / 2 * h;
    const circumference = 2 * Math.PI * BIKE.radius;
    const maximumTravel = s.oneTurnRemaining > 0 ? s.oneTurnRemaining * ratio(s.rear) * circumference : Infinity;
    const travel = Math.min(possibleTravel, maximumTravel);
    const usedFraction = possibleTravel > 0 ? travel / possibleTravel : 1;
    const dw = travel / circumference;
    const dc = dw / ratio(s.rear);
    const remaining = Math.max(0, s.oneTurnRemaining - dc);
    const done = s.oneTurnRemaining > 0 && remaining < 1e-9;
    return { ...s, speed: s.speed + (nextSpeed - s.speed) * usedFraction, distance: s.distance + travel, crankTurns: done ? 1 : s.crankTurns + dc, wheelTurns: done ? ratio(s.rear) : s.wheelTurns + dw, oneTurnRemaining: done ? 0 : remaining, running: !done, measured: done, elapsed: s.elapsed + h * usedFraction, highCadenceTime: limited.highCadenceTime, fatigued: limited.fatigued };
  }
  const f = forces(s);
  const limited = applyCadenceLimit(s, Math.max(0, s.speed + (f.drive - f.resistance) / BIKE.mass * h), h);
  const speed = limited.speed;
  const travel = Math.min((s.speed + speed) / 2 * h, ROUTES[s.mode].length - s.distance);
  const dw = travel / (2 * Math.PI * BIKE.radius);
  const distance = s.distance + travel;
  const finished = distance >= ROUTES[s.mode].length - 1e-8;
  return { ...s, speed, distance, wheelTurns: s.wheelTurns + dw, crankTurns: s.crankTurns + dw / ratio(s.rear), elapsed: s.elapsed + h, finished, running: !finished, highCadenceTime: limited.highCadenceTime, fatigued: limited.fatigued };
}
