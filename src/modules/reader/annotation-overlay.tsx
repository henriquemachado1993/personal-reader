"use client";
import { useRef } from "react";
import type { Annotation, AnnotationKind, Point } from "@/shared/types";

export function AnnotationOverlay({
  annotations,
  draft,
  tool,
  color,
  thickness = 2,
  opacity = 1,
  onDraft,
  onComplete,
  onErase,
}: {
  annotations: Annotation[];
  draft: Point[];
  tool: string;
  color: string;
  thickness?: number;
  opacity?: number;
  onDraft: (points: Point[]) => void;
  onComplete: (points: Point[], kind: AnnotationKind) => void;
  onErase: (id: string) => void;
}) {
  const points = useRef<Point[]>([]);
  const drawing = useRef(false);
  const getPoint = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
      pressure: event.pressure,
    };
  };
  const enabled = [
    "pen",
    "highlight",
    "rectangle",
    "circle",
    "arrow",
    "eraser",
    "clipping",
    "text",
    "image",
  ].includes(tool);
  const draw = (
    kind: string,
    pts: Point[],
    tint: string,
    id?: string,
    annotation?: Annotation,
  ) => {
    if (pts.length < 2) return null;
    const first = pts[0],
      last = pts[pts.length - 1];
    const geometry = {
      x: Math.min(first.x, last.x) * 1000,
      y: Math.min(first.y, last.y) * 1000,
      width: Math.abs(first.x - last.x) * 1000,
      height: Math.abs(first.y - last.y) * 1000,
    };
    const props = {
      stroke: tint,
      strokeWidth: annotation?.thickness ?? thickness,
      vectorEffect: "non-scaling-stroke" as const,
      fill: "none",
      onPointerDown: () => {
        if (tool === "eraser" && id) onErase(id);
      },
      style: {
        pointerEvents:
          tool === "eraser" ? ("stroke" as const) : ("none" as const),
      },
    };
    if (kind === "text")
      return (
        <text
          x={first.x * 1000}
          y={first.y * 1000 + 24}
          fill={tint}
          fontSize={24}
          style={{ pointerEvents: tool === "eraser" ? "all" : "none" }}
          onPointerDown={props.onPointerDown}
        >
          {annotation?.text}
        </text>
      );
    if (kind === "image")
      return (
        <image
          href={annotation?.image}
          {...geometry}
          style={{ pointerEvents: tool === "eraser" ? "all" : "none" }}
          onPointerDown={props.onPointerDown}
        />
      );
    if (kind === "pen")
      return (
        <polyline
          {...props}
          points={pts.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    if (kind === "circle")
      return (
        <ellipse
          {...props}
          cx={(first.x + last.x) * 500}
          cy={(first.y + last.y) * 500}
          rx={geometry.width / 2}
          ry={geometry.height / 2}
        />
      );
    if (kind === "arrow")
      return (
        <g>
          <line
            {...props}
            x1={first.x * 1000}
            y1={first.y * 1000}
            x2={last.x * 1000}
            y2={last.y * 1000}
            markerEnd="url(#arrow-head)"
          />
        </g>
      );
    if (kind === "highlight")
      return (
        <g>
          {Array.from({ length: Math.floor(pts.length / 2) }, (_, i) => (
            <rect
              key={i}
              {...props}
              x={Math.min(pts[i * 2].x, pts[i * 2 + 1].x) * 1000}
              y={Math.min(pts[i * 2].y, pts[i * 2 + 1].y) * 1000}
              width={Math.abs(pts[i * 2].x - pts[i * 2 + 1].x) * 1000}
              height={Math.abs(pts[i * 2].y - pts[i * 2 + 1].y) * 1000}
              fill={tint}
              fillOpacity={0.3}
              stroke="none"
              style={{ pointerEvents: tool === "eraser" ? "all" : "none" }}
            />
          ))}
        </g>
      );
    return (
      <rect
        {...props}
        {...geometry}
        strokeDasharray={kind === "clipping" ? "5 4" : undefined}
      />
    );
  };
  return (
    <svg
      className={`annotation-overlay ${enabled ? "drawing" : ""}`}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      style={{
        color,
        touchAction: enabled ? "none" : "auto",
        pointerEvents: enabled ? "auto" : "none",
      }}
      aria-label="Camada de anotações"
      onPointerDown={(e) => {
        if (tool === "eraser" || !enabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        points.current = [getPoint(e)];
        onDraft(points.current);
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        const p = getPoint(e);
        points.current =
          tool === "pen" ? [...points.current, p] : [points.current[0], p];
        onDraft(points.current);
      }}
      onPointerUp={(e) => {
        if (!drawing.current) return;
        drawing.current = false;
        const pts = [...points.current, getPoint(e)];
        if (
          pts.length > 1 &&
          (Math.abs(pts[0].x - pts.at(-1)!.x) +
            Math.abs(pts[0].y - pts.at(-1)!.y) >
            0.002 ||
            pts.length > 5)
        )
          onComplete(
            tool === "pen" ? pts : [pts[0], pts.at(-1)!],
            tool as AnnotationKind,
          );
        points.current = [];
        onDraft([]);
      }}
      onPointerCancel={() => {
        drawing.current = false;
        points.current = [];
        onDraft([]);
      }}
    >
      <defs>
        <marker
          id="arrow-head"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 8 4 L 0 8"
            fill="none"
            stroke="context-stroke"
            strokeWidth="1.2"
          />
        </marker>
      </defs>
      {annotations.map((a) => (
        <g key={a.id} opacity={a.opacity ?? 1}>
          {draw(a.kind, a.points ?? [], a.color, a.id, a)}
        </g>
      ))}
      <g opacity={opacity}>{draw(tool, draft, color)}</g>
    </svg>
  );
}
