import rough from "roughjs";
import type { SketchTemplate, Point } from "./storyboard";

/**
 * Render hand-drawn rough sketch shapes onto an SVG element using Rough.js.
 */
export function drawRoughSketch(
  svgEl: SVGSVGElement,
  template: SketchTemplate,
  w: number,
  h: number,
  points?: Point[],
  color: string = "#2B2A28",
  strokeWidth: number = 2.5,
) {
  // Clear existing paths
  while (svgEl.firstChild) {
    svgEl.removeChild(svgEl.firstChild);
  }

  const rc = rough.svg(svgEl);
  const options = {
    stroke: color,
    strokeWidth,
    roughness: 1.8,
    bowing: 1.5,
  };

  let node: SVGElement | null = null;

  switch (template) {
    case "rough-circle":
      node = rc.ellipse(w / 2, h / 2, w * 0.88, h * 0.88, options);
      break;

    case "rough-box":
      node = rc.rectangle(w * 0.06, h * 0.06, w * 0.88, h * 0.88, options);
      break;

    case "rough-arrow": {
      const pathData = `M ${w * 0.1} ${h * 0.5} Q ${w * 0.5} ${h * 0.4} ${w * 0.85} ${h * 0.5}`;
      const lineNode = rc.path(pathData, options);
      const headData = `M ${w * 0.72} ${h * 0.3} L ${w * 0.88} ${h * 0.5} L ${w * 0.72} ${h * 0.7}`;
      const headNode = rc.path(headData, options);
      svgEl.appendChild(lineNode);
      svgEl.appendChild(headNode);
      return;
    }

    case "squiggle-underline": {
      const step = w / 6;
      let pathStr = `M 0 ${h / 2}`;
      for (let i = 0; i <= 6; i++) {
        const yOffset = i % 2 === 0 ? h * 0.3 : h * 0.7;
        pathStr += ` Q ${i * step + step / 2} ${yOffset} ${(i + 1) * step} ${h / 2}`;
      }
      node = rc.path(pathStr, options);
      break;
    }

    case "custom":
    default: {
      if (points && points.length > 1) {
        const pts: [number, number][] = points.map((p) => [p.x, p.y]);
        node = rc.linearPath(pts, options);
      } else {
        node = rc.rectangle(w * 0.05, h * 0.05, w * 0.9, h * 0.9, options);
      }
      break;
    }
  }

  if (node) {
    svgEl.appendChild(node);
  }
}
