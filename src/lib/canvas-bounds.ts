/**
 * Live canvas bounds — updated by the Canvas component via ResizeObserver
 * whenever the canvas div is mounted or resized.
 *
 * All coordinate calculations (layout engine, overlap resolution, move/resize
 * clamping) read from here so they adapt to the actual rendered canvas size
 * instead of relying on hardcoded pixel constants.
 */

const EDGE_PAD = 0.05; // 5% padding on each edge so elements never kiss the border

let _w = 720; // sensible defaults until Canvas mounts and measures itself
let _h = 380;

/** Called by Canvas.tsx on mount and on every resize. */
export function setMeasuredCanvasSize(w: number, h: number) {
  if (w > 120 && h > 80) {
    _w = Math.round(w);
    _h = Math.round(h);
  }
}

/** Returns the current safe placement zone in canvas CSS pixels. */
export function getCanvasBounds() {
  const xMin = Math.round(_w * EDGE_PAD);
  const xMax = Math.round(_w * (1 - EDGE_PAD));
  const yMin = Math.round(_h * EDGE_PAD);
  const yMax = Math.round(_h * (1 - EDGE_PAD));
  return {
    xMin,
    xMax,
    yMin,
    yMax,
    xMid: Math.round((xMin + xMax) / 2),
    yMid: Math.round((yMin + yMax) / 2),
    cw: xMax - xMin,
    ch: yMax - yMin,
  };
}
