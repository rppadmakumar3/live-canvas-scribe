# Storyboard Storyteller

Storyboard Live — Project Scope Document

A WebMCP Challenge submission

1. One-line pitch

A live canvas where a presenter narrates by voice, and an agent populates the canvas in real time with text, shapes, and diagram connectors as they speak — watchable and screen-shareable while it happens, then replayable afterward as a scroll-driven story.

2. Problem and validation

The pain: Creating visual tutorials and presentations is slow because visual editing and live explanation compete for the same attention. Manual whiteboard-video production is a well-documented, expensive category — professional production costs $10,000–$20,000 per minute, and DIY tools still estimate 5-7 days for storyboard creation and 5-6 days for animation. A whole tool market (VideoScribe, Doodly, Powtoon, Golpo AI) exists purely to shortcut this.

The gap those tools don't fill: Every one of them is a batch pipeline — script in, finished video file out, rendered afterward. None of them let a presenter narrate live and watch the canvas build in real time during an actual screen-share.

Honest limitation: The cost/time evidence above is about pre-recorded video production specifically, not live real-time presenting. The live-presenting pain is a reasonable, adjacent inference, not independently sourced with its own quotes — the burden of proof for this idea rests more on the demo convincingly showing the mechanism working than on pre-existing testimonial evidence.

3. Differentiation — checked against real, deployed competition

Verified against the live WebMCP directory (424 real sites) and the 25 official OpenAI showcase apps:

Existing thing What it does Why Storyboard Live is different webmcp-flow (live WebMCP demo) Generic node/edge architecture diagram builder No voice input, no narrative sequencing, no multi-media, not built for live presenting Golpo AI / VideoScribe / Powtoon Script → finished whiteboard video file Batch/offline rendering pipeline — no live, real-time canvas fill during an actual presentation Gamma / Tome / Beautiful.ai AI-generated static slide decks Also batch/offline; output is a fixed deck, not a live-built, screen-shareable, scroll-replayable canvas

Nothing in either dataset combines: live voice input + real-time multi-element canvas + human-agent shared editing + scroll-story playback.

4. Judging criteria alignment

Potential Impact: Credible, sourced adjacent pain (expensive/slow whiteboard-video production); audience is real and specific (educators, trainers, tutorial creators, presenters). Impact case is carried primarily by the live demo actually proving the mechanism, not by pre-existing testimony about this exact live-presenting scenario.

Creativity & Ambition: Differentiates from three separate existing categories at once (generic diagram tools, batch video generators, AI slide generators) — a stronger claim than differentiating from just one. Combines voice input, live multi-element canvas editing, and scroll-story export — more ambitious than a single-mechanic demo.

5. Detailed workflow — worked example (water cycle lesson)

Presenter opens Storyboard Live, starts screen-sharing the tab in a video call.

Narrates: "Let's talk about the water cycle. The sun heats up water in the ocean, causing evaporation." → Agent calls add_shape (sun), add_shape (ocean), add_text_block ("Water Cycle" title), add_connector (ocean → sun position, labeled "Evaporation") with the fade-in-and-scale reveal animation.

Continues: "That water vapor rises and cools, forming clouds — condensation." → Agent calls get_canvas_state first (checks existing layout to avoid overlap), then add_shape (cloud), add_connector (evaporation point → cloud, labeled "Condensation").

Continues: "Then it falls back down as rain — precipitation." → Agent calls add_connector (cloud → ocean, labeled "Precipitation"), closing the visual loop.

Mid-explanation adjustment: Presenter notices the cloud shape is too small and drags it larger herself, directly on the canvas — proving the canvas is genuinely shared, editable state, not a one-way agent output.

Narration ends. The canvas shows a complete water-cycle diagram, built live, entirely during the explanation.

Presenter clicks "Preview as story." → Each narrated segment had been silently grouped into a numbered beat via group_into_beat as she paused between ideas. export_story compiles the three beats (evaporation, condensation, precipitation) into a scroll-driven sequence a viewer can step through afterward, each scroll position revealing the matching canvas state at that point in the explanation.

6. Flow diagram

flowchart TD
    A[Presenter narrates by voice] --> B[Speech-to-text via Web Speech API]
    B --> C[Agent interprets narration segment]
    C --> D[get_canvas_state: check existing layout]
    D --> E[Agent calls add_text_block / add_shape / add_connector]
    E --> F[Element appears live on canvas with reveal animation]
    F --> G{Presenter wants to adjust?}
    G -- Yes --> H[Presenter drags/edits element directly]
    G -- No --> I[Narration continues]
    H --> I
    I --> J[Pause detected]
    J --> K[group_into_beat: close current beat]
    K --> A
    I --> L[Presenter clicks Preview as story]
    L --> M[export_story: compile beats into scroll sequence]
    M --> N[Scroll-driven playback for later viewing]


Plain-text version of the same loop, for anyone viewing this file without Mermaid support:

Presenter narrates by voice →

Speech-to-text converts it →

Agent checks canvas state →

Agent adds the relevant element(s) with a reveal animation →

Presenter may adjust that element manually at any point →

On a pause, the segment closes as a "beat" →

Loop back to step 1 for the next part of the narration →

When finished, "Preview as story" compiles all beats into a scroll-driven playback.

7. MVP scope

In scope

Live voice input via the browser's native Web Speech API (real speech-to-text)

Canvas content types: text blocks, a small shape set (circle, rectangle, arrow), diagram connectors, icons from a fixed icon library

One consistent animation style: fade-in + scale-up reveal for new elements, "draw-on" reveal for connectors

Manual drag-to-adjust on any canvas element, at any time, by the presenter

Beat grouping during narration (automatic, based on narration pauses)

"Preview as story" — scroll-driven playback of the compiled beats

A typed-input fallback mode (hidden by default), as insurance against speech-recognition issues during the actual demo recording

Explicitly out of scope for MVP

AI-generated images (icons only, not generated art)

Multiple animation styles (one signature motion only)

Multi-scene branching — linear beat sequence only

Exported video file (.mp4) — the deliverable is the live web app plus scroll playback, not a rendered video

Multi-presenter/multi-user simultaneous collaboration

8. WebMCP tool specification

document.modelContext.registerTool({
  name: "get_canvas_state",
  description: "Returns all current elements on the canvas with their positions, so new elements can be placed without overlapping existing ones",
  inputSchema: {},
  execute: async () => { /* returns array of { id, type, position, size, label } */ }
});

document.modelContext.registerTool({
  name: "add_text_block",
  description: "Adds a text element to the canvas at a given position, with the standard reveal animation",
  inputSchema: {
    text: { type: "string" },
    position: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } }
  },
  execute: async ({ text, position }) => { /* creates element, triggers fade-in-scale reveal */ }
});

document.modelContext.registerTool({
  name: "add_shape",
  description: "Adds a shape (circle, rectangle, or arrow) to the canvas at a given position",
  inputSchema: {
    shapeType: { type: "string", enum: ["circle", "rectangle", "arrow", "icon"] },
    iconName: { type: "string", description: "Required only when shapeType is 'icon' — name from the fixed icon library" },
    position: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
    label: { type: "string" }
  },
  execute: async ({ shapeType, iconName, position, label }) => { /* creates shape, triggers reveal animation */ }
});

document.modelContext.registerTool({
  name: "add_connector",
  description: "Draws a connecting line between two existing canvas elements, with an optional label, using the draw-on reveal animation",
  inputSchema: {
    fromId: { type: "string" },
    toId: { type: "string" },
    label: { type: "string" }
  },
  execute: async ({ fromId, toId, label }) => { /* draws connector between the two referenced elements */ }
});

document.modelContext.registerTool({
  name: "group_into_beat",
  description: "Closes the current set of recently-added elements into a named story beat, tied to the narration segment that produced them",
  inputSchema: { beatLabel: { type: "string" } },
  execute: async ({ beatLabel }) => { /* snapshots current new elements as one beat in the story sequence */ }
});

document.modelContext.registerTool({
  name: "export_story",
  description: "Compiles all recorded beats into a scroll-driven playback sequence for later viewing",
  inputSchema: {},
  execute: async () => { /* returns/generates the scroll-sequence view */ }
});


Human-in-the-loop behavior: Every canvas element remains directly editable by the presenter at any time via normal drag/click interaction — the agent's tool calls are additive, not exclusive. No tool call requires a separate confirmation step in this MVP, since additions are non-destructive and instantly visible (unlike the job-application-copilot design considered earlier in this process, where submit actions were irreversible and required explicit gating). This is a deliberate, documented design choice, not an oversight.

9. Tech stack

Frontend: Vanilla HTML/CSS/JS, single-page app, no build step — canvas rendered via SVG or HTML5 Canvas for the shapes/connectors/animations

Speech input: Browser-native Web Speech API (SpeechRecognition), with a typed-text fallback input

Storage: Browser localStorage for the current canvas/story state during a session — no backend required for the MVP

Hosting: Static hosting via Netlify, Vercel, or Cloudflare Pages

Polyfill: WebMCP polyfill included for cross-browser support during testing, verified natively in Chrome (flag/origin trial) and ChatGPT's in-app browser before final submission

10. Demo strategy

Rehearse one clean, well-paced narration (the water-cycle example above) so the live voice-to-canvas mechanic reads as smooth and confident on camera

Include the manual drag-adjustment moment on camera deliberately — this is the clearest visual proof that the canvas is genuinely shared, live state, not a one-way agent output

End the demo video on the "Preview as story" scroll playback, not on the live-fill moment — it's the strongest closing beat and makes the output feel like a complete deliverable

Keep the typed-input fallback ready but unused unless speech recognition genuinely fails during recording

11. Build order

Canvas engine — element creation, positioning, drag-to-adjust, reveal animations

WebMCP tool registration — all six tools wired to the canvas engine

Speech-to-text integration with the typed-text fallback

Beat grouping and story-export/scroll-playback view

Full rehearsal pass of the worked example, then demo recording

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9adc49fc-ecee-4a5f-a520-c8298e9a49cb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
