// Nederlandse notatie voor getallen en kindvriendelijke woorden.
import type { Direction } from "@/lib/mechanics/types";

export function fmtNumber(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10 ** decimals) / 10 ** decimals;
  return rounded.toFixed(decimals).replace(".", ",");
}

export function fmtRevs(n: number): string {
  return fmtNumber(n, 2);
}

const WORDS: Array<[number, string]> = [
  [0.25, "een kwart rondje"],
  [1 / 3, "een derde rondje"],
  [0.5, "een half rondje"],
  [2 / 3, "twee derde rondje"],
  [0.75, "driekwart rondje"],
  [1, "één rondje"],
  [1.5, "anderhalf rondje"],
  [2, "twee rondjes"],
  [2.5, "tweeënhalf rondje"],
  [3, "drie rondjes"],
  [4, "vier rondjes"],
  [5, "vijf rondjes"],
  [6, "zes rondjes"],
  [8, "acht rondjes"],
  [10, "tien rondjes"],
];

/** Woorden voor eenvoudige waarden, bv. 0,50 → "een half rondje". */
export function revsWords(n: number): string | null {
  for (const [v, w] of WORDS) {
    if (Math.abs(n - v) < 0.004) return w;
  }
  return null;
}

export function dirWord(d: Direction | 0): string {
  if (d === 1) return "rechtsom";
  if (d === -1) return "linksom";
  return "stil";
}

export function dirArrow(d: Direction | 0): string {
  if (d === 1) return "↻";
  if (d === -1) return "↺";
  return "•";
}

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
