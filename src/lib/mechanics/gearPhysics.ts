// Regels voor rechtstreeks in elkaar grijpende tandwielen.
import { toothAngle } from "./gearGeometry";
import type { Direction } from "./types";

/**
 * Verhouding van het aangedreven tandwiel t.o.v. het aandrijvende tandwiel.
 * Negatief: de draairichting keert om.
 * 40 tanden drijft 20 tanden aan: ratio = -2 (twee rondjes, andere kant op).
 */
export function meshRatio(driverTeeth: number, drivenTeeth: number): number {
  return -driverTeeth / drivenTeeth;
}

export function meshDirection(driverDirection: Direction): Direction {
  return driverDirection === 1 ? -1 : 1;
}

export function frac(x: number): number {
  return x - Math.floor(x);
}

/**
 * Berekent de basishoek (fase) van het aangedreven tandwiel zodat tand en
 * tandruimte precies tegenover elkaar staan op de verbindingslijn.
 * angleToDriven = hoek van de lijn van het aandrijvende naar het aangedreven middelpunt.
 */
export function meshPhase(
  driverPhase: number,
  driverTeeth: number,
  drivenTeeth: number,
  angleToDriven: number
): number {
  const pDriver = toothAngle(driverTeeth);
  const pDriven = toothAngle(drivenTeeth);
  const u = frac((angleToDriven - driverPhase) / pDriver);
  return angleToDriven + Math.PI - pDriven * (0.5 - u);
}
