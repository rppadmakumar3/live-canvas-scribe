import { useRef, useState } from "react";
import {
  Pointer,
  Pencil,
  Eraser,
  StickyNote,
  Highlighter,
  Circle,
  Square,
  BoxSelect,
  Upload,
  Type,
  HelpCircle,
  X,
} from "lucide-react";
import {
  COLOR_PALETTE,
  STICKY_COLORS,
  type StickyColor,
  type SketchTemplate,
} from "@/lib/storyboard";

export type WhiteboardTool = "select" | "pen" | "eraser" | "sticky";

const SHORTCUTS = [
  { keys: "Ctrl + Z", action: "Undo last change" },
  { keys: "Space + Drag", action: "Pan canvas" },
  { keys: "Middle mouse", action: "Pan canvas" },
  { keys: "Ctrl + Scroll", action: "Zoom in / out" },
  { keys: "Double-click", action: "Edit text / label" },
  { keys: "Right-click", action: "Context menu (duplicate, pin…)" },
  { keys: "× button", action: "Delete element (hover to reveal)" },
  { keys: "↔ handle", action: "Resize element" },
];

type Props = {
  activeTool: WhiteboardTool;
  onSelectTool: (t: WhiteboardTool) => void;
  activeColor: string;
  onSelectColor: (hex: string) => void;
  activeStickyColor: StickyColor;
  onSelectStickyColor: (sc: StickyColor) => void;
  onAddSticky: () => void;
  onAddSketch: (template: SketchTemplate) => void;
  onAddHighlight: () => void;
  onAddFrame: () => void;
  onUploadImage: (dataUrl: string) => void;
  onAddText: () => void;
  onAddShape: (type: "circle" | "rectangle") => void;
};

export function WhiteboardToolbar({
  activeTool,
  onSelectTool,
  activeColor,
  onSelectColor,
  activeStickyColor,
  onSelectStickyColor,
  onAddSticky,
  onAddSketch,
  onAddHighlight,
  onAddFrame,
  onUploadImage,
  onAddText,
  onAddShape,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        onUploadImage(evt.target.result as string);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="relative flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-chalk/90 p-2 shadow-sketch backdrop-blur-md">
      {/* Mode tools */}
      <button onClick={() => onSelectTool("select")} title="Select / Move (S)" className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${activeTool === "select" ? "bg-primary text-primary-foreground" : "text-ink-soft hover:bg-secondary hover:text-ink"}`}>
        <Pointer className="h-4 w-4" />
      </button>
      <button onClick={() => onSelectTool("pen")} title="Freehand Pen (P)" className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${activeTool === "pen" ? "bg-primary text-primary-foreground" : "text-ink-soft hover:bg-secondary hover:text-ink"}`}>
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={() => onSelectTool("eraser")} title="Eraser (E)" className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${activeTool === "eraser" ? "bg-primary text-primary-foreground" : "text-ink-soft hover:bg-secondary hover:text-ink"}`}>
        <Eraser className="h-4 w-4" />
      </button>

      <div className="h-5 w-px bg-border mx-1" />

      {/* Quick insert */}
      <button onClick={onAddText} title="Add Text block" className="flex h-9 items-center gap-1 rounded-xl border border-border px-2.5 text-xs font-semibold text-ink shadow-sketch hover:bg-secondary">
        <Type className="h-4 w-4 text-accent" /> Text
      </button>
      <button onClick={() => onAddShape("circle")} title="Add Circle" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-ink-soft shadow-sketch hover:bg-secondary hover:text-ink">
        <Circle className="h-4 w-4" />
      </button>
      <button onClick={() => onAddShape("rectangle")} title="Add Rectangle" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-ink-soft shadow-sketch hover:bg-secondary hover:text-ink">
        <Square className="h-4 w-4" />
      </button>
      <button onClick={onAddSticky} title="Add Sticky Note" className="flex h-9 items-center gap-1 rounded-xl border border-border px-2.5 text-xs font-semibold text-ink shadow-sketch hover:bg-secondary">
        <StickyNote className="h-4 w-4 text-accent" /> Note
      </button>
      <button onClick={onAddHighlight} title="Add Highlight" className="flex h-9 items-center gap-1 rounded-xl border border-border px-2.5 text-xs font-semibold text-ink shadow-sketch hover:bg-secondary">
        <Highlighter className="h-4 w-4 text-accent-highlight" /> Highlight
      </button>
      <button onClick={onAddFrame} title="Add Group Frame" className="flex h-9 items-center gap-1 rounded-xl border border-border px-2.5 text-xs font-semibold text-ink shadow-sketch hover:bg-secondary">
        <BoxSelect className="h-4 w-4 text-accent" /> Frame
      </button>

      {/* Sketch dropdown */}
      <select onChange={(e) => { if (e.target.value) { onAddSketch(e.target.value as SketchTemplate); e.target.value = ""; } }} defaultValue="" className="h-9 rounded-xl border border-border bg-chalk px-2 text-xs font-semibold text-ink outline-none hover:bg-secondary cursor-pointer">
        <option value="" disabled>✏️ Sketch…</option>
        <option value="rough-circle">Rough Circle</option>
        <option value="rough-box">Rough Box</option>
        <option value="rough-arrow">Rough Arrow</option>
        <option value="squiggle-underline">Squiggle</option>
      </select>

      {/* Image upload */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      <button onClick={() => fileInputRef.current?.click()} title="Upload Image" className="flex h-9 items-center gap-1 rounded-xl border border-border px-2.5 text-xs font-semibold text-ink shadow-sketch hover:bg-secondary">
        <Upload className="h-4 w-4 text-ink-soft" /> Image
      </button>

      <div className="h-5 w-px bg-border mx-1" />

      {/* Color palette */}
      <div className="flex items-center gap-1">
        {COLOR_PALETTE.map((c) => (
          <button key={c.hex} onClick={() => onSelectColor(c.hex)} title={c.name} style={{ backgroundColor: c.hex }} className={`h-5 w-5 rounded-full border border-black/10 transition-transform hover:scale-110 ${activeColor === c.hex ? "ring-2 ring-accent ring-offset-2 ring-offset-[var(--paper)]" : ""}`} />
        ))}
      </div>

      <div className="h-5 w-px bg-border mx-1" />

      {/* Sticky colors */}
      <div className="flex items-center gap-1">
        {(["amber", "teal", "coral"] as StickyColor[]).map((sc) => (
          <button key={sc} onClick={() => onSelectStickyColor(sc)} title={`Sticky: ${sc}`} style={{ backgroundColor: STICKY_COLORS[sc].bg }} className={`h-5 w-5 rounded border border-black/10 transition-transform hover:scale-110 ${activeStickyColor === sc ? "ring-2 ring-accent ring-offset-2 ring-offset-[var(--paper)]" : ""}`} />
        ))}
      </div>

      <div className="h-5 w-px bg-border mx-1" />

      {/* Keyboard shortcuts */}
      <div className="relative">
        <button onClick={() => setShowShortcuts((v) => !v)} title="Keyboard shortcuts" className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${showShortcuts ? "bg-primary text-primary-foreground" : "text-ink-soft hover:bg-secondary hover:text-ink"}`}>
          <HelpCircle className="h-4 w-4" />
        </button>
        {showShortcuts && (
          <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-chalk p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Shortcuts</span>
              <button onClick={() => setShowShortcuts(false)} className="text-ink-soft hover:text-ink"><X className="h-3.5 w-3.5" /></button>
            </div>
            <ul className="space-y-2">
              {SHORTCUTS.map((s) => (
                <li key={s.keys} className="flex items-center justify-between gap-3">
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-ink whitespace-nowrap">{s.keys}</span>
                  <span className="text-right text-[11px] text-ink-soft">{s.action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
