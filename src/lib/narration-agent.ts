import type { ShapeType } from "./storyboard";

type Tools = {
  getCanvasState: () => any;
  addTextBlock: (text: string, position?: { x?: number; y?: number }) => { id: string };
  addShape: (a: {
    shapeType: ShapeType;
    iconName?: string;
    position?: { x?: number; y?: number };
    label?: string;
  }) => { id: string };
  addConnector: (fromId: string, toId: string, label?: string) => any;
  groupIntoBeat: (label: string) => any;
};

const CONCEPTS: Array<{ match: RegExp; icon: string; label: string }> = [
  { match: /\bsun|solar|heat\b/i, icon: "sun", label: "Sun" },
  { match: /\bocean|sea|water body|lake\b/i, icon: "waves", label: "Ocean" },
  { match: /\bcloud|vapou?r\b/i, icon: "cloud", label: "Cloud" },
  { match: /\brain|precipitat|droplet|water drop\b/i, icon: "droplet", label: "Rain" },
  { match: /\bwind|air\b/i, icon: "wind", label: "Wind" },
  { match: /\bmountain|land|ground\b/i, icon: "mountain", label: "Land" },
  { match: /\bplant|leaf|tree|forest\b/i, icon: "leaf", label: "Plants" },
  { match: /\bfire|energy|burn\b/i, icon: "flame", label: "Energy" },
  { match: /\bidea|insight|concept\b/i, icon: "lightbulb", label: "Idea" },
  { match: /\bteam|people|user|audience\b/i, icon: "users", label: "People" },
  { match: /\bdata|database|storage|record\b/i, icon: "database", label: "Data" },
];

const RELATIONS = [
  "evaporation",
  "condensation",
  "precipitation",
  "collection",
  "transpiration",
  "feedback",
  "flow",
  "leads to",
  "becomes",
  "returns",
];

/**
 * Local narration interpreter. In a WebMCP session the model drives the very
 * same six tools; this keeps the demo self-driving when no agent is attached.
 */
export function interpretSegment(segment: string, tools: Tools) {
  const state = tools.getCanvasState();
  const existing: Array<{ id: string; label: string }> = state.elements.map((e: any) => ({
    id: e.id,
    label: String(e.label ?? ""),
  }));

  const titleMatch = segment.match(/(?:let'?s talk about|today we'?ll cover|this is about)\s+(.+?)[.,]?$/i);
  if (titleMatch && !state.elements.some((e: any) => e.type === "text")) {
    const title = titleMatch[1].replace(/\.$/, "");
    tools.addTextBlock(title.replace(/\b\w/g, (c) => c.toUpperCase()), { x: 60, y: 40 });
  }

  const added: Array<{ id: string; label: string }> = [];
  const slotCount = existing.length;
  CONCEPTS.forEach((c) => {
    if (!c.match.test(segment)) return;
    const already = existing.find((e) => e.label.toLowerCase() === c.label.toLowerCase());
    if (already) return;
    const i = slotCount + added.length;
    const res = tools.addShape({
      shapeType: "icon",
      iconName: c.icon,
      label: c.label,
      position: { x: 120 + (i % 4) * 230, y: 170 + Math.floor(i / 4) * 200 },
    });
    added.push({ id: res.id, label: c.label });
  });

  const pool = [...existing, ...added];
  const relation = RELATIONS.find((r) => segment.toLowerCase().includes(r));
  if (pool.length >= 2) {
    const to = pool[pool.length - 1];
    const from = pool[pool.length - 2];
    if (from && to && from.id !== to.id) {
      tools.addConnector(
        from.id,
        to.id,
        relation ? relation.charAt(0).toUpperCase() + relation.slice(1) : undefined,
      );
    }
  }

  const beatLabel =
    relation?.replace(/\b\w/g, (c) => c.toUpperCase()) ??
    added[0]?.label ??
    segment.split(/\s+/).slice(0, 4).join(" ");
  tools.groupIntoBeat(beatLabel);
}
