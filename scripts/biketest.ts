import assert from "node:assert/strict";
import { BIKE, REAR_TEETH, cadence, forces, initialBike, maximumCadenceForMode, maximumSpeed, oneTurn, ratio, shiftBike, stepBike, targetCadence, type BikeMode, type BikeState } from "../src/lib/bike/physics";
import { chainGeometry, chainRollers } from "../src/lib/mechanics/chainPhysics";
import { newJournal, tested } from "../src/lib/bike/discoveries";

const flatMeasurements: Array<{ rear: number; seconds: number; rpm: number }> = [];
for (let rear = 0; rear < 9; rear++) {
  let s = oneTurn({ ...initialBike(), rear });
  for (let i = 0; i < 1000 && s.running; i++) s = stepBike(s, 0.02);
  assert.equal(s.crankTurns, 1); assert.equal(s.wheelTurns, 40 / REAR_TEETH[rear]); assert(s.measured && !s.running);
  flatMeasurements.push({ rear, seconds: s.elapsed, rpm: cadence(s) });
  assert.equal(shiftBike(oneTurn(s), 8 - rear).rear, rear, "Exact meting vergrendelt schakeling");
  assert.deepEqual(stepBike({ ...s, running: false }, 0.02), { ...s, running: false });
  const moving = { ...s, running: true };
  const next = stepBike(moving, 0.02);
  assert(Math.abs((next.wheelTurns - s.wheelTurns) / (next.crankTurns - s.crankTurns) - ratio(rear)) < 1e-10);
  const a = { x: 430 / .38, y: 305 / .38, teeth: 40, angle: 0 }, b = { x: (245 + (8-rear)*1.7) / .38, y: (280-(8-rear)*.9) / .38, teeth: REAR_TEETH[rear], angle: 0 };
  assert(chainGeometry(a, b)); assert(chainRollers(a, b).every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.equal(BIKE.pedalForce, 240);
  console.log(`OK ${REAR_TEETH[rear]} tanden: ${s.wheelTurns.toFixed(5)} wielrondes in ${s.elapsed.toFixed(2)} s, ${cadence(s).toFixed(1)} rpm`);
}
assert(flatMeasurements[0].seconds > flatMeasurements[8].seconds, "Zwaar verzet vraagt meer tijd voor één trapronde vanuit stilstand");
assert(flatMeasurements[0].rpm < flatMeasurements[8].rpm, "Traptempo hangt op het vlak af van het gekozen verzet");
assert.equal(targetCadence("flat"), 90); assert.equal(targetCadence("sprint"), 90); assert.equal(targetCadence("hill"), 70);
assert.equal(maximumCadenceForMode("hill"), 90); assert.equal(maximumCadenceForMode("flat"), 120); assert.equal(maximumCadenceForMode("sprint"), 120);
{
  const hillAt = (rpm: number) => forces({ ...initialBike("hill"), rear: 8, speed: maximumSpeed(8, "hill") * rpm / 90 });
  assert.equal(hillAt(80).engagement, 1, "Tot 80 rpm blijft de volledige duwkracht beschikbaar");
  assert(hillAt(85).engagement < hillAt(80).engagement && hillAt(85).engagement > hillAt(89).engagement, "Bergop neemt de duwkracht geleidelijk af");
  assert.equal(hillAt(90).engagement, 0, "Bij het maximale bergtempo is geen extra versnelling meer mogelijk");
}
{ let s = { ...initialBike("flat"), rear: 8, running: true }; let peak = 0; for (let i = 0; i < 12 * 50 && !s.fatigued; i++) { s = stepBike(s, .02); peak = Math.max(peak, cadence(s)); } assert(peak > BIKE.sustainableCadence, "Een hoog traptempo kan kortstondig"); assert(s.fatigued, "Na drie seconden boven 90 rpm treedt vermoeidheid op"); const beforeDrop = cadence(s); s = stepBike(s, .02); assert(cadence(s) < beforeDrop && cadence(s) > BIKE.sustainableCadence, "Vermoeidheid laat het tempo geleidelijk dalen"); for (let i = 0; i < 3 * 50 && s.fatigued; i++) s = stepBike(s, .02); assert(!s.fatigued && cadence(s) < BIKE.sustainableCadence, "Onder 90 rpm worden vermoeidheid en aftelling gereset"); assert.equal(s.highCadenceTime, 0); assert(s.speed <= maximumSpeed(s.rear)); }
function ride(mode: BikeMode, strategy: "adaptive" | "fixed", rear?: number) {
  let s = { ...initialBike(mode), running: true };
  if (rear !== undefined) s.rear = rear;
  const used = new Set([s.rear]); let lastShift = -10;
  for (let i = 0; i < 600 * 50 && !s.finished; i++) {
    if (strategy === "adaptive" && s.elapsed - lastShift > 2) {
      const before = s;
      if (mode === "hill" && s.distance > 5 && forces(s).available < forces(s).resistance + 7) s = shiftBike(s, s.rear + 1);
      if (mode === "sprint" && cadence(s) > BIKE.sustainableCadence) s = shiftBike(s, s.rear - 1);
      if (s.rear !== before.rear) {
        assert.equal(s.wheelTurns, before.wheelTurns); assert.equal(s.crankTurns, before.crankTurns); assert.equal(s.speed, before.speed);
        used.add(s.rear); lastShift = s.elapsed;
      }
    }
    s = stepBike(s, .02);
    assert(Number.isFinite(s.speed) && s.speed >= 0);
    assert(cadence(s) <= maximumCadenceForMode(mode) + 1e-9, "Traptempo blijft per proef begrensd");
  }
  console.log(`${mode} ${strategy} ${rear ?? ""}: finish=${s.finished} t=${s.elapsed.toFixed(1)} v=${(s.speed*3.6).toFixed(1)} x=${s.distance.toFixed(1)} gears=${[...used].map(i=>REAR_TEETH[i])}`);
  return { state: s, used };
}
const hill = ride("hill", "adaptive");
assert(hill.state.finished); assert(hill.used.size >= 4, "Berg vraagt zinvol progressief schakelen");
assert(!ride("hill", "fixed", 3).state.finished, "Startverzet kan de steile top niet aan");
assert(ride("hill", "fixed", 8).state.finished, "Geen kunstmatig verplicht tandwiel per segment");
const sprint = ride("sprint", "adaptive");
assert(sprint.state.finished); assert(sprint.used.size >= 5, "Sprint gebruikt meerdere versnellingen");
for (const rear of [0, 4, 7, 8]) assert(sprint.state.elapsed < ride("sprint", "fixed", rear).state.elapsed, "Schakelen wint van een vast verzet");
const p = newJournal(); assert(!tested("flat", p.flat));
assert.deepEqual(initialBike("hill"), initialBike("hill"));
assert.deepEqual(initialBike("sprint"), initialBike("sprint"));
const paused: BikeState = { ...hill.state, finished: false, running: false };
assert.deepEqual(stepBike(paused, .02), paused);
console.log("Alle fietscontroles geslaagd.");
