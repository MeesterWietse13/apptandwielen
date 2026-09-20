"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BIKE_LESSONS, loadBikeJournal, type BikeJournal } from "@/lib/bike/discoveries";
import { REAR_TEETH } from "@/lib/bike/physics";
import { fmtNumber } from "@/lib/format";
export function BikeDiscoveries() {
  const [journal, setJournal] = useState<BikeJournal | null>(null);
  useEffect(() => { setJournal(loadBikeJournal()); }, []);
  const lessons = BIKE_LESSONS.filter(l => journal?.[l.id].completed);
  return <section className="mb-8"><h2 className="text-2xl font-black text-sky-300 print:text-black">Fiets</h2><p className="mb-3 text-sm text-slate-400 print:text-black">Schakelen, bergop rijden en sprinten met constante beenkracht</p>
    {!lessons.length && <Link href="/fietslab" className="btn btn-ghost print:hidden">🚲 Onderzoek het in het Fietslab</Link>}
    <div className="grid gap-3">{lessons.map(l => { const p = journal![l.id]; return <article key={l.id} className="card break-inside-avoid print:border-slate-400 print:bg-white print:text-black"><h3 className="text-lg font-black">{l.title}</h3><dl className="mt-3 space-y-2 text-sm"><div><dt className="font-bold">Mijn voorspelling</dt><dd>{p.prediction}</dd></div><div><dt className="font-bold">Mijn metingen</dt><dd>{p.records.map((r, i) => <div key={i}>{l.id === "flat" ? `${REAR_TEETH[r.rear]} tanden: 1 trapronde → ${fmtNumber(r.wheelTurns)} wielrondes${Number.isFinite(r.cadence) ? ` · ${fmtNumber(r.speed, 1)} km/u · ${fmtNumber(r.cadence!, 0)} rpm` : ""}` : `${fmtNumber(r.seconds, 1)} seconden · ${fmtNumber(r.speed, 1)} km/u bij de finish · ${r.shifts} keer geschakeld`}</div>)}</dd></div><div><dt className="font-bold">Mijn antwoord</dt><dd>{p.answer}</dd></div><div><dt className="font-bold">Mijn besluit</dt><dd className="whitespace-pre-wrap">{l.discovery}</dd></div><div><dt className="font-bold text-emerald-300 print:text-black">De ontdekking</dt><dd>{l.discovery}</dd></div></dl></article>; })}</div>
  </section>;
}
