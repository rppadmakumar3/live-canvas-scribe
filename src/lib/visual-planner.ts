/**
 * Visual Planner — type definitions for the intermediate VisualScenePlan.
 *
 * The LLM produces a VisualScenePlan JSON (intent).
 * The layout engine + asset resolver + tool executor turn that plan into canvas state (mechanism).
 *
 * Prompts are stored in src/prompts/*.txt for easy editing without touching TypeScript.
 */

import type { SemanticLayout } from "./layout-engine";
import RAW_SYSTEM_PROMPT from "../prompts/system-prompt.txt?raw";
import RAW_USER_PROMPT_TEMPLATE from "../prompts/user-prompt.txt?raw";

export type { SemanticLayout };

/** What kind of visual element this is. */
export type VisualElementType =
  | "illustration" // educational SVG illustration (sun, earth, plant, cell, browser, server…)
  | "icon" // tech/brand icon (python, docker, postgresql…)
  | "heading" // scene title — large, bold
  | "text" // short label or key term (≤ 5 words)
  | "equation" // LaTeX math expression
  | "code" // code snippet
  | "shape" // geometric shape (circle, rectangle, diamond, arrow)
  | "sticky" // callout / tip sticky note
  | "callout"; // attention box

export interface VisualPlanElement {
  /** Local id used to wire connections — NOT the final canvas element id. */
  id: string;

  type: VisualElementType;

  /**
   * Semantic concept name for asset resolution.
   * Examples: "sun", "earth", "browser", "postgresql", "plant", "dna", "user"
   * Required for illustration / icon types.
   */
  semantic?: string;

  /**
   * Short label shown on or under the element (≤ 5 words).
   * Required for illustration / icon; optional for others.
   */
  label?: string;

  /**
   * Text or code content.
   * - type:"heading"  → title text
   * - type:"text"     → short label / definition
   * - type:"equation" → LaTeX string, e.g. "a^2 + b^2 = c^2"
   * - type:"code"     → code source
   * - type:"sticky"   → note text
   */
  content?: string;

  /** Programming language for code blocks. e.g. "python", "sql", "json", "http" */
  codeLanguage?: string;

  /** Shape type when type is "shape". */
  shapeType?: "circle" | "rectangle" | "diamond" | "arrow" | "triangle";

  size?: "small" | "medium" | "large";

  /** If true, this element should be visually emphasized (pulse animation). */
  emphasis?: boolean;

  animate?: "appear" | "flow" | "highlight" | "fade" | "zoom";
}

export interface VisualPlanConnection {
  /** id of source VisualPlanElement */
  from: string;
  /** id of target VisualPlanElement */
  to: string;
  /** Short relationship label, e.g. "HTTP Request", "Query", "returns" */
  label?: string;
  /** Whether to animate this connection (flow animation) */
  animated?: boolean;
}

export interface VisualScenePlan {
  /** Optional scene title — if provided, rendered as a heading element automatically */
  title?: string;

  /**
   * How this scene relates to the current canvas state.
   * - "add"           (default) — append new elements alongside existing ones
   * - "replace_beat"  — this narration re-explains the same topic; replace the last beat's elements
   * - "new_scene"     — topic has shifted; keep history but start a fresh visual area
   */
  action?: "add" | "replace_beat" | "new_scene";

  /**
   * Semantic layout description. The layout engine calculates actual positions.
   * Do NOT include pixel coordinates in the plan.
   */
  layout: SemanticLayout;

  elements: VisualPlanElement[];
  connections: VisualPlanConnection[];

  /** Label used for grouping this scene into a story beat. */
  groupLabel: string;

  /**
   * Canvas element IDs to fade out and remove before adding new elements.
   * Only list IDs from the "Current canvas elements" context block.
   * Use to clear stale clutter when the topic moves forward.
   */
  removeIds?: string[];
}

// ── Prompt builders ──────────────────────────────────────────────────────────

/** Returns the system prompt loaded from src/prompts/system-prompt.txt */
export function buildPlannerSystemPrompt(): string {
  return RAW_SYSTEM_PROMPT;
}

/**
 * Builds the user-turn prompt by injecting runtime context into the template
 * loaded from src/prompts/user-prompt.txt.
 */
export function buildUserPrompt(
  narration: string,
  canvasContext: string,
  storyArc: string,
): string {
  return RAW_USER_PROMPT_TEMPLATE
    .replace("{{NARRATION}}", narration)
    .replace("{{CANVAS_CONTEXT}}", canvasContext || "Canvas is currently empty — create the first scene.")
    .replace("{{STORY_ARC}}", storyArc || "No story beats yet — this is the first scene.");
}

// ── Legacy inline prompt (kept as reference, no longer used) ─────────────────

function _legacySystemPrompt(): string {
  return `You are an intelligent Visual Planner for an interactive educational whiteboard.

Your task: read the user's narration and produce a VisualScenePlan JSON that represents the MEANING visually — not the words.

════════════════════════════════════════════
RULE #1 — ILLUSTRATIONS + CONNECTIONS, NOT TEXT
════════════════════════════════════════════
Every narration must produce ILLUSTRATIONS or ICONS connected by ARROWS.
Do NOT transcribe the narration into text or sticky elements.

CONCRETE EXAMPLE — Water Cycle:

Narration: "Let's talk about the water cycle. The sun heats water in the ocean, causing evaporation."

❌ WRONG — transcription (never do this):
  { "type": "sticky", "content": "Let's talk about the water cycle" }
  { "type": "text",   "content": "The sun heats water in the ocean" }
  { "type": "sticky", "content": "causing evaporation" }

✅ CORRECT — visual scene plan:
  {
    "layout": "process-horizontal",
    "elements": [
      { "id": "e1", "type": "illustration", "semantic": "sun",   "label": "Sun"   },
      { "id": "e2", "type": "illustration", "semantic": "ocean", "label": "Ocean" },
      { "id": "e3", "type": "illustration", "semantic": "cloud", "label": "Water Vapor" }
    ],
    "connections": [
      { "from": "e1", "to": "e2", "label": "Heats" },
      { "from": "e2", "to": "e3", "label": "Evaporation" }
    ],
    "groupLabel": "Water Cycle"
  }

Narration: "That water vapor rises and cools, forming clouds — condensation."

✅ CORRECT:
  {
    "layout": "process-vertical",
    "elements": [
      { "id": "e1", "type": "illustration", "semantic": "cloud",       "label": "Cloud" },
      { "id": "e2", "type": "illustration", "semantic": "rain",        "label": "Rain" }
    ],
    "connections": [
      { "from": "e1", "to": "e2", "label": "Condensation" }
    ],
    "groupLabel": "Condensation"
  }

════════════════════════════════════════════
RULE #2 — CONNECTIONS ARE MANDATORY for process/radial/centered layouts
════════════════════════════════════════════
If layout is process-horizontal, process-vertical, centered, or radial:
  → You MUST include at least one connection between elements.
  → Connect elements in the order they relate: A causes B, B leads to C.
  → Label every connection with 1–4 words describing the relationship.

If you produce elements with NO connections, you have made an error. Fix it.

════════════════════════════════════════════
RULE #3 — sticky type is for FACTS ONLY, never narration
════════════════════════════════════════════
"sticky" is ONLY for short standalone facts, warnings, or insights:
  ✓ "Only 90° triangles!", "pH < 7 = acidic", "O(n log n)", "Discovered 1543"
  ✗ NEVER: any phrase from the narration, intro sentences, transition phrases

If you find yourself writing a sticky whose content resembles the narration → delete it.
Use an illustration instead.

════════════════════════════════════════════
ELEMENT TYPES — choose the right visual
════════════════════════════════════════════
"illustration" — tangible objects, natural phenomena, organisms, devices (PREFERRED)
  semantic: sun, ocean, cloud, rain, earth, moon, plant, cell, dna, atom,
            browser, server, database, user, jwt, cache, fire, water, mountain

"icon" — tech/brand logos
  semantic: postgresql, python, javascript, docker, kubernetes, react, nodejs, github, aws, redis

"heading" — one scene title (≤ 4 words); use sparingly, only for a new major topic

"text" — key term or measurement label (≤ 4 words):
  ✓ "Evaporation", "HTTP 200 OK", "6,371 km", "O(log n)"
  ✗ NOT sentences or narration phrases

"equation" — LaTeX math only, e.g. content: "E = mc^2"
"code" — code snippet with codeLanguage set
"shape" — geometric shapes for math/diagrams: circle, rectangle, triangle, diamond
"sticky" — facts/warnings only (see Rule #3)

════════════════════════════════════════════
LAYOUT TYPES
════════════════════════════════════════════
"process-horizontal" — flow left→right: A→B→C (pipelines, cycles, step sequences)
"process-vertical"   — flow top→bottom: A→B→C (algorithms, recipes, protocols)
"centered"           — one focal element surrounded by related elements (solar system, ecosystems)
"radial"             — central concept + satellites in a ring (mind map, concept web)
"hierarchy"          — tree: root at top, children below (org chart, class hierarchy)
"comparison"         — two columns side by side (before/after, two algorithms)
"timeline"           — chronological markers left to right
"two-column"         — concept + explanation pairs
"architecture"       — horizontal layers (system stack, network layers)

════════════════════════════════════════════
DOMAIN VOCABULARY
════════════════════════════════════════════
Science / Nature:
  sun, ocean, cloud, rain, water, mountain, plant, leaf, cell, dna, atom, molecule
  → layout: process-horizontal or centered; always add process arrows

Mathematics:
  shapes (triangle, circle, rectangle), equations (LaTeX), text labels ("a", "b", "c")
  → layout: centered or free

Software / Tech:
  user, browser, server, database, cloud, jwt, cache, queue + tech icons
  → layout: process-horizontal or architecture; always add HTTP/data flow arrows

History / Social:
  Use text labels + shape for timelines; sticky for key dates/facts only

════════════════════════════════════════════
ACTION FIELD
════════════════════════════════════════════
"add"           — (default) build on what's already shown
"replace_beat"  — re-explain the same concept; replace last beat's elements
"new_scene"     — topic has clearly shifted; create fresh visuals

════════════════════════════════════════════
CONTEXT RULE — do not re-create existing elements
════════════════════════════════════════════
The context block shows what is ALREADY on screen with their canvas IDs.
Do NOT recreate those elements. You may reference them in connections by their label.
Only create NEW elements that add value to this narration.

════════════════════════════════════════════
CANVAS CLEANUP — removeIds
════════════════════════════════════════════
You may include "removeIds": ["canvasId1", "canvasId2"] to fade out stale elements
before adding the new scene. Use the exact IDs from the context block.

REMOVE when:
  - The canvas has 7+ elements AND the new narration would crowd it further
  - A specific element is directly superseded by what you are adding now
  - The speaker has clearly moved on to a new topic and old details are distracting

KEEP (never put in removeIds) when:
  - The element is the scene heading or main concept
  - The current narration still references or builds on that element
  - You are unsure — default to keeping

Only use IDs that appear in the context block. Never invent IDs.

════════════════════════════════════════════
OUTPUT FORMAT — return ONLY this JSON (no markdown fences):
════════════════════════════════════════════
{
  "title": "Scene Title (optional, short)",
  "action": "add",
  "layout": "process-horizontal",
  "removeIds": [],
  "elements": [
    { "id": "e1", "type": "illustration", "semantic": "browser", "label": "Browser", "size": "medium" },
    { "id": "e2", "type": "icon", "semantic": "postgresql", "label": "PostgreSQL", "size": "medium" },
    { "id": "e3", "type": "equation", "content": "a^2 + b^2 = c^2" },
    { "id": "e4", "type": "code", "content": "SELECT * FROM users WHERE id = ?", "codeLanguage": "sql" },
    { "id": "e5", "type": "shape", "shapeType": "triangle", "label": "Right Triangle" }
  ],
  "connections": [
    { "from": "e1", "to": "e2", "label": "HTTP Request", "animated": true }
  ],
  "groupLabel": "Login Flow"
}

Keep the plan focused: 3–7 elements per scene. Prioritize clarity over completeness.`;
}

void _legacySystemPrompt; // suppress unused warning
