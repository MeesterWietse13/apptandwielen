"use client";
import type { Dispatch } from "react";
import type { Analysis } from "@/lib/mechanics/mechanismGraph";
import { MAX_COMPONENTS, type ComponentKind, type Layer } from "@/lib/mechanics/types";
import type { Action, LayerView, WorkbenchState } from "./useWorkbench";

interface ToolbarProps {
  state: WorkbenchState;
  analysis: Analysis;
  dispatch: Dispatch<Action>;
  onAdd: (kind: ComponentKind) => void;
  onTest: () => void;
  onOneTurn: () => void;
}

export function Toolbar({ state, analysis, dispatch, onAdd, onTest, onOneTurn }: ToolbarProps) {
  const { construction, sim, view, tool } = state;
  const count = construction.components.length;
  const full = count >= MAX_COMPONENTS;
  const running = sim.status === "test";
  const busy = sim.status === "oneTurn";

  const setLayerView = (lv: LayerView) => {
    const patch: Partial<typeof view> = { layerView: lv };
    if (lv === "L1") patch.activeLayer = 1;
    if (lv === "L2") patch.activeLayer = 2;
    dispatch({ type: "SET_VIEW", patch });
  };

  return (
    <div className="workbench-toolbar pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-2 sm:p-3">
      <div className="workbench-toolbar-inner pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-2 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-1.5">
          <button className="btn btn-sky" onClick={() => onAdd("gear")} disabled={full} title="Gewoon tandwiel toevoegen">
            <GearIcon /> <span className="hidden sm:inline">Tandwiel</span>
          </button>
          <button className="btn btn-indigo" onClick={() => onAdd("sprocket")} disabled={full} title="Kettingtandwiel toevoegen">
            <SprocketIcon /> <span className="hidden sm:inline">Kettingtandwiel</span>
          </button>
          <button
            className={`btn ${tool === "chain" ? "btn-active" : "btn-ghost"}`}
            onClick={() => dispatch({ type: "SET_TOOL", tool: tool === "chain" ? "select" : "chain" })}
            title="Ketting tussen twee kettingtandwielen"
          >
            🔗 <span className="hidden sm:inline">Ketting</span>
          </button>
          <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${full ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-300"}`} title="Aantal onderdelen">
            {count}/{MAX_COMPONENTS}
          </span>
        </div>

        <div className="seg" role="group" aria-label="Lagen">
          <button className={view.layerView === "L1" ? "on" : ""} onClick={() => setLayerView("L1")}>
            Laag 1
          </button>
          <button className={view.layerView === "L2" ? "on" : ""} onClick={() => setLayerView("L2")}>
            Laag 2
          </button>
          <button className={view.layerView === "both" ? "on" : ""} onClick={() => setLayerView("both")}>
            Beide
          </button>
        </div>
        {view.layerView === "both" && (
          <div className="seg" role="group" aria-label="Actieve laag">
            {[1, 2].map((l) => (
              <button key={l} className={view.activeLayer === l ? "on" : ""} onClick={() => dispatch({ type: "SET_VIEW", patch: { activeLayer: l as Layer } })} title="Nieuwe onderdelen komen op deze laag">
                Bouw op {l}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button className={`btn ${running ? "btn-amber-soft" : "btn-emerald"}`} onClick={onTest} disabled={busy} title={running ? "Pauze" : "Test: motor draait continu"}>
            {running ? "⏸ Pauze" : "▶ Test"}
          </button>
          <button className="btn btn-motor" onClick={onOneTurn} disabled={busy} title="Motor draait exact één rondje en meet alles">
            {busy ? "↻ Bezig…" : "↻ MOTOR 1 RONDJE"}
          </button>
          <button className="btn btn-ghost" onClick={() => dispatch({ type: "SIM_CLEAR" })} disabled={sim.theta === 0 && sim.status !== "oneTurn"} title="Wist alleen de meetwaarden">
            Meting wissen
          </button>
        </div>
        {analysis.blocked && <div className="w-full text-center text-xs font-semibold text-rose-300">{analysis.problems.find((p) => p.type !== "noMotor")?.message}</div>}
      </div>
    </div>
  );
}

interface TopControlsProps {
  state: WorkbenchState;
  dispatch: Dispatch<Action>;
  onZoom: (f: number) => void;
  onZoomReset: () => void;
  onFit: () => void;
  onCheck: () => void;
  onClear: () => void;
}

export function TopControls({ state, dispatch, onZoom, onZoomReset, onFit, onCheck, onClear }: TopControlsProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-3">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-slate-700/70 bg-slate-900/85 p-1 shadow-lg backdrop-blur">
        <button className="btn-icon" onClick={() => dispatch({ type: "UNDO" })} disabled={state.past.length === 0} title="Ongedaan maken (Ctrl+Z)">
          ↶
        </button>
        <button className="btn-icon" onClick={() => dispatch({ type: "REDO" })} disabled={state.future.length === 0} title="Opnieuw (Ctrl+Y)">
          ↷
        </button>
        <span className="mx-1 h-5 w-px bg-slate-700" />
        <button className="btn-icon" onClick={onCheck} title="Controleer opstelling (technische fouten)">
          🔍
        </button>
        <button className="btn-icon" onClick={onClear} disabled={state.construction.components.length === 0} title="Werkbank leegmaken">
          🗑
        </button>
      </div>
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-slate-700/70 bg-slate-900/85 p-1 shadow-lg backdrop-blur">
        <button className="btn-icon" onClick={() => onZoom(1 / 1.25)} title="Zoom uit">
          −
        </button>
        <button className="btn-icon min-w-[3.2rem] text-xs font-bold" onClick={onZoomReset} title="100%">
          {Math.round(state.view.zoom * 100)}%
        </button>
        <button className="btn-icon" onClick={() => onZoom(1.25)} title="Zoom in">
          +
        </button>
        <button className="btn-icon" onClick={onFit} title="Constructie centreren">
          ⊡
        </button>
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l1.6 2.6 3-.6.6 3L19.8 8.6 18 11l1.8 2.4-2.6 1.6-.6 3-3-.6L12 22l-1.6-2.6-3 .6-.6-3-2.6-1.6L6 12 4.2 9.6 6.8 8l.6-3 3 .6z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="12" cy="12" r="3.2" fill="#0f172a" />
    </svg>
  );
}

function SprocketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2.2" strokeDasharray="2.5 2.2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}
