"use client";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { fmtNumber } from "@/lib/format";
import { BIKE, REAR_TEETH, ROUTES, cadence, forces, initialBike, maximumCadenceForMode, oneTurn, ratio, shiftBike, stepBike, targetCadence, type BikeMode, type BikeState } from "@/lib/bike/physics";
import { BIKE_LESSONS, loadBikeJournal, newJournal, saveBikeJournal, tested, type BikeJournal, type BikeProgress } from "@/lib/bike/discoveries";
import { BikeScene } from "./BikeScene";
import "./bike.css";

export function BikeLab() {
  const [state, setState] = useState(initialBike);
  const sim = useRef(state);
  const [journal, setJournal] = useState<BikeJournal>(newJournal);
  const journalRef = useRef(journal);
  const [ready, setReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const lesson = BIKE_LESSONS.find(l => l.id === state.mode)!;
  const progress = journal[state.mode];
  const testDone = tested(state.mode, progress);
  const f = forces(state);
  const rpm = cadence(state);
  const targetRpm = targetCadence(state.mode);
  const maxRpm = maximumCadenceForMode(state.mode);
  const cadenceText = state.fatigued ? "vermoeid · terug naar 90" : rpm >= maxRpm - 1.5 ? "maximum" : rpm === 0 ? "stil" : rpm < targetRpm - 10 ? "laag" : rpm > targetRpm + 10 ? "te hoog" : "goed";
  const highCadenceSecondsLeft = Math.max(1, Math.ceil(BIKE.overCadenceSeconds - state.highCadenceTime));

  function setSim(next: BikeState) { sim.current = next; setState(next); }
  function changeProgress(mode: BikeMode, patch: Partial<BikeProgress>) {
    const next = { ...journalRef.current, [mode]: { ...journalRef.current[mode], ...patch } };
    journalRef.current = next; setJournal(next);
    if (!saveBikeJournal(next)) setNotice("Opslaan lukt niet in deze browser. Houd dit tabblad open om verder te werken.");
  }
  useEffect(() => {
    const saved = loadBikeJournal(); journalRef.current = saved; setJournal(saved); setReady(true);
    setCanFullscreen(typeof document.documentElement.requestFullscreen === "function");
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    let frame = 0, previous = 0;
    const tick = (now: number) => {
      const before = sim.current;
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      const next = stepBike(before, dt);
      if (next !== before) {
        sim.current = next; setState(next);
        if ((!before.measured && next.measured) || (!before.finished && next.finished)) {
          const current = journalRef.current;
          const p = current[next.mode];
          const updated = { ...current, [next.mode]: { ...p, records: [...p.records, { rear: next.rear, wheelTurns: next.mode === "flat" ? next.wheelTurns : ratio(next.rear), seconds: next.elapsed, speed: next.speed * 3.6, shifts: next.shifts, cadence: next.mode === "flat" ? cadence(next) : undefined }].slice(-30) } };
          journalRef.current = updated; setJournal(updated);
          if (!saveBikeJournal(updated)) setNotice("Opslaan lukt niet in deze browser.");
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) { const paused = { ...sim.current, running: false }; sim.current = paused; setState(paused); } };
    document.addEventListener("visibilitychange", hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", hide); };
  }, []);
  async function toggleFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setNotice("Volledig scherm kon niet worden geopend."); }
  }
  function selectMode(mode: BikeMode) { setSim(initialBike(mode)); setNotice(""); }
  const feedback = state.finished ? (state.mode === "hill" ? "Top bereikt! Je beenkracht bleef de hele rit gelijk." : "Finish! Vergelijk je tijd en probeer een andere aanpak.") : state.fatigued ? "Je hield een te hoog traptempo te lang vol. Je tempo zakt nu geleidelijk. Onder 90 rpm start de aftelling opnieuw vanaf nul." : rpm >= maxRpm - 1.5 ? `Je zit aan het maximale traptempo van ${maxRpm} rpm. Schakel zwaarder om nog sneller te rijden.` : state.running && rpm > BIKE.sustainableCadence ? `Dit hoge traptempo houd je nog ${highCadenceSecondsLeft} ${highCadenceSecondsLeft === 1 ? "seconde" : "seconden"} vol. Schakel zwaarder.` : state.running && rpm >= targetRpm - 10 ? `Mooi traptempo. ${state.mode === "hill" ? "Bergop mik je rond 70 rpm." : "Op het vlak mik je rond 90 rpm."}` : state.mode === "hill" && f.drive < f.resistance + 4 && state.distance > 5 ? "De berg wordt steiler. Je benen duwen nog even hard. Kun je lichter schakelen?" : state.mode === "flat" ? (state.running ? "Je beenkracht blijft gelijk. Kijk hoe het verzet je traptempo verandert." : "Vergelijk ook de snelheid en het traptempo bij een licht en een zwaar verzet.") : state.mode === "sprint" && rpm < 45 && state.speed > 0 ? "De trappers draaien traag. Onderzoek of een lichtere versnelling helpt versnellen." : "Kijk naar het traptempo en de snelheid. Onderzoek wat schakelen doet.";
  return <div className="bike-app">
    <AppShell fullscreenAvailable={canFullscreen} isFullscreen={fullscreen} onToggleFullscreen={toggleFullscreen} />
    <div className="bike-heading"><div><h1>🚲 Fietslab</h1><span>Waarom schakel je anders bergop dan tijdens een sprint?</span></div><div className="seg" aria-label="Fietsproef">{BIKE_LESSONS.map((l, i) => <button key={l.id} className={state.mode === l.id ? "on" : ""} onClick={() => selectMode(l.id)}>{i + 1}. {l.label}{journal[l.id].completed ? " ✓" : ""}</button>)}</div></div>
    <main className="bike-layout">
      <aside className="bike-lesson" aria-label="Ontdekopdracht">
        <div className="card"><div className="text-xs font-bold uppercase text-sky-300">Ontdekopdracht · {lesson.label}</div><h2 className="mt-1 text-xl font-black">{lesson.title}</h2><p className="mt-2 text-sm text-slate-300">{lesson.task}</p></div>
        <div className="card"><h3>1 · Voorspel</h3><p className="my-2 text-sm">{lesson.question}</p><Choices name={`prediction-${state.mode}`} options={lesson.options} value={progress.prediction} disabled={progress.completed} onChange={prediction => changeProgress(state.mode, { prediction })} /></div>
        <div className="card"><h3>2 · Test {testDone && "✓"}</h3><p className="mt-1 text-sm text-slate-300">{state.mode === "flat" ? "Meet minstens twee verschillende achtertandwielen met 1 trapronde." : "Bereik het einde van de route. Je mag onderweg schakelen."}</p>
          {progress.records.length > 0 && <ul className="mt-2 space-y-1 text-xs text-sky-200">{progress.records.slice(-4).map((r, i) => <li key={i}>{state.mode === "flat" ? `${REAR_TEETH[r.rear]} tanden → ${fmtNumber(r.wheelTurns)} wielrondes${Number.isFinite(r.cadence) ? ` · ${fmtNumber(r.speed, 1)} km/u · ${fmtNumber(r.cadence!, 0)} rpm` : ""}` : `${fmtNumber(r.seconds, 1)} s · ${fmtNumber(r.speed, 1)} km/u · ${r.shifts} keer geschakeld`}</li>)}</ul>}
        </div>
        <div className="card"><h3>3 · Antwoord</h3><p className="my-2 text-sm">{lesson.question}</p>{!testDone && <p className="mb-2 text-xs text-slate-400">Eerst voorspellen en de proef uitvoeren</p>}<Choices name={`answer-${state.mode}`} options={lesson.options} value={progress.answer} disabled={!testDone || progress.completed} onChange={answer => changeProgress(state.mode, { answer })} />{progress.answer && progress.answer !== lesson.correct && <p className="mt-2 text-xs text-amber-200">Vergelijk je antwoord met de proef. Test gerust opnieuw.</p>}</div>
        <div className="card"><h3>4 · Mijn besluit</h3><p className="mt-2 text-sm">{progress.completed || (testDone && progress.answer === lesson.correct) ? lesson.discovery : "Voer de proef uit en kies het juiste antwoord. Daarna verschijnt je besluit hier."}</p>
          <button className="btn btn-emerald mt-2 w-full" disabled={progress.completed || !testDone || !progress.prediction || progress.answer !== lesson.correct} onClick={() => changeProgress(state.mode, { completed: true, conclusion: lesson.discovery })}>{progress.completed ? "✓ Ontdekking bewaard" : "Ontdekking afronden"}</button>
        </div>
        {progress.completed && <div className="card border-emerald-500/50"><h3 className="text-emerald-300">De ontdekking</h3><p className="mt-2 text-sm">{lesson.discovery}</p></div>}
      </aside>
      <section className="bike-workspace" aria-label="Fietssimulator">
        <div className="bike-scene-wrap"><BikeScene state={state} /></div>
        <div className="bike-readout" aria-live="off">
          <div><span>Achteraan</span><strong>{REAR_TEETH[state.rear]} <small>tanden</small></strong></div>
          <div><span>Snelheid</span><strong>{fmtNumber(state.speed * 3.6, 1)}<small> km/u</small></strong></div>
          {state.mode === "flat" && <div><span>Wielrondes gemeten</span><strong>{fmtNumber(state.wheelTurns, 2)}</strong></div>}
          {state.mode !== "flat" && <div><span>Rijtijd</span><strong>{fmtNumber(state.elapsed, 1)}<small> s</small></strong></div>}
          <div><span>Traptempo · richttempo {targetRpm}</span><strong>{fmtNumber(rpm, 0)}<small> rpm</small></strong></div>
          <div className="bike-force"><span>🔒 Beenkracht · 100% constant</span><Meter value={100} color="amber" /><span>Duwkracht aan het wiel</span><Meter value={f.drive / 102 * 100} color="sky" />{state.mode !== "sprint" && <><span>Berg en weg vragen</span><Meter value={Math.max(0, f.resistance) / 102 * 100} color="rose" /></>}</div>
        </div>
        {state.mode !== "flat" && <div className="bike-route"><label>Route · {Math.round(state.distance / ROUTES[state.mode].length * 100)}%<progress max={ROUTES[state.mode].length} value={state.distance} /></label><label>Traptempo · {fmtNumber(rpm, 0)} rpm · {cadenceText} · richttempo {targetRpm} rpm<Meter value={rpm / maxRpm * 100} color={rpm > targetRpm + 10 ? "rose" : "sky"} /></label></div>}
        <p className="bike-feedback" role="status">{notice || feedback}</p>
        <div className="bike-controls">
          <div className="bike-cassette" aria-label="Negen achtertandwielen">{[...REAR_TEETH].reverse().map((t, i) => <button key={t} aria-label={`Achteraan ${t} tanden`} aria-pressed={state.rear === 8 - i} disabled={state.oneTurnRemaining > 0 || state.finished} className={`chip ${state.rear === 8 - i ? "on" : ""}`} onClick={() => setSim(shiftBike(sim.current, 8 - i))}><svg viewBox="-42 -42 84 84" aria-hidden><circle r={t} fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="4 2" /><circle r="6" fill="currentColor" /></svg>{t}</button>)}</div>
          <div className="bike-buttons"><button className="btn btn-ghost" disabled={state.rear === 8 || state.oneTurnRemaining > 0 || state.finished} onClick={() => setSim(shiftBike(sim.current, state.rear + 1))}>← Lichter</button><button className="btn btn-ghost" disabled={state.rear === 0 || state.oneTurnRemaining > 0 || state.finished} onClick={() => setSim(shiftBike(sim.current, state.rear - 1))}>Zwaarder →</button><button className="btn btn-sky" disabled={!ready || !progress.prediction || state.finished} onClick={() => setSim({ ...sim.current, running: !sim.current.running })}>{state.running ? "⏸ Pauze" : "▶ Start"}</button>{state.mode === "flat" && <button className="btn btn-motor" disabled={!ready || !progress.prediction || state.oneTurnRemaining > 0} onClick={() => setSim(oneTurn(sim.current))}>↻ 1 trapronde</button>}<button className="btn btn-ghost" onClick={() => setSim(initialBike(state.mode))}>Reset proef</button></div>
          {!progress.prediction && <p className="text-center text-xs text-amber-200">Kies eerst je voorspelling om te starten</p>}
        </div>
        <details className="bike-model"><summary>Wat houden we gelijk? · Over dit model</summary><p>🔒 Beenkracht · fiets en massa · wielgrootte · voortandwiel (40 tanden) · maximale trapcapaciteit · route. Alleen het tandwiel achteraan verandert.</p><p>Dit is een vereenvoudigd wetenschappelijk model. In het echt spelen ook gewicht, luchtweerstand, wrijving en andere factoren mee. Een echte fiets heeft extra onderdelen om de ketting te geleiden.</p><p>Wielrenners mikken op het vlak rond 90 rpm. Bergop is 90 rpm de bovengrens in dit model, maar op steile stukken zakt het tempo vaak richting 70 rpm of lager omdat de vaste beenkracht niet volstaat. Op het vlak en tijdens de sprint begint boven 90 rpm een aftelling.</p></details>
      </section>
    </main>
  </div>;
}
function Choices({ name, options, value, disabled, onChange }: { name: string; options: string[]; value: string; disabled: boolean; onChange: (value: string) => void }) { return <div className="space-y-1">{options.map(option => <label key={option} className={`option ${value === option ? "on" : ""}`}><input type="radio" name={name} checked={value === option} disabled={disabled} onChange={() => onChange(option)} /><span>{option}</span></label>)}</div>; }
function Meter({ value, color }: { value: number; color: "amber" | "sky" | "rose" }) { return <div className="bike-meter" role="meter" aria-label={color === "amber" ? "Constante beenkracht" : "Meter"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(100, value)))}><div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color === "amber" ? "#fbbf24" : color === "sky" ? "#38bdf8" : "#fb7185" }} /></div>; }
