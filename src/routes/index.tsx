import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { Mic, MicOff, Keyboard, Play, Trash2, Wand2, Plug, PlugZap } from "lucide-react";
import { Canvas } from "@/components/storyboard/Canvas";
import { StoryPlayback } from "@/components/storyboard/StoryPlayback";
import { useStoryboard } from "@/lib/use-storyboard";
import { useSpeech } from "@/lib/use-speech";
import { interpretSegment } from "@/lib/narration-agent";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Storyboard Live — Narrate, and the canvas draws itself" },
      {
        name: "description",
        content:
          "Speak your explanation and watch an agent build the diagram live: text, shapes and labeled connectors, then replay it as a scroll-driven story.",
      },
      { property: "og:title", content: "Storyboard Live — Narrate, and the canvas draws itself" },
      {
        property: "og:description",
        content:
          "A live canvas that fills itself while you present. Voice in, diagram out, scroll-story replay after.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const DEMO_SCRIPT = [
  "Let's talk about the water cycle. The sun heats up water in the ocean, causing evaporation.",
  "That water vapor rises and cools, forming clouds — condensation.",
  "Then it falls back down as rain — precipitation.",
];

function Index() {
  const sb = useStoryboard();
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [showTyped, setShowTyped] = useState(false);
  const [story, setStory] = useState(false);

  const handleSegment = useCallback(
    (text: string) => {
      sb.setNarration(text);
      interpretSegment(text, sb.tools);
    },
    [sb],
  );

  const speech = useSpeech({ onSegment: handleSegment, onInterim: setInterim });

  const runDemo = useCallback(() => {
    DEMO_SCRIPT.forEach((line, i) =>
      setTimeout(() => {
        setInterim(line);
        handleSegment(line);
        if (i === DEMO_SCRIPT.length - 1) setTimeout(() => setInterim(""), 900);
      }, i * 1400),
    );
  }, [handleSegment]);

  const beatCount = sb.state.beats.length;
  const stats = useMemo(
    () => [
      { k: "Elements", v: sb.state.elements.length },
      { k: "Connectors", v: sb.state.connectors.length },
      { k: "Beats", v: beatCount },
    ],
    [sb.state.elements.length, sb.state.connectors.length, beatCount],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-2xl leading-none text-ink">Storyboard Live</h1>
          <p className="mt-1 text-xs text-ink-soft">
            Narrate. The agent fills the canvas while you speak.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium ${
              sb.toolsReady ? "bg-accent/10 text-accent" : "bg-muted text-ink-soft"
            }`}
          >
            {sb.toolsReady ? <PlugZap className="h-3.5 w-3.5" /> : <Plug className="h-3.5 w-3.5" />}
            {sb.toolsReady ? "WebMCP tools registered" : "WebMCP bridge ready (6 tools)"}
          </span>
          <button
            onClick={speech.listening ? speech.stop : speech.start}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sketch transition-transform hover:-translate-y-0.5 ${
              speech.listening
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {speech.listening ? "Stop narrating" : "Start narrating"}
          </button>
          <button
            onClick={runDemo}
            className="flex items-center gap-2 rounded-full border border-border bg-chalk px-4 py-2 text-sm font-medium text-ink shadow-sketch"
          >
            <Wand2 className="h-4 w-4" /> Run demo script
          </button>
          <button
            disabled={!beatCount}
            onClick={() => setStory(true)}
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sketch disabled:opacity-40"
          >
            <Play className="h-4 w-4" /> Preview as story
          </button>
        </div>
      </header>

      <main className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-3">
          <div className="h-[62vh] min-h-[420px]">
            <Canvas
              elements={sb.state.elements}
              connectors={sb.state.connectors}
              onMove={sb.moveElement}
              onResize={sb.resizeElement}
              onDelete={sb.deleteElement}
            />
          </div>

          <div className="rounded-2xl border border-border bg-chalk p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
                {speech.listening ? "Listening" : "Narration"}
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
                  placeholder="Type a narration segment…"
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

      {story && (
        <StoryPlayback
          beats={sb.state.beats}
          elements={sb.state.elements}
          connectors={sb.state.connectors}
          onClose={() => setStory(false)}
        />
      )}
    </div>
  );
}
