"use client";
import { memo, useMemo } from "react";
import { chainRollers, circlesPath, polygonPath } from "@/lib/mechanics/chainPhysics";
import type { MechComponent } from "@/lib/mechanics/types";

export interface ChainSvgProps {
  chainId: string;
  a: MechComponent;
  b: MechComponent;
  angleA: number; // radialen
  angleB: number;
  selected: boolean;
  invalid: boolean;
  staticMode?: boolean;
}

/** Een ketting met zichtbare schakels en rollers die rond beide kettingtandwielen loopt. */
export const ChainSvg = memo(function ChainSvg({ chainId, a, b, angleA, angleB, selected, invalid, staticMode }: ChainSvgProps) {
  const rollers = useMemo(
    () => (invalid ? [] : chainRollers({ x: a.x, y: a.y, teeth: a.teeth, angle: angleA }, { x: b.x, y: b.y, teeth: b.teeth, angle: angleB })),
    [a.x, a.y, a.teeth, b.x, b.y, b.teeth, angleA, angleB, invalid]
  );
  const plates = useMemo(() => polygonPath(rollers), [rollers]);
  const dots = useMemo(() => circlesPath(rollers, 3.4), [rollers]);
  const pins = useMemo(() => circlesPath(rollers, 1.4), [rollers]);

  if (invalid) {
    return (
      <g data-chain-id={staticMode ? undefined : chainId} style={{ cursor: staticMode ? undefined : "pointer" }}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ef4444" strokeWidth="14" strokeOpacity="0.15" />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ef4444" strokeWidth="4" strokeDasharray="10 8" />
      </g>
    );
  }

  return (
    <g data-chain-id={staticMode ? undefined : chainId} style={{ cursor: staticMode ? undefined : "pointer" }}>
      {/* onzichtbare brede rand voor aanklikken */}
      {!staticMode && <path d={plates} fill="none" stroke="#000" strokeOpacity="0" strokeWidth="18" strokeLinejoin="round" />}
      {selected && <path d={plates} fill="none" stroke="#22d3ee" strokeWidth="14" strokeOpacity="0.45" strokeLinejoin="round" />}
      {/* schaduw van de ketting */}
      <path d={plates} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="9" strokeLinejoin="round" transform="translate(2,4)" />
      {/* buitenplaten */}
      <path d={plates} fill="none" stroke="#1e293b" strokeWidth="8.5" strokeLinejoin="round" />
      {/* binnenplaten */}
      <path d={plates} fill="none" stroke="#64748b" strokeWidth="4.5" strokeLinejoin="round" />
      {/* rollers */}
      <path d={dots} fill="#e2e8f0" stroke="#334155" strokeWidth="1.2" />
      <path d={pins} fill="#475569" />
    </g>
  );
});
