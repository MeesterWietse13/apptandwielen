"use client";
import type { Dispatch } from "react";
import { dirArrow, dirWord, fmtRevs, revsWords } from "@/lib/format";
import type { Analysis } from "@/lib/mechanics/mechanismGraph";
import { shaftPartnerId } from "@/lib/mechanics/shaftPhysics";
import { measure, SPEEDS, type Speed } from "@/lib/mechanics/simulationEngine";
import { MAX_TEETH, MIN_TEETH, TEETH_PRESETS, type Layer } from "@/lib/mechanics/types";
import type { Action, WorkbenchState } from "./useWorkbench";

interface PanelProps {
  state: WorkbenchState;
  analysis: Analysis;
  dispatch: Dispatch<Action>;
}

/** Compact instellingenpaneel van het geselecteerde onderdeel. */
export function InspectorPanel({ state, analysis, dispatch }: PanelProps) {
  const { construction, selection } = state;
  if (!selection) {
    return (
      <div className="card text-sm text-slate-300">
        <div className="mb-1 font-bold text-slate-100">Niets geselecteerd</div>
        <p>Klik op een tandwiel om het in te stellen. Sleep om te verplaatsen.</p>
        <p className="mt-1 text-slate-400">Tip: sleep een tandwiel tegen een ander tot het <span className="text-emerald-300">klikt</span>.</p>
      </div>
    );
  }
  if (selection.type === "chain") {
    const ch = construction.chains.find((k) => k.id === selection.id);
    const a = construction.components.find((k) => k.id === ch?.a);
    const b = construction.components.find((k) => k.id === ch?.b);
    if (!ch || !a || !b) return null;
    return (
      <div className="card">
        <div className="mb-2 text-base font-extrabold text-slate-100">
          🔗 Ketting {a.letter} — {b.letter}
        </div>
        <p className="mb-3 text-sm text-slate-300">
          {a.letter} ({a.teeth} tanden) en {b.letter} ({b.teeth} tanden) op Laag {a.layer}.
        </p>
        <button className="btn btn-danger w-full" onClick={() => dispatch({ type: "REMOVE_CHAIN", id: ch.id })}>
          Ketting verwijderen
        </button>
      </div>
    );
  }
  const comp = construction.components.find((k) => k.id === selection.id);
  if (!comp) return null;
  const node = analysis.nodes[comp.id];
  const isMotor = construction.motorId === comp.id;
  const isTarget = construction.targetId === comp.id;
  const partnerId = shaftPartnerId(construction, comp.id);
  const partner = construction.components.find((k) => k.id === partnerId);

  return (
    <div className="card">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-base font-extrabold text-slate-100">
          {comp.letter} — {comp.teeth} tanden
        </div>
        <div className="flex gap-1 text-xs font-bold">
          {isMotor && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">⚡ MOTOR</span>}
          {isTarget && <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-300">🎯 DOEL</span>}
        </div>
      </div>
      <div className="mb-3 text-xs text-slate-400">
        {comp.kind === "gear" ? "Gewoon tandwiel" : "Kettingtandwiel"} · Laag {comp.layer}
        {partner && <span className="text-amber-300"> · op één as met {partner.letter}</span>}
        {node && !node.connected && construction.motorId && <span className="text-slate-500"> · beweegt niet mee</span>}
      </div>

      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Aantal tanden</label>
      <div className="mb-2 flex items-center gap-2">
        <button className="btn-icon" onClick={() => dispatch({ type: "SET_TEETH", id: comp.id, teeth: comp.teeth - 1 })} disabled={comp.teeth <= MIN_TEETH} aria-label="Minder tanden">
          −
        </button>
        <input
          type="range"
          min={MIN_TEETH}
          max={MAX_TEETH}
          step={1}
          value={comp.teeth}
          onChange={(e) => dispatch({ type: "SET_TEETH", id: comp.id, teeth: Number(e.target.value) })}
          className="flex-1 accent-sky-400"
          aria-label="Aantal tanden"
        />
        <button className="btn-icon" onClick={() => dispatch({ type: "SET_TEETH", id: comp.id, teeth: comp.teeth + 1 })} disabled={comp.teeth >= MAX_TEETH} aria-label="Meer tanden">
          +
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {TEETH_PRESETS.map((t) => (
          <button key={t} className={`chip ${comp.teeth === t ? "on" : ""}`} onClick={() => dispatch({ type: "SET_TEETH", id: comp.id, teeth: t })}>
            {t}
          </button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1.5">
        <button className={`btn ${isMotor ? "btn-amber-soft" : "btn-amber"}`} onClick={() => dispatch({ type: "SET_MOTOR", id: comp.id })} disabled={isMotor}>
          ⚡ {isMotor ? "Is de motor" : "Maak motor"}
        </button>
        <button className={`btn ${isTarget ? "btn-ghost" : "btn-rose"}`} onClick={() => dispatch({ type: "SET_TARGET", id: isTarget ? null : comp.id })} disabled={isMotor}>
          🎯 {isTarget ? "Doel weghalen" : "Maak doel"}
        </button>
        <button className="btn btn-ghost" onClick={() => dispatch({ type: "DUPLICATE", id: comp.id })}>
          ⧉ Dupliceren
        </button>
        <button className="btn btn-danger" onClick={() => dispatch({ type: "DELETE", id: comp.id })}>
          🗑 Verwijderen
        </button>
      </div>

      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Laag</label>
      <div className="seg mb-2 w-full">
        {[1, 2].map((l) => (
          <button key={l} className={`flex-1 ${comp.layer === l ? "on" : ""}`} onClick={() => dispatch({ type: "SET_LAYER", id: comp.id, layer: l as Layer })}>
            Laag {l}
          </button>
        ))}
      </div>
      {partner && (
        <button className="btn btn-ghost w-full" onClick={() => dispatch({ type: "REMOVE_SHAFT", id: comp.id })}>
          Van de as halen (los van {partner.letter})
        </button>
      )}
      {comp.kind === "sprocket" && (
        <button className="btn btn-indigo mt-2 w-full" onClick={() => { dispatch({ type: "SET_TOOL", tool: "chain" }); dispatch({ type: "CHAIN_CLICK", id: comp.id }); }}>
          🔗 Ketting vanaf {comp.letter}…
        </button>
      )}
    </div>
  );
}

/** Motorinstellingen: richting en testsnelheid. De snelheid verandert nooit de verhouding. */
export function MotorPanel({ state, dispatch }: Omit<PanelProps, "analysis">) {
  const { construction, speed } = state;
  const motor = construction.components.find((k) => k.id === construction.motorId);
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-extrabold text-slate-100">⚡ Motor</div>
        {motor ? (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
            {motor.letter} ⚡ MOTOR · {motor.teeth} tanden
          </span>
        ) : (
          <span className="text-xs text-slate-400">nog geen motor</span>
        )}
      </div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Richting</label>
      <div className="seg mb-2 w-full">
        <button className={`flex-1 ${construction.motorDirection === 1 ? "on" : ""}`} onClick={() => dispatch({ type: "SET_DIRECTION", direction: 1 })}>
          ↻ Rechtsom
        </button>
        <button className={`flex-1 ${construction.motorDirection === -1 ? "on" : ""}`} onClick={() => dispatch({ type: "SET_DIRECTION", direction: -1 })}>
          ↺ Linksom
        </button>
      </div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Testsnelheid</label>
      <div className="seg w-full">
        {SPEEDS.map((s: Speed) => (
          <button key={s} className={`flex-1 capitalize ${speed === s ? "on" : ""}`} onClick={() => dispatch({ type: "SET_SPEED", speed: s })}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Meetpaneel: rondjes en richting per onderdeel. */
export function MeasurementPanel({ state, analysis, dispatch }: PanelProps) {
  const { construction, sim } = state;
  const rows = measure(construction, analysis, sim.theta);
  const measured = sim.theta > 0;
  const motor = construction.components.find((k) => k.id === construction.motorId);
  // Woorden zijn alleen nuttig na een vaste meting. Tijdens een vrije test
  // kwamen ze telkens heel even tevoorschijn bij een volledig rondje, waardoor
  // het meetpaneel in hoogte en de tabel in breedte versprong.
  const words = sim.oneTurnDone ? rows.filter((r) => r.connected && !r.isMotor).map((r) => ({ r, w: revsWords(r.revs) })).filter((x) => x.w) : [];
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-extrabold text-slate-100">📏 Meetpaneel</div>
        <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => dispatch({ type: "SIM_CLEAR" })} disabled={!measured}>
          Meting wissen
        </button>
      </div>
      <div className="mb-2 text-xs text-slate-400">
        {!motor
          ? "Kies eerst een motor."
          : sim.status === "oneTurn"
            ? `Motor draait… ${fmtRevs(sim.theta)} rondje`
            : sim.oneTurnDone
              ? "✓ Motor draaide exact 1,00 rondje."
              : measured
                ? `Motor draaide ${fmtRevs(sim.theta)} rondjes (Test).`
                : "Druk op ↻ MOTOR 1 RONDJE om exact te meten."}
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-500">Nog geen onderdelen.</div>
      ) : (
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="w-[28%] pb-1 pr-1">Tandwiel</th>
              <th className="w-[18%] px-1 pb-1 text-right">Tanden</th>
              <th className="w-[22%] px-1 pb-1 text-right">Rondjes</th>
              <th className="w-[32%] pb-1 pl-2">Richting</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-slate-800 ${r.connected ? "text-slate-100" : "text-slate-500"}`}>
                <td className="py-1 font-bold">
                  {r.letter}
                  {r.isMotor && <span className="text-amber-300"> ⚡</span>}
                  {construction.targetId === r.id && <span> 🎯</span>}
                  {r.kind === "sprocket" && <span className="ml-1 text-[10px] font-normal text-indigo-300">ketting</span>}
                  <span className="ml-1 text-[10px] font-normal text-slate-500">L{r.layer}</span>
                </td>
                <td className="px-1 py-1 text-right tabular-nums">{r.teeth}</td>
                <td className="px-1 py-1 text-right font-mono text-base font-bold tabular-nums">{r.connected ? fmtRevs(r.revs) : "—"}</td>
                <td className="overflow-hidden py-1 pl-2">
                  {r.connected ? (
                    <span className="whitespace-nowrap">
                      <span className="text-lg leading-none">{dirArrow(r.direction)}</span> <span className="text-xs text-slate-300">{dirWord(r.direction)}</span>
                    </span>
                  ) : (
                    <span className="text-xs">beweegt niet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {words.length > 0 && (
        <div className="mt-2 space-y-0.5 text-xs text-sky-200">
          {words.map(({ r, w }) => (
            <div key={r.id}>
              {r.letter}: {fmtRevs(r.revs)} = {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
