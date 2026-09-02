/**
 * Layout Engine — translates semantic layout descriptions into pixel positions.
 * Gemini describes layout intent; this code calculates the actual coordinates.
 *
 * Bounds are read live from canvas-bounds.ts (updated by the Canvas ResizeObserver)
 * so the layout adapts to the actual rendered canvas size.
 */
import { getCanvasBounds } from "./canvas-bounds";

export type SemanticLayout =
  | "process-horizontal" // A → B → C left to right
  | "process-vertical" // A → B → C top to bottom
  | "centered" // one focal element + supporting elements around it
  | "radial" // central concept + satellites in a ring
  | "hierarchy" // tree: root at top, children below
  | "comparison" // two columns side by side
  | "timeline" // horizontal timeline with markers
  | "two-column" // alternating left / right columns
  | "architecture" // layered horizontal bands (like system architecture)
  | "sequence" // actors in a horizontal row with vertical message lanes (software flows)
  | "free"; // no automatic layout; use element hints

export type ElementSize = "small" | "medium" | "large";

export interface LayoutItem {
  type: string; // element type hint for sizing ("illustration" | "icon" | "text" | "equation" | "code" | ...)
  size?: ElementSize;
}

export interface LayoutResult {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Default sizes per element type ───────────────────────────────────────────

const BASE_SIZES: Record<string, { w: number; h: number }> = {
  illustration: { w: 120, h: 120 },
  icon: { w: 100, h: 100 },
  shape: { w: 120, h: 100 },
  text: { w: 160, h: 50 },
  heading: { w: 300, h: 55 },
  equation: { w: 250, h: 75 },
  code: { w: 300, h: 180 },
  sticky: { w: 170, h: 130 },
  callout: { w: 200, h: 100 },
};
const DEFAULT_SIZE = { w: 120, h: 100 };

const SIZE_MULTIPLIERS: Record<ElementSize, number> = {
  small: 0.75,
  medium: 1.0,
  large: 1.4,
};

function sizeOf(item: LayoutItem): { w: number; h: number } {
  const base = BASE_SIZES[item.type] ?? DEFAULT_SIZE;
  const mult = SIZE_MULTIPLIERS[item.size ?? "medium"];
  return { w: Math.round(base.w * mult), h: Math.round(base.h * mult) };
}

// ── Canvas bounds (refreshed from canvas-bounds.ts on every calculateLayout call) ──

let CX_MIN = 36,
  CX_MAX = 684,
  CY_MIN = 19,
  CY_MAX = 361; // fallback defaults
let CX_MID = 360,
  CY_MID = 190;
let CW = 648,
  CH = 342;

function clampX(x: number) {
  return Math.min(Math.max(CX_MIN, x), CX_MAX);
}
function clampY(y: number) {
  return Math.min(Math.max(CY_MIN, y), CY_MAX);
}

function refreshBounds() {
  const b = getCanvasBounds();
  CX_MIN = b.xMin;
  CX_MAX = b.xMax;
  CY_MIN = b.yMin;
  CY_MAX = b.yMax;
  CX_MID = b.xMid;
  CY_MID = b.yMid;
  CW = b.cw;
  CH = b.ch;
}

// ── Orbit helpers ─────────────────────────────────────────────────────────────

/**
 * Computes the orbit radius and optional element scale for ring layouts.
 * Guarantees:
 *   1. All elements stay inside the canvas (canvas-fit constraint).
 *   2. Adjacent elements in the ring don't overlap each other (no-overlap constraint).
 * If the no-overlap radius exceeds the canvas-fit radius, elements are scaled down.
 */
function computeOrbitParams(
  n: number,
  sizes: { w: number; h: number }[],
  fitScale = 0.88,
): { orbitR: number; elementScale: number } {
  const maxHalf = Math.max(...sizes.map((s) => Math.max(s.w, s.h) / 2));
  const margin = 12;
  // Maximum orbit that keeps the element edge inside the canvas
  const fitR = Math.max(60, Math.min(CW / 2 - maxHalf - margin, CH / 2 - maxHalf - margin) * fitScale);

  if (n <= 1) return { orbitR: fitR, elementScale: 1 };

  // Minimum orbit so adjacent elements (in a uniform ring) don't touch
  const angleBetween = (2 * Math.PI) / n;
  const noOverlapR = (maxHalf + margin / 2) / Math.sin(angleBetween / 2);

  if (noOverlapR <= fitR) {
    // Both constraints satisfied — use a comfortable spacing between the two bounds
    const orbitR = Math.min(fitR, Math.max(noOverlapR * 1.1, fitR * 0.55));
    return { orbitR, elementScale: 1 };
  }

  // noOverlapR > fitR → elements are too large to fit non-overlapping inside the canvas.
  // Scale elements down until both constraints are satisfied.
  const targetHalf = fitR * Math.sin(angleBetween / 2) - margin / 2;
  const elementScale = Math.max(0.4, targetHalf / maxHalf);
  const newMaxHalf = maxHalf * elementScale;
  const newFitR = Math.max(
    60,
    Math.min(CW / 2 - newMaxHalf - margin, CH / 2 - newMaxHalf - margin) * fitScale,
  );
  return { orbitR: newFitR, elementScale };
}

// ── Layout functions ──────────────────────────────────────────────────────────

/** Single-row helper — lays out `items` centred at `rowCenterY`. */
function processHorizontalRow(
  items: LayoutItem[],
  rowCenterY: number,
): LayoutResult[] {
  const n = items.length;
  const sizes = items.map(sizeOf);
  const totalW = sizes.reduce((s, sz) => s + sz.w, 0);

  const maxTotalW = CW * 0.92;
  const scale = totalW > maxTotalW ? maxTotalW / totalW : 1;
  const scaled = sizes.map((sz) => ({
    w: Math.max(40, Math.round(sz.w * scale)),
    h: Math.max(30, Math.round(sz.h * scale)),
  }));

  const scaledTotalW = scaled.reduce((s, sz) => s + sz.w, 0);
  const totalGap = Math.max(0, CW - scaledTotalW);
  const gap = Math.max(12, totalGap / (n + 1));

  const results: LayoutResult[] = [];
  let x = CX_MIN + gap;
  for (let i = 0; i < n; i++) {
    const { w, h } = scaled[i];
    results.push({ x: clampX(x), y: clampY(rowCenterY - h / 2), w, h });
    x += w + gap;
  }
  return results;
}

function processHorizontal(items: LayoutItem[]): LayoutResult[] {
  const n = items.length;
  if (n === 0) return [];

  // 5+ items: wrap into multiple rows of ≤4 so nothing gets squeezed
  const MAX_PER_ROW = 4;
  if (n > MAX_PER_ROW) {
    const numRows = Math.ceil(n / MAX_PER_ROW);
    const ROW_GAP = 24;

    const rows: LayoutItem[][] = [];
    for (let i = 0; i < n; i += MAX_PER_ROW) rows.push(items.slice(i, i + MAX_PER_ROW));

    const rowMaxH = rows.map((row) => Math.max(...row.map((it) => sizeOf(it).h)));
    const totalH = rowMaxH.reduce((s, h) => s + h, 0) + ROW_GAP * (numRows - 1);

    // Scale vertically if rows exceed available canvas height
    const availH = CH - 20;
    const vScale = totalH > availH ? availH / totalH : 1;
    const scaledRowMaxH = rowMaxH.map((h) => Math.round(h * vScale));
    const scaledGap = Math.max(8, Math.round(ROW_GAP * vScale));
    const scaledTotalH = scaledRowMaxH.reduce((s, h) => s + h, 0) + scaledGap * (numRows - 1);

    let rowTopY = Math.max(CY_MIN + 10, CY_MID - scaledTotalH / 2);

    const results: LayoutResult[] = [];
    for (let r = 0; r < rows.length; r++) {
      const rowCY = rowTopY + scaledRowMaxH[r] / 2;
      results.push(...processHorizontalRow(rows[r], rowCY));
      rowTopY += scaledRowMaxH[r] + scaledGap;
    }
    return results;
  }

  // ≤4 items: single centred row
  return processHorizontalRow(items, CY_MID);
}

function processVertical(items: LayoutItem[]): LayoutResult[] {
  const n = items.length;
  const sizes = items.map(sizeOf);
  const totalH = sizes.reduce((s, sz) => s + sz.h, 0);

  // Scale items down proportionally if they're too tall
  const maxTotalH = CH * 0.92;
  const scale = totalH > maxTotalH ? maxTotalH / totalH : 1;
  const scaled = sizes.map((sz) => ({
    w: Math.max(40, Math.round(sz.w * scale)),
    h: Math.max(24, Math.round(sz.h * scale)), // min 24 (not 30) to reduce overflow risk
  }));

  const scaledTotalH = scaled.reduce((s, sz) => s + sz.h, 0);
  const totalGap = Math.max(0, CH - scaledTotalH);
  const gap = Math.max(6, totalGap / (n + 1)); // min 6 (not 12) to prevent overflow

  const results: LayoutResult[] = [];
  let y = CY_MIN + gap;

  for (let i = 0; i < n; i++) {
    const { w, h } = scaled[i];
    const x = clampX(CX_MID - w / 2);
    results.push({ x, y: clampY(y), w, h });
    y += h + gap;
  }
  return results;
}

function centeredLayout(items: LayoutItem[]): LayoutResult[] {
  if (items.length === 0) return [];
  const results: LayoutResult[] = [];

  // First element = focal, placed at center
  const focalSize = sizeOf({ ...items[0], size: items[0].size ?? "large" });
  results.push({
    x: clampX(CX_MID - focalSize.w / 2),
    y: clampY(CY_MID - focalSize.h / 2),
    w: focalSize.w,
    h: focalSize.h,
  });

  const rest = items.slice(1);
  if (!rest.length) return results;

  const restSizes = rest.map(sizeOf);
  const { orbitR, elementScale } = computeOrbitParams(rest.length, restSizes, 0.88);
  const angleStep = (2 * Math.PI) / rest.length;
  const startAngle = -Math.PI / 2 + Math.PI / rest.length; // slight offset for visual balance

  for (let i = 0; i < rest.length; i++) {
    const angle = startAngle + i * angleStep;
    const { w, h } = restSizes[i];
    const sw = Math.max(40, Math.round(w * elementScale));
    const sh = Math.max(30, Math.round(h * elementScale));
    const cx = CX_MID + orbitR * Math.cos(angle);
    const cy = CY_MID + orbitR * Math.sin(angle);
    results.push({ x: clampX(cx - sw / 2), y: clampY(cy - sh / 2), w: sw, h: sh });
  }
  return results;
}

function radialLayout(items: LayoutItem[]): LayoutResult[] {
  if (items.length === 0) return [];
  const n = items.length;

  // ── Pure ring: no explicit hub ──────────────────────────────────────────────
  // When no element is explicitly "large", all n items go in a uniform ring.
  // computeOrbitParams ensures they fit the canvas AND don't overlap each other.
  const hasHub = items[0].size === "large";

  if (!hasHub) {
    const sizes = items.map(sizeOf);
    const { orbitR, elementScale } = computeOrbitParams(n, sizes, 0.88);
    const angleStep = (2 * Math.PI) / n;
    return sizes.map(({ w, h }, i) => {
      const angle = -Math.PI / 2 + i * angleStep; // start from top, clockwise
      const sw = Math.max(40, Math.round(w * elementScale));
      const sh = Math.max(30, Math.round(h * elementScale));
      const cx = CX_MID + orbitR * Math.cos(angle);
      const cy = CY_MID + orbitR * Math.sin(angle);
      return { x: clampX(cx - sw / 2), y: clampY(cy - sh / 2), w: sw, h: sh };
    });
  }

  // ── Hub + ring: first item is the centre hub ────────────────────────────────
  const focalSize = sizeOf({ ...items[0], size: "large" });
  const results: LayoutResult[] = [{
    x: clampX(CX_MID - focalSize.w / 2),
    y: clampY(CY_MID - focalSize.h / 2),
    w: focalSize.w,
    h: focalSize.h,
  }];

  const rest = items.slice(1);
  if (!rest.length) return results;

  const restSizes = rest.map(sizeOf);
  const { orbitR, elementScale } = computeOrbitParams(rest.length, restSizes, 0.85);
  const angleStep = (2 * Math.PI) / rest.length;

  for (let i = 0; i < rest.length; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    const { w, h } = restSizes[i];
    const sw = Math.max(40, Math.round(w * elementScale));
    const sh = Math.max(30, Math.round(h * elementScale));
    const cx = CX_MID + orbitR * Math.cos(angle);
    const cy = CY_MID + orbitR * Math.sin(angle);
    results.push({ x: clampX(cx - sw / 2), y: clampY(cy - sh / 2), w: sw, h: sh });
  }
  return results;
}

function hierarchyLayout(items: LayoutItem[]): LayoutResult[] {
  if (!items.length) return [];
  const children = items.slice(1);
  const VGAP = 40;
  const TOP_PAD = 16;

  const rootRaw = sizeOf({ ...items[0], size: items[0].size ?? "large" });
  const childSizes = children.map(sizeOf);
  const childMaxH = childSizes.length ? Math.max(...childSizes.map((s) => s.h)) : 0;

  // Scale vertically so root + gap + children all fit within canvas height
  const neededH = rootRaw.h + (children.length ? VGAP + childMaxH : 0) + TOP_PAD * 2;
  const vScale = neededH > CH ? (CH - TOP_PAD) / (neededH - TOP_PAD) : 1;

  const rootH = Math.round(rootRaw.h * vScale);
  const rootW = Math.round(rootRaw.w * vScale);
  const results: LayoutResult[] = [{
    x: clampX(CX_MID - rootW / 2),
    y: CY_MIN + TOP_PAD,
    w: rootW,
    h: rootH,
  }];

  if (!children.length) return results;

  const scaledChildMaxH = Math.round(childMaxH * vScale);
  const rowCY = CY_MIN + TOP_PAD + rootH + VGAP + scaledChildMaxH / 2;
  // Use processHorizontalRow for horizontal fitting; scale heights by vScale
  const childRows = processHorizontalRow(children, rowCY);
  results.push(...childRows.map((r) => ({ ...r, h: Math.max(20, Math.round(r.h * vScale)) })));
  return results;
}

function comparisonLayout(items: LayoutItem[]): LayoutResult[] {
  if (!items.length) return [];
  const half = Math.ceil(items.length / 2);
  const maxRowsPerCol = Math.max(half, items.length - half);
  const sizes = items.map(sizeOf);
  const maxItemH = Math.max(...sizes.map((s) => s.h));

  // Compute a row height that fits all rows inside the canvas
  const ROW_GAP = 20;
  const TOP_PAD = 20;
  const totalNeeded = TOP_PAD + maxRowsPerCol * maxItemH + (maxRowsPerCol - 1) * ROW_GAP;
  const scale = totalNeeded > CH ? CH / totalNeeded : 1;
  const rowH = Math.round(maxItemH * scale);
  const rowGap = Math.max(6, Math.round(ROW_GAP * scale));
  const topPad = Math.round(TOP_PAD * scale);

  const results: LayoutResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const { w, h } = sizes[i];
    const col = i < half ? 0 : 1;
    const rowInCol = i < half ? i : i - half;
    const x = col === 0 ? clampX(CX_MIN + CW * 0.08) : clampX(CX_MIN + CW * 0.55);
    const y = clampY(CY_MIN + topPad + rowInCol * (rowH + rowGap));
    results.push({ x, y, w: Math.max(40, Math.round(w * scale)), h: Math.max(24, Math.round(h * scale)) });
  }
  return results;
}

function timelineLayout(items: LayoutItem[]): LayoutResult[] {
  // Like process-horizontal but elements sit above the midline (space for timeline bar below)
  return processHorizontal(items).map((r) => ({
    ...r,
    y: clampY(CY_MID - r.h - 20),
  }));
}

function twoColumnLayout(items: LayoutItem[]): LayoutResult[] {
  if (!items.length) return [];
  const numRows = Math.ceil(items.length / 2);
  const sizes = items.map(sizeOf);
  const maxItemH = Math.max(...sizes.map((s) => s.h));

  // Scale row height so all rows fit inside canvas
  const ROW_GAP = 20;
  const totalNeeded = numRows * maxItemH + (numRows - 1) * ROW_GAP + 40;
  const scale = totalNeeded > CH ? CH / totalNeeded : 1;
  const rowH = Math.round(maxItemH * scale);
  const rowGap = Math.max(6, Math.round(ROW_GAP * scale));

  const results: LayoutResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const { w, h } = sizes[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? clampX(CX_MIN + CW * 0.06) : clampX(CX_MIN + CW * 0.54);
    const y = clampY(CY_MIN + 20 + row * (rowH + rowGap));
    results.push({ x, y, w: Math.max(40, Math.round(w * scale)), h: Math.max(24, Math.round(h * scale)) });
  }
  return results;
}

/**
 * sequence — actors across the top (single horizontal row), any extra elements
 * stacked vertically below in a centred column (representing message steps).
 * Produces clean left-to-right actor lanes ideal for software interaction diagrams.
 */
function sequenceLayout(items: LayoutItem[]): LayoutResult[] {
  if (!items.length) return [];
  const actorTypes = new Set(["illustration", "icon", "shape"]);
  const actors = items.filter((it) => actorTypes.has(it.type));
  const steps = items.filter((it) => !actorTypes.has(it.type));

  const actorItems = actors.length ? actors : items;
  const stepItems = actors.length ? steps : [];

  const ACTOR_PAD = 16;
  const actorMaxH = Math.max(...actorItems.map((a) => sizeOf(a).h));
  const ACTOR_CY = CY_MIN + ACTOR_PAD + actorMaxH / 2;
  const results: LayoutResult[] = processHorizontalRow(actorItems, ACTOR_CY);

  if (stepItems.length) {
    const STEP_GAP = 14;
    const stepStart = CY_MIN + ACTOR_PAD + actorMaxH + 28;
    const stepSizes = stepItems.map(sizeOf);
    // Scale steps to fit remaining vertical space
    const totalStepH = stepSizes.reduce((s, sz) => s + sz.h, 0) + (stepItems.length - 1) * STEP_GAP;
    const availH = CY_MAX - stepStart;
    const stepScale = totalStepH > availH ? availH / totalStepH : 1;

    let stepY = stepStart;
    for (let i = 0; i < stepItems.length; i++) {
      const { w, h } = stepSizes[i];
      const sh = Math.max(20, Math.round(h * stepScale));
      const sw = Math.max(40, Math.round(w * stepScale));
      results.push({ x: clampX(CX_MID - sw / 2), y: clampY(stepY), w: sw, h: sh });
      stepY += sh + Math.round(STEP_GAP * stepScale);
    }
  }

  return results;
}

function architectureLayout(items: LayoutItem[]): LayoutResult[] {
  if (!items.length) return [];
  const results: LayoutResult[] = [];
  const cols = Math.min(3, Math.ceil(Math.sqrt(items.length)));
  const numRows = Math.ceil(items.length / cols);
  const cellW = CW / cols;
  const cellH = CH / numRows;
  const CELL_PAD = 0.82; // use 82% of each cell so elements have visible breathing room

  for (let i = 0; i < items.length; i++) {
    let { w, h } = sizeOf(items[i]);
    // Scale item down to fit within its grid cell
    const maxCellW = cellW * CELL_PAD;
    const maxCellH = cellH * CELL_PAD;
    if (w > maxCellW || h > maxCellH) {
      const s = Math.min(maxCellW / w, maxCellH / h);
      w = Math.max(30, Math.round(w * s));
      h = Math.max(20, Math.round(h * s));
    }
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = clampX(CX_MIN + col * cellW + (cellW - w) / 2);
    const y = clampY(CY_MIN + row * cellH + (cellH - h) / 2);
    results.push({ x, y, w, h });
  }
  return results;
}

/**
 * free — force-directed spread.
 * Starts from a grid and runs repulsion iterations so no two elements overlap.
 * Runs in O(n² × ITERS) but n is capped at 14 so this is always fast.
 */
function freeLayout(items: LayoutItem[]): LayoutResult[] {
  if (!items.length) return [];
  const n = items.length;
  const sizes = items.map(sizeOf);

  // Initial grid placement
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cellW = CW / cols;
  const cellH = CH / rows;

  const pos = sizes.map((sz, i) => ({
    x: CX_MIN + (i % cols) * cellW + (cellW - sz.w) / 2,
    y: CY_MIN + Math.floor(i / cols) * cellH + (cellH - sz.h) / 2,
    w: sz.w,
    h: sz.h,
  }));

  // Repulsion passes — push overlapping elements apart
  const ITERS = 50; // increased from 40 for better separation
  for (let iter = 0; iter < ITERS; iter++) {
    const step = Math.max(1, 24 - iter * 0.46);
    for (let i = 0; i < n; i++) {
      let fx = 0;
      let fy = 0;
      const pi = pos[i];
      const cxi = pi.x + pi.w / 2;
      const cyi = pi.y + pi.h / 2;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const pj = pos[j];
        const dx = cxi - (pj.x + pj.w / 2) || 0.01;
        const dy = cyi - (pj.y + pj.h / 2) || 0.01;
        const dist = Math.hypot(dx, dy) || 0.01;
        const minDist = (pi.w + pj.w) / 2 + 22;
        if (dist < minDist) {
          const push = (minDist - dist) / dist;
          fx += dx * push;
          fy += dy * push;
        }
      }
      if (Math.abs(fx) > 0.1 || Math.abs(fy) > 0.1) {
        const mag = Math.hypot(fx, fy) || 1;
        pi.x = Math.round(Math.min(Math.max(CX_MIN, pi.x + (fx / mag) * Math.min(mag, step)), CX_MAX - pi.w));
        pi.y = Math.round(Math.min(Math.max(CY_MIN, pi.y + (fy / mag) * Math.min(mag, step)), CY_MAX - pi.h));
      }
    }
  }
  return pos;
}

// ── Universal overlap safety net ──────────────────────────────────────────────

/**
 * Post-layout safety pass: nudges any still-overlapping elements apart.
 * Acts as a catch-all for edge cases in any layout function.
 * O(n² × 15) — for n ≤ 14 this completes in < 0.1 ms.
 */
function nudgeOverlaps(results: LayoutResult[]): LayoutResult[] {
  if (results.length < 2) return results;
  const PAD = 8; // minimum gap to enforce between every pair of elements
  const items = results.map((r) => ({ ...r })); // shallow copy

  for (let iter = 0; iter < 15; iter++) {
    let anyMoved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        // Positive overlap on both axes = elements are overlapping
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + PAD;
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + PAD;
        if (ox <= 0 || oy <= 0) continue;
        // Push apart along the axis with the smaller overlap
        anyMoved = true;
        if (ox <= oy) {
          const shift = Math.ceil(ox / 2);
          if (a.x + a.w / 2 <= b.x + b.w / 2) {
            a.x = Math.max(CX_MIN, a.x - shift);
            b.x = Math.min(CX_MAX - b.w, b.x + shift);
          } else {
            a.x = Math.min(CX_MAX - a.w, a.x + shift);
            b.x = Math.max(CX_MIN, b.x - shift);
          }
        } else {
          const shift = Math.ceil(oy / 2);
          if (a.y + a.h / 2 <= b.y + b.h / 2) {
            a.y = Math.max(CY_MIN, a.y - shift);
            b.y = Math.min(CY_MAX - b.h, b.y + shift);
          } else {
            a.y = Math.min(CY_MAX - a.h, a.y + shift);
            b.y = Math.max(CY_MIN, b.y - shift);
          }
        }
      }
    }
    if (!anyMoved) break;
  }
  return items;
}

// ── Public API ────────────────────────────────────────────────────────────────

function roundResults(results: LayoutResult[]): LayoutResult[] {
  return results.map((r) => {
    const w = Math.round(r.w);
    const h = Math.round(r.h);
    // Clamp top-left so the element's right/bottom edge also stays inside the canvas
    const x = Math.round(Math.min(Math.max(CX_MIN, r.x), CX_MAX - w));
    const y = Math.round(Math.min(Math.max(CY_MIN, r.y), CY_MAX - h));
    return { x, y, w, h };
  });
}

export function calculateLayout(layout: SemanticLayout, items: LayoutItem[]): LayoutResult[] {
  if (!items.length) return [];
  // Read the live canvas dimensions before every layout computation
  refreshBounds();

  let results: LayoutResult[];
  switch (layout) {
    case "process-horizontal":
      results = processHorizontal(items);
      break;
    case "process-vertical":
      results = processVertical(items);
      break;
    case "centered":
      results = centeredLayout(items);
      break;
    case "radial":
      results = radialLayout(items);
      break;
    case "hierarchy":
      results = hierarchyLayout(items);
      break;
    case "comparison":
      results = comparisonLayout(items);
      break;
    case "timeline":
      results = timelineLayout(items);
      break;
    case "two-column":
      results = twoColumnLayout(items);
      break;
    case "architecture":
      results = architectureLayout(items);
      break;
    case "sequence":
      results = sequenceLayout(items);
      break;
    case "free":
      results = freeLayout(items);
      break;
    default:
      results = processHorizontal(items);
      break;
  }
  // Universal safety net: nudge any residual overlaps from any layout function
  return roundResults(nudgeOverlaps(results));
}
