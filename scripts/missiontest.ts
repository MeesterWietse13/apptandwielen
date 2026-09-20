import { analyze } from "../src/lib/mechanics/mechanismGraph";
import { pitchRadius } from "../src/lib/mechanics/gearGeometry";
import { emptyConstruction, structureHash, type Construction, type MechComponent, type Layer, type ComponentKind } from "../src/lib/mechanics/types";
import { buildRecord, emptyProgress, evaluateMission, addRecord, type MissionProgress, type TestRecord } from "../src/lib/missions/missionEngine";
import { MISSIONS, missionById } from "../src/lib/missions/missions";

let fails = 0;
function comp(letter: string, kind: ComponentKind, teeth: number, x: number, y: number, layer: Layer = 1): MechComponent { return { id: letter, letter, kind, teeth, x, y, layer }; }
function train(teeth: number[], kind: ComponentKind = "gear", gap = 0): Construction {
  const c = emptyConstruction(); let x = 0;
  teeth.forEach((t, i) => { const letter = String.fromCharCode(65 + i); if (i > 0) x += pitchRadius(teeth[i - 1]) + pitchRadius(t) + gap; c.components.push(comp(letter, kind, t, x, 0)); });
  c.motorId = "A";
  if (kind === "sprocket") for (let i = 1; i < teeth.length; i++) c.chains.push({ id: `ch${i}`, a: String.fromCharCode(64 + i), b: String.fromCharCode(65 + i) });
  return c;
}
function rec(c: Construction, kind: "oneTurn" | "test"): TestRecord { return buildRecord(c, analyze(c), kind, structureHash(c)); }
function run(id: string, live: Construction, records: Construction[] | null, kind: "oneTurn" | "test", answers: Partial<MissionProgress> = {}) {
  const m = missionById(id)!;
  let p: MissionProgress = { ...emptyProgress(), prediction: m.prediction ? m.prediction.options[0].id : null, conclusion: "", ...answers };
  for (const rc of records ?? []) p = addRecord(p, rec(rc, kind));
  p = addRecord(p, rec(live, kind));
  const ev = evaluateMission(m, p, { construction: live, analysis: analyze(live), hash: structureHash(live) });
  const ok = ev.canComplete;
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"}: ${id} ${m.title}` + (ok ? "" : ` -> ${ev.requirements.filter(r => !r.done).map(r => r.label).join("; ")} | truth=${ev.truth} answer=${p.answer} answerCorrect=${ev.answerCorrect}`));
}
// Machine: A(40,L1) mesh B(20,L1); C spr(30,L2) op as B; D spr(15,L2) ketting met C
function bigMachine(extraGear = false): Construction {
  const c = emptyConstruction(); const xb = pitchRadius(40) + pitchRadius(20);
  c.components.push(comp("A", "gear", 40, 0, 0, 1), comp("B", "gear", 20, xb, 0, 1), comp("C", "sprocket", 30, xb, 0, 2), comp("D", "sprocket", 15, xb, -320, 2));
  if (extraGear) c.components.push(comp("E", "gear", 20, xb + pitchRadius(20) * 2, 0, 1));
  c.shafts.push({ a: "B", b: "C" }); c.chains.push({ id: "ch", a: "C", b: "D" }); c.motorId = "A"; c.targetId = "D";
  return c;
}
const far = (t: number[], gap: number) => train(t, "sprocket", gap);

run("g1", train([20, 20]), null, "test", { answer: "grijpen" });
run("g2", train([20, 20]), null, "test", { answer: "linksom" });
run("g3", train([40, 20]), null, "oneTurn", { answer: "meer" });
run("g4", train([20, 40]), null, "oneTurn", { answer: "minder" });
run("g5", train([20, 20, 20, 20]), [train([20, 20, 20])], "test", { answer: "drie-zelfde" });
run("g6", train([10, 30]), [train([20, 10])], "oneTurn", { answer: "2-033" });
run("gc1", train([20, 20, 20]), null, "test");
run("gc2", train([20, 20]), null, "test");
run("gc3", train([40, 20]), null, "oneTurn");
run("gc4", train([20, 40]), null, "oneTurn");
run("gc5", train([40, 20]), null, "oneTurn");
run("gc6", train([20, 40]), null, "oneTurn");
run("gc7", train([40, 30, 20, 15, 10]), null, "oneTurn");
run("gc8", train([40, 20, 20, 20, 10]), null, "oneTurn");
run("k1", far([40, 20], 120), null, "test", { answer: "ja" });
run("k2", far([40, 20], 120), null, "test", { answer: "rechtsom" });
run("k3", far([40, 20], 120), null, "oneTurn", { answer: "meer" });
run("k4", far([20, 40], 120), null, "oneTurn", { answer: "minder" });
run("k5", far([20, 10], 120), null, "oneTurn", { answer: "2" });
run("k6", far([20, 10], 320), [far([20, 10], 120)], "oneTurn", { answer: "evenveel" });
run("kc1", far([40, 20], 120), null, "oneTurn");
run("kc2", far([20, 40], 120), null, "oneTurn");
run("kc3", far([40, 20], 120), null, "oneTurn");
run("kc4", far([20, 40], 120), null, "oneTurn");
run("kc5", far([20, 10], 120), [far([40, 20], 120)], "oneTurn");
run("kc6", far([20, 20], 700), null, "test");
{ const c = emptyConstruction(); c.components.push(comp("A", "gear", 40, 0, 0, 1), comp("B", "gear", 20, 0, 0, 2)); c.shafts.push({ a: "A", b: "B" }); c.motorId = "A"; c.targetId = "B"; run("ld1", c, null, "oneTurn", { answer: "zelfde" }); }
{ const c = emptyConstruction(); c.components.push(comp("A", "gear", 40, 0, 0, 1), comp("B", "gear", 15, 0, 0, 2)); c.shafts.push({ a: "A", b: "B" }); c.motorId = "A"; run("l1", c, null, "test"); }
run("l2", bigMachine(), null, "test");
run("l3", bigMachine(), null, "oneTurn");
run("l4", bigMachine(true), null, "test");
// negatieve controles: verkeerde oplossingen mogen NIET slagen
{ const m = missionById("gc5")!; const live = train([40, 30]); let p = addRecord(emptyProgress(), rec(live, "oneTurn")); const ev = evaluateMission(m, p, { construction: live, analysis: analyze(live), hash: structureHash(live) }); console.log(`${!ev.canComplete ? "ok  " : "FAIL"}: gc5 weigert 40->30`); if (ev.canComplete) fails++; }
{ const m = missionById("gc1")!; const live = train([20, 20]); let p = addRecord(emptyProgress(), rec(live, "test")); const ev = evaluateMission(m, p, { construction: live, analysis: analyze(live), hash: structureHash(live) }); console.log(`${!ev.canComplete ? "ok  " : "FAIL"}: gc1 weigert 2 tandwielen (andere richting)`); if (ev.canComplete) fails++; }
{ const m = missionById("kc5")!; const live = far([40, 20], 300); let p = addRecord(emptyProgress(), rec(far([40, 20], 120), "oneTurn")); p = addRecord(p, rec(live, "oneTurn")); const ev = evaluateMission(m, p, { construction: live, analysis: analyze(live), hash: structureHash(live) }); console.log(`${!ev.canComplete ? "ok  " : "FAIL"}: kc5 weigert zelfde tanden op andere afstand`); if (ev.canComplete) fails++; }
{ const m = missionById("g3")!; const live = train([40, 20]); let p: MissionProgress = { ...emptyProgress(), prediction: "meer", answer: "minder", conclusion: "iets" }; p = addRecord(p, rec(live, "oneTurn")); const ev = evaluateMission(m, p, { construction: live, analysis: analyze(live), hash: structureHash(live) }); console.log(`${!ev.canComplete && ev.answerCorrect === false ? "ok  " : "FAIL"}: g3 fout antwoord blokkeert afronden`); if (ev.canComplete) fails++; }
console.log(`\nMissies getest: ${MISSIONS.length}, fouten: ${fails}`);
if (fails) process.exit(1);
