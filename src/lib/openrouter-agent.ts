/**
 * OpenRouter AI Driver — upgraded to Visual Planner pipeline.
 *
 * Old: Director text → Drafter pixel-coordinate tool calls (2 LLM calls, fragile)
 * New: Single call → VisualScenePlan JSON → layout engine + asset resolver → tools
 *
 * The LLM only produces INTENT (what and how to visualize).
 * Position calculation, asset resolution, and tool invocation are deterministic code.
 */

import { buildPlannerSystemPrompt, buildUserPrompt, type VisualScenePlan } from "./visual-planner";
import { resolveAsset } from "./asset-resolver";
import { calculateLayout, type LayoutItem } from "./layout-engine";
import type { CanvasElement, Connector, ShapeType } from "./storyboard";
import { uid } from "./storyboard";

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;
}

// ── JSON extractor ────────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  let s = raw.trim();
  // Strip markdown code fences (handles ```json ... ``` and ``` ... ```)
  s = s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Walk from the first '{' matching brace depth to find the correct closing '}'
  // This handles cases where the model includes explanation text with nested JSON examples
  const start = s.indexOf("{");
  if (start === -1) return s;

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }

  // Fallback: grab from first { to last }
  const end = s.lastIndexOf("}");
  return end > start ? s.slice(start, end + 1) : s.slice(start);
}

// ── Fallback: populate canvas if plan is empty or agent failed ────────────────
// IMPORTANT: Never transcribe narration text here — use a generic visual placeholder.

function fallbackNarrationSummary(_segment: string, tools: any) {
  // Use a generic shape/icon so we never paste narration phrases onto the canvas.
  if (tools.addShape) {
    tools.addShape({ shapeType: "rectangle", label: "Key Concept" });
  } else if (tools.addTextBlock) {
    tools.addTextBlock("Key Concept");
  }
  if (tools.groupIntoBeat) tools.groupIntoBeat("Key Concept");
}

// ── Main interpreter ──────────────────────────────────────────────────────────

export async function interpretWithOpenRouter(
  segment: string,
  tools: any,
  config: OpenRouterConfig,
): Promise<boolean> {
  if (!config.apiKey?.trim()) throw new Error("OpenRouter API key is empty");

  const model = config.model || "minimax/minimax-m3:free";
  const systemPrompt = buildPlannerSystemPrompt();

  // Send ALL current canvas elements (capped to 14) so Gemini can:
  //  a) avoid recreating existing elements
  //  b) identify stale ones to include in removeIds for cleanup
  const canvasState = tools.getCanvasState?.() ?? [];
  const beats: Array<{ id: string; label: string }> = canvasState.beats ?? [];
  const allElements: any[] = Array.isArray(canvasState)
    ? canvasState
    : (canvasState.elements ?? []);

  const contextElements = allElements.slice(-14);
  const canvasContext = contextElements.length
    ? `Current canvas elements (do NOT recreate; use IDs in removeIds to clear stale ones):\n${JSON.stringify(
        contextElements.map((e: any) => ({
          id: e.id,
          label: e.label ?? e.text ?? "",
          type: e.type ?? e.kind,
        })),
        null,
        2,
      )}`
    : "";

  const storyArc = beats.length
    ? `Beats so far: ${beats.map((b: any) => b.label).join(" → ")}`
    : "";

  const userPrompt = buildUserPrompt(segment, canvasContext, storyArc);

  let plan: VisualScenePlan | null = null;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        "HTTP-Referer":
          typeof window !== "undefined" ? window.location.origin : "https://storyboard.live",
        "X-Title": "Whiteboard Live",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const rawContent: string = data.choices?.[0]?.message?.content ?? "";
    console.log("[Storyboard Live — Visual Planner raw]:\n", rawContent);

    const cleanJson = extractJson(rawContent);
    try {
      plan = JSON.parse(cleanJson) as VisualScenePlan;
    } catch (e) {
      console.warn("[Storyboard Live] Failed to parse VisualScenePlan JSON:", rawContent);
    }
  } catch (err) {
    console.error("[Storyboard Live] OpenRouter call failed:", err);
  }

  // Validate plan
  if (!plan || !Array.isArray(plan.elements) || plan.elements.length === 0) {
    console.warn("[Storyboard Live] Empty or invalid plan — using fallback");
    fallbackNarrationSummary(segment, tools);
    return false;
  }

  // Client-side guard: strip any sticky/text elements that are just transcribed narration.
  // Gemini sometimes outputs narration phrases verbatim despite the system prompt rule.
  {
    const narrationWords = new Set(
      segment
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
    const visualTypes = new Set(["illustration", "icon", "shape", "equation", "code"]);
    plan.elements = plan.elements.filter((elem) => {
      // Always keep visual elements
      if (visualTypes.has(elem.type)) return true;
      // heading: keep as long as it's ≤ 4 words
      if (elem.type === "heading") {
        const words = (elem.content ?? elem.label ?? "").trim().split(/\s+/);
        return words.length <= 5;
      }
      // text: keep only if it's a short term (≤ 5 words) with low narration overlap
      if (elem.type === "text") {
        const content = (elem.content ?? elem.label ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, "");
        const words = content.split(/\s+/).filter((w) => w.length > 3);
        if (words.length > 5) return false; // clearly a sentence — reject
        const overlap = words.filter((w) => narrationWords.has(w)).length / (words.length || 1);
        return overlap < 0.6;
      }
      // sticky/callout: reject if content looks like narration (>4 content words with >50% overlap)
      if (elem.type === "sticky" || elem.type === "callout") {
        const content = (elem.content ?? elem.label ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, "");
        const words = content.split(/\s+/).filter((w) => w.length > 3);
        if (words.length <= 2) return true; // short fact — keep
        const overlap = words.filter((w) => narrationWords.has(w)).length / words.length;
        return overlap < 0.5 && words.length <= 4;
      }
      return true;
    });

    // If we stripped everything down to 0 visual elements, fall back
    if (plan.elements.length === 0) {
      console.warn("[Storyboard Live] All elements were narration transcriptions — using fallback");
      fallbackNarrationSummary(segment, tools);
      return false;
    }
  }

  // Sanitize: remove connections that reference non-existent element IDs
  if (Array.isArray(plan.connections)) {
    const elementIds = new Set(plan.elements.map((e) => e.id));
    plan.connections = plan.connections.filter(
      (c) => elementIds.has(c.from) && elementIds.has(c.to),
    );
  } else {
    plan.connections = [];
  }

  // Sanitize removeIds: only keep IDs that actually exist on canvas (never let hallucinated IDs through)
  if (Array.isArray(plan.removeIds) && plan.removeIds.length > 0) {
    const existingIds = new Set(allElements.map((e: any) => e.id));
    plan.removeIds = plan.removeIds.filter((id) => typeof id === "string" && existingIds.has(id));
  } else {
    plan.removeIds = [];
  }

  // Ensure groupLabel is a non-empty string
  if (!plan.groupLabel || typeof plan.groupLabel !== "string") {
    plan.groupLabel = segment.split(/\s+/).slice(0, 4).join(" ");
  }

  console.log(
    `[Storyboard Live — Visual Plan]: ${plan.layout} · ${plan.elements.length} elements · "${plan.groupLabel}"`,
  );

  // ── Execute the plan ────────────────────────────────────────────────────────

  try {
    // Use the batch apply_visual_scene tool if available (preferred)
    if (tools.applyVisualScene) {
      await tools.applyVisualScene(plan);
      return true;
    }

    // Fallback: manual execution using individual tools
    await executeVisualPlanManually(plan, tools);
    return true;
  } catch (execErr) {
    console.error("[Storyboard Live] Plan execution failed:", execErr);
    fallbackNarrationSummary(segment, tools);
    return false;
  }
}

// ── Manual execution (when applyVisualScene isn't available) ─────────────────

async function executeVisualPlanManually(plan: VisualScenePlan, tools: any) {
  const elements = plan.elements;

  const layoutItems: LayoutItem[] = elements.map((e) => ({
    type: e.type === "illustration" || e.type === "icon" ? "illustration" : e.type,
    size: e.size ?? "medium",
  }));

  const positions = calculateLayout(plan.layout, layoutItems);

  // Resolve assets in parallel
  const assetResults = await Promise.all(
    elements.map((e) =>
      e.semantic ? resolveAsset(e.semantic) : Promise.resolve({ type: "none" as const }),
    ),
  );

  const createdMap: Record<string, string> = {};

  for (let i = 0; i < elements.length; i++) {
    const planEl = elements[i];
    const pos = positions[i] ?? { x: 80 + i * 140, y: 180, w: 120, h: 120 };
    const asset = assetResults[i];
    const position = { x: pos.x, y: pos.y };

    let created: { id: string } | null = null;

    if (planEl.type === "illustration" || planEl.type === "icon") {
      const svgContent =
        asset.type === "local-svg" || asset.type === "iconify-svg" ? asset.value : "";
      const emoji = asset.type === "emoji" ? asset.value : undefined;

      if (tools.addIllustration && svgContent) {
        created = tools.addIllustration(
          planEl.semantic ?? "",
          svgContent,
          position,
          { w: pos.w, h: pos.h },
          planEl.label,
        );
      } else if (emoji && tools.addEmoji) {
        created = tools.addEmoji(emoji, 1, position, planEl.label);
      } else if (tools.addShape) {
        created = tools.addShape({
          shapeType: "icon" as ShapeType,
          iconName: planEl.semantic,
          label: planEl.label,
          position,
        });
      }
    } else if (planEl.type === "equation" && tools.addMathBlock) {
      created = tools.addMathBlock(planEl.content ?? "", position);
    } else if (planEl.type === "code" && tools.addCodeBlock) {
      created = tools.addCodeBlock(planEl.content ?? "", planEl.codeLanguage ?? "text", position);
    } else if (planEl.type === "heading" && tools.addTextBlock) {
      const text = planEl.content ?? planEl.label ?? "";
      created = tools.addTextBlock(text, position);
    } else if (planEl.type === "text" && tools.addTextBlock) {
      const text = (planEl.content ?? planEl.label ?? "").split(/\s+/).slice(0, 6).join(" ");
      created = tools.addTextBlock(text, position);
    } else if ((planEl.type === "sticky" || planEl.type === "callout") && tools.addStickyNote) {
      created = tools.addStickyNote(planEl.content ?? planEl.label ?? "", "amber", position);
    } else if (planEl.type === "shape" && tools.addShape) {
      const stMap: Record<string, ShapeType> = {
        circle: "circle",
        rectangle: "rectangle",
        diamond: "flowchart",
        arrow: "arrow",
        triangle: "triangle",
      };
      created = tools.addShape({
        shapeType: stMap[planEl.shapeType ?? "rectangle"] ?? "rectangle",
        label: planEl.label,
        position,
      });
    }

    if (created?.id) createdMap[planEl.id] = created.id;
  }

  // Wire connectors
  for (const conn of plan.connections) {
    const fromId = createdMap[conn.from];
    const toId = createdMap[conn.to];
    if (fromId && toId && tools.addConnector) {
      tools.addConnector(fromId, toId, conn.label);
    }
  }

  // Group into beat
  if (tools.groupIntoBeat) tools.groupIntoBeat(plan.groupLabel ?? "Scene");
}
