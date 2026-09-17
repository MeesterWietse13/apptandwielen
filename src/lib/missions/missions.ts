// Alle opdrachten van de Labzone: ontdekopdrachten en bouwuitdagingen.
import { dist, outerRadius } from "@/lib/mechanics/gearGeometry";
import type { ComponentKind } from "@/lib/mechanics/types";
import { fmtRevs } from "@/lib/format";
import type { EvalCtx, MissionDef, MissionGroup, MissionKind, Option, ReqDef, TestRecord } from "./missionEngine";
import { recordTarget } from "./missionEngine";

const EPS = 1e-6;

// ---------- Herbruikbare voorwaarden ----------

const reqMotor = (kind?: ComponentKind): ReqDef => ({
  id: "motor",
  label: kind === "sprocket" ? "Er is een motor (kettingtandwiel)" : kind === "gear" ? "Er is een motor (gewoon tandwiel)" : "Er is een motor",
  test: (ctx) => !!ctx.liveMotor && (!kind || ctx.liveMotor.kind === kind),
  hint: "Selecteer een tandwiel en druk op ⚡ Maak motor.",
});

const reqTarget = (kind?: ComponentKind, label = "Het doeltandwiel beweegt mee"): ReqDef => ({
  id: "target",
  label,
  test: (ctx) =>
    !!ctx.liveTarget &&
    ctx.liveTarget.connected &&
    ctx.liveTarget.id !== ctx.live.analysis.motorId &&
    (!kind || ctx.liveTarget.kind === kind),
  hint: "Bewegen alle tandwielen die je nodig hebt? Staan de tanden goed in elkaar?",
});

const reqValid = (): ReqDef => ({
  id: "valid",
  label: "De constructie is in orde",
  test: (ctx) => ctx.live.analysis.canRun,
  detail: (ctx) => ctx.live.analysis.problems.find((p) => p.type !== "noMotor")?.message ?? null,
  hint: "Kijk naar de rode randen en verplaats die onderdelen.",
});

const reqTested = (oneTurn: boolean): ReqDef => ({
  id: "tested",
  label: oneTurn ? "Getest met ↻ MOTOR 1 RONDJE" : "Getest (▶ Test of ↻ MOTOR 1 RONDJE)",
  test: (ctx) => !!ctx.current && ctx.current.valid && (!oneTurn || ctx.current.kind === "oneTurn"),
  hint: oneTurn ? "Gebruik ↻ MOTOR 1 RONDJE." : "Druk op ▶ Test en kijk goed naar de witte stippen.",
});

const req = (id: string, label: string, test: (ctx: EvalCtx) => boolean, hint?: string, detail?: (ctx: EvalCtx) => string | null): ReqDef => ({
  id,
  label,
  test,
  hint,
  detail,
});

const base = (motorKind: ComponentKind | undefined, oneTurn: boolean, targetKind?: ComponentKind): ReqDef[] => [
  reqMotor(motorKind),
  reqTarget(targetKind),
  reqValid(),
  reqTested(oneTurn),
];

const targetRevs = (ctx: EvalCtx) => (ctx.target ? ctx.target.revs : null);
const sameDir = (ctx: EvalCtx) => !!ctx.target && !!ctx.current?.motor && ctx.target.dir === ctx.current.motor.dir;

const moreLessTruth = (ctx: EvalCtx) => {
  const r = targetRevs(ctx);
  if (r === null) return null;
  return r > 1 + EPS ? "meer" : r < 1 - EPS ? "minder" : "evenveel";
};
const dirTruth = (ctx: EvalCtx) => (ctx.target ? (ctx.target.dir === 1 ? "rechtsom" : "linksom") : null);

const OPT_MORE_LESS: Option[] = [
  { id: "minder", label: "Minder rondjes" },
  { id: "evenveel", label: "Evenveel rondjes" },
  { id: "meer", label: "Meer rondjes" },
];
const OPT_DIR: Option[] = [
  { id: "rechtsom", label: "Rechtsom ↻" },
  { id: "linksom", label: "Linksom ↺" },
];

/** Twee kettingtandwielen met één ketting en verder niets (voor de kettingopdrachten). */
const twoSprocketsOnly: ReqDef = {
  id: "twoSprockets",
  label: "Precies twee kettingtandwielen, verbonden met één ketting",
  test: (ctx) => {
    const a = ctx.live.analysis;
    if (!a.motorId) return false;
    const conn = a.connectedIds;
    return (
      conn.length === 2 &&
      conn.every((id) => a.nodes[id].kind === "sprocket") &&
      a.edges.some((e) => e.type === "chain" && conn.includes(e.a) && conn.includes(e.b))
    );
  },
  hint: "Gebruik precies twee kettingtandwielen. Verbind ze met 🔗 Ketting.",
};

const chainOnly = (): ReqDef =>
  req(
    "chainOnly",
    "Een kettingoverbrenging (kettingtandwielen en kettingen)",
    (ctx) => {
      const a = ctx.live.analysis;
      const conn = a.connectedIds;
      return (
        conn.length >= 2 &&
        conn.every((id) => a.nodes[id].kind === "sprocket") &&
        a.edges.some((e) => e.type === "chain" && conn.includes(e.a) && conn.includes(e.b))
      );
    },
    "Gebruik kettingtandwielen en verbind ze met 🔗 Ketting."
  );

const gearTrainOnly = (): ReqDef =>
  req(
    "gearsOnly",
    "Een reeks gewone tandwielen die in elkaar grijpen",
    (ctx) => {
      const a = ctx.live.analysis;
      const conn = a.connectedIds;
      return conn.length >= 2 && conn.every((id) => a.nodes[id].kind === "gear") && !a.edges.some((e) => e.type !== "mesh" && conn.includes(e.a) && conn.includes(e.b));
    },
    "Gebruik alleen gewone tandwielen op één laag."
  );

const liveDistance = (ctx: EvalCtx) => (ctx.liveMotor && ctx.liveTarget ? dist(ctx.liveMotor, ctx.liveTarget) : 0);

const teethPair = (r: TestRecord) => {
  const t = recordTarget(r);
  return r.motor && t ? `${r.motor.teeth}-${t.teeth}` : "";
};
const ratioOfRecord = (r: TestRecord) => recordTarget(r)?.revs ?? null;
const validChainOneTurn = (r: TestRecord) => r.valid && r.kind === "oneTurn" && r.gearCount === 0 && r.chainCount >= 1 && !!recordTarget(r);

// ---------- TANDWIELEN: ontdekopdrachten ----------

const gearDiscoveries: MissionDef[] = [
  {
    id: "g1",
    kind: "discovery",
    group: "gears",
    number: 1,
    title: "Laat twee tandwielen samenwerken",
    steps: ["Plaats twee gewone tandwielen.", "Maak er één motor.", "Zorg dat de motor het tweede tandwiel laat draaien."],
    prediction: {
      question: "Wanneer zal het tweede tandwiel beginnen draaien?",
      options: [
        { id: "dichtbij", label: "Als het dicht bij de motor ligt" },
        { id: "grijpen", label: "Als de tanden in elkaar grijpen" },
        { id: "overal", label: "Zodra het op de werkbank ligt" },
      ],
    },
    requirements: [
      reqMotor("gear"),
      req("two", "Er liggen minstens twee gewone tandwielen", (ctx) => ctx.live.construction.components.filter((k) => k.kind === "gear").length >= 2, "Druk op + Tandwiel."),
      reqTarget("gear", "Het tweede tandwiel beweegt mee"),
      reqValid(),
      reqTested(false),
    ],
    answer: {
      question: "Wanneer draaide het tweede tandwiel mee?",
      options: [
        { id: "dichtbij", label: "Zodra het dicht bij de motor lag" },
        { id: "grijpen", label: "Pas toen de tanden in elkaar grepen" },
        { id: "overal", label: "Het draaide altijd mee" },
      ],
      truth: () => "grijpen",
    },
    conclusionPrompt: "Schrijf je besluit. Wanneer geeft een tandwiel beweging door?",
    conclusionPlaceholder: "Het tweede tandwiel draait mee als ...",
    discovery: "De tanden moeten goed in elkaar grijpen om beweging door te geven.",
    hints: [
      "Sleep het tweede tandwiel tegen de motor tot het 'klikt'.",
      "Kijk of de tanden van beide tandwielen in elkaar passen.",
      "Druk op ▶ Test en kijk of de witte stip van het tweede tandwiel beweegt.",
    ],
  },
  {
    id: "g2",
    kind: "discovery",
    group: "gears",
    number: 2,
    title: "Welke kant draait het op?",
    steps: ["Gebruik twee gewone tandwielen die in elkaar grijpen.", "Maak A de motor.", "Laat A rechtsom draaien en test."],
    prediction: { question: "Draait B rechtsom of linksom?", options: OPT_DIR },
    requirements: [
      reqMotor("gear"),
      req("cw", "De motor draait rechtsom ↻", (ctx) => ctx.live.construction.motorDirection === 1, "Zet de richting van de motor op rechtsom."),
      reqTarget("gear", "Het tweede tandwiel beweegt mee"),
      reqValid(),
      reqTested(false),
    ],
    answer: { question: "Welke kant draaide het tweede tandwiel op?", options: OPT_DIR, truth: dirTruth },
    conclusionPrompt: "Schrijf je besluit over de draairichting.",
    conclusionPlaceholder: "Als twee tandwielen in elkaar grijpen, dan ...",
    discovery: "Twee tandwielen die rechtstreeks in elkaar grijpen, draaien in tegengestelde richting.",
    hints: ["Kijk naar de witte stippen terwijl de motor draait.", "Volg de stip van het tweede tandwiel: gaat ze met de klok mee of tegen de klok in?"],
  },
  {
    id: "g3",
    kind: "discovery",
    group: "gears",
    number: 3,
    title: "Groot naar klein",
    steps: ["Koppel een groot en een klein tandwiel.", "Maak het grote tandwiel motor.", "Druk op ↻ MOTOR 1 RONDJE."],
    prediction: { question: "Maakt het kleine tandwiel minder, evenveel of meer rondjes dan het grote?", options: OPT_MORE_LESS },
    requirements: [
      reqMotor("gear"),
      reqTarget("gear"),
      req("bigMotor", "De motor is het grote tandwiel", (ctx) => !!ctx.liveMotor && !!ctx.liveTarget && ctx.liveMotor.teeth > ctx.liveTarget.teeth, "Geef de motor meer tanden dan het andere tandwiel."),
      reqValid(),
      reqTested(true),
    ],
    answer: { question: "Wat zag je in het meetpaneel? Het kleine tandwiel maakte ...", options: OPT_MORE_LESS, truth: moreLessTruth },
    conclusionPrompt: "Schrijf je besluit.",
    conclusionPlaceholder: "Als een groot tandwiel een klein tandwiel aandrijft, dan ...",
    discovery: "Het kleine tandwiel maakt meer rondjes dan het grote.",
    hints: ["Gebruik ↻ MOTOR 1 RONDJE en lees het meetpaneel.", "Welk tandwiel maakt de meeste rondjes?"],
  },
  {
    id: "g4",
    kind: "discovery",
    group: "gears",
    number: 4,
    title: "Klein naar groot",
    steps: ["Gebruik dezelfde twee tandwielen.", "Maak nu het kleine tandwiel motor.", "Druk op ↻ MOTOR 1 RONDJE."],
    prediction: { question: "Maakt het grote tandwiel minder, evenveel of meer rondjes dan de motor?", options: OPT_MORE_LESS },
    requirements: [
      reqMotor("gear"),
      reqTarget("gear"),
      req("smallMotor", "De motor is het kleine tandwiel", (ctx) => !!ctx.liveMotor && !!ctx.liveTarget && ctx.liveMotor.teeth < ctx.liveTarget.teeth, "Maak het tandwiel met de minste tanden motor."),
      reqValid(),
      reqTested(true),
    ],
    answer: { question: "Het grote tandwiel maakte ...", options: OPT_MORE_LESS, truth: moreLessTruth },
    conclusionPrompt: "Schrijf je besluit.",
    conclusionPlaceholder: "Als een klein tandwiel een groot tandwiel aandrijft, dan ...",
    discovery: "Het grote tandwiel maakt minder rondjes dan het kleine.",
    hints: ["Selecteer het kleine tandwiel en druk op ⚡ Maak motor.", "Vergelijk de rondjes in het meetpaneel."],
  },
  {
    id: "g5",
    kind: "discovery",
    group: "gears",
    number: 5,
    title: "Drie of vier tandwielen",
    steps: [
      "Bouw een rij van drie gewone tandwielen. Het eerste is de motor.",
      "Test en kijk welke kant het laatste tandwiel opdraait.",
      "Voeg een vierde tandwiel toe aan de rij en test opnieuw.",
    ],
    prediction: {
      question: "Draait het laatste tandwiel bij drie en bij vier tandwielen dezelfde kant op?",
      options: [
        { id: "ja", label: "Ja, dezelfde kant" },
        { id: "nee", label: "Nee, een andere kant" },
      ],
    },
    requirements: [
      reqMotor("gear"),
      reqValid(),
      req(
        "three",
        "Rij van drie tandwielen getest",
        (ctx) => ctx.records.some((r) => r.valid && r.series && r.gearCount === 3),
        "Zet drie tandwielen op een rij: elk grijpt in de volgende. De motor staat vooraan.",
        (ctx) => {
          const r = [...ctx.records].reverse().find((k) => k.valid && k.series && k.gearCount === 3);
          const t = r ? recordTarget(r) : null;
          return r && t ? `Bij 3: laatste tandwiel draait ${t.dir === r.motor?.dir ? "dezelfde kant op als de motor" : "de andere kant op"}` : null;
        }
      ),
      req(
        "four",
        "Rij van vier tandwielen getest",
        (ctx) => ctx.records.some((r) => r.valid && r.series && r.gearCount === 4),
        "Voeg een vierde tandwiel toe aan het einde van de rij en test opnieuw.",
        (ctx) => {
          const r = [...ctx.records].reverse().find((k) => k.valid && k.series && k.gearCount === 4);
          const t = r ? recordTarget(r) : null;
          return r && t ? `Bij 4: laatste tandwiel draait ${t.dir === r.motor?.dir ? "dezelfde kant op als de motor" : "de andere kant op"}` : null;
        }
      ),
    ],
    answer: {
      question: "Wat zag je?",
      options: [
        { id: "drie-zelfde", label: "Bij 3: laatste draait dezelfde kant op als de motor. Bij 4: de andere kant." },
        { id: "drie-anders", label: "Bij 3: laatste draait de andere kant op. Bij 4: dezelfde kant." },
        { id: "altijd", label: "Het laatste tandwiel draait altijd dezelfde kant op als de motor." },
      ],
      truth: () => "drie-zelfde",
    },
    conclusionPrompt: "Schrijf je besluit. Wat doet elk extra tandwiel met de richting?",
    conclusionPlaceholder: "Elk extra tandwiel ...",
    discovery: "Elk extra tandwiel keert de draairichting opnieuw om.",
    hints: ["Maak eerst een rij van drie: A grijpt in B, B grijpt in C.", "Kijk naar de witte stip van het laatste tandwiel. Vergelijk met de motor.", "Voeg dan een vierde tandwiel toe aan het einde van de rij."],
  },
  {
    id: "g6",
    kind: "discovery",
    group: "gears",
    number: 6,
    title: "Het aantal tanden",
    steps: [
      "Motor = tandwiel met 20 tanden. Doel = tandwiel met 10 tanden.",
      "Druk op ↻ MOTOR 1 RONDJE.",
      "Onderzoek daarna ook: motor 10 tanden en doel 30 tanden.",
    ],
    prediction: {
      question: "Als de motor (20 tanden) één rondje draait, hoeveel rondjes maakt het tandwiel met 10 tanden?",
      options: [
        { id: "half", label: "Een half rondje" },
        { id: "een", label: "Eén rondje" },
        { id: "twee", label: "Twee rondjes" },
        { id: "vier", label: "Vier rondjes" },
      ],
    },
    requirements: [
      reqMotor("gear"),
      reqValid(),
      req(
        "t20to10",
        "Gemeten: motor 20 tanden → doel 10 tanden",
        (ctx) => ctx.records.some((r) => r.valid && r.kind === "oneTurn" && r.motor?.teeth === 20 && recordTarget(r)?.teeth === 10 && r.gearCount === 2),
        "Geef de motor 20 tanden en het andere tandwiel 10 tanden. Gebruik ↻ MOTOR 1 RONDJE.",
        (ctx) => {
          const r = [...ctx.records].reverse().find((k) => k.valid && k.kind === "oneTurn" && k.motor?.teeth === 20 && recordTarget(k)?.teeth === 10 && k.gearCount === 2);
          return r ? `Doel maakte ${fmtRevs(recordTarget(r)!.revs)} rondjes` : null;
        }
      ),
      req(
        "t10to30",
        "Gemeten: motor 10 tanden → doel 30 tanden",
        (ctx) => ctx.records.some((r) => r.valid && r.kind === "oneTurn" && r.motor?.teeth === 10 && recordTarget(r)?.teeth === 30 && r.gearCount === 2),
        "Geef de motor 10 tanden en het andere tandwiel 30 tanden. Meet opnieuw.",
        (ctx) => {
          const r = [...ctx.records].reverse().find((k) => k.valid && k.kind === "oneTurn" && k.motor?.teeth === 10 && recordTarget(k)?.teeth === 30 && k.gearCount === 2);
          return r ? `Doel maakte ${fmtRevs(recordTarget(r)!.revs)} rondjes` : null;
        }
      ),
    ],
    answer: {
      question: "Hoeveel rondjes maakte het doel? (20 → 10 en 10 → 30)",
      options: [
        { id: "2-3", label: "10 tanden: 2,00 rondjes — 30 tanden: 3,00 rondjes" },
        { id: "2-033", label: "10 tanden: 2,00 rondjes — 30 tanden: 0,33 rondje" },
        { id: "05-3", label: "10 tanden: 0,50 rondje — 30 tanden: 3,00 rondjes" },
        { id: "1-1", label: "Allebei precies 1,00 rondje" },
      ],
      truth: () => "2-033",
    },
    conclusionPrompt: "Schrijf je besluit. Wat bepaalt hoeveel rondjes worden doorgegeven?",
    conclusionPlaceholder: "Het aantal tanden ...",
    discovery:
      "Het aantal tanden van beide tandwielen bepaalt hoeveel rondjes worden doorgegeven. 20 tanden → 10 tanden geeft dubbel zoveel rondjes. Dat noemen we de verhouding: 20 : 10 = 2 : 1.",
    hints: ["Selecteer een tandwiel en pas het aantal tanden aan in het paneel.", "Gebruik ↻ MOTOR 1 RONDJE en lees de kolom Rondjes.", "Vergelijk: 20 tanden tegenover 10 tanden. Hoeveel keer past 10 in 20?"],
  },
];

// ---------- TANDWIELEN: bouwuitdagingen ----------

const gearChallenges: MissionDef[] = [
  {
    id: "gc1",
    kind: "challenge",
    group: "gears",
    number: 1,
    title: "Zelfde richting",
    steps: ["Bouw een reeks tandwielen waarbij het laatste tandwiel dezelfde kant opdraait als de motor."],
    requirements: [reqMotor("gear"), gearTrainOnly(), reqTarget("gear", "Het laatste tandwiel (doel) beweegt mee"), reqValid(), reqTested(false), req("same", "Laatste tandwiel draait dezelfde kant op als de motor", sameDir)],
    hints: ["Kijk nog eens naar de witte stippen.", "Wat gebeurt er met de richting bij elk extra tandwiel?", "Probeer één ding te veranderen en test opnieuw."],
  },
  {
    id: "gc2",
    kind: "challenge",
    group: "gears",
    number: 2,
    title: "Andere richting",
    steps: ["Bouw een reeks tandwielen waarbij het laatste tandwiel de andere kant opdraait dan de motor."],
    requirements: [reqMotor("gear"), gearTrainOnly(), reqTarget("gear", "Het laatste tandwiel (doel) beweegt mee"), reqValid(), reqTested(false), req("opp", "Laatste tandwiel draait de andere kant op dan de motor", (ctx) => !!ctx.target && !sameDir(ctx))],
    hints: ["Kijk nog eens naar de witte stippen.", "Tel het aantal tandwielen in je rij."],
  },
  {
    id: "gc3",
    kind: "challenge",
    group: "gears",
    number: 3,
    title: "Sneller",
    steps: ["Bouw een mechanisme waarbij het doeltandwiel meer rondjes maakt dan de motor."],
    requirements: [...base("gear", true), req("faster", "Doel maakt meer rondjes dan de motor", (ctx) => (targetRevs(ctx) ?? 0) > 1 + EPS)],
    hints: ["Gebruik ↻ MOTOR 1 RONDJE.", "Welk tandwiel maakt de meeste rondjes: het grote of het kleine?"],
  },
  {
    id: "gc4",
    kind: "challenge",
    group: "gears",
    number: 4,
    title: "Trager",
    steps: ["Bouw een mechanisme waarbij het doeltandwiel minder rondjes maakt dan de motor."],
    requirements: [...base("gear", true), req("slower", "Doel maakt minder rondjes dan de motor", (ctx) => { const r = targetRevs(ctx); return r !== null && r < 1 - EPS; })],
    hints: ["Gebruik ↻ MOTOR 1 RONDJE.", "Probeer de motor kleiner te maken dan het doel."],
  },
  {
    id: "gc5",
    kind: "challenge",
    group: "gears",
    number: 5,
    title: "Precies dubbel",
    steps: ["Bouw een mechanisme waarbij één rondje van de motor precies twee rondjes van het doeltandwiel veroorzaakt."],
    requirements: [...base("gear", true), req("double", "Doel maakt precies 2,00 rondjes", (ctx) => Math.abs((targetRevs(ctx) ?? 0) - 2) < EPS, undefined, (ctx) => (ctx.target ? `Nu: ${fmtRevs(ctx.target.revs)} rondjes` : null))],
    hints: ["Gebruik ↻ MOTOR 1 RONDJE en lees de rondjes af.", "Hoeveel tanden heeft de motor? Hoeveel het doel? Vergelijk.", "Probeer één ding te veranderen en test opnieuw."],
  },
  {
    id: "gc6",
    kind: "challenge",
    group: "gears",
    number: 6,
    title: "Precies half",
    steps: ["Bouw een mechanisme waarbij het doeltandwiel precies een halve ronde maakt wanneer de motor één rondje draait."],
    requirements: [...base("gear", true), req("half", "Doel maakt precies 0,50 rondje", (ctx) => Math.abs((targetRevs(ctx) ?? 0) - 0.5) < EPS, undefined, (ctx) => (ctx.target ? `Nu: ${fmtRevs(ctx.target.revs)} rondje` : null))],
    hints: ["Gebruik ↻ MOTOR 1 RONDJE.", "Denk aan de vorige uitdaging, maar omgekeerd."],
  },
  {
    id: "gc7",
    kind: "challenge",
    group: "gears",
    number: 7,
    title: "Minstens vijf",
    steps: ["Gebruik minstens vijf gewone tandwielen in één verbonden constructie.", "Het laatste tandwiel moet sneller draaien dan de motor."],
    requirements: [
      reqMotor("gear"),
      req("five", "Minstens vijf gewone tandwielen bewegen mee", (ctx) => ctx.live.analysis.connectedIds.filter((id) => ctx.live.analysis.nodes[id].kind === "gear").length >= 5, "Bewegen alle tandwielen die je nodig hebt?", (ctx) => `Nu: ${ctx.live.analysis.connectedIds.filter((id) => ctx.live.analysis.nodes[id].kind === "gear").length} tandwielen bewegen mee`),
      reqTarget("gear", "Het laatste tandwiel (doel) beweegt mee"),
      reqValid(),
      reqTested(true),
      req("faster", "Doel maakt meer rondjes dan de motor", (ctx) => (targetRevs(ctx) ?? 0) > 1 + EPS),
    ],
    hints: ["Bewegen alle tandwielen die je nodig hebt?", "Welk tandwiel maakt de meeste rondjes?", "Kies het doel met 🎯 Maak doel."],
  },
  {
    id: "gc8",
    kind: "challenge",
    group: "gears",
    number: 8,
    title: "Combinatie",
    steps: ["Gebruik minstens vijf tandwielen.", "Het laatste tandwiel moet dezelfde kant opdraaien als de motor én meer rondjes maken dan de motor."],
    requirements: [
      reqMotor("gear"),
      req("five", "Minstens vijf gewone tandwielen bewegen mee", (ctx) => ctx.live.analysis.connectedIds.filter((id) => ctx.live.analysis.nodes[id].kind === "gear").length >= 5, "Bewegen alle tandwielen die je nodig hebt?"),
      reqTarget("gear", "Het laatste tandwiel (doel) beweegt mee"),
      reqValid(),
      reqTested(true),
      req("same", "Doel draait dezelfde kant op als de motor", sameDir),
      req("faster", "Doel maakt meer rondjes dan de motor", (ctx) => (targetRevs(ctx) ?? 0) > 1 + EPS),
    ],
    hints: ["Kijk nog eens naar de witte stippen.", "Welk tandwiel maakt de meeste rondjes?", "Probeer één ding te veranderen en test opnieuw."],
  },
];

// ---------- KETTINGLAB: ontdekopdrachten ----------

const chainDiscoveries: MissionDef[] = [
  {
    id: "k1",
    kind: "discovery",
    group: "chains",
    number: 1,
    title: "Beweging zonder contact",
    steps: ["Plaats twee kettingtandwielen met ruimte ertussen.", "Verbind ze met een ketting.", "Maak er één motor en test."],
    prediction: {
      question: "Kunnen tandwielen elkaar laten bewegen zonder dat hun tanden elkaar raken?",
      options: [
        { id: "ja", label: "Ja" },
        { id: "nee", label: "Nee" },
      ],
    },
    requirements: [
      reqMotor("sprocket"),
      twoSprocketsOnly,
      req("gap", "Er zit ruimte tussen de twee kettingtandwielen", (ctx) => !!ctx.liveMotor && !!ctx.liveTarget && liveDistance(ctx) > outerRadius("sprocket", ctx.liveMotor.teeth) + outerRadius("sprocket", ctx.liveTarget.teeth) + 40, "Schuif de kettingtandwielen verder uit elkaar."),
      reqValid(),
      reqTested(false),
    ],
    answer: {
      question: "Bewoog het tweede kettingtandwiel mee?",
      options: [
        { id: "ja", label: "Ja, ook al raken de tanden elkaar niet" },
        { id: "nee", label: "Nee" },
      ],
      truth: () => "ja",
    },
    conclusionPrompt: "Schrijf je besluit.",
    conclusionPlaceholder: "Met een ketting ...",
    discovery: "Met een ketting kun je beweging over een afstand doorgeven.",
    hints: ["Druk op + Kettingtandwiel (twee keer).", "Druk op 🔗 Ketting en klik dan op beide kettingtandwielen.", "Maak één kettingtandwiel motor en druk op ▶ Test."],
  },
  {
    id: "k2",
    kind: "discovery",
    group: "chains",
    number: 2,
    title: "Welke kant?",
    steps: ["Verbind twee kettingtandwielen met een gewone ketting.", "Laat de motor rechtsom draaien en test."],
    prediction: { question: "Welke kant draait het andere kettingtandwiel op?", options: OPT_DIR },
    requirements: [reqMotor("sprocket"), twoSprocketsOnly, req("cw", "De motor draait rechtsom ↻", (ctx) => ctx.live.construction.motorDirection === 1, "Zet de richting van de motor op rechtsom."), reqValid(), reqTested(false)],
    answer: { question: "Welke kant draaide het andere kettingtandwiel op?", options: OPT_DIR, truth: dirTruth },
    conclusionPrompt: "Schrijf je besluit. Is dat anders dan bij tandwielen die in elkaar grijpen?",
    conclusionPlaceholder: "Met een ketting draaien de kettingtandwielen ...",
    discovery: "Met een gewone ketting draaien beide kettingtandwielen dezelfde kant op. Dat is anders dan bij tandwielen die rechtstreeks in elkaar grijpen!",
    hints: ["Kijk naar de witte stippen terwijl de ketting beweegt.", "Vergelijk met wat je bij de gewone tandwielen ontdekte."],
  },
  {
    id: "k3",
    kind: "discovery",
    group: "chains",
    number: 3,
    title: "Groot naar klein",
    steps: ["Groot kettingtandwiel = motor. Klein kettingtandwiel = doel.", "Druk op ↻ MOTOR 1 RONDJE."],
    prediction: { question: "Maakt het kleine tandwiel minder, evenveel of meer rondjes?", options: OPT_MORE_LESS },
    requirements: [reqMotor("sprocket"), twoSprocketsOnly, req("bigMotor", "De motor is het grote kettingtandwiel", (ctx) => !!ctx.liveMotor && !!ctx.liveTarget && ctx.liveMotor.teeth > ctx.liveTarget.teeth, "Geef de motor meer tanden dan het andere kettingtandwiel."), reqValid(), reqTested(true)],
    answer: { question: "Het kleine kettingtandwiel maakte ...", options: OPT_MORE_LESS, truth: moreLessTruth },
    conclusionPrompt: "Schrijf je besluit.",
    conclusionPlaceholder: "Als een groot kettingtandwiel een klein aandrijft, dan ...",
    discovery: "Het kleine kettingtandwiel maakt meer rondjes.",
    hints: ["Gebruik ↻ MOTOR 1 RONDJE.", "Welk kettingtandwiel maakt de meeste rondjes?"],
  },
  {
    id: "k4",
    kind: "discovery",
    group: "chains",
    number: 4,
    title: "Klein naar groot",
    steps: ["Zelfde kettingtandwielen. Maak nu het kleine de motor.", "Druk op ↻ MOTOR 1 RONDJE."],
    prediction: { question: "Maakt het grote tandwiel minder, evenveel of meer rondjes?", options: OPT_MORE_LESS },
    requirements: [reqMotor("sprocket"), twoSprocketsOnly, req("smallMotor", "De motor is het kleine kettingtandwiel", (ctx) => !!ctx.liveMotor && !!ctx.liveTarget && ctx.liveMotor.teeth < ctx.liveTarget.teeth, "Maak het kettingtandwiel met de minste tanden motor."), reqValid(), reqTested(true)],
    answer: { question: "Het grote kettingtandwiel maakte ...", options: OPT_MORE_LESS, truth: moreLessTruth },
    conclusionPrompt: "Schrijf je besluit.",
    conclusionPlaceholder: "Als een klein kettingtandwiel een groot aandrijft, dan ...",
    discovery: "Het grote kettingtandwiel maakt minder rondjes.",
    hints: ["Selecteer het kleine kettingtandwiel en druk op ⚡ Maak motor.", "Lees het meetpaneel."],
  },
  {
    id: "k5",
    kind: "discovery",
    group: "chains",
    number: 5,
    title: "Het aantal tanden",
    steps: ["Motor = kettingtandwiel met 20 tanden. Doel = 10 tanden.", "Druk op ↻ MOTOR 1 RONDJE."],
    prediction: {
      question: "Hoeveel rondjes maakt het andere kettingtandwiel wanneer de motor één rondje maakt?",
      options: [
        { id: "half", label: "Een half rondje" },
        { id: "een", label: "Eén rondje" },
        { id: "twee", label: "Twee rondjes" },
        { id: "vier", label: "Vier rondjes" },
      ],
    },
    requirements: [reqMotor("sprocket"), twoSprocketsOnly, req("t2010", "Motor 20 tanden, doel 10 tanden", (ctx) => ctx.liveMotor?.teeth === 20 && ctx.liveTarget?.teeth === 10, "Pas het aantal tanden aan: motor 20, doel 10."), reqValid(), reqTested(true)],
    answer: {
      question: "Hoeveel rondjes maakte het kettingtandwiel met 10 tanden?",
      options: [
        { id: "05", label: "0,50 rondje" },
        { id: "1", label: "1,00 rondje" },
        { id: "2", label: "2,00 rondjes" },
        { id: "4", label: "4,00 rondjes" },
      ],
      truth: (ctx) => {
        const r = targetRevs(ctx);
        if (r === null) return null;
        if (Math.abs(r - 0.5) < EPS) return "05";
        if (Math.abs(r - 1) < EPS) return "1";
        if (Math.abs(r - 2) < EPS) return "2";
        if (Math.abs(r - 4) < EPS) return "4";
        return null;
      },
    },
    conclusionPrompt: "Schrijf je besluit.",
    conclusionPlaceholder: "Ook bij een ketting ...",
    discovery: "Ook bij een ketting bepaalt de verhouding tussen het aantal tanden hoeveel rondjes worden doorgegeven. 20 : 10 = 2 : 1.",
    hints: ["Selecteer een kettingtandwiel en pas het aantal tanden aan.", "Gebruik ↻ MOTOR 1 RONDJE en lees de kolom Rondjes."],
  },
  {
    id: "k6",
    kind: "discovery",
    group: "chains",
    number: 6,
    title: "Verder uit elkaar",
    steps: ["Gebruik dezelfde twee kettingtandwielen. Meet eerst met ↻ MOTOR 1 RONDJE.", "Sleep daarna één kettingtandwiel duidelijk verder weg. De ketting past zich aan.", "Meet opnieuw."],
    prediction: { question: "Zal het andere tandwiel nu meer of minder rondjes maken?", options: [...OPT_MORE_LESS] },
    requirements: [
      reqMotor("sprocket"),
      twoSprocketsOnly,
      reqValid(),
      req(
        "first",
        "Eerste meting gedaan",
        (ctx) => ctx.records.some((r) => r.valid && r.kind === "oneTurn" && r.sprocketCount === 2 && r.gearCount === 0),
        "Gebruik ↻ MOTOR 1 RONDJE.",
        (ctx) => {
          const r = ctx.records.find((k) => k.valid && k.kind === "oneTurn" && k.sprocketCount === 2 && k.gearCount === 0);
          return r ? `Afstand ${Math.round(r.motorTargetDistance)} — doel ${fmtRevs(recordTarget(r)?.revs ?? 0)} rondjes` : null;
        }
      ),
      req(
        "second",
        "Tweede meting met dezelfde tandwielen, maar veel verder uit elkaar",
        (ctx) => {
          const recs = ctx.records.filter((r) => r.valid && r.kind === "oneTurn" && r.sprocketCount === 2 && r.gearCount === 0);
          return recs.some((r1) => recs.some((r2) => r2 !== r1 && teethPair(r1) === teethPair(r2) && Math.abs(r1.motorTargetDistance - r2.motorTargetDistance) >= 80));
        },
        "Sleep één kettingtandwiel een flink stuk verder weg en meet opnieuw.",
        (ctx) => {
          const recs = ctx.records.filter((r) => r.valid && r.kind === "oneTurn" && r.sprocketCount === 2 && r.gearCount === 0);
          const last = recs[recs.length - 1];
          return last && recs.length > 1 ? `Laatste meting: afstand ${Math.round(last.motorTargetDistance)} — doel ${fmtRevs(recordTarget(last)?.revs ?? 0)} rondjes` : null;
        }
      ),
    ],
    answer: {
      question: "Wat gebeurde er met het aantal rondjes?",
      options: [
        { id: "meer", label: "Meer rondjes" },
        { id: "minder", label: "Minder rondjes" },
        { id: "evenveel", label: "Evenveel rondjes — alleen de ketting werd langer" },
      ],
      truth: () => "evenveel",
    },
    conclusionPrompt: "Schrijf je besluit.",
    conclusionPlaceholder: "De afstand tussen de kettingtandwielen ...",
    discovery: "De afstand tussen de tandwielen verandert het aantal rondjes niet. Alleen de ketting wordt langer.",
    hints: ["Meet eerst, sleep dan één kettingtandwiel verder weg, en meet opnieuw.", "Vergelijk de twee metingen in de checklist."],
  },
];

// ---------- KETTINGLAB: bouwuitdagingen ----------

const chainChallenges: MissionDef[] = [
  {
    id: "kc1",
    kind: "challenge",
    group: "chains",
    number: 1,
    title: "Sneller",
    steps: ["Bouw een kettingoverbrenging waarbij het doeltandwiel meer rondjes maakt dan de motor."],
    requirements: [reqMotor("sprocket"), chainOnly(), reqTarget("sprocket"), reqValid(), reqTested(true), req("faster", "Doel maakt meer rondjes dan de motor", (ctx) => (targetRevs(ctx) ?? 0) > 1 + EPS)],
    hints: ["Gebruik ↻ MOTOR 1 RONDJE.", "Welk kettingtandwiel maakt de meeste rondjes?"],
  },
  {
    id: "kc2",
    kind: "challenge",
    group: "chains",
    number: 2,
    title: "Trager",
    steps: ["Bouw een kettingoverbrenging waarbij het doeltandwiel minder rondjes maakt dan de motor."],
    requirements: [reqMotor("sprocket"), chainOnly(), reqTarget("sprocket"), reqValid(), reqTested(true), req("slower", "Doel maakt minder rondjes dan de motor", (ctx) => { const r = targetRevs(ctx); return r !== null && r < 1 - EPS; })],
    hints: ["Gebruik ↻ MOTOR 1 RONDJE.", "Probeer de motor kleiner te maken dan het doel."],
  },
  {
    id: "kc3",
    kind: "challenge",
    group: "chains",
    number: 3,
    title: "Precies dubbel",
    steps: ["Bouw een kettingoverbrenging waarbij het doeltandwiel precies twee rondjes maakt per motorronde."],
    requirements: [reqMotor("sprocket"), chainOnly(), reqTarget("sprocket"), reqValid(), reqTested(true), req("double", "Doel maakt precies 2,00 rondjes", (ctx) => Math.abs((targetRevs(ctx) ?? 0) - 2) < EPS, undefined, (ctx) => (ctx.target ? `Nu: ${fmtRevs(ctx.target.revs)} rondjes` : null))],
    hints: ["Gebruik ↻ MOTOR 1 RONDJE.", "Vergelijk het aantal tanden van motor en doel."],
  },
  {
    id: "kc4",
    kind: "challenge",
    group: "chains",
    number: 4,
    title: "Precies half",
    steps: ["Bouw een kettingoverbrenging waarbij het doeltandwiel precies een halve ronde maakt per motorronde."],
    requirements: [reqMotor("sprocket"), chainOnly(), reqTarget("sprocket"), reqValid(), reqTested(true), req("half", "Doel maakt precies 0,50 rondje", (ctx) => Math.abs((targetRevs(ctx) ?? 0) - 0.5) < EPS, undefined, (ctx) => (ctx.target ? `Nu: ${fmtRevs(ctx.target.revs)} rondje` : null))],
    hints: ["Gebruik ↻ MOTOR 1 RONDJE.", "Denk aan de vorige uitdaging, maar omgekeerd."],
  },
  {
    id: "kc5",
    kind: "challenge",
    group: "chains",
    number: 5,
    title: "Andere tandwielen, hetzelfde resultaat",
    steps: ["Bouw twee verschillende kettingoverbrengingen met andere tandenaantallen, maar met exact dezelfde verhouding.", "Meet ze allebei met ↻ MOTOR 1 RONDJE."],
    requirements: [
      reqMotor("sprocket"),
      chainOnly(),
      reqValid(),
      req(
        "first",
        "Eerste oplossing gemeten",
        (ctx) => ctx.records.some(validChainOneTurn),
        "Gebruik ↻ MOTOR 1 RONDJE.",
        (ctx) => {
          const r = ctx.records.find(validChainOneTurn);
          return r ? `Bewaard: ${r.motor?.teeth} → ${recordTarget(r)?.teeth} tanden = ${fmtRevs(ratioOfRecord(r) ?? 0)} rondjes` : null;
        }
      ),
      req(
        "second",
        "Tweede oplossing: andere tanden, zelfde verhouding",
        (ctx) => {
          const recs = ctx.records.filter(validChainOneTurn);
          return recs.some((r1) => recs.some((r2) => r2 !== r1 && teethPair(r1) !== teethPair(r2) && Math.abs((ratioOfRecord(r1) ?? 0) - (ratioOfRecord(r2) ?? -1)) < EPS));
        },
        "Verander het aantal tanden van beide kettingtandwielen. Zorg dat het aantal rondjes hetzelfde blijft.",
        (ctx) => {
          const recs = ctx.records.filter(validChainOneTurn);
          const last = recs[recs.length - 1];
          return recs.length > 1 && last ? `Laatste: ${last.motor?.teeth} → ${recordTarget(last)?.teeth} tanden = ${fmtRevs(ratioOfRecord(last) ?? 0)} rondjes` : null;
        }
      ),
    ],
    hints: ["40 → 20 en 20 → 10: wat hebben die gemeen?", "Verdubbel of halveer beide tandenaantallen."],
  },
  {
    id: "kc6",
    kind: "challenge",
    group: "chains",
    number: 6,
    title: "Grote afstand",
    steps: ["Plaats twee kettingtandwielen zo ver mogelijk uit elkaar en zorg dat de overbrenging correct blijft werken.", "Tip: zoom uit."],
    requirements: [
      reqMotor("sprocket"),
      twoSprocketsOnly,
      req("far", "De kettingtandwielen staan minstens 700 uit elkaar", (ctx) => liveDistance(ctx) >= 700, "Zoom uit en sleep één kettingtandwiel ver weg.", (ctx) => `Afstand nu: ${Math.round(liveDistance(ctx))}`),
      reqValid(),
      reqTested(false),
    ],
    hints: ["Gebruik de zoomknoppen (−) om meer werkbank te zien.", "De ketting wordt automatisch langer."],
  },
];

// ---------- TWEE LAGEN: ontdekopdrachten ----------

const layerDiscoveries: MissionDef[] = [
  {
    id: "ld1",
    kind: "discovery",
    group: "layers",
    number: 1,
    title: "Twee tandwielen op één as",
    steps: [
      "Plaats een gewoon tandwiel op Laag 1 en maak het motor.",
      "Kies Beide en voeg een gewoon tandwiel toe op Laag 2.",
      "Sleep het tweede tandwiel precies boven de motor tot ze één as delen.",
      "Maak het tandwiel op Laag 2 het doel en druk op ↻ MOTOR 1 RONDJE.",
    ],
    prediction: {
      question: "Hoe zal het tandwiel op Laag 2 draaien?",
      options: [
        { id: "zelfde", label: "Evenveel rondjes in dezelfde richting" },
        { id: "tegenovergesteld", label: "Evenveel rondjes in de andere richting" },
        { id: "niet", label: "Het zal niet meedraaien" },
      ],
    },
    requirements: [
      reqMotor("gear"),
      req(
        "shaft",
        "Twee gewone tandwielen op verschillende lagen delen één as",
        (ctx) => {
          const a = ctx.live.analysis;
          return a.edges.some(
            (e) =>
              e.type === "shaft" &&
              a.nodes[e.a].kind === "gear" &&
              a.nodes[e.b].kind === "gear" &&
              a.nodes[e.a].layer !== a.nodes[e.b].layer
          );
        },
        "Kies Laag 2 en sleep het tweede tandwiel precies boven het eerste tot het vastklikt op dezelfde as."
      ),
      reqTarget("gear", "Het tandwiel op de andere laag is het doel en beweegt mee"),
      reqValid(),
      reqTested(true),
    ],
    answer: {
      question: "Wat zag je in het meetpaneel? Het tandwiel op Laag 2 draaide ...",
      options: [
        { id: "zelfde", label: "Evenveel rondjes in dezelfde richting" },
        { id: "tegenovergesteld", label: "Evenveel rondjes in de andere richting" },
        { id: "niet", label: "Niet mee" },
      ],
      truth: () => "zelfde",
    },
    conclusionPrompt: "Schrijf je besluit over twee tandwielen op dezelfde as.",
    conclusionPlaceholder: "Twee tandwielen op dezelfde as ...",
    discovery: "Tandwielen op dezelfde as draaien evenveel rondjes en in dezelfde richting, ook als ze op een andere laag liggen.",
    hints: [
      "Gebruik de knop Laag 2 om het tweede tandwiel op de bovenste laag te plaatsen.",
      "De middelpunten moeten precies boven elkaar liggen. Dan verschijnt de gedeelde as.",
      "Selecteer het tandwiel op Laag 2 en kies Maak doel.",
    ],
  },
];

// ---------- TWEE LAGEN: bouwuitdagingen ----------

const layerChallenges: MissionDef[] = [
  {
    id: "l1",
    kind: "challenge",
    group: "layers",
    number: 1,
    title: "Eén as",
    steps: ["Plaats twee tandwielen met verschillende aantallen tanden op dezelfde as (Laag 1 en Laag 2).", "Zorg dat ze samen draaien."],
    requirements: [
      reqMotor(),
      req(
        "shaft",
        "Twee tandwielen met verschillende tanden delen één as en bewegen mee",
        (ctx) => {
          const a = ctx.live.analysis;
          return a.edges.some((e) => e.type === "shaft" && a.nodes[e.a].connected && a.nodes[e.b].connected && a.nodes[e.a].teeth !== a.nodes[e.b].teeth);
        },
        "Zet Laag 2 aan, plaats een tandwiel precies boven een tandwiel van Laag 1 tot de as-indicator verschijnt."
      ),
      reqValid(),
      reqTested(false),
    ],
    hints: ["Kies Laag 2 en voeg een tandwiel toe.", "Sleep het precies boven een tandwiel van Laag 1. Het klikt vast op de as.", "Geef beide een ander aantal tanden."],
  },
  {
    id: "l2",
    kind: "challenge",
    group: "layers",
    number: 2,
    title: "Tandwiel naar ketting",
    steps: [
      "Bouw op Laag 1 minstens twee gewone tandwielen die in elkaar grijpen.",
      "Plaats op het laatste tandwiel een kettingtandwiel op dezelfde as (Laag 2).",
      "Drijf met dat kettingtandwiel via een ketting nog een kettingtandwiel aan op Laag 2.",
    ],
    requirements: [
      reqMotor("gear"),
      req("mesh", "Minstens twee gewone tandwielen grijpen in elkaar en bewegen mee", (ctx) => { const a = ctx.live.analysis; return a.edges.some((e) => e.type === "mesh" && a.nodes[e.a].connected && a.nodes[e.b].connected); }, "Laat twee gewone tandwielen in elkaar grijpen."),
      req("shaft", "Een gewoon tandwiel en een kettingtandwiel delen één as", (ctx) => { const a = ctx.live.analysis; return a.edges.some((e) => e.type === "shaft" && a.nodes[e.a].connected && a.nodes[e.b].connected && a.nodes[e.a].kind !== a.nodes[e.b].kind); }, "Plaats een kettingtandwiel op de andere laag precies boven een gewoon tandwiel."),
      req("chain", "Een ketting drijft een kettingtandwiel aan", (ctx) => { const a = ctx.live.analysis; return a.edges.some((e) => e.type === "chain" && a.nodes[e.a].connected && a.nodes[e.b].connected); }, "Verbind twee kettingtandwielen met 🔗 Ketting."),
      reqTarget("sprocket", "Het doel is een kettingtandwiel dat meebeweegt"),
      req("otherLayer", "Motor en doel liggen op een andere laag", (ctx) => !!ctx.liveMotor && !!ctx.liveTarget && ctx.liveMotor.layer !== ctx.liveTarget.layer, "Het doel moet op de andere laag liggen dan de motor."),
      reqValid(),
      reqTested(false),
    ],
    hints: ["Begin op Laag 1 met twee tandwielen.", "Kies Laag 2, voeg een kettingtandwiel toe en zet het op de as van het laatste tandwiel.", "Voeg nog een kettingtandwiel toe op Laag 2 en verbind met 🔗 Ketting."],
  },
  {
    id: "l3",
    kind: "challenge",
    group: "layers",
    number: 3,
    title: "Sneller over twee lagen",
    steps: ["Bouw een machine die op Laag 1 begint en op Laag 2 eindigt.", "Het laatste tandwiel moet sneller draaien dan de motor."],
    requirements: [
      reqMotor(),
      reqTarget(),
      req("layers", "Motor op de ene laag, doel op de andere laag", (ctx) => !!ctx.liveMotor && !!ctx.liveTarget && ctx.liveMotor.layer !== ctx.liveTarget.layer, "Zet het doel op de andere laag."),
      req("shaft", "De lagen zijn verbonden met een gedeelde as", (ctx) => { const a = ctx.live.analysis; return a.edges.some((e) => e.type === "shaft" && a.nodes[e.a].connected && a.nodes[e.b].connected); }, "Overdracht tussen de lagen gebeurt via een gedeelde as."),
      reqValid(),
      reqTested(true),
      req("faster", "Doel maakt meer rondjes dan de motor", (ctx) => (targetRevs(ctx) ?? 0) > 1 + EPS, undefined, (ctx) => (ctx.target ? `Nu: ${fmtRevs(ctx.target.revs)} rondjes` : null)),
    ],
    hints: ["Gebruik ↻ MOTOR 1 RONDJE.", "Welk tandwiel maakt de meeste rondjes?", "Een groot tandwiel dat een klein tandwiel aandrijft maakt het sneller."],
  },
  {
    id: "l4",
    kind: "challenge",
    group: "layers",
    number: 4,
    title: "De grote machine",
    steps: ["Gebruik minstens 3 gewone tandwielen, 2 kettingtandwielen, 1 ketting, 1 gedeelde as en beide lagen.", "Alles moet één werkende constructie vormen."],
    requirements: [
      reqMotor(),
      req("gears3", "Minstens 3 gewone tandwielen bewegen mee", (ctx) => ctx.live.analysis.connectedIds.filter((id) => ctx.live.analysis.nodes[id].kind === "gear").length >= 3, undefined, (ctx) => `Nu: ${ctx.live.analysis.connectedIds.filter((id) => ctx.live.analysis.nodes[id].kind === "gear").length}`),
      req("spr2", "Minstens 2 kettingtandwielen bewegen mee", (ctx) => ctx.live.analysis.connectedIds.filter((id) => ctx.live.analysis.nodes[id].kind === "sprocket").length >= 2),
      req("chain", "Minstens 1 ketting", (ctx) => { const a = ctx.live.analysis; return a.edges.some((e) => e.type === "chain" && a.nodes[e.a].connected && a.nodes[e.b].connected); }),
      req("shaft", "Minstens 1 gedeelde as", (ctx) => { const a = ctx.live.analysis; return a.edges.some((e) => e.type === "shaft" && a.nodes[e.a].connected && a.nodes[e.b].connected); }),
      req("both", "Beide lagen worden gebruikt", (ctx) => new Set(ctx.live.analysis.connectedIds.map((id) => ctx.live.analysis.nodes[id].layer)).size === 2),
      req("all", "Alle onderdelen op de werkbank bewegen mee", (ctx) => ctx.live.construction.components.length > 0 && ctx.live.analysis.connectedIds.length === ctx.live.construction.components.length, "Bewegen alle tandwielen die je nodig hebt?"),
      reqValid(),
      reqTested(false),
    ],
    hints: ["Bouw stap voor stap: eerst de tandwielen op Laag 1.", "Zet een kettingtandwiel op de as van een tandwiel (Laag 2).", "Verbind met een ketting naar een tweede kettingtandwiel op Laag 2.", "Test met ▶ Test: beweegt alles?"],
  },
];

export const MISSIONS: MissionDef[] = [...gearDiscoveries, ...gearChallenges, ...chainDiscoveries, ...chainChallenges, ...layerDiscoveries, ...layerChallenges];
export const DISCOVERY_MISSIONS = MISSIONS.filter((m) => m.kind === "discovery");
export const CHALLENGE_MISSIONS = MISSIONS.filter((m) => m.kind === "challenge");

export const GROUPS: Array<{ id: MissionGroup; title: string; subtitle: string }> = [
  { id: "gears", title: "Tandwielen", subtitle: "Rechtstreeks in elkaar grijpen" },
  { id: "chains", title: "Kettinglab", subtitle: "Beweging over een afstand" },
  { id: "layers", title: "Twee lagen", subtitle: "Gedeelde assen en grote machines" },
];

export function missionById(id: string | null | undefined): MissionDef | null {
  if (!id) return null;
  return MISSIONS.find((m) => m.id === id) ?? null;
}

export function missionsOf(group: MissionGroup, kind: MissionKind): MissionDef[] {
  return MISSIONS.filter((m) => m.group === group && m.kind === kind);
}

export function nextMissionOfKind(id: string): MissionDef | null {
  const current = missionById(id);
  if (!current) return null;
  const list = current.kind === "discovery" ? DISCOVERY_MISSIONS : CHALLENGE_MISSIONS;
  const i = list.findIndex((m) => m.id === id);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
}

export function missionCode(m: MissionDef): string {
  const g = m.group === "gears" ? "T" : m.group === "chains" ? "K" : "L";
  return m.kind === "discovery" ? `${g}${m.number}` : `${g}U${m.number}`;
}

export type { MissionGroup, MissionKind } from "./missionEngine";
