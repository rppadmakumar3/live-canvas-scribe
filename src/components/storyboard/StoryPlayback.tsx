import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Beat, CanvasElement, Connector } from "@/lib/storyboard";
import { Canvas } from "./Canvas";

type Props = {
  beats: Beat[];
  elements: CanvasElement[];
  connectors: Connector[];
  onClose: () => void;
};

export function StoryPlayback({ beats, elements, connectors, onClose }: Props) {
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sections = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        });
      },
      { root: scrollRef.current, threshold: 0.6 },
    );
    sections.current.forEach((s) => s && obs.observe(s));
    return () => obs.disconnect();
  }, [beats.length]);

  const visible = new Set<string>();
  beats.slice(0, active + 1).forEach((b) => {
    b.elementIds.forEach((id) => visible.add(id));
    b.connectorIds.forEach((id) => visible.add(id));
  });

  return (
    <div className="fixed inset-0 z-50 bg-[var(--paper)]">
      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-10 flex items-center gap-2 rounded-full border border-border bg-chalk px-4 py-2 text-sm font-medium text-ink shadow-sketch"
      >
        <X className="h-4 w-4" /> Close story
      </button>

      <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_400px]">
        <div className="relative p-6">
          <Canvas
            elements={elements}
            connectors={connectors}
            onMove={() => {}}
            onResize={() => {}}
            onDelete={() => {}}
            interactive={false}
            visibleIds={visible}
          />
        </div>
        <div ref={scrollRef} className="h-full overflow-y-auto border-l border-border px-8">
          <div className="flex h-[40vh] items-end pb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Scroll story
              </p>
              <h2 className="mt-2 font-display text-4xl text-ink">Your narration, replayable.</h2>
              <p className="mt-3 text-sm text-ink-soft">
                Scroll down to step through each beat exactly as it was built.
              </p>
            </div>
          </div>
          {beats.map((b, i) => (
            <div
              key={b.id}
              data-i={i}
              ref={(n) => {
                sections.current[i] = n;
              }}
              className={`flex min-h-[70vh] flex-col justify-center border-t border-border/60 py-10 transition-opacity duration-300 ${
                active === i ? "opacity-100" : "opacity-40"
              }`}
            >
              <span className="font-mono text-xs text-accent">Beat {String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 font-display text-3xl text-ink">{b.label}</h3>
              {b.narration && (
                <p className="mt-4 text-base leading-relaxed text-ink-soft">“{b.narration}”</p>
              )}
              <p className="mt-4 text-xs text-ink-soft/70">
                {b.elementIds.length} elements · {b.connectorIds.length} connectors
              </p>
            </div>
          ))}
          <div className="flex h-[40vh] items-start pt-10">
            <p className="text-sm text-ink-soft">End of story.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
