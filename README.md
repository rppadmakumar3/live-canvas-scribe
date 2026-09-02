# Storyboard Live

Narrate by voice. The agent fills the canvas while you speak — then replay it as a scroll-driven story.

A [WebMCP Challenge](https://webmcp.org) submission.

---

## What it does

Storyboard Live is a live whiteboard powered by voice and AI. You speak an explanation; an agent interprets the meaning and places visual elements — text blocks, shapes, icons, diagrams, equations, code blocks — onto a shared canvas in real time. When you're done, the canvas replays as a scroll-driven story, beat by beat.

**Key capabilities**

- Voice narration via the browser's Web Speech API, with a typed-input fallback
- AI interprets meaning (not just words) and builds a visual scene from a single LLM call
- Elements: text, shapes, sticky notes, icons, illustrations, equations (KaTeX), code blocks (syntax-highlighted), connectors with labels
- Manual drag, resize, and edit on any element at any time — the canvas is always yours
- Beat grouping: each narration pause closes a story segment
- Scroll-driven story playback (`Preview as story`) — step through the canvas as it was built
- Four canvas themes: Light, Dark, Sepia, Blackboard
- Freehand drawing tools and an eraser
- Full undo support (`Cmd/Ctrl + Z`)
- 30+ WebMCP tools registered on `document.modelContext` — inspectable via the in-app tools badge
- State persisted to `localStorage` across sessions

---

## Tech stack

| Layer | Technology |
|---|---|
| Meta-framework | TanStack Start |
| UI | React 19 + Tailwind CSS 4 + Radix UI |
| Build | Vite 8 |
| AI gateway | OpenRouter (Gemini 2.5 Flash by default) |
| Voice input | Web Speech API |
| Sketch rendering | Rough.js |
| Math rendering | KaTeX |
| Deployment | Cloudflare Pages (via Nitro) |

---

## Getting started

**Prerequisites:** Node.js 20+ and npm.

```bash
git clone <repository-url>
cd live-canvas-scribe
npm install
```

Create a `.env` file at the project root:

```env
VITE_OPENROUTER_API_KEY=your_openrouter_key_here
VITE_OPENROUTER_MODEL=google/gemini-2.5-flash   # optional, this is the default
```

If `VITE_OPENROUTER_API_KEY` is absent, the app falls back to a local heuristic agent — still functional for demo topics like the water cycle.

```bash
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Production build
npm run preview   # Preview the production build locally
```

---

## How the AI pipeline works

```
Voice narration
  → Gemini (1 LLM call) → VisualScenePlan JSON
  → Layout Engine (code) → pixel positions
  → Asset Resolver (code + Iconify) → SVG / emoji
  → WebMCP tools → Canvas state
  → React renderers → visual result
```

The LLM only decides *what* to show and how to arrange it conceptually. All pixel positioning and asset resolution is deterministic code — the model never calculates coordinates.

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

The app registers 30+ tools on `document.modelContext` including:

| Tool | Purpose |
|---|---|
| `get_canvas_state` | Returns all current elements and their positions |
| `add_text_block` | Adds a text element with reveal animation |
| `add_shape` | Adds a shape (circle, rect, arrow, icon) |
| `add_connector` | Draws a labeled connector between two elements |
| `apply_visual_scene` | Batch operation — layout + assets in one call |
| `add_illustration` | Places an educational SVG illustration |
| `add_code_block` | Adds a syntax-highlighted code block |
| `add_math` | Renders a LaTeX equation via KaTeX |
| `group_into_beat` | Closes the current elements into a named story beat |
| `export_story` | Compiles beats into scroll-driven playback |

Click the **WebMCP Tools** badge in the app header to inspect all registered tools and their schemas.
