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
  type LucideIcon,
} from "lucide-react";
import type { CanvasElement } from "@/lib/storyboard";

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

export function ElementBody({ el }: { el: CanvasElement }) {
  if (el.kind === "text") {
    return (
      <div className="flex h-full w-full items-center px-3 text-left font-display text-2xl leading-tight text-ink">
        {el.text}
      </div>
    );
  }

  if (el.shapeType === "icon") {
    const Icon = ICONS[el.iconName ?? "star"] ?? Star;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1">
        <Icon className="h-1/2 w-1/2 text-accent" strokeWidth={1.6} />
        {el.label && <span className="text-xs font-medium text-ink-soft">{el.label}</span>}
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

  const rounded = el.shapeType === "circle" ? "rounded-full" : "rounded-xl";
  return (
    <div
      className={`flex h-full w-full items-center justify-center border-2 border-ink bg-chalk px-3 text-center shadow-sketch ${rounded}`}
    >
      <span className="text-sm font-semibold text-ink">{el.label}</span>
    </div>
  );
}
