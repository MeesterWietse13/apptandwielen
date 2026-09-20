"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { IdeasPanel } from "@/components/free/IdeasPanel";
import { LabPanel } from "@/components/lab/LabPanel";
import { analyze, technicalReport } from "@/lib/mechanics/mechanismGraph";
import { emptyConstruction, structureHash, type ComponentKind, type Construction } from "@/lib/mechanics/types";
import {
  addRecord,
  buildRecord,
  completeMission,
  emptyProgress,
  evaluateMission,
  type MissionProgress,
} from "@/lib/missions/missionEngine";
import { CHALLENGE_MISSIONS, DISCOVERY_MISSIONS, missionById } from "@/lib/missions/missions";
import { loadData, updateData } from "@/lib/storage";
import { InspectorPanel, MeasurementPanel, MotorPanel } from "./Panels";
import { Toolbar, TopControls } from "./Toolbar";
import { Workbench, type WorkbenchHandle } from "./Workbench";
import { useWorkbench } from "./useWorkbench";

interface Props {
  mode: "free" | "lab" | "build";
}

export function WorkbenchApp({ mode }: Props) {
  const missionKind = mode === "build" ? "challenge" : "discovery";
  const zoneMissions = mode === "build" ? CHALLENGE_MISSIONS : DISCOVERY_MISSIONS;
  const [state, dispatch] = useWorkbench();
  const analysis = useMemo(() => analyze(state.construction), [state.construction]);
  const hash = useMemo(() => structureHash(state.construction), [state.construction]);
  const wbRef = useRef<WorkbenchHandle>(null);
  const [hydrated, setHydrated] = useState(false);
  const [progress, setProgress] = useState<Record<string, MissionProgress>>({});
  const [currentMissionId, setCurrentMissionId] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [report, setReport] = useState<string[] | null>(null);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ---- laden uit localStorage ----
  useEffect(() => {
    const data = loadData();
    if (mode === "free") {
      if (data.free) dispatch({ type: "LOAD", construction: data.free.construction });
    } else {
      setProgress(data.progress);
      const storedId = mode === "build" ? data.build.currentMissionId : data.lab.currentMissionId;
      const storedMission = missionById(storedId);
      const mid = storedMission?.kind === missionKind ? storedMission.id : zoneMissions[0].id;
      setCurrentMissionId(mid);
      const c = data.lab.constructions[mid];
      dispatch({ type: "LOAD", construction: c ?? emptyConstruction() });
    }
    updateData((d) => ({ ...d, lastZone: mode === "free" ? "ontdekzone" : mode === "build" ? "buildzone" : "labzone" }));
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setLeftOpen(mode !== "free");
      setRightOpen(false);
    }
    setHydrated(true);
  }, [mode, dispatch, missionKind, zoneMissions]);

  // Fullscreen verandert alleen de beschikbare viewport en dus nooit de constructie.
  useEffect(() => {
    setFullscreenAvailable(typeof document.documentElement.requestFullscreen === "function");
    const syncFullscreen = () => {
      setIsFullscreen(document.fullscreenElement !== null);
      requestAnimationFrame(() => wbRef.current?.fit());
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    if (!fullscreenAvailable) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify("Volledig scherm kon niet worden geopend.", "warn");
    }
  };

  const togglePanel = (side: "left" | "right") => {
    if (side === "left") setLeftOpen((open) => !open);
    else setRightOpen((open) => !open);
    requestAnimationFrame(() => requestAnimationFrame(() => wbRef.current?.fit()));
  };

  // ---- constructie bewaren ----
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      updateData((d) => {
        if (mode === "free") return { ...d, free: { construction: state.construction } };
        if (!currentMissionId) return d;
        return { ...d, lab: { ...d.lab, currentMissionId, constructions: { ...d.lab.constructions, [currentMissionId]: state.construction } } };
      });
    }, 400);
    return () => clearTimeout(t);
  }, [state.construction, hydrated, mode, currentMissionId]);

  // ---- voortgang bewaren ----
  useEffect(() => {
    if (!hydrated || mode === "free") return;
    updateData((d) => ({ ...d, progress }));
  }, [progress, hydrated, mode]);

  // ---- animatielus ----
  const running = state.sim.status === "test" || state.sim.status === "oneTurn";
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      dispatch({ type: "SIM_TICK", now, dt });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, dispatch]);

  // ---- meldingen automatisch sluiten ----
  useEffect(() => {
    if (!state.notice) return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_NOTICE" }), 4500);
    return () => clearTimeout(t);
  }, [state.notice, dispatch]);

  // ---- testrecords voor opdrachten ----
  const recordTest = useCallback(
    (kind: "oneTurn" | "test") => {
      if (mode === "free" || !currentMissionId) return;
      const rec = buildRecord(state.construction, analysis, kind, hash);
      setProgress((p) => {
        const cur = p[currentMissionId] ?? emptyProgress();
        const existing = cur.records.find((r) => r.hash === hash);
        if (existing && existing.kind === "oneTurn" && kind === "test") return p;
        return { ...p, [currentMissionId]: addRecord(cur, rec) };
      });
    },
    [mode, currentMissionId, state.construction, analysis, hash]
  );
  const prevDone = useRef(false);
  useEffect(() => {
    if (state.sim.oneTurnDone && !prevDone.current) recordTest("oneTurn");
    prevDone.current = state.sim.oneTurnDone;
  }, [state.sim.oneTurnDone, recordTest]);
  const prevTheta = useRef(0);
  useEffect(() => {
    if (state.sim.status === "test" && prevTheta.current < 0.5 && state.sim.theta >= 0.5) recordTest("test");
    prevTheta.current = state.sim.theta;
  }, [state.sim.theta, state.sim.status, recordTest]);

  // ---- opdracht evalueren ----
  const mission = missionById(currentMissionId);
  const missionProgress = currentMissionId ? progress[currentMissionId] ?? emptyProgress() : null;
  const evaluation = useMemo(
    () => (mission && missionProgress ? evaluateMission(mission, missionProgress, { construction: state.construction, analysis, hash }) : null),
    [mission, missionProgress, state.construction, analysis, hash]
  );

  const updateMission = useCallback(
    (fn: (p: MissionProgress) => MissionProgress) => {
      if (!currentMissionId) return;
      setProgress((p) => ({ ...p, [currentMissionId]: fn(p[currentMissionId] ?? emptyProgress()) }));
    },
    [currentMissionId]
  );

  const targetLetter = analysis.targetId ? analysis.nodes[analysis.targetId].letter : null;

  // Bouwuitdagingen worden automatisch gecontroleerd
  useEffect(() => {
    if (mission?.kind === "challenge" && evaluation?.canComplete && missionProgress && !missionProgress.completed) {
      updateMission((p) => completeMission(p, evaluation, targetLetter));
      dispatch({ type: "NOTICE", text: "✓ Gelukt! Je bouwwerk voldoet aan de opdracht.", kind: "ok" });
    }
  }, [mission, evaluation, missionProgress, updateMission, targetLetter, dispatch]);

  const tryComplete = () => {
    if (!mission || !evaluation) return;
    if (evaluation.canComplete) {
      updateMission((p) => completeMission({ ...p, conclusion: mission.discovery ?? "" }, evaluation, targetLetter));
      dispatch({ type: "NOTICE", text: "✓ Ontdekking voltooid!", kind: "ok" });
    } else {
      updateMission((p) => ({ ...p, attempts: p.attempts + 1 }));
      dispatch({ type: "NOTICE", text: evaluation.nextTip ?? "Nog niet helemaal. Kijk naar de stappen zonder vinkje.", kind: "warn" });
    }
  };

  const selectMission = (id: string) => {
    if (currentMissionId) {
      const cur = state.construction;
      const curId = currentMissionId;
      updateData((d) => ({ ...d, lab: { ...d.lab, constructions: { ...d.lab.constructions, [curId]: cur } } }));
    }
    const data = loadData();
    const c = data.lab.constructions[id];
    dispatch({ type: "LOAD", construction: c ?? emptyConstruction() });
    setCurrentMissionId(id);
    updateData((d) =>
      mode === "build"
        ? { ...d, build: { ...d.build, currentMissionId: id } }
        : { ...d, lab: { ...d.lab, currentMissionId: id } }
    );
  };

  // ---- acties ----
  const notify = useCallback((text: string, kind: "info" | "warn" | "ok" = "info") => dispatch({ type: "NOTICE", text, kind }), [dispatch]);

  const onAdd = (kind: ComponentKind) => {
    const near = wbRef.current?.centerWorld() ?? { x: 0, y: 0 };
    dispatch({ type: "ADD", kind, near });
  };
  const explainBlocked = () => {
    const p = analysis.problems.find((k) => k.type !== "noMotor") ?? analysis.problems[0];
    notify(p ? p.message : "De motor kan nog niet draaien.", "warn");
  };
  const onTest = () => {
    if (state.sim.status === "test") return dispatch({ type: "SIM_PAUSE" });
    if (!analysis.canRun) return explainBlocked();
    dispatch({ type: "SIM_TEST" });
  };
  const onOneTurn = () => {
    if (!analysis.canRun) return explainBlocked();
    dispatch({ type: "SIM_ONE_TURN", now: performance.now() });
  };
  const onCheck = () => setReport(technicalReport(state.construction, analysis).lines);
  const onClear = () => {
    if (state.construction.components.length === 0) return;
    if (window.confirm("Wil je alle tandwielen en kettingen in één keer opruimen?")) dispatch({ type: "CLEAR_ALL" });
  };
  const loadShared = (c: Construction) => {
    dispatch({ type: "LOAD", construction: c, keepHistory: true });
    notify("Machine geladen. Onderzoek wat ze doet!", "ok");
    setTimeout(() => wbRef.current?.fit(), 50);
  };

  // ---- sneltoetsen ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "REDO" : "UNDO" });
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "REDO" });
      } else if ((e.key === "Delete" || e.key === "Backspace") && state.selection) {
        e.preventDefault();
        if (state.selection.type === "component") dispatch({ type: "DELETE", id: state.selection.id });
        else dispatch({ type: "REMOVE_CHAIN", id: state.selection.id });
      } else if (mod && e.key.toLowerCase() === "d" && state.selection?.type === "component") {
        e.preventDefault();
        dispatch({ type: "DUPLICATE", id: state.selection.id });
      } else if (e.key === "Escape") {
        dispatch({ type: "SELECT", selection: null });
        dispatch({ type: "SET_TOOL", tool: "select" });
        setReport(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, state.selection]);

  const noticeStyle =
    state.notice?.kind === "ok"
      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
      : state.notice?.kind === "warn"
        ? "border-amber-400/50 bg-amber-500/15 text-amber-100"
        : "border-sky-400/50 bg-sky-500/15 text-sky-100";

  return (
    <div className="workbench-app flex h-[100dvh] flex-col bg-slate-950 text-slate-100" data-fullscreen={isFullscreen ? "true" : "false"}>
      <AppShell fullscreenAvailable={fullscreenAvailable} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
      <div className="workbench-layout relative flex min-h-0 flex-1">
        <aside
          className={`${leftOpen ? "flex" : "hidden"} workbench-panel workbench-panel-left w-[340px] shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-900/80 max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:w-[min(92vw,360px)] max-lg:shadow-2xl max-lg:backdrop-blur`}
        >
          {mode === "lab" ? (
            <LabPanel
              zone="lab"
              mission={mission}
              progress={progress}
              missionProgress={missionProgress}
              evaluation={evaluation}
              onSelectMission={selectMission}
              onSetPrediction={(v) => updateMission((p) => ({ ...p, prediction: v }))}
              onSetAnswer={(v) => updateMission((p) => ({ ...p, answer: v }))}
              onTryComplete={tryComplete}
              onHint={() => updateMission((p) => ({ ...p, hintLevel: Math.min((mission?.hints.length ?? 0), p.hintLevel + 1) }))}
              onClearBench={onClear}
            />
          ) : mode === "build" ? (
            <LabPanel
              zone="build"
              mission={mission}
              progress={progress}
              missionProgress={missionProgress}
              evaluation={evaluation}
              onSelectMission={selectMission}
              onSetPrediction={(v) => updateMission((p) => ({ ...p, prediction: v }))}
              onSetAnswer={(v) => updateMission((p) => ({ ...p, answer: v }))}
              onTryComplete={tryComplete}
              onHint={() => updateMission((p) => ({ ...p, hintLevel: Math.min((mission?.hints.length ?? 0), p.hintLevel + 1) }))}
              onClearBench={onClear}
            />
          ) : (
            <IdeasPanel construction={state.construction} onLoad={loadShared} notify={notify} />
          )}
        </aside>

        <main className="relative min-w-0 flex-1">
          <Workbench ref={wbRef} state={state} analysis={analysis} dispatch={dispatch} />
          <TopControls
            state={state}
            dispatch={dispatch}
            onZoom={(f) => wbRef.current?.zoomBy(f)}
            onZoomReset={() => wbRef.current?.zoomTo(1)}
            onFit={() => wbRef.current?.fit()}
            onCheck={onCheck}
            onClear={onClear}
          />
          <Toolbar state={state} analysis={analysis} dispatch={dispatch} onAdd={onAdd} onTest={onTest} onOneTurn={onOneTurn} />

          <button className="btn-icon panel-toggle absolute left-2 top-14 z-20 !bg-slate-900/85" onClick={() => togglePanel("left")} title={leftOpen ? "Paneel verbergen" : mode === "lab" ? "Opdracht tonen" : mode === "build" ? "Bouwopdracht tonen" : "Ideeën tonen"}>
            {leftOpen ? "◀" : mode === "lab" ? "🧪" : mode === "build" ? "🏗️" : "💡"}
          </button>
          <button className="btn-icon panel-toggle absolute right-2 top-14 z-20 !bg-slate-900/85" onClick={() => togglePanel("right")} title={rightOpen ? "Paneel verbergen" : "Instellingen en meetpaneel tonen"}>
            {rightOpen ? "▶" : "📏"}
          </button>

          {state.notice && (
            <div key={state.notice.id} className={`notice-pop pointer-events-none absolute left-1/2 top-14 z-30 max-w-[min(92%,520px)] -translate-x-1/2 rounded-xl border px-4 py-2 text-center text-sm font-semibold shadow-xl backdrop-blur ${noticeStyle}`}>
              {state.notice.text}
            </div>
          )}

          {report && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setReport(null)}>
              <div className="card w-full max-w-md border-sky-500/40" onClick={(e) => e.stopPropagation()}>
                <div className="mb-2 text-base font-black text-slate-100">🔍 Controleer opstelling</div>
                <ul className="space-y-1 text-sm text-slate-200">
                  {report.map((l, i) => (
                    <li key={i} className={`rounded-lg px-2 py-1 ${l.startsWith("Alles") ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800/80"}`}>
                      {l}
                    </li>
                  ))}
                </ul>
                <button className="btn btn-sky mt-3 w-full" onClick={() => setReport(null)}>
                  Oké
                </button>
              </div>
            </div>
          )}
        </main>

        <aside
          className={`${rightOpen ? "flex" : "hidden"} workbench-panel workbench-panel-right w-[330px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-800 bg-slate-900/80 p-3 max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:w-[min(92vw,320px)] max-lg:shadow-2xl max-lg:backdrop-blur`}
        >
          <MeasurementPanel state={state} analysis={analysis} dispatch={dispatch} />
          <MotorPanel state={state} dispatch={dispatch} />
          <InspectorPanel state={state} analysis={analysis} dispatch={dispatch} />
        </aside>
      </div>
    </div>
  );
}
