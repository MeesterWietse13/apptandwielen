"use client";
import { memo, useMemo } from "react";
import { gearOutline, hubRadius, outerRadius, pitchRadius, rootRadius, toothAngle } from "@/lib/mechanics/gearGeometry";
import type { ComponentKind, Layer, MechComponent } from "@/lib/mechanics/types";

export type ColorKey = "amber" | "emerald" | "sky" | "teal" | "indigo";

export function colorKeyFor(kind: ComponentKind, teeth: number): ColorKey {
  if (kind === "sprocket") return "indigo";
  if (teeth <= 15) return "amber";
  if (teeth <= 25) return "emerald";
  if (teeth <= 40) return "sky";
  return "teal";
}

const PALETTE: Record<ColorKey, { light: string; base: string; dark: string; side: string; stroke: string }> = {
  amber: { light: "#fde68a", base: "#f59e0b", dark: "#d97706", side: "#92400e", stroke: "#78350f" },
  emerald: { light: "#a7f3d0", base: "#10b981", dark: "#059669", side: "#065f46", stroke: "#064e3b" },
  sky: { light: "#bae6fd", base: "#0ea5e9", dark: "#0284c7", side: "#075985", stroke: "#0c4a6e" },
  teal: { light: "#99f6e4", base: "#14b8a6", dark: "#0d9488", side: "#115e59", stroke: "#134e4a" },
  indigo: { light: "#c7d2fe", base: "#818cf8", dark: "#6366f1", side: "#3730a3", stroke: "#312e81" },
};

/** Gradients en patronen die alle tandwielen delen. Eén keer per SVG plaatsen. */
export function WorkbenchDefs() {
  return (
    <defs>
      {(Object.keys(PALETTE) as ColorKey[]).map((k) => (
        <g key={k}>
          <linearGradient id={`top-${k}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={PALETTE[k].light} />
            <stop offset="55%" stopColor={PALETTE[k].base} />
            <stop offset="100%" stopColor={PALETTE[k].dark} />
          </linearGradient>
          <radialGradient id={`face-${k}`} cx="0.4" cy="0.35" r="0.75">
            <stop offset="0%" stopColor={PALETTE[k].light} stopOpacity="0.95" />
            <stop offset="60%" stopColor={PALETTE[k].base} />
            <stop offset="100%" stopColor={PALETTE[k].dark} />
          </radialGradient>
        </g>
      ))}
      <radialGradient id="gear-shadow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#000" stopOpacity="0.45" />
        <stop offset="70%" stopColor="#000" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="metal" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="45%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#475569" />
      </radialGradient>
      <radialGradient id="axle" cx="0.4" cy="0.35" r="0.7">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#1e293b" />
      </radialGradient>
      <pattern id="grid-minor" width="25" height="25" patternUnits="userSpaceOnUse">
        <path d="M25 0H0V25" fill="none" stroke="#334155" strokeOpacity="0.35" strokeWidth="1" />
      </pattern>
      <pattern id="grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
        <rect width="100" height="100" fill="url(#grid-minor)" />
        <path d="M100 0H0V100" fill="none" stroke="#38bdf8" strokeOpacity="0.16" strokeWidth="1.2" />
      </pattern>
    </defs>
  );
}

function singleToothPath(kind: ComponentKind, teeth: number): string {
  const r = pitchRadius(teeth);
  const ro = outerRadius(kind, teeth);
  const rr = rootRadius(kind, teeth);
  const p = toothAngle(teeth);
  const prof: Array<[number, number]> =
    kind === "gear"
      ? [
          [rr, -0.3],
          [r, -0.24],
          [ro, -0.12],
          [ro, 0.12],
          [r, 0.24],
          [rr, 0.3],
        ]
      : [
          [rr, -0.26],
          [r, -0.16],
          [ro, -0.05],
          [ro, 0.05],
          [r, 0.16],
          [rr, 0.26],
        ];
  const pts = prof.map(([rad, f]) => `${(rad * Math.cos(f * p)).toFixed(2)},${(rad * Math.sin(f * p)).toFixed(2)}`);
  return `M${pts.join("L")}Z`;
}

export interface GearSvgProps {
  comp: MechComponent;
  angleDeg: number;
  isMotor: boolean;
  isTarget: boolean;
  selected: boolean;
  invalid: boolean;
  connected: boolean;
  meshHighlight: boolean;
  onShaft: boolean;
  motorDirection: 1 | -1;
  /** tekeningen zonder interactie (snapshots) */
  staticMode?: boolean;
}

export const GearSvg = memo(function GearSvg({
  comp,
  angleDeg,
  isMotor,
  isTarget,
  selected,
  invalid,
  connected,
  meshHighlight,
  onShaft,
  motorDirection,
  staticMode,
}: GearSvgProps) {
  const { kind, teeth, layer } = comp;
  const key = colorKeyFor(kind, teeth);
  const pal = PALETTE[key];
  const r = pitchRadius(teeth);
  const ro = outerRadius(kind, teeth);
  const rr = rootRadius(kind, teeth);
  const hub = hubRadius(teeth);
  const outline = useMemo(() => gearOutline(kind, teeth), [kind, teeth]);
  const tooth0 = useMemo(() => singleToothPath(kind, teeth), [kind, teeth]);
  const shadowOffset = layer === 2 ? { x: 7, y: 11 } : { x: 3, y: 5 };
  const thickness = layer === 2 ? 4 : 3;

  const holes = useMemo(() => {
    const inner = hub + 6;
    const outer = rr - 8;
    if (outer - inner < 22) return [];
    const n = kind === "sprocket" ? 5 : teeth >= 40 ? 6 : 4;
    const mid = (inner + outer) / 2;
    const hr = Math.min((outer - inner) * 0.34, 14);
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + Math.PI / n + (kind === "sprocket" ? 0 : Math.PI / 4);
      return { cx: mid * Math.cos(a), cy: mid * Math.sin(a), r: hr };
    });
  }, [hub, rr, kind, teeth]);

  const labelFont = Math.max(11, hub * 1.05);
  const showTeethInside = r >= 52;
  const teethLabel = r >= 70 ? `${teeth} tanden` : `${teeth} t`;

  return (
    <g
      className={staticMode ? undefined : "gear-node"}
      transform={`translate(${comp.x.toFixed(2)},${comp.y.toFixed(2)})`}
      data-comp-id={staticMode ? undefined : comp.id}
      style={staticMode ? undefined : { cursor: "grab" }}
    >
      {/* Schaduw: het tandwiel zweeft enkele millimeters boven de tafel */}
      <circle cx={shadowOffset.x} cy={shadowOffset.y} r={ro + (layer === 2 ? 6 : 3)} fill="url(#gear-shadow)" />
      {/* Zijkant (dikte) */}
      <g transform={`translate(0,${thickness}) rotate(${angleDeg.toFixed(3)})`}>
        <path d={outline} fill={pal.side} stroke={pal.stroke} strokeWidth="1" strokeLinejoin="round" />
      </g>
      {/* Bovenkant */}
      <g transform={`rotate(${angleDeg.toFixed(3)})`}>
        <path d={outline} fill={`url(#top-${key})`} stroke={pal.stroke} strokeWidth="1.2" strokeLinejoin="round" />
        <circle r={Math.max(rr - 3, hub + 2)} fill={`url(#face-${key})`} stroke={pal.dark} strokeWidth="1.5" />
        <circle r={Math.max(rr - 3, hub + 2)} fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="2" />
        {holes.map((h, i) => (
          <g key={i}>
            <circle cx={h.cx} cy={h.cy} r={h.r} fill="#0b1220" fillOpacity="0.55" />
            <circle cx={h.cx} cy={h.cy} r={h.r} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1.5" />
          </g>
        ))}
        {/* Rotatiemarkering: witte tand, lijn en stip */}
        <path d={tooth0} fill="#fff" fillOpacity="0.92" stroke="#0f172a" strokeWidth="0.8" />
        <line x1={hub + 2} y1="0" x2={rr - 4} y2="0" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.9" />
        <circle cx={Math.max(rr - 10, hub + 8)} cy="0" r="5.5" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
      </g>
      {/* Naaf / as */}
      <circle r={hub} fill={onShaft ? "url(#axle)" : "url(#metal)"} stroke="#1e293b" strokeWidth="1.5" />
      {onShaft && <circle r={hub - 4} fill="none" stroke="#0f172a" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 3" />}
      {isMotor && <circle r={hub + 3} fill="none" stroke="#f59e0b" strokeWidth="3" />}
      {isTarget && <circle r={hub + (isMotor ? 7 : 3)} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="4 3" />}
      <text
        y={showTeethInside ? -2 : 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={labelFont}
        fontWeight={800}
        fill="#0f172a"
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {comp.letter}
      </text>
      {showTeethInside ? (
        <g transform={`translate(0,${hub + 12})`}>
          <rect x={-(teethLabel.length * 3.6 + 8)} y="-9" width={teethLabel.length * 7.2 + 16} height="18" rx="9" fill="#0f172a" fillOpacity="0.75" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight={700} fill="#f8fafc" style={{ userSelect: "none", pointerEvents: "none" }}>
            {teethLabel}
          </text>
        </g>
      ) : (
        <g transform={`translate(0,${ro + 14})`}>
          <rect x={-(teethLabel.length * 3.4 + 7)} y="-8" width={teethLabel.length * 6.8 + 14} height="16" rx="8" fill="#0f172a" fillOpacity="0.75" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight={700} fill="#f8fafc" style={{ userSelect: "none", pointerEvents: "none" }}>
            {teethLabel}
          </text>
        </g>
      )}
      {isMotor && (
        <g transform={`translate(${hub * 0.75 + 4},${-hub * 0.75 - 4})`}>
          <circle r="11" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="13" style={{ userSelect: "none", pointerEvents: "none" }}>
            ⚡
          </text>
        </g>
      )}
      {isMotor && !staticMode && (
        <g transform={`translate(0,${r >= 70 ? hub + 31 : showTeethInside ? ro + 14 : ro + 32})`}>
          <rect x="-34" y="-9" width="68" height="18" rx="9" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight={900} fill="#1c1917" style={{ userSelect: "none", pointerEvents: "none" }}>
            MOTOR {motorDirection === 1 ? "↻" : "↺"}
          </text>
        </g>
      )}
      {isTarget && (
        <g transform={`translate(${-hub * 0.75 - 4},${-hub * 0.75 - 4})`}>
          <circle r="11" fill="#f43f5e" stroke="#881337" strokeWidth="1.5" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="12" style={{ userSelect: "none", pointerEvents: "none" }}>
            🎯
          </text>
        </g>
      )}
      {/* Statusringen */}
      {invalid && (
        <g>
          <circle r={ro + 2} fill="#ef4444" fillOpacity="0.18" />
          <circle r={ro + 4} fill="none" stroke="#ef4444" strokeWidth="3.5" />
        </g>
      )}
      {meshHighlight && <circle r={ro + 6} fill="none" stroke="#4ade80" strokeWidth="3" strokeOpacity="0.9" />}
      {selected && !staticMode && <circle className="selection-ring" r={ro + 8} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="8 6" />}
      {!connected && !staticMode && !invalid && <circle r={ro + 1} fill="none" stroke="#94a3b8" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 4" />}
    </g>
  );
});

/** Vage weergave van een onderdeel op de andere (verborgen) laag. */
export function GhostGear({ comp }: { comp: MechComponent }) {
  const r = pitchRadius(comp.teeth);
  return (
    <g transform={`translate(${comp.x.toFixed(2)},${comp.y.toFixed(2)})`} style={{ pointerEvents: "none" }} opacity={0.35}>
      <circle r={r} fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="6 5" />
      <circle r={hubRadius(comp.teeth)} fill="#e2e8f0" fillOpacity="0.15" stroke="#e2e8f0" strokeWidth="1" />
      <text textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight={800} fill="#e2e8f0">
        {comp.letter}
      </text>
      <text y={r + 14} textAnchor="middle" fontSize="11" fill="#e2e8f0">
        Laag {comp.layer}
      </text>
    </g>
  );
}

export function layerLabel(layer: Layer) {
  return `Laag ${layer}`;
}
