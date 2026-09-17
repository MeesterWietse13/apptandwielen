"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Dispatch } from "react";
import { constructionBounds, hubRadius, pitchRadius } from "@/lib/mechanics/gearGeometry";
import type { Analysis } from "@/lib/mechanics/mechanismGraph";
import { angleDeg } from "@/lib/mechanics/simulationEngine";
import { WORLD, type Layer, type MechComponent } from "@/lib/mechanics/types";
import { ChainSvg } from "./ChainSvg";
import { GearSvg, GhostGear, WorkbenchDefs } from "./GearSvg";
import type { Action, WorkbenchState } from "./useWorkbench";

export interface WorkbenchHandle {
  zoomBy: (factor: number) => void;
  zoomTo: (zoom: number) => void;
  fit: () => void;
  centerWorld: () => { x: number; y: number };
}

interface Props {
  state: WorkbenchState;
  analysis: Analysis;
  dispatch: Dispatch<Action>;
}

type Gesture =
  | { mode: "drag"; id: string; offX: number; offY: number; startX: number; startY: number; moved: boolean }
  | { mode: "pan"; startTx: number; startTy: number; startX: number; startY: number; moved: boolean }
  | { mode: "pinch"; startDist: number; startZoom: number; startTx: number; startTy: number; midX: number; midY: number };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

export const Workbench = forwardRef<WorkbenchHandle, Props>(function Workbench({ state, analysis, dispatch }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const viewRef = useRef(state.view);
  viewRef.current = state.view;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const toolRef = useRef(state.tool);
  toolRef.current = state.tool;
  const constructionRef = useRef(state.construction);
  constructionRef.current = state.construction;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) setSize({ w: width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toLocal = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  }, []);

  const toWorld = useCallback((p: { x: number; y: number }) => {
    const v = viewRef.current;
    const s = sizeRef.current;
    return { x: (p.x - s.w / 2 - v.tx) / v.zoom, y: (p.y - s.h / 2 - v.ty) / v.zoom };
  }, []);

  const zoomAt = useCallback(
    (p: { x: number; y: number }, factor: number, absolute?: number) => {
      const v = viewRef.current;
      const s = sizeRef.current;
      const z2 = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, absolute ?? v.zoom * factor));
      const wx = (p.x - s.w / 2 - v.tx) / v.zoom;
      const wy = (p.y - s.h / 2 - v.ty) / v.zoom;
      dispatch({ type: "SET_VIEW", patch: { zoom: z2, tx: p.x - s.w / 2 - wx * z2, ty: p.y - s.h / 2 - wy * z2 } });
    },
    [dispatch]
  );

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (f) => zoomAt({ x: sizeRef.current.w / 2, y: sizeRef.current.h / 2 }, f),
      zoomTo: (z) => zoomAt({ x: sizeRef.current.w / 2, y: sizeRef.current.h / 2 }, 1, z),
      fit: () => {
        const b = constructionBounds(constructionRef.current);
        const s = sizeRef.current;
        if (!b) {
          dispatch({ type: "SET_VIEW", patch: { zoom: 1, tx: 0, ty: 0 } });
          return;
        }
        const bw = Math.max(200, b.maxX - b.minX);
        const bh = Math.max(200, b.maxY - b.minY);
        const zoom = Math.max(MIN_ZOOM, Math.min(1.4, (s.w / bw) * 0.88, (s.h / bh) * 0.85));
        const cx = (b.minX + b.maxX) / 2;
        const cy = (b.minY + b.maxY) / 2;
        dispatch({ type: "SET_VIEW", patch: { zoom, tx: -cx * zoom, ty: -cy * zoom } });
      },
      centerWorld: () => {
        const v = viewRef.current;
        return { x: -v.tx / v.zoom, y: -v.ty / v.zoom };
      },
    }),
    [dispatch, zoomAt]
  );

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toLocal(e);
      zoomAt(p, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toLocal, zoomAt]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toLocal(e);
    pointers.current.set(e.pointerId, p);
    const v = viewRef.current;
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      if (gesture.current?.mode === "drag") dispatch({ type: "DRAG_END" });
      gesture.current = {
        mode: "pinch",
        startDist: Math.max(10, Math.hypot(p1.x - p2.x, p1.y - p2.y)),
        startZoom: v.zoom,
        startTx: v.tx,
        startTy: v.ty,
        midX: (p1.x + p2.x) / 2,
        midY: (p1.y + p2.y) / 2,
      };
      return;
    }
    const target = e.target as Element;
    const compEl = target.closest("[data-comp-id]");
    const chainEl = target.closest("[data-chain-id]");
    if (compEl) {
      const id = compEl.getAttribute("data-comp-id")!;
      if (toolRef.current === "chain") {
        dispatch({ type: "CHAIN_CLICK", id });
        gesture.current = null;
        return;
      }
      const comp = constructionRef.current.components.find((k) => k.id === id);
      if (!comp) return;
      const w = toWorld(p);
      gesture.current = { mode: "drag", id, offX: comp.x - w.x, offY: comp.y - w.y, startX: p.x, startY: p.y, moved: false };
      dispatch({ type: "DRAG_START", id });
      return;
    }
    if (chainEl) {
      dispatch({ type: "SELECT", selection: { type: "chain", id: chainEl.getAttribute("data-chain-id")! } });
      gesture.current = null;
      return;
    }
    gesture.current = { mode: "pan", startTx: v.tx, startTy: v.ty, startX: p.x, startY: p.y, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = toLocal(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.mode === "pinch") {
      if (pointers.current.size < 2) return;
      const [p1, p2] = [...pointers.current.values()];
      const d = Math.max(10, Math.hypot(p1.x - p2.x, p1.y - p2.y));
      const s = sizeRef.current;
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (g.startZoom * d) / g.startDist));
      const wx = (g.midX - s.w / 2 - g.startTx) / g.startZoom;
      const wy = (g.midY - s.h / 2 - g.startTy) / g.startZoom;
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      dispatch({ type: "SET_VIEW", patch: { zoom, tx: mx - s.w / 2 - wx * zoom, ty: my - s.h / 2 - wy * zoom } });
      return;
    }
    const dx = p.x - g.startX;
    const dy = p.y - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < 4) return;
    g.moved = true;
    if (g.mode === "drag") {
      const w = toWorld(p);
      dispatch({ type: "DRAG_MOVE", id: g.id, raw: { x: w.x + g.offX, y: w.y + g.offY } });
    } else if (g.mode === "pan") {
      dispatch({ type: "SET_VIEW", patch: { tx: g.startTx + dx, ty: g.startTy + dy } });
    }
  };

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.mode === "pinch") {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    if (g.mode === "drag") {
      dispatch({ type: "DRAG_END" });
    } else if (g.mode === "pan" && !g.moved) {
      dispatch({ type: "SELECT", selection: null });
      if (toolRef.current === "chain") dispatch({ type: "SET_TOOL", tool: "select" });
    }
    gesture.current = null;
  };

  const { construction, view, sim, selection, dragPreview } = state;
  const theta = sim.theta;
  const byId = useMemo(() => new Map(construction.components.map((k) => [k.id, k])), [construction.components]);

  const angleOf = (id: string) => {
    const n = analysis.nodes[id];
    return n ? angleDeg(n.phase, n.omega, theta) : 0;
  };
  const angleRadOf = (id: string) => (angleOf(id) * Math.PI) / 180;

  const isVisible = (layer: Layer) => view.layerView === "both" || (view.layerView === "L1" ? layer === 1 : layer === 2);
  const chainProblemIds = new Set(analysis.problems.filter((p) => p.type === "chain").flatMap((p) => [p.ids.join("~")]));
  const invalidChain = (a: string, b: string) => chainProblemIds.has(`${a}~${b}`) || chainProblemIds.has(`${b}~${a}`);

  const renderLayer = (layer: Layer) => {
    const comps = construction.components.filter((k) => k.layer === layer);
    const chains = construction.chains.filter((ch) => byId.get(ch.a)?.layer === layer);
    return (
      <g key={`layer-${layer}`}>
        {comps.map((comp) => {
          const n = analysis.nodes[comp.id];
          return (
            <GearSvg
              key={comp.id}
              comp={comp}
              angleDeg={angleOf(comp.id)}
              isMotor={construction.motorId === comp.id}
              isTarget={construction.targetId === comp.id}
              selected={selection?.type === "component" && selection.id === comp.id}
              invalid={!!n && (n.overlap || n.conflict)}
              connected={!!n && n.connected}
              meshHighlight={!!dragPreview && (dragPreview.meshWith.includes(comp.id) || (dragPreview.id === comp.id && dragPreview.meshWith.length > 0))}
              onShaft={!!n && !!n.shaftWith}
              motorDirection={construction.motorDirection}
            />
          );
        })}
        {chains.map((ch) => {
          const a = byId.get(ch.a);
          const b = byId.get(ch.b);
          if (!a || !b) return null;
          return (
            <ChainSvg
              key={ch.id}
              chainId={ch.id}
              a={a}
              b={b}
              angleA={angleRadOf(a.id)}
              angleB={angleRadOf(b.id)}
              selected={selection?.type === "chain" && selection.id === ch.id}
              invalid={invalidChain(a.id, b.id)}
            />
          );
        })}
      </g>
    );
  };

  const ghosts: MechComponent[] =
    view.layerView === "L1"
      ? construction.components.filter((k) => k.layer === 2)
      : view.layerView === "L2"
        ? construction.components.filter((k) => k.layer === 1)
        : [];

  const shaftMarkers = construction.shafts
    .map((s) => {
      const a = byId.get(s.a);
      const b = byId.get(s.b);
      if (!a || !b) return null;
      const lower = a.layer === 1 ? a : b;
      const upper = a.layer === 1 ? b : a;
      const ring = isVisible(upper.layer) ? upper : lower;
      return { key: `${s.a}-${s.b}`, x: a.x, y: a.y, lower, ring, visible: isVisible(a.layer) || isVisible(b.layer) };
    })
    .filter((m): m is NonNullable<typeof m> => !!m && m.visible);

  const shaftPreview = dragPreview?.shaftWith ? byId.get(dragPreview.shaftWith) : null;
  const transform = `translate(${(size.w / 2 + view.tx).toFixed(2)},${(size.h / 2 + view.ty).toFixed(2)}) scale(${view.zoom.toFixed(4)})`;

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-[#0b1220]">
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className="block select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        style={{ cursor: state.tool === "chain" ? "crosshair" : "default" }}
      >
        <WorkbenchDefs />
        <rect width={size.w} height={size.h} fill="#0b1220" />
        <g transform={transform}>
          <rect x={WORLD.minX} y={WORLD.minY} width={WORLD.maxX - WORLD.minX} height={WORLD.maxY - WORLD.minY} fill="#0f172a" />
          <rect x={WORLD.minX} y={WORLD.minY} width={WORLD.maxX - WORLD.minX} height={WORLD.maxY - WORLD.minY} fill="url(#grid-major)" />
          <rect x={WORLD.minX} y={WORLD.minY} width={WORLD.maxX - WORLD.minX} height={WORLD.maxY - WORLD.minY} fill="none" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="3" />
          {ghosts.map((g) => (
            <GhostGear key={g.id} comp={g} />
          ))}
          {isVisible(1) && renderLayer(1)}
          {isVisible(2) && renderLayer(2)}
          {/* Gedeelde assen: metalen as bovenop, plus omtrek van het onderliggende tandwiel */}
          {shaftMarkers.map((m) => (
            <g key={m.key} transform={`translate(${m.x.toFixed(2)},${m.y.toFixed(2)})`} style={{ pointerEvents: "none" }}>
              {view.layerView === "both" && (
                <circle r={pitchRadius(m.lower.teeth)} fill="none" stroke="#f8fafc" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="5 5" />
              )}
              {/* metalen as-ring rond de naaf (de letter blijft leesbaar) */}
              <circle r={hubRadius(m.ring.teeth) + 2.5} fill="none" stroke="url(#axle)" strokeWidth="4" />
              <circle r={hubRadius(m.ring.teeth) + 5} fill="none" stroke="#0f172a" strokeOpacity="0.6" strokeWidth="1" />
            </g>
          ))}
          {shaftPreview && (
            <g transform={`translate(${shaftPreview.x.toFixed(2)},${shaftPreview.y.toFixed(2)})`} style={{ pointerEvents: "none" }}>
              <circle r={26} fill="none" stroke="#fbbf24" strokeWidth="4" className="pulse-ring" />
              <circle r={10} fill="#fbbf24" />
              <text y={-34} textAnchor="middle" fontSize="14" fontWeight={800} fill="#fbbf24">
                Zelfde as
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
});
