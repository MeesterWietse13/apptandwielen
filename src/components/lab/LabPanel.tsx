"use client";
import { useEffect, useState } from "react";
import type { MissionDef, MissionEvaluation, MissionProgress } from "@/lib/missions/missionEngine";
import { CHALLENGE_MISSIONS, DISCOVERY_MISSIONS, GROUPS, missionCode, missionsOf, nextMissionOfKind, type MissionGroup } from "@/lib/missions/missions";

interface Props {
  zone: "lab" | "build";
  mission: MissionDef | null;
  progress: Record<string, MissionProgress>;
  missionProgress: MissionProgress | null;
  evaluation: MissionEvaluation | null;
  onSelectMission: (id: string) => void;
  onSetPrediction: (v: string) => void;
  onSetAnswer: (v: string) => void;
  onTryComplete: () => void;
  onHint: () => void;
  onClearBench: () => void;
}

export function LabPanel({ zone, mission, progress, missionProgress, evaluation, onSelectMission, onSetPrediction, onSetAnswer, onTryComplete, onHint, onClearBench }: Props) {
  const [group, setGroup] = useState<MissionGroup>(mission?.group ?? "gears");
  const kind = zone === "lab" ? "discovery" : "challenge";
  const zoneMissions = zone === "lab" ? DISCOVERY_MISSIONS : CHALLENGE_MISSIONS;
  const done = zoneMissions.filter((m) => progress[m.id]?.completed).length;

  useEffect(() => {
    if (mission) setGroup(mission.group);
  }, [mission]);

  const chip = (m: MissionDef) => {
    const isDone = !!progress[m.id]?.completed;
    const isCurrent = mission?.id === m.id;
    return (
      <button
        key={m.id}
        onClick={() => {
          setGroup(m.group);
          onSelectMission(m.id);
        }}
        className={`chip ${isCurrent ? "on" : ""} ${isDone ? "done" : ""}`}
        title={m.title}
      >
        {isDone ? "✓ " : ""}
        {zone === "lab" ? m.number : `U${m.number}`}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-black text-slate-100">{zone === "lab" ? "🧪 Labzone" : "🏗️ Buildzone"}</div>
          <div className="text-xs text-slate-400">
            {done} van {zoneMissions.length} {zone === "lab" ? "ontdekopdrachten" : "bouwuitdagingen"} voltooid
          </div>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all" style={{ width: `${zoneMissions.length ? (done / zoneMissions.length) * 100 : 0}%` }} />
      </div>

      <div className="card sticky top-2 z-20 border-slate-700 bg-slate-900/95 shadow-lg backdrop-blur">
          <div className="seg mb-2 w-full">
            {GROUPS.map((g) => (
              <button key={g.id} className={`flex-1 ${group === g.id ? "on" : ""}`} onClick={() => setGroup(g.id)}>
                {g.title}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-400">{GROUPS.find((g) => g.id === group)?.subtitle}</div>
          {missionsOf(group, kind).length > 0 && (
            <>
              <div className={`mb-1 mt-2 text-xs font-bold uppercase tracking-wide ${zone === "lab" ? "text-sky-300" : "text-amber-300"}`}>
                {zone === "lab" ? "Ontdekopdrachten" : "Bouwuitdagingen"}
              </div>
              <div className="flex flex-wrap gap-1">{missionsOf(group, kind).map(chip)}</div>
            </>
          )}
      </div>

      {mission && missionProgress && evaluation && (
        <MissionView
          mission={mission}
          progress={missionProgress}
          evaluation={evaluation}
          onSetPrediction={onSetPrediction}
          onSetAnswer={onSetAnswer}
          onTryComplete={onTryComplete}
          onHint={onHint}
          onNext={() => {
            const n = nextMissionOfKind(mission.id);
            if (n) onSelectMission(n.id);
          }}
          onClearBench={onClearBench}
        />
      )}
    </div>
  );
}

interface ViewProps {
  mission: MissionDef;
  progress: MissionProgress;
  evaluation: MissionEvaluation;
  onSetPrediction: (v: string) => void;
  onSetAnswer: (v: string) => void;
  onTryComplete: () => void;
  onHint: () => void;
  onNext: () => void;
  onClearBench: () => void;
}

function MissionView({ mission, progress, evaluation, onSetPrediction, onSetAnswer, onTryComplete, onHint, onNext, onClearBench }: ViewProps) {
  const isDiscovery = mission.kind === "discovery";
  const completed = progress.completed;
  const next = nextMissionOfKind(mission.id);
  const hintsShown = mission.hints.slice(0, progress.hintLevel);
  let step = 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="card border-sky-500/30">
        <div className="mb-1 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${isDiscovery ? "bg-sky-500/20 text-sky-300" : "bg-amber-500/20 text-amber-300"}`}>
            {isDiscovery ? "Ontdekopdracht" : "Bouwuitdaging"} {missionCode(mission)}
          </span>
          {completed && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-black text-emerald-300">✓ voltooid</span>}
        </div>
        <h2 className="text-lg font-black leading-tight text-slate-50">{mission.title}</h2>
      </div>

      <Section n={step++} title={isDiscovery ? "Opdracht" : "Bouw dit"}>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-200">
          {mission.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </Section>

      {mission.prediction && (
        <Section n={step++} title="Voorspel" done={!!progress.prediction}>
          <p className="mb-2 text-sm font-semibold text-slate-100">{mission.prediction.question}</p>
          <div className="flex flex-col gap-1">
            {mission.prediction.options.map((o) => (
              <label key={o.id} className={`option ${progress.prediction === o.id ? "on" : ""}`}>
                <input type="radio" name={`pred-${mission.id}`} className="accent-sky-400" checked={progress.prediction === o.id} onChange={() => onSetPrediction(o.id)} disabled={completed} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {!progress.prediction && <p className="mt-1 text-xs text-slate-400">Kies eerst wat je denkt. Fout gokken mag!</p>}
        </Section>
      )}

      <Section n={step++} title="Bouw & test" done={evaluation.mechanicsOk}>
        <ul className="space-y-1">
          {evaluation.requirements.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${r.done ? "bg-emerald-500 text-slate-950" : "border border-slate-600 text-transparent"}`}>✓</span>
              <span className={r.done ? "text-slate-300" : "text-slate-100"}>
                {r.label}
                {r.detail && <span className="block text-xs text-sky-300">{r.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
        {!evaluation.mechanicsOk && evaluation.nextTip && <div className="mt-2 rounded-lg bg-slate-800/80 px-2 py-1.5 text-xs text-slate-300">👉 {evaluation.nextTip}</div>}
      </Section>

      {mission.answer && (
        <Section n={step++} title="Antwoord" done={evaluation.answerCorrect === true} locked={!evaluation.mechanicsOk}>
          <p className="mb-2 text-sm font-semibold text-slate-100">{mission.answer.question}</p>
          <div className="flex flex-col gap-1">
            {mission.answer.options.map((o) => (
              <label key={o.id} className={`option ${progress.answer === o.id ? "on" : ""}`}>
                <input type="radio" name={`ans-${mission.id}`} className="accent-sky-400" checked={progress.answer === o.id} onChange={() => onSetAnswer(o.id)} disabled={completed || !evaluation.mechanicsOk} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {progress.answer && evaluation.answerCorrect === false && (
            <div className="mt-2 rounded-lg bg-amber-500/15 px-2 py-1.5 text-xs text-amber-200">Hmm, kijk nog eens goed naar het meetpaneel en de witte stippen. Test gerust opnieuw.</div>
          )}
          {evaluation.answerCorrect && <div className="mt-2 text-xs font-bold text-emerald-300">Dat klopt met je meting!</div>}
        </Section>
      )}

      {mission.conclusionPrompt && (
        <Section n={step++} title="Besluit" done={evaluation.conclusionOk} locked={!evaluation.mechanicsOk}>
          <p className="text-sm text-slate-100">{completed || evaluation.conclusionOk
            ? mission.discovery
            : "Voer de proef uit en kies het juiste antwoord. Daarna verschijnt je besluit hier."}</p>
        </Section>
      )}

      {completed ? (
        <div className="card border-emerald-500/40 bg-emerald-500/10">
          <div className="text-base font-black text-emerald-300">{isDiscovery ? "✓ Ontdekking voltooid" : "✓ Gelukt!"}</div>
          {mission.discovery && (
            <div className="mt-2 rounded-lg border border-emerald-500/30 bg-slate-950/40 p-2 text-sm text-slate-100">
              <div className="mb-1 text-[11px] font-black uppercase tracking-wide text-emerald-300">De ontdekking</div>
              {mission.discovery}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {next && (
              <button className="btn btn-emerald flex-1" onClick={onNext}>
                Volgende opdracht →
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          {isDiscovery ? (
            <button className={`btn w-full ${evaluation.canComplete ? "btn-emerald" : "btn-ghost"}`} onClick={onTryComplete}>
              ✓ Ontdekking afronden
            </button>
          ) : (
            <div className="text-sm text-slate-300">
              {evaluation.mechanicsOk ? "Controleren…" : "Bouw, test en de app controleert automatisch."}
              {progress.attempts > 0 && <div className="mt-1 text-xs text-slate-400">Pogingen: {progress.attempts}</div>}
            </div>
          )}
          {!evaluation.canComplete && progress.attempts > 0 && isDiscovery && (
            <div className="mt-2 text-xs text-amber-200">Nog niet helemaal. Kijk naar de stappen zonder vinkje.</div>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-100">💡 Hulp nodig?</div>
          <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={onHint} disabled={progress.hintLevel >= mission.hints.length}>
            {progress.hintLevel >= mission.hints.length ? "Geen hints meer" : progress.hintLevel === 0 ? "Geef een hint" : "Nog een hint"}
          </button>
        </div>
        {hintsShown.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-slate-200">
            {hintsShown.map((h, i) => (
              <li key={i} className="rounded-lg bg-slate-800/70 px-2 py-1">
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button className="text-left text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline" onClick={onClearBench}>
        Werkbank leegmaken voor deze opdracht
      </button>
    </div>
  );
}

function Section({ n, title, done, locked, children }: { n: number; title: string; done?: boolean; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className={`card ${locked ? "opacity-60" : ""}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${done ? "bg-emerald-500 text-slate-950" : "bg-slate-700 text-slate-100"}`}>{done ? "✓" : n}</span>
        <span className="text-sm font-black uppercase tracking-wide text-slate-200">{title}</span>
        {locked && <span className="ml-auto text-[11px] text-slate-400">eerst bouwen en testen</span>}
      </div>
      {children}
    </div>
  );
}
