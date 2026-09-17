// Gedeelde types voor de mechanische engine van het Tandwielenlab.
// Dit is de enige bron van waarheid voor de vorm van een constructie.

export type ComponentKind = "gear" | "sprocket";
export type Layer = 1 | 2;
/** 1 = rechtsom (met de klok mee op het scherm), -1 = linksom */
export type Direction = 1 | -1;

export interface MechComponent {
  id: string;
  letter: string;
  kind: ComponentKind;
  teeth: number;
  x: number;
  y: number;
  layer: Layer;
}

export interface Chain {
  id: string;
  a: string;
  b: string;
}

export interface ShaftLink {
  a: string;
  b: string;
}

export interface Construction {
  components: MechComponent[];
  chains: Chain[];
  shafts: ShaftLink[];
  motorId: string | null;
  motorDirection: Direction;
  targetId: string | null;
}

export const MAX_COMPONENTS = 10;
export const MIN_TEETH = 10;
export const MAX_TEETH = 60;
export const TEETH_PRESETS = [10, 15, 20, 25, 30, 40, 50, 60];
export const WORLD = { minX: -1600, maxX: 1600, minY: -1100, maxY: 1100 };
export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function emptyConstruction(): Construction {
  return {
    components: [],
    chains: [],
    shafts: [],
    motorId: null,
    motorDirection: 1,
    targetId: null,
  };
}

export function cloneConstruction(c: Construction): Construction {
  return JSON.parse(JSON.stringify(c)) as Construction;
}

export function nextLetter(components: MechComponent[]): string {
  for (const l of LETTERS) {
    if (!components.some((c) => c.letter === l)) return l;
  }
  return "?";
}

let idCounter = 0;
export function newId(prefix = "c"): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function getComponent(c: Construction, id: string | null | undefined): MechComponent | null {
  if (!id) return null;
  return c.components.find((k) => k.id === id) ?? null;
}

export function kindName(kind: ComponentKind): string {
  return kind === "gear" ? "tandwiel" : "kettingtandwiel";
}

export function componentLabel(comp: MechComponent): string {
  return `${comp.letter} — ${comp.teeth} tanden`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Een "vingerafdruk" van de mechanische structuur. Verandert die, dan zijn
 * oude metingen niet meer geldig. Het doeltandwiel hoort hier NIET bij: het
 * doel kiezen verandert de fysica niet.
 */
export function structureHash(c: Construction): string {
  const comps = [...c.components]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (k) =>
        `${k.id}:${k.kind}:${k.teeth}:${k.layer}:${Math.round(k.x * 2) / 2}:${Math.round(k.y * 2) / 2}`
    )
    .join("|");
  const chains = [...c.chains]
    .map((ch) => [ch.a, ch.b].sort().join("~"))
    .sort()
    .join("|");
  const shafts = [...c.shafts]
    .map((s) => [s.a, s.b].sort().join("~"))
    .sort()
    .join("|");
  return `${comps}#${chains}#${shafts}#${c.motorId ?? "-"}#${c.motorDirection}`;
}

function isLayer(v: unknown): v is Layer {
  return v === 1 || v === 2;
}

/** Maakt van onbekende data (localStorage, galerij) een geldige constructie. */
export function sanitizeConstruction(raw: unknown): Construction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.components)) return null;
  const components: MechComponent[] = [];
  for (const item of r.components as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    if (typeof it.id !== "string" || typeof it.x !== "number" || typeof it.y !== "number") continue;
    const kind: ComponentKind = it.kind === "sprocket" ? "sprocket" : "gear";
    const teeth = clamp(Math.round(Number(it.teeth) || 20), MIN_TEETH, MAX_TEETH);
    const layer: Layer = isLayer(it.layer) ? it.layer : 1;
    const letter = typeof it.letter === "string" && it.letter.length === 1 ? it.letter : "?";
    components.push({
      id: it.id,
      letter,
      kind,
      teeth,
      x: clamp(it.x, WORLD.minX, WORLD.maxX),
      y: clamp(it.y, WORLD.minY, WORLD.maxY),
      layer,
    });
    if (components.length >= MAX_COMPONENTS) break;
  }
  // Letters herstellen indien nodig
  components.forEach((c) => {
    if (c.letter === "?" || components.filter((o) => o.letter === c.letter).length > 1) {
      c.letter = nextLetter(components.filter((o) => o !== c));
    }
  });
  const ids = new Set(components.map((c) => c.id));
  const chains: Chain[] = [];
  if (Array.isArray(r.chains)) {
    for (const item of r.chains as unknown[]) {
      const it = item as Record<string, unknown>;
      if (it && typeof it.a === "string" && typeof it.b === "string" && ids.has(it.a) && ids.has(it.b) && it.a !== it.b) {
        chains.push({ id: typeof it.id === "string" ? it.id : newId("ch"), a: it.a, b: it.b });
      }
    }
  }
  const shafts: ShaftLink[] = [];
  if (Array.isArray(r.shafts)) {
    for (const item of r.shafts as unknown[]) {
      const it = item as Record<string, unknown>;
      if (it && typeof it.a === "string" && typeof it.b === "string" && ids.has(it.a) && ids.has(it.b) && it.a !== it.b) {
        shafts.push({ a: it.a, b: it.b });
      }
    }
  }
  const motorId = typeof r.motorId === "string" && ids.has(r.motorId) ? r.motorId : null;
  const targetId = typeof r.targetId === "string" && ids.has(r.targetId) ? r.targetId : null;
  const motorDirection: Direction = r.motorDirection === -1 ? -1 : 1;
  return { components, chains, shafts, motorId, targetId, motorDirection };
}
