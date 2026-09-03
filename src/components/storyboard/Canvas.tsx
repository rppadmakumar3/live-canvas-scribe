import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, Download, Pin, PinOff, CopyPlus, BringToFront, SendToBack, Trash2 } from "lucide-react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { type CanvasElement, type Connector } from "@/lib/storyboard";
import { setMeasuredCanvasSize, getCanvasBounds } from "@/lib/canvas-bounds";
import { ElementBody } from "./CanvasElementView";

type Camera = { x: number; y: number; scale: number };

type Props = {
  elements: CanvasElement[];
  connectors: Connector[];
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
  onUpdateText?: (id: string, text: string) => void;
  onUpdateLabel?: (id: string, label: string) => void;
  onAddStroke?: (points: { x: number; y: number }[], color: string) => void;
  onDuplicate?: (id: string) => void;
  onPin?: (id: string, pinned: boolean) => void;
  onSetLayer?: (id: string, dir: "front" | "back") => void;
  activeTool?: "select" | "pen" | "eraser" | "sticky";
  activeColor?: string;
  interactive?: boolean;
  isProcessing?: boolean;
  visibleIds?: Set<string> | null;
};

/** Returns the point on an element's border that faces a given target point. */
function edgePoint(el: CanvasElement, toward: { x: number; y: number }) {
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return { x: cx, y: cy };
  const tx = dx !== 0 ? (dx > 0 ? el.w / 2 : -el.w / 2) / dx : Infinity;
  const ty = dy !== 0 ? (dy > 0 ? el.h / 2 : -el.h / 2) / dy : Infinity;
  const t = Math.min(Math.abs(tx), Math.abs(ty));
  return { x: cx + dx * t, y: cy + dy * t };
}

function anchorPath(from: CanvasElement, to: CanvasElement, others: CanvasElement[] = []) {
  const cf = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const ct = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const a = edgePoint(from, ct);
  const b = edgePoint(to, cf);

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const BEND = Math.min(40, Math.max(18, dist * 0.09));

  // Default: arc bends to the right-hand side of the travel direction
  let sign = 1;
  const apexX = (a.x + b.x) / 2 + (dy / dist) * BEND * sign;
  const apexY = (a.y + b.y) / 2 - (dx / dist) * BEND * sign;

  // If the apex lands inside any other element, flip to the other side
  const apexCollides = others.some(
    (el) =>
      el.id !== from.id &&
      el.id !== to.id &&
      apexX >= el.x - 4 &&
      apexX <= el.x + el.w + 4 &&
      apexY >= el.y - 4 &&
      apexY <= el.y + el.h + 4,
  );
  if (apexCollides) sign = -1;

  const mx = (a.x + b.x) / 2 + (dy / dist) * BEND * sign;
  const my = (a.y + b.y) / 2 - (dx / dist) * BEND * sign;
  const labelX = mx + (dy / dist) * 14 * sign;
  const labelY = my - (dx / dist) * 14 * sign;

  return { d: `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`, mid: { x: labelX, y: labelY } };
}

export function Canvas({
  elements,
  connectors,
  onMove,
  onResize,
  onDelete,
  onUpdateText,
  onUpdateLabel,
  onAddStroke,
  onDuplicate,
  onPin,
  onSetLayer,
  activeTool = "select",
  activeColor = "#2B2A28",
  interactive = true,
  isProcessing = false,
  visibleIds = null,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const isDrawing = useRef(false);

  // ── Camera (pan + zoom) ─────────────────────────────────────────────────────
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  cameraRef.current = camera;

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });

  /** Convert screen pointer coords → canvas logical coords */
  function toCanvas(sx: number, sy: number) {
    const cam = cameraRef.current;
    const rect = wrapRef.current!.getBoundingClientRect();
    return {
      x: (sx - rect.left - cam.x) / cam.scale,
      y: (sy - rect.top - cam.y) / cam.scale,
    };
  }

  // Non-passive wheel: trackpad two-finger scroll → pan, Ctrl+scroll / pinch → zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setCamera((cam) => {
        if (e.ctrlKey || e.metaKey) {
          // Zoom centred on cursor
          const rect = el.getBoundingClientRect();
          const ox = e.clientX - rect.left;
          const oy = e.clientY - rect.top;
          const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
          const newScale = Math.min(4, Math.max(0.25, cam.scale * factor));
          const ratio = newScale / cam.scale;
          return { x: ox - (ox - cam.x) * ratio, y: oy - (oy - cam.y) * ratio, scale: newScale };
        }
        // Pan
        return { ...cam, x: cam.x - e.deltaX, y: cam.y - e.deltaY };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [interactive]);

  // ── Drag state ──────────────────────────────────────────────────────────────
  const drag = useRef<{
    id: string;
    dx: number;
    dy: number;
    mode: "move" | "resize";
    w: number;
    h: number;
  } | null>(null);

  // Measure the canvas div and keep canvas-bounds in sync
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = (entries?: ResizeObserverEntry[]) => {
      const rect = entries?.[0]?.contentRect ?? el.getBoundingClientRect();
      setMeasuredCanvasSize(rect.width, rect.height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shown = (id: string) => !visibleIds || visibleIds.has(id);

  function handleCanvasPointerDown(e: React.PointerEvent) {
    if (!interactive) return;

    // Middle-mouse button → pan
    if (e.button === 1) {
      e.preventDefault();
      const cam = cameraRef.current;
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, camX: cam.x, camY: cam.y };
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (activeTool === "pen") {
      const pt = toCanvas(e.clientX, e.clientY);
      isDrawing.current = true;
      setDrawingPoints([pt]);
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }

    setSelected(null);
  }

  const handleExportPng = async () => {
    if (!wrapRef.current) return;
    const { default: html2canvas } = await import("html2canvas");
    const prevCamera = { ...cameraRef.current };
    setCamera({ x: 0, y: 0, scale: 1 });
    // Two animation frames to ensure DOM has repainted at the new camera
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      const canvas = await html2canvas(wrapRef.current, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#f7f5ef",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `storyboard-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setCamera(prevCamera);
    }
  };

  function onElementPointerDown(e: React.PointerEvent, el: CanvasElement, mode: "move" | "resize") {
    if (!interactive) return;
    if (activeTool === "eraser") {
      onDelete(el.id);
      return;
    }
    if (activeTool !== "select") return;
    // Pinned elements cannot be moved (but can still be selected/deleted)
    if (el.isPinned && mode === "move") return;

    e.preventDefault();
    e.stopPropagation();
    const pt = toCanvas(e.clientX, e.clientY);
    drag.current = {
      id: el.id,
      dx: pt.x - el.x,
      dy: pt.y - el.y,
      mode,
      w: el.w,
      h: el.h,
    };
    setSelected(el.id);
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    // Middle-mouse pan
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setCamera((cam) => ({ ...cam, x: panStart.current.camX + dx, y: panStart.current.camY + dy }));
      return;
    }

    const pt = toCanvas(e.clientX, e.clientY);

    if (isDrawing.current) {
      setDrawingPoints((pts) => [...pts, pt]);
      return;
    }

    const d = drag.current;
    if (!d) return;
    const el = elements.find((x) => x.id === d.id);
    if (!el) return;
    if (d.mode === "move") {
      const { xMin, xMax, yMin, yMax } = getCanvasBounds();
      const clampedX = Math.max(xMin, Math.min(pt.x - d.dx, xMax - el.w));
      const clampedY = Math.max(yMin, Math.min(pt.y - d.dy, yMax - el.h));
      onMove(d.id, clampedX, clampedY);
    } else {
      const { xMax, yMax } = getCanvasBounds();
      const newW = Math.max(48, Math.min(pt.x - el.x, xMax - el.x));
      const newH = Math.max(40, Math.min(pt.y - el.y, yMax - el.y));
      onResize(d.id, newW, newH);
    }
  }

  function endDrag() {
    isPanning.current = false;
    if (isDrawing.current) {
      isDrawing.current = false;
      if (drawingPoints.length > 1 && onAddStroke) {
        onAddStroke(drawingPoints, activeColor);
      }
      setDrawingPoints([]);
    }
    drag.current = null;
  }

  return (
    <div
      ref={wrapRef}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={handleCanvasPointerDown}
      className={`canvas-paper relative h-full w-full overflow-hidden rounded-2xl ${
        isProcessing ? "canvas-processing" : ""
      } ${
        isPanning.current ? "cursor-grabbing" :
        activeTool === "pen" ? "cursor-crosshair" : activeTool === "eraser" ? "cursor-cell" : ""
      }`}
    >
      {/* Camera controls — always visible in top-right */}
      <div className="absolute right-3 top-3 z-50 flex items-center gap-1">
        <button
          onClick={() => setCamera((c) => { const s = Math.max(0.25, c.scale / 1.25); return { ...c, scale: s }; })}
          title="Zoom out"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-chalk/90 text-ink-soft shadow-sketch backdrop-blur-sm hover:text-ink"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setCamera({ x: 0, y: 0, scale: 1 })}
          title="Reset zoom"
          className="rounded-lg border border-border bg-chalk/90 px-2 py-1 font-mono text-[11px] text-ink-soft shadow-sketch backdrop-blur-sm hover:text-ink"
        >
          {Math.round(camera.scale * 100)}%
        </button>
        <button
          onClick={() => setCamera((c) => { const s = Math.min(4, c.scale * 1.25); return { ...c, scale: s }; })}
          title="Zoom in"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-chalk/90 text-ink-soft shadow-sketch backdrop-blur-sm hover:text-ink"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleExportPng}
          title="Export canvas as PNG"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-chalk/90 text-ink-soft shadow-sketch backdrop-blur-sm hover:text-ink"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Camera transform layer — all canvas content lives here */}
      <div
        ref={contentRef}
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {/* Sequence actor lifelines: dashed vertical lines when elements share a top-row Y
               and connectors flow between them horizontally */}
          {(() => {
            if (connectors.length === 0) return null;
            const shownEls = elements.filter((e) => shown(e.id) && !e.isFadingOut);
            if (shownEls.length < 2) return null;
            // Actors = top row: elements whose Y is within 40px of the minimum Y
            const minY = Math.min(...shownEls.map((e) => e.y));
            const actors = shownEls.filter((e) => Math.abs(e.y - minY) < 40);
            if (actors.length < 2) return null;
            // Only draw lifelines if connectors exist between these actors
            const actorIds = new Set(actors.map((e) => e.id));
            const seqConns = connectors.filter(
              (c) => actorIds.has(c.fromId) && actorIds.has(c.toId) && shown(c.id),
            );
            if (seqConns.length === 0) return null;
            const bottomY = Math.max(...shownEls.map((e) => e.y + e.h)) + 30;
            return (
              <g key="lifelines">
                {actors.map((e) => (
                  <line
                    key={e.id + "-life"}
                    x1={e.x + e.w / 2}
                    y1={e.y + e.h}
                    x2={e.x + e.w / 2}
                    y2={bottomY}
                    className="stroke-accent/30"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                  />
                ))}
              </g>
            );
          })()}

          {/* Timeline bar: only drawn when ≥3 elements are in a horizontal row with NO connectors */}
          {(() => {
            if (connectors.length > 0) return null;
            const shownEls = elements.filter((e) => shown(e.id) && !e.isFadingOut);
            if (shownEls.length < 3) return null;
            const midYs = shownEls.map((e) => e.y + e.h / 2);
            const avgMidY = midYs.reduce((s, y) => s + y, 0) / midYs.length;
            if (midYs.some((y) => Math.abs(y - avgMidY) > 20)) return null;
            const xs = shownEls.map((e) => e.x);
            const xes = shownEls.map((e) => e.x + e.w);
            const lineY = Math.max(...shownEls.map((e) => e.y + e.h)) + 14;
            const x1 = Math.min(...xs) - 14;
            const x2 = Math.max(...xes) + 14;
            return (
              <g key="timeline-bar">
                <line x1={x1} y1={lineY} x2={x2} y2={lineY} className="stroke-accent/40" strokeWidth="2" strokeDasharray="4 3" />
                {shownEls.map((e) => (
                  <circle key={e.id + "-tick"} cx={e.x + e.w / 2} cy={lineY} r="3" className="fill-accent/60" />
                ))}
              </g>
            );
          })()}

          {connectors.map((c) => {
            const from = elements.find((e) => e.id === c.fromId);
            const to = elements.find((e) => e.id === c.toId);
            if (!from || !to || !shown(c.id)) return null;
            const { d, mid } = anchorPath(from, to, elements);
            // Truncate long labels so they never overflow the pill
            const rawLabel = c.label ?? "";
            const displayLabel = rawLabel.length > 20 ? rawLabel.slice(0, 19) + "…" : rawLabel;
            const labelW = Math.min(150, Math.max(52, displayLabel.length * 6 + 18));
            const sw = c.style?.thick ? "4" : "2";
            const stroke = c.style?.color ?? "var(--accent)";
            const dash = c.style?.dashed ? "6 4" : undefined;
            const markerId = `sb-arrow${c.style?.color ? `-${c.id}` : ""}`;
            return (
              <g key={c.id} className="animate-draw-on">
                {c.style?.color && (
                  <defs>
                    <marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                      <path d="M1,1 L7,4 L1,7" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </marker>
                  </defs>
                )}
                <path
                  d={d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  markerEnd={`url(#${markerId})`}
                />
                {displayLabel && (
                  <g>
                    <rect
                      x={mid.x - labelW / 2}
                      y={mid.y - 11}
                      width={labelW}
                      height={22}
                      rx={11}
                      className="fill-chalk stroke-border"
                      strokeWidth="1"
                    />
                    <text
                      x={mid.x}
                      y={mid.y + 4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      className="fill-ink"
                    >
                      {displayLabel}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {drawingPoints.length > 1 && (
            <path
              d={drawingPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
              fill="none"
              stroke={activeColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          <defs>
            <marker id="sb-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M1,1 L7,4 L1,7" fill="none" className="stroke-accent" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
        </svg>

        {elements
          .slice()
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
          .map((el) =>
            shown(el.id) ? (
              <ContextMenu.Root key={el.id}>
                <ContextMenu.Trigger asChild>
                  <div
                    onPointerDown={(e) => onElementPointerDown(e, el, "move")}
                    style={{ left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.zIndex ?? 0 }}
                    className={`group absolute select-none ${
                      interactive && activeTool === "select" && !el.isPinned ? "cursor-grab active:cursor-grabbing" : ""
                    } ${selected === el.id ? "ring-2 ring-accent/60 ring-offset-2 ring-offset-[var(--paper)] rounded-xl" : ""} ${
                      el.isFadingOut
                        ? "opacity-0 transition-opacity duration-300"
                        : "animate-reveal transition-all"
                    } ${el.emphasizedAt && Date.now() - el.emphasizedAt < 1000 ? "animate-pulse-glow" : ""}`}
                  >
                    <ElementBody el={el} onUpdateText={onUpdateText} onUpdateLabel={onUpdateLabel} />
                    {/* Pin indicator */}
                    {el.isPinned && (
                      <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-highlight/90 shadow-sketch">
                        <Pin className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                    {interactive && activeTool === "select" && (
                      <>
                        <button
                          aria-label="Delete element"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => onDelete(el.id)}
                          className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-chalk text-ink-soft shadow-sketch group-hover:flex"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        {!el.isPinned && (
                          <span
                            onPointerDown={(e) => onElementPointerDown(e, el, "resize")}
                            className="absolute -bottom-1 -right-1 hidden h-4 w-4 cursor-se-resize rounded-sm border-b-2 border-r-2 border-accent group-hover:block"
                          />
                        )}
                      </>
                    )}
                  </div>
                </ContextMenu.Trigger>
                {interactive && (
                  <ContextMenu.Portal>
                    <ContextMenu.Content
                      className="z-[100] min-w-[160px] overflow-hidden rounded-xl border border-border bg-chalk p-1 shadow-lg"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {onDuplicate && (
                        <ContextMenu.Item
                          onSelect={() => onDuplicate(el.id)}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-secondary"
                        >
                          <CopyPlus className="h-3.5 w-3.5 text-accent" /> Duplicate
                        </ContextMenu.Item>
                      )}
                      {onSetLayer && (
                        <>
                          <ContextMenu.Item
                            onSelect={() => onSetLayer(el.id, "front")}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-secondary"
                          >
                            <BringToFront className="h-3.5 w-3.5 text-accent" /> Bring to Front
                          </ContextMenu.Item>
                          <ContextMenu.Item
                            onSelect={() => onSetLayer(el.id, "back")}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-secondary"
                          >
                            <SendToBack className="h-3.5 w-3.5 text-accent" /> Send to Back
                          </ContextMenu.Item>
                        </>
                      )}
                      {onPin && (
                        <ContextMenu.Item
                          onSelect={() => onPin(el.id, !el.isPinned)}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-secondary"
                        >
                          {el.isPinned
                            ? <><PinOff className="h-3.5 w-3.5 text-accent" /> Unpin</>
                            : <><Pin className="h-3.5 w-3.5 text-accent" /> Pin</>
                          }
                        </ContextMenu.Item>
                      )}
                      <ContextMenu.Separator className="my-1 h-px bg-border" />
                      <ContextMenu.Item
                        onSelect={() => onDelete(el.id)}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive outline-none hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                )}
              </ContextMenu.Root>
            ) : null,
          )}

        {elements.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p className="max-w-sm text-center font-display text-2xl text-ink-soft/50">
              Give an agent access — the canvas builds itself.
            </p>
            <p className="text-center text-sm text-ink-soft/35">
              Ask an agent via WebMCP · or use Voice input · or type a prompt below
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
