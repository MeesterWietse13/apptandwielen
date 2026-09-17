"use client";
import { useMemo } from "react";
import { ChainSvg } from "@/components/workbench/ChainSvg";
import { GearSvg, WorkbenchDefs } from "@/components/workbench/GearSvg";
import { constructionBounds } from "@/lib/mechanics/gearGeometry";
import { analyze } from "@/lib/mechanics/mechanismGraph";
import type { Construction } from "@/lib/mechanics/types";

interface Props {
  construction: Construction;
  className?: string;
  height?: number;
}

/** Statische mini-weergave (snapshot) van een constructie, ook bruikbaar bij afdrukken. */
export function MiniConstruction({ construction, className, height = 150 }: Props) {
  const analysis = useMemo(() => analyze(construction), [construction]);
  const b = constructionBounds(construction);
  if (!b) return <div className={`flex items-center justify-center text-xs text-slate-500 ${className ?? ""}`}>geen constructie</div>;
  const pad = 20;
  const vb = `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`;
  const byId = new Map(construction.components.map((k) => [k.id, k]));
  const angle = (id: string) => analysis.nodes[id]?.phase ?? 0;
  return (
    <svg viewBox={vb} className={className} style={{ height, width: "100%" }} preserveAspectRatio="xMidYMid meet">
      <WorkbenchDefs />
      {[1, 2].map((layer) => (
        <g key={layer}>
          {construction.components
            .filter((k) => k.layer === layer)
            .map((comp) => (
              <GearSvg
                key={comp.id}
                comp={comp}
                angleDeg={(angle(comp.id) * 180) / Math.PI}
                isMotor={construction.motorId === comp.id}
                isTarget={construction.targetId === comp.id}
                selected={false}
                invalid={false}
                connected={!!analysis.nodes[comp.id]?.connected}
                meshHighlight={false}
                onShaft={!!analysis.nodes[comp.id]?.shaftWith}
                motorDirection={construction.motorDirection}
                staticMode
              />
            ))}
          {construction.chains
            .filter((ch) => byId.get(ch.a)?.layer === layer)
            .map((ch) => {
              const a = byId.get(ch.a);
              const bb = byId.get(ch.b);
              if (!a || !bb) return null;
              return <ChainSvg key={ch.id} chainId={ch.id} a={a} b={bb} angleA={angle(a.id)} angleB={angle(bb.id)} selected={false} invalid={false} staticMode />;
            })}
        </g>
      ))}
    </svg>
  );
}
