# AnyTale play mode (`/anytale`)

## Goal

Ship a highly guided, tap-only **AnyTale play** experience on a dedicated page at **`/anytale`**, while renaming the existing editor surface to **`/anytale-editor`** and updating navigation so both coexist. Play mode consumes the same AnyTale data as the editor (`server/database/anytale-data.json` shape: `parts`, `plot`, `characters`; see samples in-repo and `public/js/app-ui/anytale/prompt-assembler.mjs` for prompt assembly). Persist a **single** session object in **`localStorage`** and **always restore** it on load; missing or invalid fields are healed with **defaults or fresh random** values (no schema-version work for now).

## Implementation details (design record)

### Routing and menu

- Rename the current editor entry point: **`anytale.html` → `anytale-editor.html`** (or equivalent), with bundle/entry script paths updated so the editor still mounts `AnyTalePage` from `public/js/app-ui/anytale/anytale.mjs`.
- Add a new **`anytale.html`** (and **`/js/...` entry module**) for play mode only.
- Global hamburger (`public/js/app-ui/hamburger-menu.mjs`): rename **“AnyTale”** → **“AnyTale Editor”** pointing at the editor URL; add **“AnyTale”** pointing at the new play URL. Fix `active` path checks for both.
- Search the repo for hard-coded **`/anytale.html`** / **`anytale.html`** links and update them to the editor path where appropriate.

### Layout and UX

- Shared **`AppHeader`** as on other pages; below it, the experience is **one outlined portrait panel** (mobile-friendly, touch targets).
- **Top of frame:** Reset (with **confirm** dialog), Dialog on/off (controls **chat/dialog generation**), Mute (voice playback / new TTS), **Music** play/stop (looping background tracks — **placeholder playlist + player** acceptable now; note future: full playlist + user-generated tracks via existing music workflows).
- **Below controls:** speech bubble for **current dialog** (empty when none).
- **Bottom:** glass panel for **choice context** text; **three** primary choices as text ± icon/image in glass; below that **back / multicolor progress / forward** for plot stepping. Progress bar shows **current plot completion** and **pre-render status** (distinct colors per meaning — define a simple legend in UI or comments).
- **“Three + one Other”:** “Other” is always a **fourth** choice when the pattern applies. **Introduction** is the exception: **exactly three** actions, **no** fourth: (1) change character, (2) change background, (3) begin the tale.

### Session bootstrap (cold start)

- Random **character** (from library).
- Random **`background`-typed** part plus **random attribute selections** (respect category/custom attribute rules from part config).
- Random **plot** whose plot block **`section`** is **`prelude`** (case-insensitive match per product convention).
- Start at **page index 0** (page 1).
- After bootstrap, show **introduction** until the user picks an action.

### Interaction flows

1. **Introduction:** three options only (above). “Begin the tale” enters normal plot progression.
2. **Character change:** show **three** random characters (name, personality profile, preview portrait). Fourth: **“Maybe someone else?”** → reroll the trio.
3. **Background change:** show **three** random parts with type **`background`**. On pick, walk **each attribute**; three concrete options + fourth **“None of these”** leaves that attribute **unset / null**. Then return to appropriate navigation state.
4. **Plot progression:** while moving through pages, **no choice UI** (only forward/back + progress + top toggles). **End of plot:** offer **three** plots whose **`section`** matches one of the current plot’s **`progressionSections`** entries; fourth **“Let’s say goodbye for now”** jumps to a **random** plot with **`section === epilogue`** (case-insensitive). Append chosen plots to a **linear timeline** in the persisted session object for future save/load/share features.

### Imagery

- Composite prompt via **`assemblePrompt(enabledParts, activePage)`** in `public/js/app-ui/anytale/prompt-assembler.mjs`: enabled parts include the **session background part** and **session character parts**; **`activePage`** is the current plot page (`tags`, `hiddenParts`, etc.).
- Invoke the **same image generation path and settings** as the AnyTale editor today (reuse client workflow code paths used for editor preview/generation).
- **Pre-render** upcoming plot pages where product-appropriate; **cancel all** queued/in-flight **image** jobs on reset, session invalidation, or leaving mid-work (same as dialog/TTS/music cancellation policy).

### Dialog (LLM)

- **Future:** import chat-generation **endpoints** and **model settings** from another project via **configs / resource files** (stub hooks acceptable until integrated).
- When dialog is **on:** system prompt = **base instructions** + **current character personality**; user/content prompt includes the active page’s **`dialogPrompt`** one-liner. When dialog is **off:** **skip** generation; plot still advances on **new page entry** without dialog text.
- **New capability:** cancel **in-progress** dialog/voice/**workflow** jobs; **speech stops immediately** mid-line when cancelled or muted per product rules (mute: stop playback and block new TTS while muted — align with existing audio patterns).

### Voice

- Reuse **existing** voice generation workflow: **character voice sample** + **dialog text** → speech URL. Persist **generated dialog text** and **voice URL** in the session object.

### Background music

- **Note for later:** build a proper **playlist + player** (looping tracks + optional user generation via existing music workflow). For initial delivery, minimal loop + play/stop is enough if called out in code comments/README for implementers.

### Reset

- **Confirm** dialog; on confirm: **stop all generations** (dialog, TTS, **images/pre-renders**, any other workflows), **stop all playing audio**, then perform a **full cold start** reroll (same rules as first visit).

### Persistence

- **One** `localStorage` JSON object (distinct key from editor keys `anytale-state`, `anytale-plot`, `anytale-character` — **do not clobber** editor storage). Suggested contents: selected **character** (uid + snapshot fields needed for UI), **background part** uid + **attribute map**, **background music** selection id, **linear plot timeline** (ordered plot uids or equivalent), **per-page or current** generated **dialog text** + **voice URL**, **current plot uid**, **current page index**, UI mode / phase (intro vs character picker vs plot vs end choice), toggles (dialog on, mute, music on). **Always restore** on `/anytale` load.

### Plot data model (editor-aligned)

- Plot blocks: **`uid`**, **`name`**, **`section`**, **`pages[]`** (each page: **`tags`**, **`dialogPrompt`**, **`hiddenParts`**), **`progressionSections`**, **`progressionDisabledParts`** — see `createBlankPlot` / `loadPlot` in `public/js/app-ui/anytale/anytale-state.mjs` and server `GET /anytale/plot/:uid`.

## Tasks

- [ ] **Editor rename (routes and assets):** Add `public/anytale-editor.html` (or rename from `anytale.html`), point it at a dedicated editor entry module (e.g. rename `public/js/anytale.mjs` → `anytale-editor.mjs` and update the script tag). Set document title to **AnyTale Editor**. Ensure the editor page still loads tags/autocomplete as today. **Manual test:** open editor URL, verify layout, generation, hamburger.

- [ ] **Play shell:** Add `public/anytale.html` + `public/js/anytale-play.mjs` (name as you prefer) that mounts a new root component under `Page` / `ToastProvider` / `TooltipProvider` mirroring other pages. Title **AnyTale**. **Manual test:** blank page loads without console errors.

- [ ] **Hamburger and deep links:** Update `public/js/app-ui/hamburger-menu.mjs` labels and `href`s; grep the repo for `anytale.html` / `/anytale` string references (docs, HTML, comments) and fix breaks. **Manual test:** both entries navigate correctly; active highlighting works on each page.

- [ ] **Play session module:** Define a single `localStorage` key and `{ load, save, patch }` helpers for the session object described above. On load, merge missing keys using **random/default** repair. Never write into `anytale-state` / `anytale-plot` / `anytale-character`. **Manual test:** refresh play page retains mocked state when values are set in DevTools.

- [ ] **Data fetch layer for play:** Reuse `GET /anytale/parts`, `GET /anytale/plot`, `GET /anytale/plot/:uid`, `GET /anytale/characters` (and list endpoints as needed) to hydrate libraries client-side; cache in memory for random selection. **Manual test:** network panel shows successful fetches on play load.

- [ ] **Cold start + introduction:** Implement random selection for character, background+attrs, prelude plot, page 0; render introduction with **three** buttons only. Wire “begin tale” to exit intro into plot navigation state. **Manual test:** first visit (empty play key) always reaches intro then plot.

- [ ] **Portrait panel UI scaffold:** Outlined portrait frame, placeholder for generated image, regions for bubble, glass choice area, bottom nav + progress bar (static/mock percentages acceptable initially). **Manual test:** resize to narrow viewport; controls remain tappable.

- [ ] **Prompt assembly + image generation:** Build the `enabledParts` structure from session character + background parts (matching editor part object shape), pass current `activePage`, call `assemblePrompt`, then trigger **editor-equivalent** image generation and display result in-frame. **Manual test:** generated image updates when changing page tags in a test harness or real plot.

- [ ] **Plot navigation:** Implement forward/back clamped to page count; persist `currentPlotUid` + `pageIndex` on every change; on page change optionally kick pre-render. **Manual test:** step through pages, reload, resume same page.

- [ ] **Character change flow:** Random triple + fourth reroll; applying choice updates session and refreshes portrait pipeline. **Manual test:** reroll changes all three cards.

- [ ] **Background change flow:** Random background triple; attribute wizard with “None of these” → null; completion updates session + portrait. **Manual test:** skip an attribute and confirm prompt omits that tag category value.

- [ ] **End-of-plot branching:** Detect last page; show continuation UI: three plots filtered by `progressionSections` vs candidate plot `section`; fourth routes to random **`epilogue`** section plot; append to linear timeline and load new plot at page 0. **Manual test:** with fixture plots, verify filtering and epilogue shortcut.

- [ ] **Dialog pipeline (stub ok):** Read model/base prompt paths from **config placeholders**; when enabled, call stub or real client that will later proxy to imported chat API; fill speech bubble; when disabled, clear pending dialog on page advance only. **Manual test:** toggle dialog off, advance pages, no network to chat stub.

- [ ] **Voice integration:** Pipe dialog text into existing character voice workflow; respect mute (no playback, no new requests while muted); store URL + transcript in session; **cancel** in-flight audio on reset / character change as required. **Manual test:** mute during playback stops audio immediately.

- [ ] **Cancellation infrastructure:** Central **session generation controller** (AbortController and/or explicit cancel hooks) used by dialog, TTS, image jobs, and pre-renders; **reset** and **confirm** invoke cancel-all then cold start. **Manual test:** start a slow generation, hit reset, confirm no late completion mutates UI.

- [ ] **Reset UX:** Confirmation modal copy; on confirm run cancel-all + stop all `HTMLAudioElement` / WebAudio used for voice and music; reroll session. **Manual test:** audio stops before new session paints.

- [ ] **Background music control:** Add play/stop next to mute; use a **small built-in loop list** or single placeholder asset; document TODO for full playlist + user generation. **Manual test:** music toggles without breaking voice.

- [ ] **Progress bar behavior:** Implement multi-segment visualization: at minimum **page index / page count** and **pre-render queue** state; document color mapping in code comments. **Manual test:** forward/back updates segments predictably.

- [ ] **Polish and regression:** Confirm editor localStorage keys unchanged; run through mobile viewport; fix any broken global navigation. **Manual test:** full scripted walk: cold start → intro → plot → branch → reset → restore.

## Future Implementation Rules Suggestions

_None — planning only._
