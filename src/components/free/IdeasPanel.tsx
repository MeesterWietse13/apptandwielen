"use client";
import { useCallback, useEffect, useState } from "react";
import { MiniConstruction } from "@/components/MiniConstruction";
import { sanitizeConstruction, type Construction } from "@/lib/mechanics/types";

const IDEAS = [
  "Kun je vijf tandwielen allemaal laten bewegen?",
  "Kun je een machine maken met beide lagen?",
  "Kun je het laatste tandwiel sneller laten draaien dan de motor?",
  "Kun je een tandwiel op Laag 1 een ketting op Laag 2 laten aandrijven?",
  "Kun je een systeem bouwen dat blokkeert?",
  "Kun je twee tandwielen op één as zetten die toch een ander tandwiel anders laten draaien?",
];

interface SharedMachine {
  id: number;
  name: string;
  author: string;
  construction: unknown;
  componentCount: number;
  createdAt: string;
}

interface Props {
  construction: Construction;
  onLoad: (c: Construction) => void;
  notify: (text: string, kind?: "info" | "warn" | "ok") => void;
}

export function IdeasPanel({ construction, onLoad, notify }: Props) {
  const [ideasOpen, setIdeasOpen] = useState(true);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [machines, setMachines] = useState<SharedMachine[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/machines", { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; machines: SharedMachine[] };
      if (!data.ok) throw new Error("fout");
      setMachines(data.machines);
    } catch {
      setError("De galerij kon niet geladen worden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (galleryOpen) void refresh();
  }, [galleryOpen, refresh]);

  const share = async () => {
    if (!name.trim()) {
      notify("Geef je machine eerst een naam.", "warn");
      return;
    }
    if (construction.components.length === 0) {
      notify("Bouw eerst iets op de werkbank.", "warn");
      return;
    }
    setSharing(true);
    try {
      const res = await fetch("/api/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, author, construction }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "fout");
      notify("Je machine staat in de galerij! 🎉", "ok");
      setName("");
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Delen is niet gelukt.", "warn");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <div className="text-lg font-black text-slate-100">🔧 Ontdekzone</div>
        <div className="text-xs text-slate-400">Vrij bouwen, testen en meten. Geen verplichte opdrachten.</div>
      </div>

      <div className="card">
        <div className="mb-1 text-sm font-black text-slate-100">Zo werkt het</div>
        <ul className="space-y-1 text-sm text-slate-300">
          <li>➕ Voeg tandwielen toe en sleep ze tegen elkaar tot ze <span className="text-emerald-300">klikken</span>.</li>
          <li>⚡ Kies een motor. ▶ Test laat hem draaien.</li>
          <li>↻ MOTOR 1 RONDJE meet precies hoeveel rondjes elk tandwiel maakt.</li>
          <li>🔗 Verbind kettingtandwielen met een ketting.</li>
          <li>🧱 Zet op Laag 2 een tandwiel precies boven een ander: zelfde as!</li>
        </ul>
      </div>

      <div className="card">
        <button className="flex w-full items-center justify-between text-left" onClick={() => setIdeasOpen((o) => !o)}>
          <span className="text-sm font-black text-slate-100">💡 Idee om te onderzoeken</span>
          <span className="text-slate-400">{ideasOpen ? "▾" : "▸"}</span>
        </button>
        {ideasOpen && (
          <ul className="mt-2 space-y-1.5">
            {IDEAS.map((idea, i) => (
              <li key={i} className="rounded-lg bg-slate-800/70 px-2 py-1.5 text-sm text-slate-200">
                {idea}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <button className="flex w-full items-center justify-between text-left" onClick={() => setGalleryOpen((o) => !o)}>
          <span className="text-sm font-black text-slate-100">🏛 Machinegalerij van de klas</span>
          <span className="text-slate-400">{galleryOpen ? "▾" : "▸"}</span>
        </button>
        {galleryOpen && (
          <div className="mt-2 space-y-3">
            <div className="rounded-lg border border-slate-700 p-2">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Deel je machine</div>
              <input className="input mb-1" placeholder="Naam van je machine" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
              <input className="input mb-2" placeholder="Jouw naam (mag leeg)" value={author} maxLength={40} onChange={(e) => setAuthor(e.target.value)} />
              <button className="btn btn-sky w-full" onClick={share} disabled={sharing}>
                {sharing ? "Bezig…" : "📤 Deel je machine"}
              </button>
            </div>
            {loading && <div className="text-xs text-slate-400">Laden…</div>}
            {error && <div className="text-xs text-rose-300">{error}</div>}
            {!loading && !error && machines.length === 0 && <div className="text-xs text-slate-400">Nog geen machines gedeeld. Wees de eerste!</div>}
            <div className="space-y-2">
              {machines.map((m) => {
                const c = sanitizeConstruction(m.construction);
                return (
                  <div key={m.id} className="rounded-lg border border-slate-700 bg-slate-950/40 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-100">{m.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {m.author || "anoniem"} · {m.componentCount} onderdelen
                        </div>
                      </div>
                      <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => c && onLoad(c)} disabled={!c}>
                        Laad
                      </button>
                    </div>
                    {c && <MiniConstruction construction={c} height={80} className="mt-1" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
