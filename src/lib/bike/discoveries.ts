import type { BikeMode } from "./physics";
export interface BikeRecord { rear: number; wheelTurns: number; seconds: number; speed: number; shifts: number; cadence?: number }
export interface BikeProgress { prediction: string; answer: string; conclusion: string; records: BikeRecord[]; completed: boolean }
export type BikeJournal = Record<BikeMode, BikeProgress>;
export const newProgress = (): BikeProgress => ({ prediction: "", answer: "", conclusion: "", records: [], completed: false });
export const newJournal = (): BikeJournal => ({ flat: newProgress(), hill: newProgress(), sprint: newProgress() });
export const BIKE_LESSONS = [
  { id: "flat" as const, label: "Vlak", title: "Wat doet schakelen?", task: "Voorspel. Kies daarna minstens twee verschillende achtertandwielen en meet telkens 1 trapronde.", question: "Wat gebeurt er met het aantal wielrondes per trap als je achteraan een groter tandwiel kiest?", options: ["Meer wielrondes", "Evenveel wielrondes", "Minder wielrondes"], correct: "Minder wielrondes", discovery: "Een groter tandwiel achteraan geeft minder wielrondes per trap. Met een kleiner tandwiel achteraan maakt het wiel meer rondjes per trap." },
  { id: "hill" as const, label: "Bergrit", title: "Bereik de top", task: "Bereik de top. De weg wordt steeds steiler. Onderzoek hoe je onderweg kunt schakelen terwijl je benen even hard blijven duwen.", question: "Wat helpt als de berg steiler wordt?", options: ["Een groter tandwiel achteraan", "Een kleiner tandwiel achteraan", "Harder duwen met mijn benen"], correct: "Een groter tandwiel achteraan", discovery: "Als de berg steiler wordt, helpt een groter tandwiel achteraan. Je wiel maakt minder rondjes per trap, maar kan met dezelfde beenkracht harder tegen de grond duwen." },
  { id: "sprint" as const, label: "Sprint", title: "Zo snel mogelijk naar de finish", task: "Rijd naar de finish op een lichte afdaling. Onderzoek wanneer schakelen helpt. Reset en vergelijk je eindtijd.", question: "Hoe schakel je als je snelheid en traptempo stijgen?", options: ["Ik kies telkens een iets kleiner tandwiel achteraan", "Ik kies telkens een groter tandwiel achteraan", "Ik verander mijn beenkracht"], correct: "Ik kies telkens een iets kleiner tandwiel achteraan", discovery: "Als je sneller gaat, kun je naar een kleiner tandwiel achteraan schakelen. Het wiel maakt dan meer rondjes per trap, zolang je die versnelling nog goed rond krijgt." },
];
export function tested(mode: BikeMode, p: BikeProgress) { return mode === "flat" ? new Set(p.records.map(r => r.rear)).size >= 2 : p.records.length > 0; }
// Separate key: existing constructions and progress are never rewritten here.
const KEY = "tandwielenlab:bike:v1";
export function loadBikeJournal(): BikeJournal {
  const journal = newJournal();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    for (const mode of ["flat", "hill", "sprint"] as const) {
      const p = raw?.[mode];
      if (!p || typeof p !== "object") continue;
      journal[mode] = { prediction: typeof p.prediction === "string" ? p.prediction : "", answer: typeof p.answer === "string" ? p.answer : "", conclusion: typeof p.conclusion === "string" ? p.conclusion : "", completed: p.completed === true, records: Array.isArray(p.records) ? p.records.filter((r: BikeRecord) => r && [r.rear, r.wheelTurns, r.seconds, r.speed, r.shifts].every(Number.isFinite) && r.rear >= 0 && r.rear <= 8).slice(-30) : [] };
    }
  } catch { /* An unavailable or malformed store starts with an empty journal. */ }
  return journal;
}
export function saveBikeJournal(journal: BikeJournal): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(journal)); return true; } catch { return false; }
}
