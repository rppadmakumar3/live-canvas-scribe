export type ShapeType = "circle" | "rectangle" | "arrow" | "icon";

export type CanvasElement = {
  id: string;
  kind: "text" | "shape";
  shapeType?: ShapeType;
  iconName?: string;
  text?: string;
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  createdAt: number;
};

export type Connector = {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
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

/** Find a free slot near the requested position so agent output never stacks. */
export function resolveOverlap(
  elements: CanvasElement[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const pad = 16;
  let px = x;
  let py = y;
  for (let i = 0; i < 60; i++) {
    const hit = elements.some(
      (e) =>
        px < e.x + e.w + pad &&
        px + w + pad > e.x &&
        py < e.y + e.h + pad &&
        py + h + pad > e.y,
    );
    if (!hit) break;
    px += 40;
    py += 28;
    if (px + w > 1400) {
      px = 40;
      py += 120;
    }
  }
  return { x: Math.max(8, px), y: Math.max(8, py) };
}
