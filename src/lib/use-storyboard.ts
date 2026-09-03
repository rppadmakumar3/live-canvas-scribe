import { useCallback, useEffect, useRef, useState } from "react";
import { initWebMCPPolyfill } from "./webmcp-polyfill";
import {
  EMPTY_STATE,
  STORAGE_KEY,
  resolveOverlap,
  uid,
  type Beat,
  type CanvasElement,
  type Connector,
  type ConnectorStyle,
  type ShapeType,
  type StickyColor,
  type StoryboardState,
} from "./storyboard";
import { getCanvasBounds } from "./canvas-bounds";
import { calculateLayout, type SemanticLayout, type LayoutItem } from "./layout-engine";
import { resolveAsset } from "./asset-resolver";
import type { VisualScenePlan, VisualPlanElement } from "./visual-planner";

type ToolLog = { id: string; name: string; detail: string; at: number };

const DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  circle: { w: 140, h: 140 },
  rectangle: { w: 180, h: 100 },
  triangle: { w: 180, h: 150 },
  arrow: { w: 140, h: 60 },
  icon: { w: 120, h: 120 },
  text: { w: 260, h: 64 },
};

export function useStoryboard() {
  const [state, setState] = useState<StoryboardState>(EMPTY_STATE);
  const [log, setLog] = useState<ToolLog[]>([]);
  const [toolsReady, setToolsReady] = useState(false);
  const [toolsManifest, setToolsManifest] = useState<{ name: string; description: string }[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const narrationRef = useRef("");

  // hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as StoryboardState);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const pushLog = useCallback((name: string, detail: string) => {
    setLog((l) => [{ id: uid("log"), name, detail, at: Date.now() }, ...l].slice(0, 40));
  }, []);

  const setNarration = useCallback((text: string) => {
    narrationRef.current = text;
  }, []);

  // ── Undo ring buffer (max 20 snapshots) ────────────────────────────────────
  const HISTORY_LIMIT = 20;
  const historyRef = useRef<StoryboardState[]>([]);

  const saveHistory = useCallback(() => {
    historyRef.current = [
      ...historyRef.current.slice(-(HISTORY_LIMIT - 1)),
      stateRef.current,
    ];
  }, []);

  const undo = useCallback(() => {
    const hist = historyRef.current;
    if (!hist.length) return { ok: false, reason: "nothing to undo" };
    const prev = hist[hist.length - 1];
    historyRef.current = hist.slice(0, -1);
    setState(prev);
    pushLog("undo", `restored ${prev.elements.length} elements`);
    return { ok: true };
  }, [pushLog]);

  /* ---------------- tool implementations ---------------- */

  const getCanvasState = useCallback(() => {
    const s = stateRef.current;
    pushLog("get_canvas_state", `${s.elements.length} elements, ${s.connectors.length} connectors`);
    const elementsSummary = s.elements.map((e) => ({
      id: e.id,
      type: e.kind === "text" ? "text" : e.shapeType,
      position: { x: e.x, y: e.y },
      size: { w: e.w, h: e.h },
      label: e.label ?? e.text ?? "",
    }));
    return Object.assign(elementsSummary, {
      elements: elementsSummary,
      connectors: s.connectors.map((c) => ({
        id: c.id,
        fromId: c.fromId,
        toId: c.toId,
        label: c.label ?? "",
      })),
      beats: s.beats.map((b) => ({ id: b.id, label: b.label })),
    });
  }, [pushLog]);

  const addTextBlock = useCallback(
    (text: string, position?: { x?: number; y?: number }) => {
      const size = DEFAULT_SIZE.text;
      const el: CanvasElement = {
        id: uid("txt"),
        kind: "text",
        text,
        x: 0,
        y: 0,
        ...size,
        createdAt: Date.now(),
      };
      setState((s) => {
        const pos = resolveOverlap(
          s.elements,
          position?.x ?? 80 + s.elements.length * 20,
          position?.y ?? 80 + s.elements.length * 10,
          size.w,
          size.h,
        );
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_text_block", `"${text}"`);
      return { id: el.id };
    },
    [pushLog],
  );

  const addMathBlock = useCallback(
    (latex: string, position?: { x?: number; y?: number }) => {
      const size = { w: 280, h: 80 };
      const el: CanvasElement = {
        id: uid("mth"),
        kind: "math",
        latex,
        text: latex,
        x: 0,
        y: 0,
        ...size,
        createdAt: Date.now(),
      };
      setState((s) => {
        const pos = resolveOverlap(
          s.elements,
          position?.x ?? 120 + s.elements.length * 30,
          position?.y ?? 120 + s.elements.length * 20,
          size.w,
          size.h,
        );
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_math_block", `"${latex}"`);
      return { id: el.id };
    },
    [pushLog],
  );
  const addEmoji = useCallback(
    (emoji: string, sizeMultiplier = 1, position?: { x?: number; y?: number }, label?: string) => {
      const size = { w: 80 * sizeMultiplier, h: 80 * sizeMultiplier };
      const el: CanvasElement = {
        id: uid("emj"),
        kind: "emoji",
        emoji,
        label,
        x: 0,
        y: 0,
        ...size,
        createdAt: Date.now(),
      };
      setState((s) => {
        const pos = resolveOverlap(
          s.elements,
          position?.x ?? 160 + s.elements.length * 60,
          position?.y ?? 200,
          size.w,
          size.h,
        );
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_emoji", `${emoji}${label ? ` · ${label}` : ""}`);
      return { id: el.id };
    },
    [pushLog],
  );

  const addShape = useCallback(
    (args: {
      shapeType: ShapeType;
      iconName?: string;
      position?: { x?: number; y?: number };
      label?: string;
    }) => {
      const size = DEFAULT_SIZE[args.shapeType] ?? DEFAULT_SIZE.rectangle;
      const el: CanvasElement = {
        id: uid(args.shapeType.slice(0, 3)),
        kind: "shape",
        shapeType: args.shapeType,
        iconName: args.iconName,
        label: args.label,
        x: 0,
        y: 0,
        ...size,
        createdAt: Date.now(),
      };
      setState((s) => {
        const pos = resolveOverlap(
          s.elements,
          args.position?.x ?? 160 + s.elements.length * 60,
          args.position?.y ?? 200,
          size.w,
          size.h,
        );
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_shape", `${args.shapeType}${args.label ? ` · ${args.label}` : ""}`);
      return { id: el.id };
    },
    [pushLog],
  );

  const addConnector = useCallback(
    (fromId: string, toId: string, label?: string) => {
      const s = stateRef.current;
      const lowerFrom = fromId.toLowerCase();
      const lowerTo = toId.toLowerCase();

      const from =
        s.elements.find((e) => e.id === fromId) ||
        s.elements.find((e) => e.label?.toLowerCase() === lowerFrom) ||
        s.elements.find((e) => e.text?.toLowerCase().includes(lowerFrom));

      const to =
        s.elements.find((e) => e.id === toId) ||
        s.elements.find((e) => e.label?.toLowerCase() === lowerTo) ||
        s.elements.find((e) => e.text?.toLowerCase().includes(lowerTo));

      if (!from || !to) {
        pushLog("add_connector", `failed: unknown element (${fromId} → ${toId})`);
        return { error: "One or both element ids do not exist on the canvas." };
      }
      const c: Connector = {
        id: uid("con"),
        fromId: from.id,
        toId: to.id,
        label,
        createdAt: Date.now(),
      };
      setState((prev) => ({ ...prev, connectors: [...prev.connectors, c] }));
      pushLog(
        "add_connector",
        `${from.label ?? from.text} → ${to.label ?? to.text}${label ? ` (${label})` : ""}`,
      );
      return { id: c.id };
    },
    [pushLog],
  );

  const updateConnector = useCallback(
    (connectorId: string, label?: string) => {
      setState((s) => ({
        ...s,
        connectors: s.connectors.map((c) =>
          c.id === connectorId ? { ...c, ...(label !== undefined ? { label } : {}) } : c,
        ),
      }));
      pushLog("update_connector", `${connectorId} label="${label ?? ""}"`);
      return { ok: true };
    },
    [pushLog],
  );

  const addStickyNote = useCallback(
    (text: string, color: StickyColor = "yellow", position?: { x?: number; y?: number }) => {
      const size = { w: 180, h: 140 };
      const el: CanvasElement = {
        id: uid("stk"),
        kind: "sticky",
        shapeType: "sticky",
        text,
        stickyColor: color,
        x: 0,
        y: 0,
        ...size,
        createdAt: Date.now(),
      };
      setState((s) => {
        const pos = resolveOverlap(
          s.elements,
          position?.x ?? 120 + s.elements.length * 40,
          position?.y ?? 140 + s.elements.length * 20,
          size.w,
          size.h,
        );
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_sticky_note", `"${text}" (${color})`);
      return { id: el.id };
    },
    [pushLog],
  );

  const addStroke = useCallback(
    (points: Point[], color = "#2B2A28", strokeWidth = 3) => {
      if (!points.length) return { error: "No points provided" };
      const minX = Math.min(...points.map((p) => p.x));
      const minY = Math.min(...points.map((p) => p.y));
      const maxX = Math.max(...points.map((p) => p.x));
      const maxY = Math.max(...points.map((p) => p.y));
      const w = Math.max(20, maxX - minX);
      const h = Math.max(20, maxY - minY);

      const el: CanvasElement = {
        id: uid("str"),
        kind: "stroke",
        points,
        color,
        strokeWidth,
        x: minX,
        y: minY,
        w,
        h,
        createdAt: Date.now(),
      };
      setState((s) => ({ ...s, elements: [...s.elements, el] }));
      pushLog("draw_freehand_stroke", `${points.length} points`);
      return { id: el.id };
    },
    [pushLog],
  );

  const groupIntoBeat = useCallback(
    (beatLabel: string) => {
      let created: Beat | null = null;
      setState((s) => {
        const claimedEl = new Set(s.beats.flatMap((b) => b.elementIds));
        const claimedCon = new Set(s.beats.flatMap((b) => b.connectorIds));
        const elementIds = s.elements.filter((e) => !claimedEl.has(e.id)).map((e) => e.id);
        const connectorIds = s.connectors.filter((c) => !claimedCon.has(c.id)).map((c) => c.id);
        if (!elementIds.length && !connectorIds.length) return s;
        created = {
          id: uid("beat"),
          label: beatLabel,
          elementIds,
          connectorIds,
          narration: narrationRef.current,
          createdAt: Date.now(),
        };
        narrationRef.current = "";
        return { ...s, beats: [...s.beats, created] };
      });
      pushLog("group_into_beat", beatLabel);
      return { ok: true, beatLabel };
    },
    [pushLog],
  );

  const addSketch = useCallback(
    (
      template: SketchTemplate = "rough-box",
      points?: Point[],
      position?: { x?: number; y?: number },
      color = "#2B2A28",
    ) => {
      const size = { w: 200, h: 140 };
      const el: CanvasElement = {
        id: uid("skc"),
        kind: "sketch",
        template,
        points,
        color,
        x: 0,
        y: 0,
        ...size,
        createdAt: Date.now(),
      };
      setState((s) => {
        const pos = resolveOverlap(
          s.elements,
          position?.x ?? 200 + s.elements.length * 30,
          position?.y ?? 200 + s.elements.length * 20,
          size.w,
          size.h,
        );
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_sketch", `${template}`);
      return { id: el.id };
    },
    [pushLog],
  );

  const addImage = useCallback(
    (
      source: string,
      position?: { x?: number; y?: number },
      size?: { width?: number; height?: number },
    ) => {
      const w = size?.width ?? 220;
      const h = size?.height ?? 160;
      const el: CanvasElement = {
        id: uid("img"),
        kind: "image",
        source,
        x: 0,
        y: 0,
        w,
        h,
        createdAt: Date.now(),
      };
      setState((s) => {
        const pos = resolveOverlap(
          s.elements,
          position?.x ?? 220 + s.elements.length * 40,
          position?.y ?? 180 + s.elements.length * 20,
          w,
          h,
        );
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_image", source.slice(0, 24));
      return { id: el.id };
    },
    [pushLog],
  );

  const addHighlight = useCallback(
    (
      targetId?: string,
      position?: { x?: number; y?: number },
      size?: { width?: number; height?: number },
    ) => {
      const s = stateRef.current;
      const target = targetId ? s.elements.find((e) => e.id === targetId) : null;
      const x = target ? target.x - 12 : (position?.x ?? 150);
      const y = target ? target.y - 12 : (position?.y ?? 150);
      const w = target ? target.w + 24 : (size?.width ?? 260);
      const h = target ? target.h + 24 : (size?.height ?? 140);

      const el: CanvasElement = {
        id: uid("hlt"),
        kind: "highlight",
        targetId,
        zIndex: -1, // send behind target by default
        x,
        y,
        w,
        h,
        createdAt: Date.now(),
      };
      setState((prev) => ({ ...prev, elements: [el, ...prev.elements] }));
      pushLog(
        "add_highlight",
        target ? `behind ${target.label || target.text || target.id}` : "custom area",
      );
      return { id: el.id };
    },
    [pushLog],
  );

  const setLayerOrder = useCallback(
    (elementId: string, direction: "front" | "back") => {
      setState((s) => {
        const idx = s.elements.findIndex((e) => e.id === elementId);
        if (idx === -1) return s;
        const target = s.elements[idx];
        const rest = s.elements.filter((e) => e.id !== elementId);
        const newElements = direction === "front" ? [...rest, target] : [target, ...rest];
        return { ...s, elements: newElements };
      });
      pushLog("set_layer_order", `${elementId} → ${direction}`);
      return { ok: true };
    },
    [pushLog],
  );

  const updateTextStyle = useCallback(
    (elementId: string, bold?: boolean, size?: "small" | "medium" | "large", color?: string) => {
      setState((s) => ({
        ...s,
        elements: s.elements.map((e) => {
          if (e.id !== elementId) return e;
          return {
            ...e,
            textStyle: {
              ...e.textStyle,
              ...(bold !== undefined ? { bold } : {}),
              ...(size ? { size } : {}),
              ...(color ? { color } : {}),
            },
          };
        }),
      }));
      pushLog("update_text_style", elementId);
      return { ok: true };
    },
    [pushLog],
  );

  const addFrame = useCallback(
    (label: string, elementIds: string[]) => {
      const s = stateRef.current;
      const targetEls = s.elements.filter((e) => elementIds.includes(e.id));
      if (!targetEls.length) return { error: "No matching elementIds found" };

      const minX = Math.min(...targetEls.map((e) => e.x)) - 24;
      const minY = Math.min(...targetEls.map((e) => e.y)) - 36;
      const maxX = Math.max(...targetEls.map((e) => e.x + e.w)) + 24;
      const maxY = Math.max(...targetEls.map((e) => e.y + e.h)) + 24;

      const frameEl: CanvasElement = {
        id: uid("frm"),
        kind: "frame",
        frameLabel: label,
        frameElementIds: elementIds,
        x: Math.max(0, minX),
        y: Math.max(0, minY),
        w: maxX - minX,
        h: maxY - minY,
        zIndex: -2,
        createdAt: Date.now(),
      };

      setState((prev) => ({ ...prev, elements: [frameEl, ...prev.elements] }));
      pushLog("add_frame", `"${label}" (${elementIds.length} elements)`);
      return { id: frameEl.id };
    },
    [pushLog],
  );

  const moveElement = useCallback((id: string, x: number, y: number) => {
    setState((s) => {
      const target = s.elements.find((e) => e.id === id);
      if (!target) return s;

      // Clamp so element stays fully inside the live canvas safe zone
      const { xMin, xMax, yMin, yMax } = getCanvasBounds();
      const cx = Math.max(xMin, Math.min(x, xMax - target.w));
      const cy = Math.max(yMin, Math.min(y, yMax - target.h));
      const dx = cx - target.x;
      const dy = cy - target.y;

      // If moving a frame, move all grouped elements inside it
      if (target.kind === "frame" && target.frameElementIds) {
        const memberIds = new Set(target.frameElementIds);
        return {
          ...s,
          elements: s.elements.map((e) => {
            if (e.id === id || memberIds.has(e.id)) {
              return {
                ...e,
                x: Math.max(xMin, Math.min(e.x + dx, xMax - e.w)),
                y: Math.max(yMin, Math.min(e.y + dy, yMax - e.h)),
              };
            }
            return e;
          }),
        };
      }

      return {
        ...s,
        elements: s.elements.map((e) => (e.id === id ? { ...e, x: cx, y: cy } : e)),
      };
    });
  }, []);

  const resizeElement = useCallback((id: string, w: number, h: number) => {
    setState((s) => {
      const { cw, ch } = getCanvasBounds();
      return {
        ...s,
        elements: s.elements.map((e) =>
          e.id === id
            ? { ...e, w: Math.max(48, Math.min(cw, w)), h: Math.max(40, Math.min(ch, h)) }
            : e,
        ),
      };
    });
  }, []);

  const updateElementText = useCallback((id: string, text: string) => {
    setState((s) => ({
      ...s,
      elements: s.elements.map((e) => (e.id === id ? { ...e, text } : e)),
    }));
  }, []);

  const updateElementLabel = useCallback((id: string, label: string) => {
    setState((s) => ({
      ...s,
      elements: s.elements.map((e) => (e.id === id ? { ...e, label } : e)),
    }));
  }, []);

  const deleteElement = useCallback(
    (id: string) => {
      saveHistory();
      setState((s) => ({
        elements: s.elements.filter((e) => e.id !== id),
        connectors: s.connectors.filter((c) => c.fromId !== id && c.toId !== id),
        beats: s.beats.map((b) => ({ ...b, elementIds: b.elementIds.filter((e) => e !== id) })),
      }));
      pushLog("remove_element", id);
    },
    [pushLog, saveHistory],
  );

  const updateElement = useCallback(
    (id: string, changes: Partial<CanvasElement>) => {
      setState((s) => ({
        ...s,
        elements: s.elements.map((e) => (e.id === id ? { ...e, ...changes } : e)),
      }));
      pushLog("update_element", id);
    },
    [pushLog],
  );

  const emphasizeElement = useCallback(
    (id: string) => {
      setState((s) => ({
        ...s,
        elements: s.elements.map((e) => (e.id === id ? { ...e, emphasizedAt: Date.now() } : e)),
      }));
      pushLog("emphasize_element", id);
    },
    [pushLog],
  );

  const clearRegion = useCallback(
    (area: { x: number; y: number; width: number; height: number }) => {
      setState((s) => {
        const inRegion = s.elements.filter((e) => {
          return (
            e.x >= area.x &&
            e.x + e.w <= area.x + area.width &&
            e.y >= area.y &&
            e.y + e.h <= area.y + area.height
          );
        });
        const inRegionIds = new Set(inRegion.map((e) => e.id));
        if (inRegionIds.size > 0) {
          setTimeout(() => {
            setState((prev) => ({
              ...prev,
              elements: prev.elements.filter((el) => !inRegionIds.has(el.id)),
              connectors: prev.connectors.filter(
                (c) => !inRegionIds.has(c.fromId) && !inRegionIds.has(c.toId),
              ),
              beats: prev.beats.map((b) => ({
                ...b,
                elementIds: b.elementIds.filter((id) => !inRegionIds.has(id)),
              })),
            }));
          }, 300);
        }
        return {
          ...s,
          elements: s.elements.map((e) =>
            inRegionIds.has(e.id) ? { ...e, isFadingOut: true } : e,
          ),
        };
      });
      pushLog("clear_region", `x:${area.x} y:${area.y}`);
    },
    [pushLog],
  );

  const addFlowchartNode = useCallback(
    (
      nodeType: "process" | "decision" | "start_end" | "input_output",
      label: string,
      position?: { x?: number; y?: number },
    ) => {
      const w = nodeType === "decision" ? 160 : 180;
      const h = nodeType === "decision" ? 120 : 80;
      const el: CanvasElement = {
        id: uid("flw"),
        kind: "shape",
        shapeType: "flowchart",
        nodeType,
        label,
        x: 0,
        y: 0,
        w,
        h,
        createdAt: Date.now(),
      };
      setState((s) => {
        const pos = resolveOverlap(
          s.elements,
          position?.x ?? 200 + s.elements.length * 30,
          position?.y ?? 200 + s.elements.length * 20,
          w,
          h,
        );
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_flowchart_node", nodeType);
      return { id: el.id };
    },
    [pushLog],
  );

  const setFillColor = useCallback(
    (id: string, color: string) => {
      setState((s) => ({
        ...s,
        elements: s.elements.map((e) => (e.id === id ? { ...e, fillColor: color } : e)),
      }));
      pushLog("set_fill_color", `${color}`);
    },
    [pushLog],
  );

  const addIllustration = useCallback(
    (
      semantic: string,
      svgContent: string,
      position?: { x?: number; y?: number },
      size?: { w?: number; h?: number },
      label?: string,
    ) => {
      const w = size?.w ?? 120;
      const h = size?.h ?? 120;
      const el: CanvasElement = {
        id: uid("ill"),
        kind: "illustration",
        semantic,
        svgContent,
        label,
        x: 0,
        y: 0,
        w,
        h,
        createdAt: Date.now(),
      };
      setState((s) => {
        const pos = resolveOverlap(
          s.elements,
          position?.x ?? 160 + s.elements.length * 40,
          position?.y ?? 180,
          w,
          h,
        );
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_illustration", `${semantic}${label ? ` · ${label}` : ""}`);
      return { id: el.id };
    },
    [pushLog],
  );

  const addCodeBlock = useCallback(
    (
      code: string,
      language = "text",
      position?: { x?: number; y?: number },
      size?: { w?: number; h?: number },
    ) => {
      const w = size?.w ?? 300;
      const h = size?.h ?? 180;
      const el: CanvasElement = {
        id: uid("cod"),
        kind: "code",
        text: code,
        codeLanguage: language,
        x: 0,
        y: 0,
        w,
        h,
        createdAt: Date.now(),
      };
      setState((s) => {
        const pos = resolveOverlap(
          s.elements,
          position?.x ?? 180 + s.elements.length * 30,
          position?.y ?? 160,
          w,
          h,
        );
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_code_block", `${language}: ${code.slice(0, 30)}`);
      return { id: el.id };
    },
    [pushLog],
  );

  const addTimelineEvent = useCallback(
    (label: string, date?: string, position?: { x?: number; y?: number }) => {
      const displayText = date ? `${date} · ${label}` : label;
      const size = { w: 140, h: 60 };
      const el: CanvasElement = {
        id: uid("tev"),
        kind: "text",
        text: displayText,
        textStyle: { size: "small" },
        x: 0,
        y: 0,
        ...size,
        createdAt: Date.now(),
      };
      const { xMin, yMid } = getCanvasBounds();
      setState((s) => {
        const evCount = s.elements.filter((e) => e.id.startsWith("tev")).length;
        const pos = resolveOverlap(
          s.elements,
          position?.x ?? xMin + 20 + evCount * 160,
          position?.y ?? yMid - size.h / 2,
          size.w,
          size.h,
        );
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_timeline_event", `"${label}"${date ? ` (${date})` : ""}`);
      return { id: el.id };
    },
    [pushLog],
  );

  const addCallout = useCallback(
    (text: string, targetId?: string, position?: { x?: number; y?: number }) => {
      const size = { w: 180, h: 90 };
      const target = targetId ? stateRef.current.elements.find((e) => e.id === targetId) : null;
      const el: CanvasElement = {
        id: uid("cal"),
        kind: "callout",
        text,
        calloutTargetId: targetId,
        x: 0,
        y: 0,
        ...size,
        createdAt: Date.now(),
      };
      setState((s) => {
        const defX = target ? target.x + target.w + 16 : (position?.x ?? 200);
        const defY = target ? target.y : (position?.y ?? 150);
        const pos = resolveOverlap(s.elements, position?.x ?? defX, position?.y ?? defY, size.w, size.h);
        return { ...s, elements: [...s.elements, { ...el, ...pos }] };
      });
      pushLog("add_callout", `"${text}"`);
      return { id: el.id };
    },
    [pushLog],
  );

  const duplicateElement = useCallback(
    (elementId: string) => {
      const src = stateRef.current.elements.find((e) => e.id === elementId);
      if (!src) return { error: "Element not found" };
      const newEl: CanvasElement = {
        ...src,
        id: uid(src.kind.slice(0, 3)),
        x: src.x + 28,
        y: src.y + 28,
        createdAt: Date.now(),
        emphasizedAt: undefined,
        isFadingOut: undefined,
      };
      setState((s) => ({ ...s, elements: [...s.elements, newEl] }));
      pushLog("duplicate_element", src.label ?? src.text ?? elementId);
      return { id: newEl.id };
    },
    [pushLog],
  );

  const setConnectorStyle = useCallback(
    (connectorId: string, style: ConnectorStyle) => {
      setState((s) => ({
        ...s,
        connectors: s.connectors.map((c) =>
          c.id === connectorId ? { ...c, style } : c,
        ),
      }));
      pushLog("set_connector_style", connectorId);
      return { ok: true };
    },
    [pushLog],
  );

  const pinElement = useCallback(
    (elementId: string, pinned: boolean) => {
      setState((s) => ({
        ...s,
        elements: s.elements.map((e) =>
          e.id === elementId ? { ...e, isPinned: pinned } : e,
        ),
      }));
      pushLog("pin_element", `${elementId} → ${pinned ? "pinned" : "unpinned"}`);
      return { ok: true };
    },
    [pushLog],
  );

  const setTheme = useCallback(
    (theme: "light" | "dark" | "sepia" | "blackboard") => {
      if (typeof document !== "undefined") {
        if (theme === "light") {
          document.documentElement.removeAttribute("data-theme");
        } else {
          document.documentElement.setAttribute("data-theme", theme);
        }
      }
      pushLog("set_theme", theme);
      return { ok: true };
    },
    [pushLog],
  );

  /**
   * applyVisualScene — batch-applies a VisualScenePlan produced by the AI planner.
   * Runs layout engine → resolves assets → creates elements + connectors → groups into beat.
   */
  const applyVisualScene = useCallback(
    async (plan: VisualScenePlan) => {
      if (!plan?.elements?.length) return { ok: false, reason: "empty plan" };
      // Validate required fields — reject malformed plans from external agents
      if (!plan.layout || !Array.isArray(plan.elements)) {
        return { ok: false, reason: "invalid plan: missing layout or elements" };
      }
      saveHistory(); // snapshot before any canvas mutations so Ctrl+Z can restore
      try {
      const elements = plan.elements;

      // Build layout items for size hints
      const layoutItems: LayoutItem[] = elements.map((e) => ({
        type: e.type === "illustration" || e.type === "icon" ? "illustration" : e.type,
        size: e.size ?? "medium",
      }));

      let positions = calculateLayout(plan.layout, layoutItems);

      // Resolve assets in parallel
      const assetResults = await Promise.all(
        elements.map((e) =>
          e.semantic ? resolveAsset(e.semantic) : Promise.resolve({ type: "none" as const }),
        ),
      );

      // Handle new_scene: clear ALL existing elements so the canvas starts fresh
      if (plan.action === "new_scene") {
        setState((s) => ({
          ...s,
          elements: s.elements.map((e) => ({ ...e, isFadingOut: true })),
        }));
        await new Promise((r) => setTimeout(r, 340));
        setState((s) => ({ elements: [], connectors: [], beats: s.beats }));
        await new Promise((r) => setTimeout(r, 60));
      }

      // Handle replace_beat: fade out and remove the most recent beat's elements first
      if (plan.action === "replace_beat") {
        setState((s) => {
          const lastBeat = s.beats[s.beats.length - 1];
          if (!lastBeat) return s;
          const removeIds = new Set(lastBeat.elementIds);
          const removeConIds = new Set(lastBeat.connectorIds);
          return {
            elements: s.elements.filter((e) => !removeIds.has(e.id)),
            connectors: s.connectors.filter((c) => !removeConIds.has(c.id)),
            beats: s.beats.slice(0, -1), // drop the last beat
          };
        });
        await new Promise((r) => setTimeout(r, 80));
      }

      // Handle removeIds: fade out then delete stale elements from any previous beat
      if (Array.isArray(plan.removeIds) && plan.removeIds.length > 0) {
        const removeSet = new Set(plan.removeIds);
        // Phase 1: trigger CSS fade-out transition
        setState((s) => ({
          ...s,
          elements: s.elements.map((e) => (removeSet.has(e.id) ? { ...e, isFadingOut: true } : e)),
        }));
        // Phase 2: hard-delete after the 300 ms CSS transition finishes
        await new Promise((r) => setTimeout(r, 340));
        setState((s) => {
          const removedConIds = new Set(
            s.connectors
              .filter((c) => removeSet.has(c.fromId) || removeSet.has(c.toId))
              .map((c) => c.id),
          );
          return {
            ...s,
            elements: s.elements.filter((e) => !removeSet.has(e.id)),
            connectors: s.connectors.filter((c) => !removedConIds.has(c.id)),
            beats: s.beats.map((b) => ({
              ...b,
              elementIds: b.elementIds.filter((id) => !removeSet.has(id)),
              connectorIds: b.connectorIds.filter((id) => !removedConIds.has(id)),
            })),
          };
        });
      }

      const createdMap: Record<string, string> = {}; // planElementId → canvasElementId

      // ── Smart placement: prevent new batch from landing on top of existing elements ──
      // Only runs for "add" action (new_scene / replace_beat already cleared the canvas).
      if ((plan.action === "add" || !plan.action) && positions.length > 0) {
        const existing = stateRef.current.elements.filter((e) => !e.isFadingOut);
        if (existing.length > 0) {
          const PAD = 14; // px buffer — elements within 14 px count as overlapping
          const overlapping = positions.filter((pos) =>
            existing.some(
              (e) =>
                pos.x < e.x + e.w + PAD &&
                pos.x + pos.w > e.x - PAD &&
                pos.y < e.y + e.h + PAD &&
                pos.y + pos.h > e.y - PAD,
            ),
          ).length;

          if (overlapping / positions.length > 0.3) {
            const { yMin, yMax } = getCanvasBounds();
            const existingBottom = Math.max(...existing.map((e) => e.y + e.h));
            const newTop = Math.min(...positions.map((p) => p.y));
            const newBottom = Math.max(...positions.map((p) => p.y + p.h));
            const batchH = newBottom - newTop;
            const shiftTop = existingBottom + 20;

            if (shiftTop + batchH <= yMax) {
              // ✅ Room below: shift the whole batch down without clearing
              const dy = shiftTop - newTop;
              positions = positions.map((p) => ({
                ...p,
                y: Math.min(Math.max(yMin, p.y + dy), yMax - p.h),
              }));
            } else {
              // ❌ No room to shift — fade out existing content and start fresh
              setState((s) => ({
                ...s,
                elements: s.elements.map((e) => ({ ...e, isFadingOut: true })),
              }));
              await new Promise((r) => setTimeout(r, 340));
              setState((s) => ({ elements: [], connectors: [], beats: s.beats }));
              await new Promise((r) => setTimeout(r, 60));
            }
          }
        }
      }

      // Create each element
      setState((s) => {
        let newElements = [...s.elements];
        // Track only elements added in THIS batch for intra-batch overlap resolution.
        // We do NOT resolve against previous beats' elements — the layout engine already
        // placed this scene's elements across the full canvas, and nudging against old
        // elements would fight the intended layout and cause clustering.
        let batchElements: CanvasElement[] = [];

        elements.forEach((planEl, i) => {
          const rawPos = positions[i] ?? { x: 80 + i * 140, y: 160, w: 120, h: 120 };
          // Resolve only within the current batch to prevent intra-scene stacking
          const resolved = resolveOverlap(batchElements, rawPos.x, rawPos.y, rawPos.w, rawPos.h);
          const pos = { ...rawPos, x: resolved.x, y: resolved.y };
          const asset = assetResults[i];
          let el: CanvasElement | null = null;
          const baseId = uid(planEl.type.slice(0, 3));
          createdMap[planEl.id] = baseId;

          if (planEl.type === "illustration" || planEl.type === "icon") {
            let svgContent = "";
            if (asset.type === "local-svg" || asset.type === "iconify-svg" || asset.type === "ai-svg") {
              svgContent = asset.value;
            }
            el = {
              id: baseId,
              kind: "illustration",
              semantic: planEl.semantic,
              svgContent: svgContent || undefined,
              label: planEl.label,
              emoji: asset.type === "emoji" ? asset.value : undefined,
              x: pos.x,
              y: pos.y,
              w: pos.w,
              h: pos.h,
              createdAt: Date.now(),
            };
          } else if (planEl.type === "equation") {
            el = {
              id: baseId,
              kind: "math",
              latex: planEl.content ?? "",
              text: planEl.content ?? "",
              x: pos.x,
              y: pos.y,
              w: pos.w,
              h: pos.h,
              createdAt: Date.now(),
            };
          } else if (planEl.type === "code") {
            el = {
              id: baseId,
              kind: "code",
              text: planEl.content ?? "",
              codeLanguage: planEl.codeLanguage ?? "text",
              x: pos.x,
              y: pos.y,
              w: pos.w,
              h: pos.h,
              createdAt: Date.now(),
            };
          } else if (planEl.type === "heading") {
            el = {
              id: baseId,
              kind: "text",
              text: planEl.content ?? planEl.label ?? "",
              textStyle: { bold: true, size: "large" },
              x: pos.x,
              y: pos.y,
              w: pos.w,
              h: pos.h,
              createdAt: Date.now(),
            };
          } else if (planEl.type === "text") {
            el = {
              id: baseId,
              kind: "text",
              text: planEl.content ?? planEl.label ?? "",
              x: pos.x,
              y: pos.y,
              w: pos.w,
              h: pos.h,
              createdAt: Date.now(),
            };
          } else if (planEl.type === "sticky" || planEl.type === "callout") {
            el = {
              id: baseId,
              kind: "sticky",
              shapeType: "sticky",
              text: planEl.content ?? planEl.label ?? "",
              stickyColor: "amber",
              x: pos.x,
              y: pos.y,
              w: Math.max(pos.w, 170),
              h: Math.max(pos.h, 130),
              createdAt: Date.now(),
            };
          } else if (planEl.type === "shape") {
            const shapeTypeMap: Record<string, ShapeType> = {
              circle: "circle",
              rectangle: "rectangle",
              diamond: "flowchart",
              arrow: "arrow",
              triangle: "triangle",
            };
            el = {
              id: baseId,
              kind: "shape",
              shapeType: shapeTypeMap[planEl.shapeType ?? "rectangle"] ?? "rectangle",
              nodeType: planEl.shapeType === "diamond" ? "decision" : undefined,
              label: planEl.label,
              x: pos.x,
              y: pos.y,
              w: pos.w,
              h: pos.h,
              createdAt: Date.now(),
            };
          }

          if (el) {
            newElements = [...newElements, el];
            batchElements = [...batchElements, el];
          }
        });

        return { ...s, elements: newElements };
      });

      // Small delay to let state settle before adding connectors
      await new Promise((r) => setTimeout(r, 60));

      // Create connectors using the mapped IDs
      for (const conn of plan.connections) {
        const fromId = createdMap[conn.from];
        const toId = createdMap[conn.to];
        if (fromId && toId) {
          const c: Connector = {
            id: uid("con"),
            fromId,
            toId,
            label: conn.label,
            createdAt: Date.now(),
          };
          setState((s) => ({ ...s, connectors: [...s.connectors, c] }));
          pushLog(
            "add_connector",
            `${conn.from} → ${conn.to}${conn.label ? ` (${conn.label})` : ""}`,
          );
        }
      }

      // Group into beat
      await new Promise((r) => setTimeout(r, 60));
      groupIntoBeat(plan.groupLabel);

      pushLog("apply_visual_scene", `${plan.layout} · ${elements.length} elements`);
      return { ok: true };
      } catch (err) {
        // Restore canvas to pre-call snapshot so a bad external plan never leaves it broken
        undo();
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Storyboard Live] apply_visual_scene failed, canvas restored:", msg);
        return { ok: false, reason: msg };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pushLog, groupIntoBeat, saveHistory, undo],
  );

  const clearAll = useCallback(() => {
    saveHistory();
    setState(EMPTY_STATE);
  }, [saveHistory]);

  /* ---------------- WebMCP registration ---------------- */

  useEffect(() => {
    const mc = initWebMCPPolyfill();

    const tools = [
      {
        name: "get_canvas_state",
        description:
          "Returns all current elements on the canvas with their pixel coordinates (safe zone x: 60–720, y: 60–380), so new elements can be placed without overlapping existing ones",
        inputSchema: { type: "object", properties: {} },
        execute: async () => getCanvasState(),
      },
      {
        name: "add_text_block",
        description:
          "Adds a text element to the canvas at a given position, with the standard reveal animation",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
          },
          required: ["text"],
        },
        execute: async ({ text, position }: any) => addTextBlock(text, position),
      },
      {
        name: "add_math_block",
        description: "Adds a rendered mathematical expression to the canvas, written in LaTeX",
        inputSchema: {
          type: "object",
          properties: {
            latex: { type: "string", description: "LaTeX source, e.g. 'a^2 + b^2 = c^2'" },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
          },
          required: ["latex"],
        },
        execute: async ({ latex, position }: any) => addMathBlock(latex, position),
      },
      {
        name: "add_shape",
        description:
          "Adds a shape (circle, rectangle, arrow or icon) to the canvas at a given position",
        inputSchema: {
          type: "object",
          properties: {
            shapeType: { type: "string", enum: ["circle", "rectangle", "arrow", "icon"] },
            iconName: {
              type: "string",
              description:
                "Required only when shapeType is 'icon' — name from the fixed icon library",
            },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
            label: { type: "string" },
          },
          required: ["shapeType"],
        },
        execute: async (args: any) => addShape(args),
      },
      {
        name: "add_sketch",
        description:
          "Adds a freehand sketch stroke to the canvas, either from explicit point data or a named rough-sketch template",
        inputSchema: {
          type: "object",
          properties: {
            template: {
              type: "string",
              enum: ["squiggle-underline", "rough-circle", "rough-arrow", "rough-box", "custom"],
            },
            points: {
              type: "array",
              description: "Required only when template is 'custom' — list of {x, y} points",
            },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
            color: { type: "string" },
          },
        },
        execute: async ({ template, points, position, color }: any) =>
          addSketch(template, points, position, color),
      },
      {
        name: "add_image",
        description:
          "Adds an image to the canvas, either from a URL, an uploaded data URL, or the bundled icon/illustration set",
        inputSchema: {
          type: "object",
          properties: {
            source: { type: "string", description: "URL, data URL, or bundled-icon short name" },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
            size: {
              type: "object",
              properties: { width: { type: "number" }, height: { type: "number" } },
            },
          },
          required: ["source"],
        },
        execute: async ({ source, position, size }: any) => addImage(source, position, size),
      },
      {
        name: "add_sticky_note",
        description: "Adds a colored sticky note with editable text",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            color: { type: "string", enum: ["amber", "teal", "coral"] },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
          },
          required: ["text"],
        },
        execute: async ({ text, color, position }: any) => addStickyNote(text, color, position),
      },
      {
        name: "add_highlight",
        description:
          "Adds a semi-transparent highlight over an area or existing element to draw attention to it",
        inputSchema: {
          type: "object",
          properties: {
            targetId: {
              type: "string",
              description: "Optional — id of an existing element to highlight behind",
            },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
            size: {
              type: "object",
              properties: { width: { type: "number" }, height: { type: "number" } },
            },
          },
        },
        execute: async ({ targetId, position, size }: any) =>
          addHighlight(targetId, position, size),
      },
      {
        name: "remove_element",
        description: "Deletes an element from the canvas by id",
        inputSchema: {
          type: "object",
          properties: { elementId: { type: "string" } },
          required: ["elementId"],
        },
        execute: async ({ elementId }: any) => deleteElement(elementId),
      },
      {
        name: "set_layer_order",
        description: "Moves an element to the front or back of the layer stack",
        inputSchema: {
          type: "object",
          properties: {
            elementId: { type: "string" },
            direction: { type: "string", enum: ["front", "back"] },
          },
          required: ["elementId", "direction"],
        },
        execute: async ({ elementId, direction }: any) => setLayerOrder(elementId, direction),
      },
      {
        name: "update_text_style",
        description: "Updates the style of an existing text element",
        inputSchema: {
          type: "object",
          properties: {
            elementId: { type: "string" },
            bold: { type: "boolean" },
            size: { type: "string", enum: ["small", "medium", "large"] },
            color: { type: "string" },
          },
          required: ["elementId"],
        },
        execute: async ({ elementId, bold, size, color }: any) =>
          updateTextStyle(elementId, bold, size, color),
      },
      {
        name: "add_frame",
        description:
          "Adds a labeled frame that visually groups a set of existing elements, movable as one unit",
        inputSchema: {
          type: "object",
          properties: {
            label: { type: "string" },
            elementIds: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["label", "elementIds"],
        },
        execute: async ({ label, elementIds }: any) => addFrame(label, elementIds),
      },
      {
        name: "add_connector",
        description:
          "Draws a connecting line between two existing canvas elements, with an optional label, using the draw-on reveal animation",
        inputSchema: {
          type: "object",
          properties: {
            fromId: { type: "string" },
            toId: { type: "string" },
            label: { type: "string" },
          },
          required: ["fromId", "toId"],
        },
        execute: async ({ fromId, toId, label }: any) => addConnector(fromId, toId, label),
      },
      {
        name: "update_connector",
        description: "Relabels an existing connector by its id",
        inputSchema: {
          type: "object",
          properties: {
            connectorId: { type: "string" },
            label: { type: "string", description: "New label text (pass empty string to clear)" },
          },
          required: ["connectorId"],
        },
        execute: async ({ connectorId, label }: any) => updateConnector(connectorId, label),
      },
      {
        name: "group_into_beat",
        description:
          "Closes the current set of recently-added elements into a named story beat, tied to the narration segment that produced them",
        inputSchema: {
          type: "object",
          properties: { beatLabel: { type: "string" } },
          required: ["beatLabel"],
        },
        execute: async ({ beatLabel }: any) => groupIntoBeat(beatLabel),
      },
      {
        name: "clear_canvas",
        description: "Clears all elements and connectors from the canvas",
        inputSchema: { type: "object", properties: {} },
        execute: async () => clearAll(),
      },
      {
        name: "update_element",
        description:
          "Updates the content, position, size, or color of an existing element without recreating it",
        inputSchema: {
          type: "object",
          properties: {
            elementId: { type: "string" },
            changes: {
              type: "object",
              description:
                "Only the fields that changed, e.g. { text: 'new label' } or { position: {x, y} }",
            },
          },
          required: ["elementId", "changes"],
        },
        execute: async ({ elementId, changes }: any) => updateElement(elementId, changes),
      },
      {
        name: "add_emoji",
        description:
          "Places a native emoji on the canvas as a vibrant, colorful icon. Used to illustrate metaphors and concepts vividly.",
        inputSchema: {
          type: "object",
          properties: {
            emoji: { type: "string" },
            sizeMultiplier: { type: "number", description: "Scale of the emoji, defaults to 1" },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
            label: { type: "string" },
          },
          required: ["emoji"],
        },
        execute: async ({ emoji, sizeMultiplier, position, label }: any) =>
          addEmoji(emoji, sizeMultiplier, position, label),
      },
      {
        name: "emphasize_element",
        description: "Briefly pulses or glows an existing element to draw attention back to it",
        inputSchema: {
          type: "object",
          properties: { elementId: { type: "string" } },
          required: ["elementId"],
        },
        execute: async ({ elementId }: any) => emphasizeElement(elementId),
      },
      {
        name: "clear_region",
        description: "Removes all elements within a rectangular area",
        inputSchema: {
          type: "object",
          properties: {
            area: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
              },
            },
          },
          required: ["area"],
        },
        execute: async ({ area }: any) => clearRegion(area),
      },
      {
        name: "add_flowchart_node",
        description: "Adds a standard flowchart symbol",
        inputSchema: {
          type: "object",
          properties: {
            nodeType: {
              type: "string",
              enum: ["process", "decision", "start_end", "input_output"],
            },
            label: { type: "string" },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
          },
          required: ["nodeType", "label"],
        },
        execute: async ({ nodeType, label, position }: any) =>
          addFlowchartNode(nodeType, label, position),
      },
      {
        name: "set_fill_color",
        description: "Fills an existing shape with a color, using a sweep-in animation",
        inputSchema: {
          type: "object",
          properties: {
            elementId: { type: "string" },
            color: {
              type: "string",
              description:
                "Must be from the existing fixed palette in AGENTS.md — do not introduce arbitrary hex values",
            },
          },
          required: ["elementId", "color"],
        },
        execute: async ({ elementId, color }: any) => setFillColor(elementId, color),
      },
      {
        name: "add_illustration",
        description:
          "Adds an educational SVG illustration to the canvas. Provide a semantic concept name; the system resolves the best local or remote asset automatically.",
        inputSchema: {
          type: "object",
          properties: {
            semantic: {
              type: "string",
              description:
                "Concept name e.g. 'sun', 'earth', 'browser', 'postgresql', 'plant', 'cell'",
            },
            label: { type: "string" },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
            size: { type: "object", properties: { w: { type: "number" }, h: { type: "number" } } },
          },
          required: ["semantic"],
        },
        execute: async ({ semantic, label, position, size }: any) => {
          const asset = await resolveAsset(semantic);
          const svgContent =
            asset.type === "local-svg" || asset.type === "iconify-svg" || asset.type === "ai-svg"
              ? asset.value
              : "";
          return addIllustration(semantic, svgContent, position, size, label);
        },
      },
      {
        name: "add_code_block",
        description: "Adds a styled code block to the canvas with syntax highlighting appearance.",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string" },
            language: {
              type: "string",
              description: "e.g. 'python', 'sql', 'json', 'http', 'javascript'",
            },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
          },
          required: ["code"],
        },
        execute: async ({ code, language, position }: any) =>
          addCodeBlock(code, language, position),
      },
      {
        name: "apply_visual_scene",
        description:
          "Batch operation: applies a complete VisualScenePlan. The plan describes elements and connections using semantic layout (not pixel coords). The engine resolves positions, assets, and creates all elements in one coherent update.",
        inputSchema: {
          type: "object",
          properties: {
            plan: {
              type: "object",
              description: "A VisualScenePlan JSON object",
              properties: {
                title: { type: "string" },
                layout: { type: "string" },
                elements: { type: "array" },
                connections: { type: "array" },
                groupLabel: { type: "string" },
              },
              required: ["layout", "elements", "connections", "groupLabel"],
            },
          },
          required: ["plan"],
        },
        execute: async ({ plan }: any) => applyVisualScene(plan),
      },
      {
        name: "undo",
        description: "Reverts the last canvas change (up to 20 steps of history)",
        inputSchema: { type: "object", properties: {} },
        execute: async () => undo(),
      },
      {
        name: "add_timeline_event",
        description:
          "Adds a dated event marker to the timeline layout on the canvas. Place events left-to-right in chronological order.",
        inputSchema: {
          type: "object",
          properties: {
            label: { type: "string", description: "Event name or description (≤6 words)" },
            date: {
              type: "string",
              description: "Optional date or year string, e.g. '1765' or 'June 1944'",
            },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
          },
          required: ["label"],
        },
        execute: async ({ label, date, position }: any) => addTimelineEvent(label, date, position),
      },
      {
        name: "add_callout",
        description:
          "Adds a speech-bubble callout element. Use to annotate or comment on an existing element with a pointed bubble.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Short callout text (≤10 words)" },
            targetId: { type: "string", description: "Optional — id of element this bubble points at" },
            position: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
          },
          required: ["text"],
        },
        execute: async ({ text, targetId, position }: any) => addCallout(text, targetId, position),
      },
      {
        name: "duplicate_element",
        description: "Clones an existing canvas element with a slight offset. Useful for comparison diagrams.",
        inputSchema: {
          type: "object",
          properties: { elementId: { type: "string" } },
          required: ["elementId"],
        },
        execute: async ({ elementId }: any) => duplicateElement(elementId),
      },
      {
        name: "set_connector_style",
        description: "Changes the visual style of a connector: dashed line, custom color, or thick weight.",
        inputSchema: {
          type: "object",
          properties: {
            connectorId: { type: "string" },
            dashed: { type: "boolean", description: "Render as dashed line" },
            color: { type: "string", description: "CSS color e.g. '#c93b2b' or 'var(--accent-highlight)'" },
            thick: { type: "boolean", description: "Make the connector thicker (4px instead of 2px)" },
          },
          required: ["connectorId"],
        },
        execute: async ({ connectorId, dashed, color, thick }: any) =>
          setConnectorStyle(connectorId, { dashed, color, thick }),
      },
      {
        name: "pin_element",
        description: "Locks or unlocks an element's position so it cannot be accidentally dragged.",
        inputSchema: {
          type: "object",
          properties: {
            elementId: { type: "string" },
            pinned: { type: "boolean", description: "true to lock, false to unlock" },
          },
          required: ["elementId", "pinned"],
        },
        execute: async ({ elementId, pinned }: any) => pinElement(elementId, pinned),
      },
      {
        name: "set_theme",
        description:
          "Changes the whiteboard canvas colour theme. Use to match the mood of the subject being explained.",
        inputSchema: {
          type: "object",
          properties: {
            theme: {
              type: "string",
              enum: ["light", "dark", "sepia", "blackboard"],
              description:
                "light = default warm paper | dark = dark mode | sepia = aged parchment | blackboard = dark green chalkboard",
            },
          },
          required: ["theme"],
        },
        execute: async ({ theme }: any) => setTheme(theme),
      },
    ];

    // Expose callable bridge for fallback drivers or dev tools
    (globalThis as any).storyboardTools = Object.fromEntries(tools.map((t) => [t.name, t.execute]));

    setToolsManifest(tools.map((t) => ({ name: t.name, description: t.description })));
    const disposers = tools.map((t) => mc.registerTool(t));
    setToolsReady(true);
    return () => {
      disposers.forEach((d: any) => d?.unregister?.() ?? d?.());
    };
  }, [
    getCanvasState,
    addTextBlock,
    addMathBlock,
    addEmoji,
    addShape,
    addSketch,
    addImage,
    addStickyNote,
    addHighlight,
    deleteElement,
    setLayerOrder,
    updateTextStyle,
    addFrame,
    addConnector,
    groupIntoBeat,
    clearAll,
    updateElement,
    emphasizeElement,
    clearRegion,
    addFlowchartNode,
    setFillColor,
    addIllustration,
    addCodeBlock,
    applyVisualScene,
    undo,
    updateConnector,
    addTimelineEvent,
    addCallout,
    duplicateElement,
    setConnectorStyle,
    pinElement,
    setTheme,
  ]);

  return {
    state,
    log,
    toolsReady,
    toolsManifest,
    setNarration,
    tools: {
      getCanvasState,
      addTextBlock,
      addMathBlock,
      addEmoji,
      addShape,
      addSketch,
      addImage,
      addStickyNote,
      addHighlight,
      removeElement: deleteElement,
      setLayerOrder,
      updateTextStyle,
      addFrame,
      addConnector,
      groupIntoBeat,
      clearCanvas: clearAll,
      updateElement,
      emphasizeElement,
      clearRegion,
      addFlowchartNode,
      setFillColor,
      addIllustration,
      addCodeBlock,
      applyVisualScene,
    },
    moveElement,
    resizeElement,
    updateElementText,
    updateElementLabel,
    deleteElement,
    setLayerOrder,
    updateTextStyle,
    addFrame,
    addSketch,
    addImage,
    addHighlight,
    addStickyNote,
    addMathBlock,
    addStroke,
    clearAll,
    updateElement,
    emphasizeElement,
    clearRegion,
    addFlowchartNode,
    setFillColor,
    addIllustration,
    addCodeBlock,
    applyVisualScene,
    undo,
    addTimelineEvent,
    addCallout,
    duplicateElement,
    setConnectorStyle,
    pinElement,
    setTheme,
  };
}
