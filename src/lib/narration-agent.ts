import type { ShapeType } from "./storyboard";

type Tools = {
  getCanvasState: () => any;
  addTextBlock: (text: string, position?: { x?: number; y?: number }) => { id: string };
  addMathBlock?: (latex: string, position?: { x?: number; y?: number }) => { id: string };
  addStickyNote?: (
    text: string,
    color?: string,
    position?: { x?: number; y?: number },
  ) => { id: string };
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
  { match: /\bidea|insight|concept|think\b/i, icon: "lightbulb", label: "Idea" },
  { match: /\bteam|people|user|audience|employee|onboard\b/i, icon: "users", label: "People" },
  { match: /\bdata|database|storage|record|bill|law|doc\b/i, icon: "database", label: "Document" },
];

const RELATIONS = [
  "evaporation",
  "condensation",
  "precipitation",
  "collection",
  "transpiration",
  "leads to",
  "becomes",
  "passes",
  "approved",
  "signed",
  "trains",
];

/**
 * Local narration interpreter for generic topics (Water Cycle, Math formulas, Bill to Law, Onboarding, etc.)
 */
export function interpretSegment(segment: string, tools: Tools) {
  const state = tools.getCanvasState();
  const elements = state.elements || (Array.isArray(state) ? state : []);
  const existing: Array<{ id: string; label: string; type?: string }> = elements.map((e: any) => ({
    id: e.id,
    label: String(e.label ?? e.text ?? ""),
    type: e.type,
  }));

  let addedElementsCount = 0;

  // 1. Math / Geometry formula & triangle detection
  const lowerSeg = segment.toLowerCase();
  if (
    lowerSeg.includes("pythagor") ||
    lowerSeg.includes("triangle") ||
    lowerSeg.includes("squared") ||
    lowerSeg.includes("a^2")
  ) {
    if (!existing.some((e) => e.label.toLowerCase().includes("pythagor"))) {
      tools.addTextBlock("Pythagorean Theorem", { x: 80, y: 70 });
      addedElementsCount++;
    }

    if (
      tools.addMathBlock &&
      !existing.some((e) => e.label?.includes("a^2") || e.id.startsWith("mth"))
    ) {
      tools.addMathBlock("a^2 + b^2 = c^2", { x: 380, y: 70 });
      addedElementsCount++;
    }

    if (!existing.some((e) => e.label.toLowerCase().includes("triangle"))) {
      const triRes = tools.addShape({
        shapeType: "triangle",
        label: "Right Triangle",
        position: { x: 220, y: 160 },
      });
      addedElementsCount++;

      if (tools.addConnector && existing.length > 0) {
        const formulaEl = existing.find((e) => e.label?.includes("a^2") || e.id.startsWith("mth"));
        if (formulaEl && triRes?.id) {
          tools.addConnector(triRes.id, formulaEl.id, "satisfies");
        }
      }
    }

    if (
      lowerSeg.includes("90 degree") ||
      lowerSeg.includes("only applies") ||
      lowerSeg.includes("remember")
    ) {
      if (
        tools.addStickyNote &&
        !existing.some((e) => e.label?.includes("90°") || e.text?.includes("90°"))
      ) {
        tools.addStickyNote("Applies ONLY to 90° right triangles!", "amber", { x: 460, y: 160 });
        addedElementsCount++;
      }
    }
  }

  // 2. Title / Header detection
  const titleMatch = segment.match(
    /(?:let'?s talk about|today we'?ll cover|this is about|how a|understanding)\s+(.+?)(?=\.|\,|$)/i,
  );
  if (titleMatch && !existing.some((e) => e.type === "text")) {
    const rawTitle = titleMatch[1].trim().replace(/\.$/, "");
    const title = rawTitle.replace(/\b\w/g, (c) => c.toUpperCase());
    tools.addTextBlock(title, { x: 80, y: 70 });
    addedElementsCount++;
  }

  // 3. Concept shape creation
  const added: Array<{ id: string; label: string }> = [];
  const totalConcepts = existing.filter((e) => e.type !== "text").length;

  CONCEPTS.forEach((c) => {
    if (!c.match.test(segment)) return;
    const already = existing.find((e) => e.label.toLowerCase() === c.label.toLowerCase());
    if (already) return;

    // Cap at 5 so we never exceed 2 rows (row 0 bottom=240, row 1 bottom=380 = CY_MAX)
    const index = Math.min(totalConcepts + added.length, 5);
    const pos = {
      x: 80 + (index % 3) * 190,
      y: 120 + Math.floor(index / 3) * 140,
    };

    const res = tools.addShape({
      shapeType: "icon",
      iconName: c.icon,
      label: c.label,
      position: pos,
    });
    added.push({ id: res.id, label: c.label });
    addedElementsCount++;
  });

  const pool = [...existing, ...added];
  const findByLabel = (label: string) =>
    pool.find((e) => e.label.toLowerCase().includes(label.toLowerCase()));

  const relation = RELATIONS.find((r) => lowerSeg.includes(r));
  const relLabel = relation ? relation.charAt(0).toUpperCase() + relation.slice(1) : undefined;

  // 4. Semantic connector wiring
  if (lowerSeg.includes("evaporation")) {
    const ocean = findByLabel("ocean");
    const sun = findByLabel("sun");
    if (ocean && sun && ocean.id !== sun.id) {
      tools.addConnector(ocean.id, sun.id, "Evaporation");
    }
  } else if (added.length > 0 && pool.length >= 2) {
    const to = added[0];
    const from = pool.filter((p) => p.id !== to.id && p.type !== "text").pop();
    if (from && to) {
      tools.addConnector(from.id, to.id, relLabel);
    }
  }

  // 5. MANDATORY FALLBACK REQUIREMENT — Canvas must never stay silently empty
  if (addedElementsCount === 0) {
    console.warn(`[Storyboard Live] No tool call produced for segment: "${segment}"`);
    const shortKeyword = segment.trim().split(/\s+/).slice(0, 3).join(" ") || "Key Concept";
    if (tools.addStickyNote) {
      tools.addStickyNote(shortKeyword, "amber", { x: 100, y: 180 });
    } else {
      tools.addTextBlock(shortKeyword, { x: 80, y: 70 });
    }
  }

  // 6. Group into story beat
  const beatLabel =
    relLabel ??
    (added.length > 0 ? added.map((a) => a.label).join(" & ") : null) ??
    segment.split(/\s+/).slice(0, 3).join(" ");

  tools.groupIntoBeat(beatLabel);
}
