import { useEffect, useRef, useState } from "react";
import {
  Sun,
  Cloud,
  Droplet,
  Waves,
  Wind,
  Mountain,
  Leaf,
  Flame,
  Star,
  Lightbulb,
  Users,
  Database,
  ImageIcon,
  type LucideIcon,
} from "lucide-react";
import katex from "katex";
import { STICKY_COLORS, type CanvasElement } from "@/lib/storyboard";
import { drawRoughSketch } from "@/lib/rough-sketch";
import manifestJson from "@/assets/manifest.json";

const ICONS: Record<string, LucideIcon> = {
  sun: Sun,
  cloud: Cloud,
  droplet: Droplet,
  waves: Waves,
  wind: Wind,
  mountain: Mountain,
  leaf: Leaf,
  flame: Flame,
  star: Star,
  lightbulb: Lightbulb,
  users: Users,
  database: Database,
};

export function ElementBody({
  el,
  onUpdateText,
  onUpdateLabel,
}: {
  el: CanvasElement;
  onUpdateText?: (id: string, text: string) => void;
  onUpdateLabel?: (id: string, label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(el.text ?? el.label ?? el.frameLabel ?? el.latex ?? "");
  const svgSketchRef = useRef<SVGSVGElement>(null);
  const mathRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (el.kind === "sketch" && svgSketchRef.current) {
      drawRoughSketch(
        svgSketchRef.current,
        el.template || "rough-box",
        el.w,
        el.h,
        el.points,
        el.color || "#2B2A28",
      );
    }
  }, [el.kind, el.template, el.w, el.h, el.points, el.color]);

  useEffect(() => {
    if (el.kind === "math" && mathRef.current) {
      try {
        const html = katex.renderToString(el.latex || el.text || "", {
          throwOnError: false,
          displayMode: true,
        });
        mathRef.current.innerHTML = html;
      } catch (err) {
        mathRef.current.innerText = el.latex || el.text || "";
      }
    }
  }, [el.kind, el.latex, el.text]);

  const handleBlur = () => {
    setEditing(false);
    if ((el.kind === "text" || el.kind === "sticky" || el.kind === "math") && onUpdateText) {
      onUpdateText(el.id, val);
    } else if (onUpdateLabel) {
      onUpdateLabel(el.id, val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    }
  };

  if (editing) {
    return (
      <div
        className="flex h-full w-full items-center justify-center p-1"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{ fontFamily: "var(--font-handwritten)" }}
          className="w-full rounded border border-accent bg-chalk px-2 py-1 text-center text-sm text-ink outline-none"
        />
      </div>
    );
  }

  if (el.kind === "callout") {
    return (
      <div
        onDoubleClick={() => { setVal(el.text ?? ""); setEditing(true); }}
        title="Double-click to edit callout"
        className="relative flex h-full w-full flex-col items-center justify-start"
      >
        {/* Bubble */}
        <div
          style={{ fontFamily: "var(--font-handwritten)" }}
          className="relative z-10 mt-1 flex-1 w-full flex items-center justify-center rounded-2xl border-2 border-accent bg-chalk px-3 py-2 text-center text-sm font-semibold text-ink leading-snug shadow-sketch"
        >
          {el.text}
        </div>
        {/* Tail — pointing down-left */}
        <svg
          viewBox="0 0 40 20"
          className="absolute bottom-0 left-6 h-5 w-8"
          style={{ transform: "translateY(80%)" }}
        >
          <polygon
            points="0,0 20,0 4,18"
            fill="var(--chalk)"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (el.kind === "sketch") {
    return <svg ref={svgSketchRef} className="h-full w-full pointer-events-none" />;
  }

  if (el.kind === "code") {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#1e1e2e] shadow-sketch">
        {/* Title bar */}
        <div className="flex shrink-0 items-center gap-1.5 border-b border-slate-700 px-3 py-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          {el.codeLanguage && (
            <span className="ml-auto font-mono text-[10px] text-slate-400 uppercase tracking-wider">
              {el.codeLanguage}
            </span>
          )}
        </div>
        {/* Code content */}
        <pre
          onDoubleClick={() => {
            setVal(el.text ?? "");
            setEditing(true);
          }}
          title="Double-click to edit code"
          className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed text-slate-200"
        >
          <code>{el.text}</code>
        </pre>
      </div>
    );
  }

  if (el.kind === "illustration") {
    // SVG inline illustration
    if (el.svgContent) {
      return (
        <div
          onDoubleClick={() => {
            setVal(el.label ?? "");
            setEditing(true);
          }}
          title={el.label ?? el.semantic ?? "illustration"}
          className="flex h-full w-full flex-col items-center justify-center gap-1 p-1"
        >
          <div
            className="flex-1 w-full flex items-center justify-center"
            // SVG content is sanitized at the asset-resolver level
            dangerouslySetInnerHTML={{ __html: el.svgContent }}
          />
          {el.label && (
            <span
              style={{ fontFamily: "var(--font-handwritten)" }}
              className="shrink-0 text-sm font-semibold text-ink-soft text-center px-1"
            >
              {el.label}
            </span>
          )}
        </div>
      );
    }

    // Emoji fallback (when SVG couldn't be resolved)
    if (el.emoji) {
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-1"
          title={el.label ?? el.semantic}
        >
          <span className="leading-none drop-shadow-md" style={{ fontSize: "min(64px, 52%)" }}>
            {el.emoji}
          </span>
          {el.label && (
            <span
              style={{ fontFamily: "var(--font-handwritten)" }}
              className="text-sm font-semibold text-ink-soft"
            >
              {el.label}
            </span>
          )}
        </div>
      );
    }

    // Generic icon fallback using semantic name
    const FallbackIcon = ICONS[el.semantic ?? el.iconName ?? "star"] ?? Star;
    return (
      <div
        onDoubleClick={() => {
          setVal(el.label ?? "");
          setEditing(true);
        }}
        className="flex h-full w-full flex-col items-center justify-center gap-1 p-2"
      >
        <FallbackIcon className="h-1/2 w-1/2 text-accent" strokeWidth={1.4} />
        {el.label && (
          <span
            style={{ fontFamily: "var(--font-handwritten)" }}
            className="text-sm font-semibold text-ink-soft"
          >
            {el.label}
          </span>
        )}
      </div>
    );
  }

  if (el.kind === "math") {
    return (
      <div
        onDoubleClick={() => {
          setVal(el.latex ?? el.text ?? "");
          setEditing(true);
        }}
        title="Double-click to edit math formula"
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-chalk/90 p-3 shadow-sketch"
      >
        <div ref={mathRef} className="text-ink" />
      </div>
    );
  }

  if (el.kind === "image") {
    const manifestSrc = (manifestJson as Record<string, string>)[el.source || ""] || el.source;
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-chalk/80 shadow-sketch">
        {manifestSrc ? (
          <img
            src={manifestSrc}
            alt="whiteboard image"
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-ink-soft">
            <ImageIcon className="h-8 w-8 text-accent" />
            <span className="text-xs">{el.source}</span>
          </div>
        )}
      </div>
    );
  }

  if (el.kind === "highlight") {
    return (
      <div className="h-full w-full rounded-2xl border-2 border-dashed border-accent-highlight/60 bg-accent-highlight/20 pointer-events-none transition-all" />
    );
  }

  if (el.kind === "frame") {
    return (
      <div className="relative flex h-full w-full flex-col rounded-3xl border-2 border-dashed border-accent/70 bg-accent/5 p-3">
        <div
          style={{ fontFamily: "var(--font-handwritten)" }}
          className="absolute -top-3.5 left-4 rounded-md border border-accent/40 bg-chalk px-2 py-0.5 text-sm font-bold text-accent shadow-sketch"
        >
          {el.frameLabel || "Group Frame"}
        </div>
      </div>
    );
  }

  if (el.kind === "sticky") {
    const sc = STICKY_COLORS[el.stickyColor ?? "amber"] || STICKY_COLORS.amber;
    return (
      <div
        onDoubleClick={() => {
          setVal(el.text ?? "");
          setEditing(true);
        }}
        title="Double-click to edit sticky note"
        style={{
          backgroundColor: sc.bg,
          borderColor: sc.border,
          color: sc.text,
          fontFamily: "var(--font-handwritten)",
        }}
        className="flex h-full w-full flex-col justify-between rounded-xl border-2 p-3 text-lg leading-snug shadow-sketch select-none overflow-hidden"
      >
        <p className="whitespace-pre-wrap break-words font-semibold">{el.text}</p>
        <span className="self-end text-[10px] opacity-40 font-mono">sticky</span>
      </div>
    );
  }

  if (el.kind === "stroke" && el.points && el.points.length > 0) {
    const d = el.points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x - el.x} ${p.y - el.y}`)
      .join(" ");
    return (
      <svg viewBox={`0 0 ${el.w} ${el.h}`} className="h-full w-full pointer-events-none">
        <path
          d={d}
          fill="none"
          stroke={el.color || "#2B2A28"}
          strokeWidth={el.strokeWidth || 3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (el.kind === "text") {
    const style = el.textStyle || {};
    const sizeClass =
      style.size === "small"
        ? "text-lg"
        : style.size === "large"
          ? "text-4xl font-bold"
          : "text-2.5xl";

    return (
      <div
        onDoubleClick={() => {
          setVal(el.text ?? "");
          setEditing(true);
        }}
        title="Double-click to edit text"
        style={{
          color: style.color || "var(--ink)",
          fontFamily: "var(--font-handwritten)",
        }}
        className={`flex h-full w-full items-center px-3 text-left leading-tight ${sizeClass} ${
          style.bold ? "font-bold" : ""
        }`}
      >
        {el.text}
      </div>
    );
  }

  if (el.kind === "emoji") {
    return (
      <div
        onDoubleClick={() => {
          setVal(el.label ?? "");
          setEditing(true);
        }}
        title="Double-click to edit label"
        className="flex h-full w-full flex-col items-center justify-center gap-1"
      >
        <span className="leading-none drop-shadow-md" style={{ fontSize: "min(64px, 50%)" }}>
          {el.emoji}
        </span>
        {el.label && (
          <span
            style={{ fontFamily: "var(--font-handwritten)" }}
            className="text-sm font-semibold text-ink-soft"
          >
            {el.label}
          </span>
        )}
      </div>
    );
  }

  if (el.shapeType === "icon") {
    const Icon = ICONS[el.iconName ?? "star"] ?? Star;
    return (
      <div
        onDoubleClick={() => {
          setVal(el.label ?? "");
          setEditing(true);
        }}
        title="Double-click to edit label"
        className="flex h-full w-full flex-col items-center justify-center gap-1"
      >
        <Icon className="h-1/2 w-1/2 text-accent" strokeWidth={1.6} />
        {el.label && (
          <span
            style={{ fontFamily: "var(--font-handwritten)" }}
            className="text-sm font-semibold text-ink-soft"
          >
            {el.label}
          </span>
        )}
      </div>
    );
  }

  if (el.shapeType === "triangle") {
    return (
      <div
        onDoubleClick={() => {
          setVal(el.label ?? "");
          setEditing(true);
        }}
        title="Right Triangle (a² + b² = c²)"
        className="relative flex h-full w-full flex-col items-center justify-center p-1"
      >
        <svg viewBox="0 0 160 140" className="h-full w-full drop-shadow-sm">
          <polygon
            points="25,115 135,115 135,25"
            className="fill-chalk stroke-ink"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M 120 115 L 120 100 L 135 100"
            className="fill-none stroke-accent"
            strokeWidth="2.5"
          />
          <text
            x="75"
            y="133"
            className="fill-ink text-sm font-bold"
            style={{ fontFamily: "var(--font-handwritten)" }}
          >
            a
          </text>
          <text
            x="142"
            y="75"
            className="fill-ink text-sm font-bold"
            style={{ fontFamily: "var(--font-handwritten)" }}
          >
            b
          </text>
          <text
            x="68"
            y="62"
            className="fill-accent-highlight text-sm font-bold"
            style={{ fontFamily: "var(--font-handwritten)" }}
          >
            c
          </text>
        </svg>
        {el.label && (
          <span
            style={{ fontFamily: "var(--font-handwritten)" }}
            className="text-xs font-semibold text-accent"
          >
            {el.label}
          </span>
        )}
      </div>
    );
  }

  if (el.shapeType === "arrow") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <svg viewBox="0 0 120 40" className="h-full w-full">
          <path
            d="M6 20 H100"
            className="stroke-ink"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M96 10 L114 20 L96 30 Z" className="fill-ink" />
        </svg>
      </div>
    );
  }

  if (el.shapeType === "flowchart") {
    const isProcess = el.nodeType === "process";
    const isDecision = el.nodeType === "decision";
    const isStartEnd = el.nodeType === "start_end";
    const isIO = el.nodeType === "input_output";

    let svgContent = null;
    if (isProcess) {
      svgContent = (
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="4"
          className="stroke-ink"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          style={{ fill: el.fillColor || "var(--chalk)", transition: "fill 500ms ease" }}
        />
      );
    } else if (isDecision) {
      svgContent = (
        <polygon
          points="50,4 96,50 50,96 4,50"
          className="stroke-ink"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          style={{ fill: el.fillColor || "var(--chalk)", transition: "fill 500ms ease" }}
        />
      );
    } else if (isStartEnd) {
      svgContent = (
        <rect
          x="4"
          y="15"
          width="92"
          height="70"
          rx="35"
          className="stroke-ink"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          style={{ fill: el.fillColor || "var(--chalk)", transition: "fill 500ms ease" }}
        />
      );
    } else if (isIO) {
      svgContent = (
        <polygon
          points="20,4 96,4 80,96 4,96"
          className="stroke-ink"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          style={{ fill: el.fillColor || "var(--chalk)", transition: "fill 500ms ease" }}
        />
      );
    }

    return (
      <div
        onDoubleClick={() => {
          setVal(el.label ?? "");
          setEditing(true);
        }}
        title="Double-click to edit label"
        className="relative flex h-full w-full items-center justify-center p-1 drop-shadow-sm"
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full p-1"
        >
          {svgContent}
        </svg>
        <span
          style={{ fontFamily: "var(--font-handwritten)" }}
          className="relative z-10 text-base font-semibold text-ink px-4 text-center"
        >
          {el.label}
        </span>
      </div>
    );
  }

  const rounded = el.shapeType === "circle" ? "rounded-full" : "rounded-xl";
  return (
    <div
      onDoubleClick={() => {
        setVal(el.label ?? "");
        setEditing(true);
      }}
      title="Double-click to edit label"
      style={{
        backgroundColor: el.fillColor || "var(--chalk)",
        transition: "background-color 500ms ease",
      }}
      className={`flex h-full w-full items-center justify-center border-2 border-ink px-3 text-center shadow-sketch ${rounded}`}
    >
      <span
        style={{ fontFamily: "var(--font-handwritten)" }}
        className="text-base font-semibold text-ink"
      >
        {el.label}
      </span>
    </div>
  );
}
