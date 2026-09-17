"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MiniConstruction } from "@/components/MiniConstruction";
import { dirArrow, dirWord, fmtDate, fmtRevs, revsWords } from "@/lib/format";
import type { MissionDef, MissionProgress, TestRecord } from "@/lib/missions/missionEngine";
import { MISSIONS, missionCode } from "@/lib/missions/missions";
import { loadData, updateData, type SavedData } from "@/lib/storage";

export function DiscoveriesView() {
  const [data, setData] = useState<SavedData | null>(null);
  useEffect(() => {
    setData(loadData());
  }, []);

  const completed = useMemo(() => MISSIONS.filter((m) => m.kind === "discovery" && data?.progress[m.id]?.completed), [data]);
  const gearDiscoveries = completed.filter((m) => m.kind === "discovery" && m.group === "gears");
  const chainDiscoveries = completed.filter((m) => m.kind === "discovery" && m.group === "chains");

  const setField = (field: "studentName" | "studentClass", value: string) => {
    setData((d) => (d ? { ...d, [field]: value } : d));
    updateData((d) => ({ ...d, [field]: value }));
  };

  if (!data) {
    return (
      <div className="flex h-[100dvh] flex-col bg-slate-950 text-slate-100">
        <AppShell />
        <div className="p-6 text-slate-400">Laden…</div>
      </div>
    );
  }

  const today = fmtDate(Date.now());

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 print:bg-white print:text-black">
      <AppShell />
      <div className="print-sheet mx-auto max-w-4xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight print:text-2xl">Tandwielenlab — Mijn ontdekkingen</h1>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3 print:grid-cols-3">
              <label className="flex items-center gap-2">
                <span className="font-bold">Naam:</span>
                <input className="input print:hidden" value={data.studentName} onChange={(e) => setField("studentName", e.target.value)} placeholder="__________" />
                <span className="hidden print:inline">{data.studentName || "________________"}</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="font-bold">Klas:</span>
                <input className="input print:hidden" value={data.studentClass} onChange={(e) => setField("studentClass", e.target.value)} placeholder="__________" />
                <span className="hidden print:inline">{data.studentClass || "__________"}</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="font-bold">Datum:</span>
                <span>{today}</span>
              </div>
            </div>
          </div>
          <div className="no-print flex gap-2">
            <button className="btn btn-sky" onClick={() => window.print()}>
              🖨 Afdrukken
            </button>
            <Link href="/labzone" className="btn btn-ghost">
              Naar de Labzone
            </Link>
          </div>
        </div>

        {completed.length === 0 && (
          <div className="card no-print text-slate-300">
            <div className="text-lg font-black text-slate-100">Nog geen ontdekkingen</div>
            <p className="mt-1 text-sm">Ga naar de Labzone, voorspel, bouw, test en meet. Elke afgeronde opdracht verschijnt hier.</p>
            <Link href="/labzone" className="btn btn-emerald mt-3 inline-flex">
              🧪 Naar de Labzone
            </Link>
          </div>
        )}

        <Section title="Tandwielen" subtitle="Ontdekopdrachten over tandwielen die rechtstreeks in elkaar grijpen" items={gearDiscoveries} progress={data.progress} />
        <Section title="Kettingen" subtitle="Ontdekopdrachten over kettingoverbrengingen" items={chainDiscoveries} progress={data.progress} />
      </div>
    </div>
  );
}

function Section({ title, subtitle, items, progress }: { title: string; subtitle: string; items: MissionDef[]; progress: Record<string, MissionProgress> }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-black text-sky-300 print:text-black">{title}</h2>
      <p className="mb-3 text-sm text-slate-400 print:text-black">{subtitle}</p>
      <div className="grid gap-3">
        {items.map((m) => <DiscoveryCard key={m.id} mission={m} progress={progress[m.id]} />)}
      </div>
    </section>
  );
}

function optionLabel(m: MissionDef, which: "prediction" | "answer", id: string | null) {
  if (!id) return "—";
  const opts = which === "prediction" ? m.prediction?.options : m.answer?.options;
  return opts?.find((o) => o.id === id)?.label ?? id;
}

function MeasurementTable({ record, targetLetter }: { record: TestRecord; targetLetter: string | null }) {
  const rows = record.nodes.filter((n) => n.connected);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 print:text-black">
          <th>Tandwiel</th>
          <th className="text-right">Tanden</th>
          <th className="text-right">Rondjes</th>
          <th className="pl-2">Richting</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((n) => (
          <tr key={n.letter} className="border-t border-slate-800">
            <td className="py-0.5 font-bold">
              {n.letter}
              {n.isMotor ? " ⚡" : ""}
              {n.letter === targetLetter ? " 🎯" : ""}
              {n.kind === "sprocket" ? <span className="ml-1 text-[10px] font-normal text-indigo-300">ketting</span> : null}
            </td>
            <td className="py-0.5 text-right tabular-nums">{n.teeth}</td>
            <td className="py-0.5 text-right font-mono tabular-nums">
              {fmtRevs(n.revs)}
              {revsWords(n.revs) ? <span className="ml-1 text-xs text-slate-400 print:text-black">({revsWords(n.revs)})</span> : null}
            </td>
            <td className="py-0.5 pl-2">
              {dirArrow(n.dir)} {dirWord(n.dir)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DiscoveryCard({ mission, progress }: { mission: MissionDef; progress: MissionProgress }) {
  const rec = progress.result?.record ?? null;
  const targetLetter = progress.result?.targetLetter ?? rec?.targetLetter ?? null;
  const motor = rec?.motor ?? null;
  return (
    <article className="card print-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-black text-slate-50">
          <span className="mr-2 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300 print:border print:border-black">{missionCode(mission)}</span>
          {mission.title}
        </h3>
        {progress.completedAt && <span className="text-xs text-slate-400">✓ voltooid op {fmtDate(progress.completedAt)}</span>}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px] print:grid-cols-[1fr_200px]">
        <div className="space-y-2 text-sm">
          <Row label="Opdracht">{mission.steps.join(" ")}</Row>
          {mission.prediction && <Row label="Mijn voorspelling">{optionLabel(mission, "prediction", progress.prediction)}</Row>}
          {rec && (
            <Row label="Gebouwd">
              {rec.nodes
                .filter((n) => n.connected)
                .map((n) => `${n.letter} (${n.teeth} tanden${n.kind === "sprocket" ? ", ketting" : ""}${n.isMotor ? ", motor" : ""})`)
                .join(" · ")}
              {motor && (
                <>
                  {" "}
                  — motor {motor.letter} draait {dirWord(motor.dir)} {dirArrow(motor.dir)}
                </>
              )}
            </Row>
          )}
          {rec && (
            <Row label="Meting (motor 1 rondje)">
              <MeasurementTable record={rec} targetLetter={targetLetter} />
            </Row>
          )}
          {mission.answer && <Row label="Mijn antwoord">{optionLabel(mission, "answer", progress.answer)}</Row>}
          {mission.conclusionPrompt && (
            <Row label="Mijn besluit">
              <span className="italic">“{progress.conclusion || "—"}”</span>
            </Row>
          )}
          {mission.discovery && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 print:border-black print:bg-white">
              <div className="text-[11px] font-black uppercase tracking-wide text-emerald-300 print:text-black">De ontdekking</div>
              <div className="font-semibold text-slate-50">{mission.discovery}</div>
            </div>
          )}
        </div>
        <div>
          {rec?.snapshot && (
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-1 print:border-black print:bg-white">
              <MiniConstruction construction={rec.snapshot} height={150} />
              <div className="text-center text-[10px] text-slate-400 print:text-black">constructieschema</div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-400 print:text-black">{label}</div>
      <div className="text-slate-100">{children}</div>
    </div>
  );
}
