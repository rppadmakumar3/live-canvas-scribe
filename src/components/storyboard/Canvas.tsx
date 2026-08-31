import { useRef, useState } from "react";
import { X } from "lucide-react";
import { centerOf, type CanvasElement, type Connector } from "@/lib/storyboard";
import { ElementBody } from "./CanvasElementView";

type Props = {
  elements: CanvasElement[];
  connectors: Connector[];
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
  interactive?: boolean;
  visibleIds?: Set<string> | null;
};

function anchorPath(from: CanvasElement, to: CanvasElement) {
  const a = centerOf(from);
  const b = centerOf(to);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - Math.abs(b.x - a.x) * 0.12 - 24;
  return { d: `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`, mid: { x: mx, y: my + 12 } };
}

export function Canvas({
  elements,
  connectors,
  onMove,
  onResize,
  onDelete,
  interactive = true,
  visibleIds = null,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; mode: "move" | "resize"; w: number; h: number } | null>(
    null,
  );

  const shown = (id: string) => !visibleIds || visibleIds.has(id);

  function onPointerDown(e: React.PointerEvent, el: CanvasElement, mode: "move" | "resize") {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = wrapRef.current!.getBoundingClientRect();
    drag.current = {
      id: el.id,
      dx: e.clientX - rect.left - el.x,
      dy: e.clientY - rect.top - el.y,
      mode,
      w: el.w,
      h: el.h,
    };
    setSelected(el.id);
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const el = elements.find((x) => x.id === d.id);
    if (!el) return;
    if (d.mode === "move") onMove(d.id, Math.max(0, px - d.dx), Math.max(0, py - d.dy));
    else onResize(d.id, px - el.x, py - el.y);
  }

  function endDrag() {
    drag.current = null;
  }

  return (
    <div
      ref={wrapRef}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={() => setSelected(null)}
      className="canvas-paper relative h-full w-full overflow-hidden rounded-2xl"
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {connectors.map((c) => {
          const from = elements.find((e) => e.id === c.fromId);
          const to = elements.find((e) => e.id === c.toId);
          if (!from || !to || !shown(c.id)) return null;
          const { d, mid } = anchorPath(from, to);
          return (
            <g key={c.id} className="animate-draw-on">
              <path
                d={d}
                fill="none"
                className="stroke-accent"
                strokeWidth="3"
                strokeLinecap="round"
                markerEnd="url(#sb-arrow)"
              />
              {c.label && (
                <text
                  x={mid.x}
                  y={mid.y}
                  textAnchor="middle"
                  className="fill-ink-soft text-[13px] font-semibold"
                  style={{ paintOrder: "stroke", stroke: "var(--paper)", strokeWidth: 6 }}
                >
                  {c.label}
                </text>
              )}
            </g>
          );
        })}
        <defs>
          <marker id="sb-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" className="fill-accent" />
          </marker>
        </defs>
      </svg>

      {elements.map((el) =>
        shown(el.id) ? (
          <div
            key={el.id}
            onPointerDown={(e) => onPointerDown(e, el, "move")}
            style={{ left: el.x, top: el.y, width: el.w, height: el.h }}
            className={`group absolute animate-reveal select-none ${
              interactive ? "cursor-grab active:cursor-grabbing" : ""
            } ${selected === el.id ? "ring-2 ring-accent/60 ring-offset-2 ring-offset-[var(--paper)] rounded-xl" : ""}`}
          >
            <ElementBody el={el} />
            {interactive && (
              <>
                <button
                  aria-label="Delete element"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onDelete(el.id)}
                  className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-chalk text-ink-soft shadow-sketch group-hover:flex"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <span
                  onPointerDown={(e) => onPointerDown(e, el, "resize")}
                  className="absolute -bottom-1 -right-1 hidden h-4 w-4 cursor-se-resize rounded-sm border-b-2 border-r-2 border-accent group-hover:block"
                />
              </>
            )}
          </div>
        ) : null,
      )}

      {elements.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="max-w-sm text-center font-display text-2xl text-ink-soft/60">
            The canvas fills itself while you talk.
          </p>
        </div>
      )}
    </div>
  );
}
