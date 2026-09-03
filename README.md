# Storyboard Live

Give an agent access — it builds the canvas via WebMCP. Replay it as a scroll-driven story.

A [WebMCP Challenge](https://webmcp.org) submission.

**Live demo:** https://storyboard-live-app.vercel.app

---

## What it does

Storyboard Live is a live whiteboard with 32 tools registered on `document.modelContext`. Open the app in a WebMCP-enabled browser, give an AI agent access, and it discovers the tools and builds visual diagrams directly on the canvas — text blocks, shapes, icons, illustrations, equations, code blocks, and labeled connectors — in real time. When the agent is done, the canvas replays as a scroll-driven story, beat by beat.

**Key capabilities**

- 32 WebMCP tools on `document.modelContext` — any agent in a WebMCP-enabled browser can discover and call them
- Agent builds the canvas: text, shapes, sticky notes, icons, illustrations, equations (KaTeX), code blocks, connectors
- Human and agent share the same canvas — drag, resize, or edit any element the agent placed, at any time
- Beat grouping: elements are grouped into named story segments automatically
- Scroll-driven story playback (`Preview as story`) — step through the canvas beat by beat
- Four canvas themes: Light, Dark, Sepia, Blackboard
- Freehand drawing tools and an eraser
- Full undo support (`Cmd/Ctrl + Z`)
- Voice input and typed prompt as additional input options
- State persisted to `localStorage` across sessions

---

## Tech stack

| Layer | Technology |
|---|---|
| Meta-framework | TanStack Start |
| UI | React 19 + Tailwind CSS 4 + Radix UI |
| Build | Vite 8 |
| Voice input | Web Speech API |
| Sketch rendering | Rough.js |
| Math rendering | KaTeX |

---

## Getting started

**Prerequisites:** Node.js 20+ and npm.

```bash
git clone <repository-url>
cd live-canvas-scribe
npm install
npm run dev       # Start dev server at http://localhost:5173
```

No environment variables required to run locally. Open in a WebMCP-enabled browser and give an agent access to start.

```bash
npm run build     # Production build
npm run preview   # Preview the production build locally
```

---

## How it works

```
Agent (ChatGPT / Claude in WebMCP browser)
  → discovers tools via document.modelContext
  → calls WebMCP tools → Canvas state updates
  → React renderers → visual result on canvas
  → group_into_beat → story segment saved
  → export_story → scroll-driven playback
```

All pixel positioning and asset resolution is deterministic code — the agent only decides *what* to show. It never calculates coordinates.

---

## Available commands

```bash
npm run dev        # Vite dev server (port 5173)
npm run build      # Production build
npm run build:dev  # Development-mode build
npm run preview    # Preview built output
npm run lint       # ESLint
npm run format     # Prettier
```

---

## WebMCP tools

The app registers 32 tools on `document.modelContext`. Click the **WebMCP Tools** badge in the app header to inspect all schemas live.

| Tool | Purpose |
|---|---|
| `get_canvas_state` | Returns all elements with pixel coordinates so new ones can be placed without overlap |
| `add_text_block` | Adds a text element with reveal animation |
| `add_math_block` | Adds a rendered LaTeX equation (KaTeX) |
| `add_shape` | Adds a shape — circle, rectangle, arrow, or icon |
| `add_sketch` | Adds a freehand stroke from a template or custom point data |
| `add_image` | Adds an image from a URL, data URL, or bundled icon name |
| `add_sticky_note` | Adds a colored sticky note (amber, teal, coral) |
| `add_highlight` | Adds a semi-transparent highlight over an area or element |
| `add_illustration` | Adds an educational SVG illustration by concept name (sun, cell, browser…) |
| `add_code_block` | Adds a syntax-highlighted code block |
| `add_emoji` | Places a native emoji as a colorful icon with an optional label |
| `add_flowchart_node` | Adds a standard flowchart symbol (process, decision, start/end, input/output) |
| `add_frame` | Adds a labeled frame that groups elements and moves them as one unit |
| `add_connector` | Draws a labeled connector line between two elements with draw-on animation |
| `add_timeline_event` | Adds a dated event marker for timeline layouts |
| `add_callout` | Adds a speech-bubble callout pointing at an existing element |
| `apply_visual_scene` | Batch operation — takes a full VisualScenePlan, runs layout + asset resolution, creates everything atomically |
| `update_element` | Updates content, position, size, or color of an existing element |
| `update_text_style` | Updates bold, size, or color of an existing text element |
| `update_connector` | Relabels an existing connector |
| `set_connector_style` | Sets a connector to dashed, a custom color, or thicker weight |
| `set_fill_color` | Fills a shape with a color using a sweep-in animation |
| `set_layer_order` | Moves an element to the front or back of the layer stack |
| `set_theme` | Switches the canvas theme (light / dark / sepia / blackboard) |
| `emphasize_element` | Briefly pulses an element to draw attention back to it |
| `duplicate_element` | Clones an element with a slight offset |
| `pin_element` | Locks or unlocks an element's position |
| `remove_element` | Deletes an element by id |
| `clear_region` | Removes all elements within a rectangular area |
| `clear_canvas` | Clears all elements and connectors |
| `group_into_beat` | Closes the current elements into a named story beat |
| `undo` | Reverts the last canvas change (up to 20 steps) |
