import { getCanvasBounds } from "./canvas-bounds";

export type ShapeType =
  "circle" | "rectangle" | "arrow" | "icon" | "sticky" | "triangle" | "flowchart";

export type StickyColor = "amber" | "teal" | "coral" | "yellow" | "pink" | "blue";

export type SketchTemplate =
  "squiggle-underline" | "rough-circle" | "rough-arrow" | "rough-box" | "custom";

export type Point = { x: number; y: number };

export type TextStyle = {
  bold?: boolean;
  size?: "small" | "medium" | "large";
  color?: string;
};

export type CanvasElement = {
  id: string;
  kind:
    | "text"
    | "shape"
    | "sticky"
    | "stroke"
    | "sketch"
    | "image"
    | "highlight"
    | "frame"
    | "math"
    | "emoji"
    | "code"
    | "illustration"
    | "callout";
  shapeType?: ShapeType;
  iconName?: string;
  emoji?: string;
  text?: string;
  label?: string;
  latex?: string;
  color?: string;
  stickyColor?: StickyColor;
  template?: SketchTemplate;
  points?: Point[];
  strokeWidth?: number;
  source?: string; // URL, data URL, or bundled asset short name
  targetId?: string; // target element for highlight
  frameLabel?: string;
  frameElementIds?: string[];
  textStyle?: TextStyle;
  zIndex?: number;
  nodeType?: "process" | "decision" | "start_end" | "input_output";
  fillColor?: string;
  emphasizedAt?: number;
  isFadingOut?: boolean;
  // New fields for upgraded visual engine
  codeLanguage?: string; // e.g. "python", "sql", "json"
  svgContent?: string; // sanitized inline SVG for illustrations
  semantic?: string; // concept name used for asset resolution (e.g. "sun", "browser")
  animationType?: "appear" | "fade" | "flow" | "highlight" | "zoom";
  animationDuration?: number; // ms
  animationDelay?: number; // ms
  // Interactive state
  isPinned?: boolean; // when true, drag is disabled
  calloutTargetId?: string; // id of element this callout points at
  x: number;
  y: number;
  w: number;
  h: number;
  createdAt: number;
};

export const COLOR_PALETTE = [
  { name: "Teal", hex: "#2B6E5C" },
  { name: "Amber", hex: "#C97A2B" },
  { name: "Charcoal", hex: "#2B2A28" },
  { name: "Coral", hex: "#D9534F" },
  { name: "Indigo", hex: "#4A90E2" },
  { name: "Sage", hex: "#6B8E23" },
] as const;

export const STICKY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  amber: { bg: "#FFEDD5", border: "#FED7AA", text: "#7C2D12" },
  teal: { bg: "#CCFBF1", border: "#99F6E4", text: "#115E59" },
  coral: { bg: "#FEE2E2", border: "#FCA5A5", text: "#7F1D1D" },
  yellow: { bg: "#FEF08A", border: "#FDE047", text: "#713F12" },
  pink: { bg: "#FCE7F3", border: "#FBCFE8", text: "#831843" },
  blue: { bg: "#E0F2FE", border: "#BAE6FD", text: "#0C4A6E" },
};

export type ConnectorStyle = {
  dashed?: boolean;
  color?: string; // CSS color string
  thick?: boolean;
};

export type Connector = {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  style?: ConnectorStyle;
  createdAt: number;
};

export type Beat = {
  id: string;
  label: string;
  elementIds: string[];
  connectorIds: string[];
  narration: string;
  createdAt: number;
};

export type StoryboardState = {
  elements: CanvasElement[];
  connectors: Connector[];
  beats: Beat[];
};

export const EMPTY_STATE: StoryboardState = { elements: [], connectors: [], beats: [] };

export const STORAGE_KEY = "storyboard-live:v1";

export const ICON_LIBRARY = [
  "sun",
  "cloud",
  "droplet",
  "waves",
  "wind",
  "mountain",
  "leaf",
  "flame",
  "star",
  "lightbulb",
  "users",
  "database",
] as const;

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function centerOf(el: CanvasElement) {
  return { x: el.x + el.w / 2, y: el.y + el.h / 2 };
}

// Canvas safe zone — must match layout-engine.ts constants
export const CANVAS_X_MIN = 60;
export const CANVAS_X_MAX = 720;
export const CANVAS_Y_MIN = 60;
export const CANVAS_Y_MAX = 380;

/** Find a free slot near requested position with clean grid/column alignment.
 *  All returned coordinates keep the element fully inside the live canvas safe zone. */
export function resolveOverlap(
  elements: CanvasElement[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const { xMin, xMax, yMin, yMax } = getCanvasBounds();
  const pad = 16;
  // Clamp initial position so the element fits entirely inside the canvas
  let px = Math.min(Math.max(xMin, x), xMax - w);
  let py = Math.min(Math.max(yMin, y), yMax - h);

  for (let i = 0; i < 60; i++) {
    const hit = elements.some(
      (e) =>
        px < e.x + e.w + pad && px + w + pad > e.x && py < e.y + e.h + pad && py + h + pad > e.y,
    );
    if (!hit) break;
    // Shift down to fill column cleanly
    py += Math.max(50, h + 20);
    if (py + h > yMax) {
      py = yMin;
      px += Math.max(160, w + 30);
    }
    // If pushed beyond right edge, wrap back to left column start
    if (px + w > xMax) {
      px = xMin;
      py = yMin;
    }
  }

  // Final clamp: guarantee element stays inside canvas regardless
  const finalX = Math.min(Math.max(xMin, px), xMax - w);
  const finalY = Math.min(Math.max(yMin, py), yMax - h);
  return { x: finalX, y: finalY };
}
