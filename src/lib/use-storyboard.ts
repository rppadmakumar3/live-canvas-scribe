import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_STATE,
  STORAGE_KEY,
  resolveOverlap,
  uid,
  type Beat,
  type CanvasElement,
  type Connector,
  type ShapeType,
  type StoryboardState,
} from "./storyboard";

type ToolLog = { id: string; name: string; detail: string; at: number };

const DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  circle: { w: 140, h: 140 },
  rectangle: { w: 180, h: 100 },
  arrow: { w: 140, h: 60 },
  icon: { w: 120, h: 120 },
  text: { w: 260, h: 64 },
};

export function useStoryboard() {
  const [state, setState] = useState<StoryboardState>(EMPTY_STATE);
  const [log, setLog] = useState<ToolLog[]>([]);
  const [toolsReady, setToolsReady] = useState(false);
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

  /* ---------------- tool implementations ---------------- */

  const getCanvasState = useCallback(() => {
    const s = stateRef.current;
    pushLog("get_canvas_state", `${s.elements.length} elements, ${s.connectors.length} connectors`);
    return {
      elements: s.elements.map((e) => ({
        id: e.id,
        type: e.kind === "text" ? "text" : e.shapeType,
        position: { x: e.x, y: e.y },
        size: { w: e.w, h: e.h },
        label: e.label ?? e.text ?? "",
      })),
      connectors: s.connectors.map((c) => ({
        id: c.id,
        fromId: c.fromId,
        toId: c.toId,
        label: c.label ?? "",
      })),
      beats: s.beats.map((b) => ({ id: b.id, label: b.label })),
    };
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
      const from = s.elements.find((e) => e.id === fromId);
      const to = s.elements.find((e) => e.id === toId);
      if (!from || !to) {
        pushLog("add_connector", `failed: unknown element (${fromId} → ${toId})`);
        return { error: "One or both element ids do not exist on the canvas." };
      }
      const c: Connector = { id: uid("con"), fromId, toId, label, createdAt: Date.now() };
      setState((prev) => ({ ...prev, connectors: [...prev.connectors, c] }));
      pushLog("add_connector", `${from.label ?? from.text} → ${to.label ?? to.text}${label ? ` (${label})` : ""}`);
      return { id: c.id };
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

  const exportStory = useCallback(() => {
    const s = stateRef.current;
    pushLog("export_story", `${s.beats.length} beats compiled`);
    return {
      beats: s.beats.map((b, i) => ({
        index: i + 1,
        label: b.label,
        narration: b.narration,
        elements: b.elementIds.length,
        connectors: b.connectorIds.length,
      })),
    };
  }, [pushLog]);

  /* ---------------- direct manipulation ---------------- */

  const moveElement = useCallback((id: string, x: number, y: number) => {
    setState((s) => ({
      ...s,
      elements: s.elements.map((e) => (e.id === id ? { ...e, x, y } : e)),
    }));
  }, []);

  const resizeElement = useCallback((id: string, w: number, h: number) => {
    setState((s) => ({
      ...s,
      elements: s.elements.map((e) =>
        e.id === id ? { ...e, w: Math.max(48, w), h: Math.max(40, h) } : e,
      ),
    }));
  }, []);

  const deleteElement = useCallback((id: string) => {
    setState((s) => ({
      elements: s.elements.filter((e) => e.id !== id),
      connectors: s.connectors.filter((c) => c.fromId !== id && c.toId !== id),
      beats: s.beats.map((b) => ({ ...b, elementIds: b.elementIds.filter((e) => e !== id) })),
    }));
  }, []);

  const clearAll = useCallback(() => setState(EMPTY_STATE), []);

  /* ---------------- WebMCP registration ---------------- */

  useEffect(() => {
    const mc = (globalThis as any).document?.modelContext;
    const tools = [
      {
        name: "get_canvas_state",
        description:
          "Returns all current elements on the canvas with their positions, so new elements can be placed without overlapping existing ones",
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
        name: "add_shape",
        description: "Adds a shape (circle, rectangle, arrow or icon) to the canvas at a given position",
        inputSchema: {
          type: "object",
          properties: {
            shapeType: { type: "string", enum: ["circle", "rectangle", "arrow", "icon"] },
            iconName: {
              type: "string",
              description: "Required only when shapeType is 'icon' — name from the fixed icon library",
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
        name: "export_story",
        description: "Compiles all recorded beats into a scroll-driven playback sequence for later viewing",
        inputSchema: { type: "object", properties: {} },
        execute: async () => exportStory(),
      },
    ];

    // Always expose a callable bridge (polyfill / demo driver).
    (globalThis as any).storyboardTools = Object.fromEntries(
      tools.map((t) => [t.name, t.execute]),
    );

    if (mc?.registerTool) {
      const disposers = tools.map((t) => mc.registerTool(t));
      setToolsReady(true);
      return () => {
        disposers.forEach((d: any) => d?.unregister?.() ?? d?.());
      };
    }
    setToolsReady(false);
    return;
  }, [getCanvasState, addTextBlock, addShape, addConnector, groupIntoBeat, exportStory]);

  return {
    state,
    log,
    toolsReady,
    setNarration,
    tools: { getCanvasState, addTextBlock, addShape, addConnector, groupIntoBeat, exportStory },
    moveElement,
    resizeElement,
    deleteElement,
    clearAll,
  };
}
