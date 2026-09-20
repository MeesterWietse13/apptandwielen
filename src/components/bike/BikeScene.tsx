"use client";
import { gearOutline } from "@/lib/mechanics/gearGeometry";
import { chainRollers, circlesPath, polygonPath } from "@/lib/mechanics/chainPhysics";
import { BIKE, REAR_TEETH, ROUTES, gradeAt, type BikeState } from "@/lib/bike/physics";

const SCALE = 0.38;
function Sprocket({ teeth, x, y, turns, active = false }: { teeth: number; x: number; y: number; turns: number; active?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${SCALE})`}>
    <g transform={`rotate(${turns * 360})`}>
      <path d={gearOutline("sprocket", teeth)} transform="translate(0 6)" fill="#172554" stroke="#020617" strokeWidth="3" />
      <path d={gearOutline("sprocket", teeth)} fill={active ? "url(#bike-metal-active)" : "url(#bike-metal)"} stroke={active ? "#bae6fd" : "#64748b"} strokeWidth="3" />
      {[0, 120, 240].map(a => <circle key={a} transform={`rotate(${a})`} cx={teeth * 1.7} cy="0" r={teeth * 0.28} fill="#0f172a" />)}
      <circle r="10" fill="#cbd5e1" stroke="#0f172a" strokeWidth="4" />
    </g>
  </g>;
}
export function BikeScene({ state: s }: { state: BikeState }) {
  const a = { x: 430 / SCALE, y: 305 / SCALE, teeth: BIKE.front, angle: s.crankTurns * 2 * Math.PI };
  const rearX = 245 + (8 - s.rear) * 1.7, rearY = 280 - (8 - s.rear) * 0.9;
  const b = { x: rearX / SCALE, y: rearY / SCALE, teeth: REAR_TEETH[s.rear], angle: s.wheelTurns * 2 * Math.PI };
  const rollers = chainRollers(a, b);
  const path = polygonPath(rollers);
  const angle = -Math.atan(gradeAt(s.mode, s.distance)) * 180 / Math.PI;
  const offset = (s.distance * 25) % 160;
  return <svg className="bike-scene" viewBox="100 70 720 350" role="img" aria-label={`Fiets in zijaanzicht. Vooraan 40 tanden, achteraan ${b.teeth} tanden. ${s.mode === "hill" ? "De helling wordt geleidelijk steiler." : s.mode === "sprint" ? "Een lichte afdaling naar de finish." : "Vlakke meetproef."}`}>
    <defs>
      <linearGradient id="bike-sky" x2="0" y2="1"><stop stopColor="#0c2340" /><stop offset="1" stopColor="#164e63" /></linearGradient>
      <linearGradient id="bike-frame" x2="0.6" y2="1"><stop stopColor="#a5f3fc" /><stop offset="0.4" stopColor="#38bdf8" /><stop offset="1" stopColor="#0369a1" /></linearGradient>
      <linearGradient id="bike-metal" x2="1" y2="1"><stop stopColor="#cbd5e1" /><stop offset="1" stopColor="#334155" /></linearGradient>
      <linearGradient id="bike-metal-active" x2="1" y2="1"><stop stopColor="#e0f2fe" /><stop offset="0.5" stopColor="#38bdf8" /><stop offset="1" stopColor="#0284c7" /></linearGradient>
    </defs>
    <rect x="-1000" width="3000" height="600" fill="url(#bike-sky)" />
    <circle cx="745" cy="115" r="25" fill="#fde68a" opacity="0.8" />
    <path d="M0 240L120 80 245 225 365 55 560 220 695 110 900 240V440H0Z" fill="#164e63" opacity="0.7" />
    <path d="M300 130L365 55 430 126 391 112 364 130 343 106Z" fill="#a5f3fc" opacity="0.35" />
    <path d="M0 290Q190 170 360 255T900 240V440H0Z" fill="#115e59" opacity="0.7" />
    {[0, 1, 2, 3, 4].map(i => <g key={i} transform={`translate(${i * 240 - (s.distance * 9) % 240} 295)`} opacity="0.55"><path d="M0 0v-45" stroke="#134e4a" strokeWidth="7" /><path d="M-22 -20L0 -72 22 -20Z" fill="#0f766e" /><path d="M-13 10l12 -9 16 9Z" fill="#475569" /></g>)}
    <text x="128" y="95" fill="#a5f3fc" fontSize="12" fontWeight="800" letterSpacing="2">{s.mode === "hill" ? "NAAR DE TOP" : s.mode === "sprint" ? "OP WEG NAAR DE FINISH" : "VOLG DE WITTE MARKERINGEN"}</text>
    <g transform={`rotate(${angle} 450 385)`}>
      <rect x="-100" y="385" width="1100" height="160" fill="#1e293b" />
      <path d="M-100 386H1000" stroke="#94a3b8" strokeWidth="4" />
      {Array.from({ length: 8 }, (_, i) => <g key={i} transform={`translate(${i * 160 - offset - 100} 0)`}>
        <path d="M0 416h65" stroke="#cbd5e1" strokeWidth="4" opacity="0.5" />
        <path d="M0 380l8 -12 15 12" fill="#0f766e" />
      </g>)}
      {s.mode !== "flat" && <g transform={`translate(${Math.max(735, 1600 - s.distance / ROUTES[s.mode].length * 865)} 190)`}>
        <path d="M0 0V196" stroke="#cbd5e1" strokeWidth="5" /><path d="M0 0H75V50H0Z" fill="#f8fafc" />
        {[0, 1, 2].map(i => <rect key={i} x={i * 25} y={i % 2 * 25} width="25" height="25" fill="#0f172a" />)}
        <text x="4" y="-12" fill="#f8fafc" fontSize="15" fontWeight="bold">{s.mode === "hill" ? "TOP" : "FINISH"}</text>
      </g>}
      {[245, 675].map(x => <g key={x} transform={`translate(${x} 280)`}>
        <circle r="106" fill="#0f172a" fillOpacity="0.25" stroke="#020617" strokeWidth="16" />
        <circle r="99" fill="none" stroke="#94a3b8" strokeWidth="3" />
        <g transform={`rotate(${s.wheelTurns * 360})`}>
          {Array.from({ length: 12 }, (_, i) => <line key={i} x1="0" y1="0" x2="0" y2="-97" transform={`rotate(${i * 30})`} stroke="#94a3b8" strokeWidth="1.5" opacity="0.7" />)}
          <circle cx="0" cy="-96" r="7" fill="#fff" stroke="#38bdf8" strokeWidth="3" />
        </g>
        <circle r="10" fill="#cbd5e1" />
      </g>)}
      <path d="M245 280L375 160 430 305 245 280M375 160L590 150 430 305M590 150L675 280M590 150L578 112" fill="none" stroke="#020617" strokeWidth="17" strokeLinejoin="round" />
      <path d="M245 280L375 160 430 305 245 280M375 160L590 150 430 305M590 150L675 280M590 150L578 112" fill="none" stroke="url(#bike-frame)" strokeWidth="11" strokeLinejoin="round" />
      <path d="M375 160L362 124" stroke="#cbd5e1" strokeWidth="8" /><path d="M335 122h58" stroke="#020617" strokeWidth="13" strokeLinecap="round" />
      <path d="M578 112L615 101 643 106" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
      {Array.from(REAR_TEETH).reverse().map(t => { const i = REAR_TEETH.indexOf(t); return <Sprocket key={t} teeth={t} x={245 + (8 - i) * 1.7} y={280 - (8 - i) * 0.9} turns={s.wheelTurns} />; })}
      <Sprocket teeth={REAR_TEETH[s.rear]} x={rearX} y={rearY} turns={s.wheelTurns} active />
      <Sprocket teeth={40} x={430} y={305} turns={s.crankTurns} active />
      <g transform={`scale(${SCALE})`}>
        <path d={path} fill="none" stroke="#020617" strokeWidth="10" strokeLinejoin="round" />
        <path d={path} fill="none" stroke="#94a3b8" strokeWidth="5" strokeLinejoin="round" />
        <path d={circlesPath(rollers, 2.5)} fill="#f8fafc" />
      </g>
      <g transform={`translate(430 305) rotate(${s.crankTurns * 360})`}>
        <path d="M-48 0H48" stroke="#020617" strokeWidth="12" strokeLinecap="round" /><path d="M-48 0H48" stroke="#e2e8f0" strokeWidth="6" />
        {[-48, 48].map(x => <g key={x} transform={`translate(${x} 0) rotate(${-s.crankTurns * 360})`}><rect x="-14" y="-5" width="28" height="10" rx="3" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" /></g>)}
        <circle cx="35" r="6" fill="white" stroke="#fbbf24" strokeWidth="3" />
      </g>
      <g fill="#e0f2fe" fontSize="14" fontWeight="bold"><text x="385" y="369">Voor: 40 tanden</text><text x="175" y="142">Achter: {b.teeth} tanden</text></g>
      <path d={`M230 150L${rearX} ${rearY - 48}`} stroke="#7dd3fc" strokeDasharray="3 4" opacity="0.6" />
    </g>
  </svg>;
}
