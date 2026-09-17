import { analyze } from "../src/lib/mechanics/mechanismGraph";
import { pitchRadius, computeSnap, pairRelation } from "../src/lib/mechanics/gearGeometry";
import { chainRollers } from "../src/lib/mechanics/chainPhysics";
import { emptyConstruction, type Construction, type MechComponent } from "../src/lib/mechanics/types";
import { tick, startOneTurn, measure } from "../src/lib/mechanics/simulationEngine";

let n = 0; let fails = 0;
function check(name: string, cond: boolean, extra?: unknown) { n++; if (!cond) { fails++; console.log("FAIL:", name, extra ?? ""); } else console.log("ok  :", name); }
function comp(letter: string, kind: "gear"|"sprocket", teeth: number, x: number, y: number, layer: 1|2 = 1): MechComponent { return { id: letter, letter, kind, teeth, x, y, layer }; }
function train(teeth: number[], kind: "gear"|"sprocket" = "gear"): Construction {
  const c = emptyConstruction(); let x = 0;
  teeth.forEach((t, i) => { const letter = String.fromCharCode(65 + i); if (i > 0) x += pitchRadius(teeth[i-1]) + pitchRadius(t); c.components.push(comp(letter, kind, t, x, 0)); });
  c.motorId = "A"; return c;
}
const w = (c: Construction, id: string) => analyze(c).nodes[id].omega;

// Tandwielen
check("twee gelijke 20/20", w(train([20,20]), "B") === -1);
check("40 -> 20 = -2", w(train([40,20]), "B") === -2);
check("20 -> 40 = -0.5", w(train([20,40]), "B") === -0.5);
check("30 -> 20 = -1.5", w(train([30,20]), "B") === -1.5);
{ const c = train([20,30,40]); check("drie: C = +0.5, zelfde kant", w(c,"C") === 0.5 && w(c,"B") === -20/30); }
{ const c = train([20,30,40,10]); check("vier: D = -2", Math.abs(w(c,"D") + 2) < 1e-12); }
{ const c = train([20,30,40,10,25]); check("vijf: E = +0.8", Math.abs(w(c,"E") - 0.8) < 1e-12); }
{ const c = train([10,15,20,25,30,40,50,60,20,10]); const a = analyze(c); check("tien: allemaal verbonden", a.connectedIds.length === 10 && Math.abs(a.nodes["J"].omega + 1) < 1e-9, a.nodes["J"].omega); }
{ const c = train([20,20]); c.components[1].x += 30; const a = analyze(c); check("te ver: niet verbonden", !a.nodes["B"].connected && a.canRun); }
{ const c = train([20,20]); c.components[1].x -= 20; const a = analyze(c); check("overlap: blokkeert", !a.canRun && a.problems.some(p => p.type === "overlap")); }
{ const c = train([40,20]); c.motorId = "B"; check("motor wisselen: A = -0.5", w(c,"A") === -0.5); c.motorDirection = -1; check("richting wisselen: A = +0.5", w(c,"A") === 0.5); }
// Driehoek conflict
{ const c = emptyConstruction(); const r = pitchRadius(20); const D = 2*r; c.components.push(comp("A","gear",20,0,0), comp("B","gear",20,D,0), comp("C","gear",20,D/2, Math.sqrt(3)/2*D)); c.motorId = "A";
  const a = analyze(c); check("driehoek blokkeert", a.hasConflict && !a.canRun && a.nodes["C"].conflict); }
// Vierkant (even lus) ok
{ const c = emptyConstruction(); const D = 2*pitchRadius(20); c.components.push(comp("A","gear",20,0,0), comp("B","gear",20,D,0), comp("C","gear",20,D,D), comp("D","gear",20,0,D)); c.motorId = "A"; const a = analyze(c); check("vierkant lus geldig", !a.hasConflict && a.canRun && a.nodes["C"].omega === 1); }
// Kettingen
{ const c = train([40,20], "sprocket"); c.components[1].x += 200; c.chains.push({id:"ch1", a:"A", b:"B"}); const a = analyze(c); check("ketting 40->20 = +2", a.nodes["B"].omega === 2 && a.canRun);
  const rollers = chainRollers({x:0,y:0,teeth:40,angle:0},{x:c.components[1].x,y:0,teeth:20,angle:0}); check("ketting rollers > 20", rollers.length > 20, rollers.length);
  // rollers bewegen: verschillende hoek -> andere posities, zelfde aantal
  const r2 = chainRollers({x:0,y:0,teeth:40,angle:0.05},{x:c.components[1].x,y:0,teeth:20,angle:0.1}); check("ketting aantal rollers stabiel", Math.abs(r2.length - rollers.length) <= 1, [rollers.length, r2.length]); }
{ const c = train([20,40], "sprocket"); c.components[1].x += 300; c.chains.push({id:"ch1", a:"A", b:"B"}); check("ketting 20->40 = +0.5", w(c,"B") === 0.5); }
{ const c = train([20,20], "sprocket"); c.chains.push({id:"ch1", a:"A", b:"B"}); const a = analyze(c); check("ketting te dicht: probleem", !a.canRun && a.problems.some(p=>p.type==="chain")); }
// Twee lagen + gedeelde as: A(40,L1) grijpt B(20,L1); B as met C (sprocket 30, L2); C ketting D (sprocket 15, L2)
{ const c = emptyConstruction(); const xb = pitchRadius(40)+pitchRadius(20);
  c.components.push(comp("A","gear",40,0,0,1), comp("B","gear",20,xb,0,1), comp("C","sprocket",30,xb,0,2), comp("D","sprocket",15,xb+300,0,2));
  c.shafts.push({a:"B", b:"C"}); c.chains.push({id:"ch", a:"C", b:"D"}); c.motorId = "A";
  const a = analyze(c); check("samengesteld: B=-2, C=-2, D=-4", a.nodes["B"].omega === -2 && a.nodes["C"].omega === -2 && a.nodes["D"].omega === -4, [a.nodes["B"].omega, a.nodes["C"].omega, a.nodes["D"].omega]);
  check("samengesteld canRun", a.canRun);
  check("fase gedeelde as gelijk", a.nodes["B"].phase === a.nodes["C"].phase);
  // Motor 1 rondje exact
  let s = startOneTurn({status:"idle",theta:0,oneTurn:null,oneTurnDone:false,hasRun:false}, 0, "normaal");
  let now = 0; let done = false; while (!done) { now += 16.7; const r = tick(s, now, 16.7, "normaal"); s = r.state; done = r.completedOneTurn; }
  const m = measure(c, a, s.theta); check("meting D = 4.00 exact", m.find(x=>x.letter==="D")!.revs === 4 && m.find(x=>x.letter==="A")!.revs === 1);
}
// verschillende lagen grijpen niet
{ const c = train([20,20]); c.components[1].layer = 2; const a = analyze(c); check("andere laag: grijpt niet", !a.nodes["B"].connected); }
// conflict via meerdere paden: A(20,L1)-B(20,L1) mesh; A as C(spr 20,L2); B as D(spr 40,L2); ketting C-D
{ const c = emptyConstruction(); const D = 2*pitchRadius(20);
  c.components.push(comp("A","gear",20,0,0,1), comp("B","gear",20,D,0,1), comp("C","sprocket",10,0,0,2), comp("D","sprocket",10,D,0,2));
  c.shafts.push({a:"A",b:"C"},{a:"B",b:"D"}); c.chains.push({id:"ch",a:"C",b:"D"}); c.motorId="A";
  const a = analyze(c); check("conflict via meerdere paden", a.hasConflict); }
// snap
{ const c = train([40,20]); c.components[1].x += 12; c.components[1].y += 5; const s = computeSnap(c, "B", {x: c.components[1].x, y: c.components[1].y});
  const d = Math.hypot(s.x, s.y); check("mesh snap exact", Math.abs(d - (pitchRadius(40)+pitchRadius(20))) < 1e-9 && s.meshWith.includes("A"), d); }
{ const c = train([40,20]); c.components.push(comp("C","gear",15,c.components[1].x + 10, 8, 2)); const s = computeSnap(c, "C", {x: c.components[1].x + 10, y: 8}); check("as snap", s.shaftWith === "B" && s.x === c.components[1].x && s.y === 0); }
{ const c = emptyConstruction(); const D = 2*pitchRadius(20); c.components.push(comp("A","gear",20,0,0), comp("B","gear",20,D,0), comp("C","gear",20,D/2+5, 0.85*D)); const s = computeSnap(c,"C",{x:D/2+5,y:0.85*D});
  check("dubbele mesh snap (driehoek)", s.meshWith.length === 2, s); }
check("pairRelation mesh", pairRelation({kind:"gear",teeth:20,x:0,y:0,layer:1},{kind:"gear",teeth:20,x:120,y:0,layer:1}) === "mesh");
console.log(`\n${n - fails}/${n} geslaagd`);
if (fails) process.exit(1);
