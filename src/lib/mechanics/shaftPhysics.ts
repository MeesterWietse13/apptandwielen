// Gedeelde assen: twee onderdelen op verschillende lagen, zelfde middelpunt, 1 : 1.
import type { Construction, ShaftLink } from "./types";

/** Op dezelfde as = exact dezelfde rotatie. */
export const SHAFT_RATIO = 1;

export function shaftPartnerId(c: Construction, id: string): string | null {
  const link = c.shafts.find((s) => s.a === id || s.b === id);
  if (!link) return null;
  return link.a === id ? link.b : link.a;
}

export function shaftLinkValid(c: Construction, link: ShaftLink): boolean {
  const a = c.components.find((k) => k.id === link.a);
  const b = c.components.find((k) => k.id === link.b);
  if (!a || !b) return false;
  if (a.layer === b.layer) return false;
  return Math.hypot(a.x - b.x, a.y - b.y) < 0.01;
}

/** Verwijdert asverbindingen die niet meer kloppen (verplaatst, verwijderd, zelfde laag). */
export function cleanShafts(c: Construction): ShaftLink[] {
  const seen = new Set<string>();
  const out: ShaftLink[] = [];
  for (const link of c.shafts) {
    if (!shaftLinkValid(c, link)) continue;
    if (seen.has(link.a) || seen.has(link.b)) continue;
    seen.add(link.a);
    seen.add(link.b);
    out.push(link);
  }
  return out;
}

/** Zet beide onderdelen exact op hetzelfde middelpunt (de as). */
export function alignOnShaft(c: Construction, movedId: string, partnerId: string): Construction {
  const moved = c.components.find((k) => k.id === movedId);
  if (!moved) return c;
  return {
    ...c,
    components: c.components.map((k) => (k.id === partnerId ? { ...k, x: moved.x, y: moved.y } : k)),
  };
}
