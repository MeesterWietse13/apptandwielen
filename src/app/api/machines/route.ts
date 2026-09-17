import { db } from "@/db";
import { sharedMachines } from "@/db/schema";
import { sanitizeConstruction } from "@/lib/mechanics/types";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!db) {
      return Response.json({ ok: false, machines: [], error: "De Machinegalerij is lokaal niet geconfigureerd." }, { status: 503 });
    }
    const rows = await db
      .select({
        id: sharedMachines.id,
        name: sharedMachines.name,
        author: sharedMachines.author,
        construction: sharedMachines.construction,
        componentCount: sharedMachines.componentCount,
        createdAt: sharedMachines.createdAt,
      })
      .from(sharedMachines)
      .orderBy(desc(sharedMachines.createdAt))
      .limit(30);
    return Response.json({ ok: true, machines: rows });
  } catch (err) {
    console.error("GET /api/machines", err);
    return Response.json({ ok: false, machines: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!db) {
      return Response.json({ ok: false, error: "De Machinegalerij is lokaal niet geconfigureerd." }, { status: 503 });
    }
    const body = (await req.json()) as { name?: unknown; author?: unknown; construction?: unknown };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
    const author = typeof body.author === "string" ? body.author.trim().slice(0, 40) : "";
    const construction = sanitizeConstruction(body.construction);
    if (!name || !construction || construction.components.length === 0) {
      return Response.json({ ok: false, error: "Geef je machine een naam en zorg dat ze onderdelen heeft." }, { status: 400 });
    }
    const [row] = await db
      .insert(sharedMachines)
      .values({ name, author, construction, componentCount: construction.components.length })
      .returning({ id: sharedMachines.id });
    return Response.json({ ok: true, id: row.id });
  } catch (err) {
    console.error("POST /api/machines", err);
    return Response.json({ ok: false, error: "Delen is niet gelukt." }, { status: 500 });
  }
}
