"use client";
import { useEffect, useRef, useState } from "react";
import type { Annotation, AnnotationKind, Point } from "@/shared/types";
import { annotationBounds } from "./annotation-context";
import {
  annotationTextLines,
  moveAnnotationPoints,
  resizeAnnotationPoints,
} from "./annotation-objects";

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
  onObjectChange,
  onObjectSelect,
  selectedId,
  onInsertText,
  onEditText,
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
  onObjectChange: (annotation: Annotation) => void;
  onObjectSelect: (id: string) => void;
  selectedId?: string;
  onInsertText: (point: Point) => void;
  onEditText: (annotation: Annotation) => void;
}) {
  const svgHost = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 1000 });
  const [resizePoints, setResizePoints] = useState<Point[] | null>(null);
  const resizing = useRef<Annotation | null>(null);
  const textLayouts = useRef(new Map<string, string[]>());
  const measureObjects =
    tool === "text" ||
    tool === "image" ||
    annotations.some(
      (annotation) =>
        annotation.kind === "text" ||
        (annotation.id === selectedId && annotation.kind === "image"),
    );
  useEffect(() => {
    if (!svgHost.current || !measureObjects) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      }),
    );
    observer.observe(svgHost.current);
    return () => observer.disconnect();
  }, [measureObjects]);
  const resize = (annotation: Annotation, point: Point) =>
    resizeAnnotationPoints(
      annotation.points ?? [],
      point,
      size.width,
      size.height,
      annotation.kind === "text"
        ? {
            value: annotation.text,
            fontSize: ((annotation.fontSize ?? 24) * size.width) / 1000,
          }
        : undefined,
    );
  const points = useRef<Point[]>([]);
  const drawing = useRef(false);
  const editingGesture = useRef(false);
  const objectDrag = useRef<{ annotation: Annotation; origin: Point } | null>(
    null,
  );
  const [translation, setTranslation] = useState<Point>({ x: 0, y: 0 });
  const hand = useRef<{ x: number; y: number; host: HTMLElement } | null>(null);
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
    "underline",
    "pencil",
    "hand",
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
      x: Math.min(first.x, last.x) * size.width,
      y: Math.min(first.y, last.y) * size.height,
      width: Math.abs(first.x - last.x) * size.width,
      height: Math.abs(first.y - last.y) * size.height,
    };
    const props = {
      stroke: tint,
      strokeWidth:
        (annotation?.thickness ?? thickness) * (kind === "pencil" ? 0.5 : 1),
      vectorEffect: "non-scaling-stroke" as const,
      fill: "none",
      onPointerDown: () => {
        if (tool === "eraser" && id) onErase(id);
      },
      style: {
        pointerEvents:
          tool === "eraser" || tool === "select"
            ? ("stroke" as const)
            : ("none" as const),
      },
    };
    if (kind === "text") {
      if (!annotation) return null;
      const fontSize = ((annotation.fontSize ?? 24) * size.width) / 1000;
      const key = `${fontSize}:${geometry.width}:${annotation.text}`;
      let lines = textLayouts.current.get(key);
      if (!lines) {
        lines = annotationTextLines(
          annotation.text,
          geometry.width || 320,
          fontSize,
        );
        textLayouts.current.set(key, lines);
        if (textLayouts.current.size > 64)
          textLayouts.current.delete(textLayouts.current.keys().next().value!);
      }
      return (
        <text
          x={first.x * size.width + fontSize * 0.25}
          y={first.y * size.height + fontSize * 1.25}
          fill={tint}
          fontSize={fontSize}
          fontFamily={
            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }
          aria-label={annotation.text}
          style={{
            pointerEvents:
              tool === "eraser" || tool === "select" ? "all" : "none",
          }}
          onPointerDown={props.onPointerDown}
        >
          {lines.map((line, index) => (
            <tspan
              key={index}
              x={first.x * size.width + fontSize * 0.25}
              dy={index ? fontSize * 1.35 : 0}
            >
              {line || "\u00a0"}
            </tspan>
          ))}
        </text>
      );
    }
    if (kind === "image")
      return (
        <image
          href={annotation?.image}
          {...geometry}
          style={{
            pointerEvents:
              tool === "eraser" || tool === "select" ? "all" : "none",
          }}
          onPointerDown={props.onPointerDown}
        />
      );
    if (kind === "pen" || kind === "pencil" || kind === "underline")
      return (
        <polyline
          {...props}
          points={(kind === "underline"
            ? [pts[0], pts[pts.length - 1]].map((p) => ({
                ...p,
                y: Math.max(pts[0].y, pts[pts.length - 1].y),
              }))
            : pts
          )
            .map((p) => `${p.x * size.width},${p.y * size.height}`)
            .join(" ")}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    if (kind === "circle")
      return (
        <ellipse
          {...props}
          cx={((first.x + last.x) * size.width) / 2}
          cy={((first.y + last.y) * size.height) / 2}
          rx={geometry.width / 2}
          ry={geometry.height / 2}
        />
      );
    if (kind === "arrow")
      return (
        <g>
          <line
            {...props}
            x1={first.x * size.width}
            y1={first.y * size.height}
            x2={last.x * size.width}
            y2={last.y * size.height}
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
              x={Math.min(pts[i * 2].x, pts[i * 2 + 1].x) * size.width}
              y={Math.min(pts[i * 2].y, pts[i * 2 + 1].y) * size.height}
              width={Math.abs(pts[i * 2].x - pts[i * 2 + 1].x) * size.width}
              height={Math.abs(pts[i * 2].y - pts[i * 2 + 1].y) * size.height}
              fill={tint}
              fillOpacity={0.3}
              stroke="none"
              style={{
                pointerEvents:
                  tool === "eraser" || tool === "select" ? "all" : "none",
              }}
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
      ref={svgHost}
      className={`annotation-overlay ${enabled ? "drawing" : ""}`}
      viewBox={`0 0 ${size.width} ${size.height}`}
      preserveAspectRatio="none"
      style={{
        color,
        touchAction: enabled ? "none" : "auto",
        pointerEvents: enabled ? "auto" : "none",
      }}
      aria-label="Camada de anotações"
      onClick={(event) => {
        if (editingGesture.current) {
          event.stopPropagation();
          editingGesture.current = false;
        }
      }}
      onPointerDown={(e) => {
        if (tool === "hand") {
          const host = e.currentTarget.closest(
            ".reader-scroll-area",
          ) as HTMLElement;
          if (host) {
            hand.current = { x: e.clientX, y: e.clientY, host };
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          return;
        }
        if (tool === "eraser" || !enabled) return;
        editingGesture.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        points.current = [getPoint(e)];
        onDraft(points.current);
      }}
      onPointerMove={(e) => {
        if (resizing.current) {
          setResizePoints(resize(resizing.current, getPoint(e)));
          return;
        }
        if (hand.current) {
          const h = hand.current;
          h.host.scrollBy(h.x - e.clientX, h.y - e.clientY);
          h.x = e.clientX;
          h.y = e.clientY;
          return;
        }
        if (objectDrag.current) {
          const p = getPoint(e);
          const original = objectDrag.current.annotation.points ?? [];
          const moved = moveAnnotationPoints(
            original,
            p.x - objectDrag.current.origin.x,
            p.y - objectDrag.current.origin.y,
          );
          setTranslation({
            x: moved[0].x - original[0].x,
            y: moved[0].y - original[0].y,
          });
          return;
        }
        if (!drawing.current) return;
        const p = getPoint(e);
        points.current =
          tool === "pen" || tool === "pencil"
            ? [...points.current, p]
            : [points.current[0], p];
        onDraft(points.current);
      }}
      onPointerUp={(e) => {
        hand.current = null;
        if (resizing.current) {
          const annotation = resizing.current;
          onObjectChange({
            ...annotation,
            points: resize(annotation, getPoint(e)),
            updatedAt: new Date().toISOString(),
          });
          resizing.current = null;
          setResizePoints(null);
          return;
        }
        if (objectDrag.current) {
          const { annotation, origin } = objectDrag.current;
          const end = getPoint(e);
          onObjectChange({
            ...annotation,
            points: moveAnnotationPoints(
              annotation.points ?? [],
              end.x - origin.x,
              end.y - origin.y,
            ),
            updatedAt: new Date().toISOString(),
          });
          objectDrag.current = null;
          setTranslation({ x: 0, y: 0 });
          return;
        }
        if (!drawing.current) return;
        drawing.current = false;
        const pts = [...points.current, getPoint(e)];
        if (tool === "text") onInsertText(pts[0]);
        else if (
          tool === "image" ||
          (pts.length > 1 &&
            (Math.abs(pts[0].x - pts.at(-1)!.x) +
              Math.abs(pts[0].y - pts.at(-1)!.y) >
              0.002 ||
              pts.length > 5))
        )
          onComplete(
            tool === "pen" || tool === "pencil" ? pts : [pts[0], pts.at(-1)!],
            tool as AnnotationKind,
          );
        points.current = [];
        onDraft([]);
      }}
      onPointerCancel={() => {
        hand.current = null;
        resizing.current = null;
        setResizePoints(null);
        objectDrag.current = null;
        setTranslation({ x: 0, y: 0 });
        drawing.current = false;
        editingGesture.current = false;
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
        <g
          key={a.id}
          opacity={a.opacity ?? 1}
          transform={
            objectDrag.current?.annotation.id === a.id
              ? `translate(${translation.x * size.width} ${translation.y * size.height})`
              : undefined
          }
          style={{ pointerEvents: tool === "select" ? "all" : undefined }}
          onPointerDown={(e) => {
            if (tool !== "select") return;
            editingGesture.current = true;
            // Moving a text annotation must not also select its SVG text in the browser.
            e.preventDefault();
            e.stopPropagation();
            const svg = e.currentTarget.ownerSVGElement!;
            const r = svg.getBoundingClientRect();
            objectDrag.current = {
              annotation: a,
              origin: {
                x: (e.clientX - r.left) / r.width,
                y: (e.clientY - r.top) / r.height,
              },
            };
            onObjectSelect(a.id);
            svg.setPointerCapture(e.pointerId);
          }}
          onDoubleClick={(event) => {
            if (a.kind !== "text" || tool !== "select") return;
            event.stopPropagation();
            onEditText(a);
          }}
        >
          {draw(
            a.kind,
            resizing.current?.id === a.id && resizePoints
              ? resizePoints
              : (a.points ?? []),
            a.color,
            a.id,
            a,
          )}
        </g>
      ))}
      {tool === "select" &&
        annotations
          .filter(
            (annotation) =>
              annotation.id === selectedId &&
              ["text", "image"].includes(annotation.kind),
          )
          .map((annotation) => {
            const bounds = annotationBounds(
              resizePoints && resizing.current?.id === annotation.id
                ? resizePoints
                : (annotation.points ?? []),
            );
            if (!bounds) return null;
            const x = bounds.x * size.width,
              y = bounds.y * size.height;
            const width = bounds.width * size.width,
              height = bounds.height * size.height;
            return (
              <g
                key={`selection-${annotation.id}`}
                className="annotation-object-selection"
                transform={
                  objectDrag.current?.annotation.id === annotation.id
                    ? `translate(${translation.x * size.width} ${translation.y * size.height})`
                    : undefined
                }
              >
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  pointerEvents="none"
                />
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={
                    annotation.kind === "image"
                      ? "Redimensionar imagem"
                      : "Redimensionar texto"
                  }
                  style={{ pointerEvents: "all", cursor: "nwse-resize" }}
                  onPointerDown={(event) => {
                    editingGesture.current = true;
                    event.preventDefault();
                    event.stopPropagation();
                    resizing.current = annotation;
                    event.currentTarget.ownerSVGElement!.setPointerCapture(
                      event.pointerId,
                    );
                  }}
                  onKeyDown={(event) => {
                    if (
                      ![
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(event.key)
                    )
                      return;
                    event.preventDefault();
                    event.stopPropagation();
                    const direction = ["ArrowLeft", "ArrowUp"].includes(
                      event.key,
                    )
                      ? -1
                      : 1;
                    onObjectChange({
                      ...annotation,
                      points: resize(annotation, {
                        x:
                          bounds.x +
                          bounds.width +
                          (direction * (event.shiftKey ? 16 : 4)) / size.width,
                        y: bounds.y + bounds.height,
                      }),
                      updatedAt: new Date().toISOString(),
                    });
                  }}
                >
                  <rect
                    x={Math.max(0, Math.min(x + width - 22, size.width - 44))}
                    y={Math.max(0, Math.min(y + height - 22, size.height - 44))}
                    width={44}
                    height={44}
                    fill="transparent"
                  />
                  <rect
                    x={x + width - 5}
                    y={y + height - 5}
                    width={10}
                    height={10}
                    rx={2}
                    fill="var(--surface)"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  />
                </g>
              </g>
            );
          })}
      <g opacity={opacity}>{draw(tool, draft, color)}</g>
    </svg>
  );
}
