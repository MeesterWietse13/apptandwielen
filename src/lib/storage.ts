// Lokale opslag (localStorage) van voortgang, constructies, metingen en instellingen.
import { emptyProgress, type MissionProgress } from "@/lib/missions/missionEngine";
import { sanitizeConstruction, type Construction } from "@/lib/mechanics/types";

const KEY = "tandwielenlab:v1";

export type Zone = "ontdekzone" | "labzone" | "buildzone";

export interface SavedData {
  version: 1;
  free: { construction: Construction } | null;
  lab: { currentMissionId: string | null; constructions: Record<string, Construction> };
  build: { currentMissionId: string | null };
  progress: Record<string, MissionProgress>;
  lastZone: Zone | null;
  studentName: string;
  studentClass: string;
  updatedAt: number;
}

export const emptyData = (): SavedData => ({
  version: 1,
  free: null,
  lab: { currentMissionId: null, constructions: {} },
  build: { currentMissionId: null },
  progress: {},
  lastZone: null,
  studentName: "",
  studentClass: "",
  updatedAt: 0,
});

const hasWindow = () => typeof window !== "undefined" && !!window.localStorage;

export function loadData(): SavedData {
  if (!hasWindow()) return emptyData();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as Partial<SavedData>;
    const data = emptyData();
    if (parsed.free && parsed.free.construction) {
      const c = sanitizeConstruction(parsed.free.construction);
      if (c) data.free = { construction: c };
    }
    if (parsed.lab) {
      data.lab.currentMissionId = typeof parsed.lab.currentMissionId === "string" ? parsed.lab.currentMissionId : null;
      const cons = parsed.lab.constructions ?? {};
      for (const [k, v] of Object.entries(cons)) {
        const c = sanitizeConstruction(v);
        if (c) data.lab.constructions[k] = c;
      }
    }
    if (parsed.build) {
      data.build.currentMissionId = typeof parsed.build.currentMissionId === "string" ? parsed.build.currentMissionId : null;
    }
    if (parsed.progress && typeof parsed.progress === "object") {
      for (const [k, v] of Object.entries(parsed.progress)) {
        data.progress[k] = { ...emptyProgress(), ...(v as MissionProgress) };
      }
    }
    data.lastZone = parsed.lastZone === "ontdekzone" || parsed.lastZone === "labzone" || parsed.lastZone === "buildzone" ? parsed.lastZone : null;
    data.studentName = typeof parsed.studentName === "string" ? parsed.studentName : "";
    data.studentClass = typeof parsed.studentClass === "string" ? parsed.studentClass : "";
    data.updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0;
    return data;
  } catch {
    return emptyData();
  }
}

export function saveData(data: SavedData): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...data, updatedAt: Date.now() }));
  } catch {
    // opslag vol of geblokkeerd: stil negeren
  }
}

export function updateData(fn: (d: SavedData) => SavedData): SavedData {
  const next = fn(loadData());
  saveData(next);
  return next;
}

export function resetAll(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(KEY);
}

export function hasAnyProgress(data: SavedData): boolean {
  return !!data.free || Object.keys(data.progress).length > 0 || Object.keys(data.lab.constructions).length > 0;
}

export function completedCount(data: SavedData): number {
  return Object.values(data.progress).filter((p) => p.completed).length;
}
