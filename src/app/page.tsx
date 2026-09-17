"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/AppShell";
import { MISSIONS } from "@/lib/missions/missions";
import { completedCount, hasAnyProgress, loadData, resetAll, type SavedData } from "@/lib/storage";

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<SavedData | null>(null);

  useEffect(() => {
    setData(loadData());
  }, []);

  const canContinue = data ? hasAnyProgress(data) : false;
  const done = data ? completedCount(data) : 0;

  const restart = () => {
    if (window.confirm("Wil je echt opnieuw beginnen? Al je constructies, voorspellingen en ontdekkingen worden gewist.")) {
      resetAll();
      setData(loadData());
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,_#1e293b_0%,_#020617_60%)] text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-5 py-10 sm:py-16">
        <div className="mb-4 scale-[1.8]">
          <Logo size={40} />
        </div>
        <h1 className="mt-4 text-center text-5xl font-black tracking-tight sm:text-6xl">
          Tandwielen<span className="text-sky-400">lab</span>
        </h1>
        <p className="mt-2 text-center text-xl font-extrabold text-slate-300 sm:text-2xl">
          Bouw. <span className="text-emerald-300">Test.</span> <span className="text-amber-300">Ontdek.</span>
        </p>
        <p className="mt-4 max-w-xl text-center text-slate-300">
          Bouw je eigen digitale machine met tandwielen en kettingen. Voorspel wat ze doet, laat de motor één rondje draaien en meet het zelf.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {canContinue && (
            <button className="btn btn-emerald !px-6 !py-3 !text-base" onClick={() => router.push(data?.lastZone ? `/${data.lastZone}` : "/ontdekzone")}>
              ▶ Verder werken
            </button>
          )}
          {!canContinue && (
            <Link href="/ontdekzone" className="btn btn-sky !px-6 !py-3 !text-base">
              🔧 Begin te bouwen
            </Link>
          )}
          {canContinue && (
            <button className="btn btn-ghost !px-5 !py-3" onClick={restart}>
              Opnieuw beginnen
            </button>
          )}
        </div>
        {data && done > 0 && (
          <div className="mt-3 text-sm text-slate-400">
            Je hebt al {done} van {MISSIONS.length} opdrachten voltooid.
          </div>
        )}

        <div className="mt-12 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ZoneCard
            href="/ontdekzone"
            icon="🔧"
            title="Ontdekzone"
            text="Vrij bouwen, experimenteren, meten en machines ontwerpen. Geen verplichte opdrachten."
            accent="from-sky-500/30 to-sky-500/0"
          />
          <ZoneCard
            href="/labzone"
            icon="🧪"
            title="Labzone"
            text="Voorspel, onderzoek, meet en noteer je ontdekkingen stap voor stap."
            accent="from-emerald-500/30 to-emerald-500/0"
          />
          <ZoneCard
            href="/buildzone"
            icon="🏗️"
            title="Buildzone"
            text="Pas je kennis toe in aparte bouwuitdagingen met tandwielen, kettingen en lagen."
            accent="from-orange-500/30 to-orange-500/0"
          />
          <ZoneCard
            href="/mijn-ontdekkingen"
            icon="📒"
            title="Mijn ontdekkingen"
            text="Alles wat je onderzocht, voorspeld, gemeten en besloten hebt. Ook af te drukken."
            accent="from-amber-500/30 to-amber-500/0"
          />
        </div>

        <div className="mt-12 grid w-full gap-3 text-sm text-slate-300 sm:grid-cols-4">
          {[
            ["1", "Voorspel", "Wat denk je dat er gebeurt?"],
            ["2", "Bouw", "Sleep tandwielen tot ze klikken."],
            ["3", "Motor 1 rondje", "Meet exact wat je machine doet."],
            ["4", "Ontdek", "Vind zelf de regel en bouw verder."],
          ].map(([n, t, s]) => (
            <div key={n} className="card flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/20 font-black text-sky-300">{n}</span>
              <div>
                <div className="font-black text-slate-100">{t}</div>
                <div className="text-slate-400">{s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function ZoneCard({ href, icon, title, text, accent }: { href: string; icon: string; title: string; text: string; accent: string }) {
  return (
    <Link href={href} className={`card group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-sky-400/60`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${accent}`} />
      <div className="relative">
        <div className="text-3xl">{icon}</div>
        <div className="mt-2 text-xl font-black text-slate-50">{title}</div>
        <p className="mt-1 text-sm text-slate-300">{text}</p>
        <div className="mt-3 text-sm font-bold text-sky-300 group-hover:underline">Openen →</div>
      </div>
    </Link>
  );
}
