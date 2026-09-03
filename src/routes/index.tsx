import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Keyboard, Trash2, PlugZap, Undo2, Wrench, X, Sun, Moon, BookOpen, GraduationCap } from "lucide-react";
import { Canvas } from "@/components/storyboard/Canvas";
import { WhiteboardToolbar, type WhiteboardTool } from "@/components/storyboard/WhiteboardToolbar";
import { useStoryboard } from "@/lib/use-storyboard";
import { useSpeech } from "@/lib/use-speech";
import { interpretWithOpenRouter } from "@/lib/openrouter-agent";
import type { StickyColor } from "@/lib/storyboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Whiteboard Live — Give an agent access, watch the canvas build itself" },
      {
        name: "description",
        content:
          "A live whiteboard with 32 WebMCP tools on document.modelContext. Give an agent access and watch it build diagrams, illustrations, and visual scenes directly on the canvas.",
      },
      { property: "og:title", content: "Whiteboard Live — Give an agent access, watch the canvas build itself" },
      {
        property: "og:description",
        content:
          "32 WebMCP tools on document.modelContext. Give an agent access — it builds the canvas live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const sb = useStoryboard();
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [showTyped, setShowTyped] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = useState<WhiteboardTool>("select");
  const [activeTheme, setActiveTheme] = useState<"light" | "dark" | "sepia" | "blackboard">("light");
  const [activeColor, setActiveColor] = useState("#2B6E5C");
  const [activeStickyColor, setActiveStickyColor] = useState<StickyColor>("yellow");

  const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY || "";
  const openRouterModel = import.meta.env.VITE_OPENROUTER_MODEL || "minimax/minimax-m3:free";
  const inFlightRef = useRef(false);

  const handleSegment = useCallback(
    async (text: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setIsProcessing(true);
      try {
        sb.setNarration(text);
        if (openRouterKey.trim()) {
          try {
            await interpretWithOpenRouter(text, sb.tools, {
              apiKey: openRouterKey,
              model: openRouterModel,
            });
          } catch (err) {
            console.warn("[Storyboard Live] OpenRouter failed:", err);
          }
        }
      } finally {
        inFlightRef.current = false;
        setIsProcessing(false);
      }
    },
    [sb, openRouterKey, openRouterModel],
  );

  const speech = useSpeech({ onSegment: handleSegment, onInterim: setInterim });

  // Ctrl+Z / Cmd+Z → undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        sb.undo();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [sb]);

  // Close tools popover on outside click
  useEffect(() => {
    if (!showTools) return;
    const handler = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setShowTools(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTools]);

  const beatCount = sb.state.beats.length;
  const stats = useMemo(
    () => [
      { k: "Elements",   v: sb.state.elements.length },
      { k: "Connectors", v: sb.state.connectors.length },
      { k: "Beats",      v: beatCount },
    ],
    [sb.state.elements.length, sb.state.connectors.length, beatCount],
  );
  void beatCount;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-2xl leading-none text-ink">Whiteboard Live</h1>
          <p className="mt-1 text-xs text-ink-soft">
            Give an agent access — it builds the canvas via WebMCP.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Theme switcher */}
          {([
            { key: "light",      Icon: Sun,           title: "Light (warm paper)",  bg: "#f7f5ef", fg: "#2b2a28" },
            { key: "dark",       Icon: Moon,          title: "Dark mode",            bg: "#1c1c1e", fg: "#f0f0f0" },
            { key: "sepia",      Icon: BookOpen,      title: "Sepia (parchment)",   bg: "#f5e6c8", fg: "#3b2a1a" },
            { key: "blackboard", Icon: GraduationCap, title: "Blackboard",          bg: "#1e3320", fg: "#e8f5e9" },
          ] as const).map(({ key, Icon, title, bg, fg }) => (
            <button
              key={key}
              title={title}
              onClick={() => { sb.setTheme(key); setActiveTheme(key); }}
              style={{ backgroundColor: bg }}
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all hover:scale-110 ${
                activeTheme === key ? "border-accent shadow-md scale-110" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: fg }} />
            </button>
          ))}

          <div className="h-5 w-px bg-border" />

          {/* WebMCP tools badge */}
          <div ref={toolsRef} className="relative">
            <button
              onClick={() => setShowTools((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                sb.toolsReady
                  ? "border-accent/30 bg-accent/10 text-accent hover:bg-accent/20"
                  : "border-border bg-muted text-ink-soft"
              }`}
            >
              {sb.toolsReady ? <PlugZap className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
              {sb.toolsManifest.length > 0 ? `${sb.toolsManifest.length} WebMCP Tools` : "WebMCP ready"}
            </button>

            {showTools && sb.toolsManifest.length > 0 && (
              <div className="absolute left-0 top-full z-[500] mt-2 w-80 rounded-2xl border border-border bg-chalk shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">WebMCP Tools</p>
                    <p className="text-[11px] text-ink-soft">{sb.toolsManifest.length} tools registered</p>
                  </div>
                  <button onClick={() => setShowTools(false)} className="text-ink-soft hover:text-ink">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ul className="max-h-80 overflow-y-auto py-2">
                  {sb.toolsManifest.map((t) => (
                    <li key={t.name} className="px-4 py-2 hover:bg-secondary/60">
                      <p className="font-mono text-[11px] font-semibold text-accent">{t.name}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{t.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-border" />

          <button
            onClick={speech.listening ? speech.stop : speech.start}
            disabled={isProcessing && !speech.listening}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sketch transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed ${
              speech.listening
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isProcessing ? "Drawing…" : speech.listening ? "Stop" : "Voice input"}
          </button>
        </div>
      </header>

      <main className="grid gap-4 p-4 lg:grid-cols-[1fr_380px]">
        <section className="flex flex-col gap-3">
          <div className="flex flex-col h-[74vh] min-h-[520px] gap-2">
            <WhiteboardToolbar
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              activeColor={activeColor}
              onSelectColor={setActiveColor}
              activeStickyColor={activeStickyColor}
              onSelectStickyColor={setActiveStickyColor}
              onAddSticky={() => sb.addStickyNote("Note", activeStickyColor)}
              onAddSketch={(template) => sb.addSketch(template)}
              onAddHighlight={() => sb.addHighlight()}
              onAddFrame={() => sb.addFrame("Group Frame", sb.state.elements.map((e) => e.id))}
              onUploadImage={(dataUrl) => sb.addImage(dataUrl)}
              onAddText={() => sb.tools.addTextBlock("Label")}
              onAddShape={(type) => sb.tools.addShape({ shapeType: type })}
            />

            <div className="relative flex-1 min-h-0">
              <Canvas
                elements={sb.state.elements}
                connectors={sb.state.connectors}
                onMove={sb.moveElement}
                onResize={sb.resizeElement}
                onDelete={sb.deleteElement}
                onUpdateText={sb.updateElementText}
                onUpdateLabel={sb.updateElementLabel}
                onAddStroke={(pts, col) => sb.addStroke(pts, col)}
                onDuplicate={(id) => sb.tools.duplicateElement(id)}
                onPin={(id, pinned) => sb.tools.pinElement(id, pinned)}
                onSetLayer={(id, dir) => sb.setLayerOrder(id, dir)}
                activeTool={activeTool}
                activeColor={activeColor}
                isProcessing={isProcessing}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-chalk p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
                {speech.listening ? "Listening" : "Prompt"}
              </p>
              <div className="flex items-center gap-2">
                {speech.listening && (
                  <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-destructive" />
                )}
                <button
                  onClick={() => setShowTyped((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink"
                >
                  <Keyboard className="h-3.5 w-3.5" /> Typed fallback
                </button>
                <button
                  onClick={() => sb.undo()}
                  title="Undo (Ctrl+Z)"
                  className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Undo
                </button>
                <button
                  onClick={sb.clearAll}
                  className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </button>
              </div>
            </div>
            <p className="mt-2 min-h-6 font-display text-lg text-ink">
              {interim || <span className="text-ink-soft/60">…</span>}
            </p>
            {speech.error && <p className="mt-1 text-xs text-destructive">{speech.error}</p>}
            {!speech.supported && (
              <p className="mt-1 text-xs text-ink-soft">
                This browser has no Web Speech API — use the typed fallback.
              </p>
            )}
            {showTyped && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!typed.trim()) return;
                  setInterim(typed);
                  handleSegment(typed.trim());
                  setTyped("");
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Describe what to draw…"
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Send
                </button>
              </form>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.k} className="rounded-xl border border-border bg-chalk p-3 text-center">
                <p className="font-display text-2xl text-ink">{s.v}</p>
                <p className="text-[11px] uppercase tracking-wide text-ink-soft">{s.k}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-chalk p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
              Story beats
            </h2>
            <ol className="mt-3 space-y-2">
              {sb.state.beats.map((b, i) => (
                <li key={b.id} className="rounded-lg border border-border/70 px-3 py-2">
                  <span className="font-mono text-[11px] text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-sm font-medium text-ink">{b.label}</p>
                </li>
              ))}
              {!beatCount && <p className="text-sm text-ink-soft">No beats yet.</p>}
            </ol>
          </div>

          <div className="rounded-2xl border border-border bg-chalk p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
              Tool call log
            </h2>
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
              {sb.log.map((l) => (
                <li key={l.id} className="text-xs leading-snug">
                  <span className="font-mono text-accent">{l.name}</span>{" "}
                  <span className="text-ink-soft">{l.detail}</span>
                </li>
              ))}
              {!sb.log.length && <p className="text-sm text-ink-soft">Waiting for the agent…</p>}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
