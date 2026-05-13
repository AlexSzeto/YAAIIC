# AnyTale play mode (`/anytale.html`)

## Goal

Ship a highly guided, tap-only **AnyTale play** experience on a dedicated page at **`/anytale.html`**, while renaming the existing editor surface to **`/anytale-editor.html`** and updating navigation so both coexist. Folder-style routes (`/anytale`, `/anytale-editor`) are intentionally deferred. Play mode consumes the same AnyTale data as the editor (`server/database/anytale-data.json` shape: `parts`, `plot`, `characters`; see samples in-repo and `public/js/app-ui/anytale/prompt-assembler.mjs` for prompt assembly). Persist a **single** session object in **`localStorage`** and **always restore** it on load; missing or invalid fields are healed with **defaults or fresh random** values (no schema-version work for now).

## Implementation details (design record)

### Routing and menu

- Rename the current editor entry point: **`anytale.html` → `anytale-editor.html`** (or equivalent), with bundle/entry script paths updated so the editor still mounts `AnyTalePage` from `public/js/app-ui/anytale/anytale.mjs`.
- Add a new **`anytale.html`** (and **`/js/...` entry module**) for play mode only.
- Global hamburger (`public/js/app-ui/hamburger-menu.mjs`): rename **“AnyTale”** → **“AnyTale Editor”** pointing at the editor URL; add **“AnyTale”** pointing at the new play URL. Fix `active` path checks for both.
- Search the repo for hard-coded **`/anytale.html`** / **`anytale.html`** links and update them to the editor path where appropriate.
- Do **not** add server rewrites for `/anytale` or `/anytale-editor` in this pass.

### Reusable UI and page-local controls

- Reuse `Page`, `AppHeader`, `HamburgerMenu`, `Panel`, `ToggleSwitch`, `NavigatorControl`, `showDialog`, `ToastProvider`, and `TooltipProvider` where they fit.
- Extend `public/js/custom-ui/io/button.mjs` with AnyTale-play-only **glass button variants** (for example glass icon, glass icon-text, glass text) that use the same visual material as `Panel variant="glass"` without wrapping buttons in `Panel`.
- The main play choices are **custom page-local components**, not generic `Button` instances. They should share the same glass effect and be designed for the portrait panel layout.
- Do **not** show an audio player UI in play mode. Dialog voice and background music are automatic; the only visible audio controls are dialog mute/unmute and music play/stop or mute/unmute.
- Do **not** use `globalAudioPlayer` or `AudioPlayer` in AnyTale play mode; build a new play-mode audio runtime.

### Layout and UX

- Shared **`AppHeader`** as on other pages; below it, the experience is **one outlined portrait panel** (mobile-friendly, touch targets).
- **Top of frame:** Reset (with **confirm** dialog), Dialog on/off (controls **chat/dialog generation**), Mute (voice playback / new TTS), **Music** play/stop (looping background tracks — **placeholder playlist** acceptable now; note future: full playlist + user-generated tracks via existing music workflows).
- **Below controls:** speech bubble for **current dialog** (empty when none).
- **Bottom:** glass panel for **choice context** text; **three** primary choices as text ± icon/image in glass; below that **back / multicolor progress / forward** for plot stepping. Progress bar shows **current plot completion** and **pre-render status** (distinct colors per meaning — define a simple legend in UI or comments).
- **“Three + one Other”:** “Other” is always a **fourth** choice when the pattern applies. **Introduction** is the exception: **exactly three** actions, **no** fourth: (1) change character, (2) change background, (3) begin the tale.

### Session bootstrap (cold start)

- Random **character** (from library).
- Random **`background`-typed** part plus **random attribute selections** (respect category/custom attribute rules from part config).
- Random **plot** whose plot block **`section`** is **`prelude`** (case-insensitive match per product convention).
- Start at **page index 0** (page 1).
- After bootstrap, show **introduction** until the user picks an action.
- If the library has no usable prelude plot, no usable epilogue plot, no character, or no `background`-typed part, fail the play page load with a simple message asking the user to create the missing prelude/epilogue/background/character data in the editor before entering play mode.

### Interaction flows

1. **Introduction:** three options only (above). “Begin the tale” enters normal plot progression.
2. **Character change:** show **three** random characters (name, personality profile, preview portrait). Fourth: **“Maybe someone else?”** → reroll the trio.
3. **Background change:** show **three** random parts with type **`background`**. On pick, walk **each attribute**; three concrete options + fourth **“None of these”** leaves that attribute **unset / null**. Then return to appropriate navigation state.
4. **Plot progression:** while moving through pages, **no choice UI** (only forward/back + progress + top toggles). **End of plot:** offer **three** plots whose **`section`** matches one of the current plot’s **`progressionSections`** entries; fourth **“Let’s say goodbye for now”** jumps to a **random** plot with **`section === epilogue`** (case-insensitive). If no progression section is defined or no matching plot exists, show only the fourth epilogue option. Append chosen plots to a **linear timeline** in the persisted session object for future save/load/share features.

### Imagery

- Composite prompt via **`assemblePrompt(enabledParts, activePage)`** in `public/js/app-ui/anytale/prompt-assembler.mjs`: enabled parts include the **session background part** and **session character parts**; **`activePage`** is the current plot page (`tags`, `hiddenParts`, etc.).
- Remove the editor `WorkflowSelector`; both AnyTale editor and play mode use the configured AnyTale image workflow directly from config (new config key if needed), including workflow defaults / `extraInputs`.
- Invoke the **same image generation path and settings** as the AnyTale editor after that config-based workflow selection is in place.
- **Pre-render** upcoming plot pages where product-appropriate; **cancel all** queued/in-flight **image** jobs on reset, session invalidation, or leaving mid-work (same as dialog/TTS/music cancellation policy).

### Dialog (LLM)

- **Future:** import chat-generation **endpoints** and **model settings** from another project via **configs / resource files** (stub hooks acceptable until integrated).
- When dialog is **on:** system prompt = **base instructions** + **current character personality**; user/content prompt includes the active page’s **`dialogPrompt`** one-liner. When dialog is **off:** **skip** generation; plot still advances on **new page entry** without dialog text.
- If the page has no `dialogPrompt` or the prompt is empty after trimming, skip dialog generation for that page as if the character is temporarily muted.
- If the character personality profile is missing, skip dialog generation.
- **New capability:** cancel **in-progress** dialog/voice/**workflow** jobs; **speech stops immediately** mid-line when cancelled or muted per product rules (mute: stop playback and block new TTS while muted).
- Add server-side cancellation endpoints for ComfyUI workflow jobs and Ollama/dialog generations. If Ollama cannot be stopped mid-generation or mid-stream with the current integration, stop and report that limitation before implementing a fake cancellation path.

### Voice

- Add a new text-to-speech path: **character voice sample** + **dialog text** → speech URL. Use a configured TTS workflow such as Chatterbox or Qwen text-to-speech, with server-side preprocessing that maps the selected character voice sample and generated dialog into the workflow inputs correctly.
- Existing `/anytale/characters/:uid/generate-voice` is a personality-to-voice-sample workflow and is **not** the play-mode dialog TTS endpoint.
- Persist **generated dialog text** and **voice URL** in the session object.
- If the character voice sample is missing, treat the character as muted: show text when dialog generation is otherwise allowed, but do not request TTS or play speech.

### Background music

- **Note for later:** build a proper **playlist + player** (looping tracks + optional user generation via existing music workflow). For initial delivery, minimal loop + play/stop is enough if called out in code comments/README for implementers.
- Do not use `globalAudioPlayer`. Build a play-mode audio runtime with two independent channels: one for dialog voice and one for background music. It must support immediate stop/mute, independent volume/mute state, background looping, and reset/leave cleanup.
- AmbientBrew / `AmbientCoffee` can be considered for the background music channel only. Current assessment: it is useful for dynamic ambient recipes and channel effects, but is too heavy and recipe-oriented to replace the required two-channel play-mode runtime. Prefer a small dedicated two-channel runtime now, with optional AmbientBrew adapter later for richer ambient tracks.

### Reset

- **Confirm** dialog; on confirm: **stop all generations** (dialog, TTS, **images/pre-renders**, any other workflows), **stop all playing audio**, then perform a **full cold start** reroll (same rules as first visit).

### Persistence

- **One** `localStorage` JSON object (distinct key from editor keys `anytale-state`, `anytale-plot`, `anytale-character` — **do not clobber** editor storage). Suggested contents: selected **character** (uid + snapshot fields needed for UI), **background part** uid + **attribute map**, **background music** selection id, **linear plot timeline**, **generated asset cache**, **current plot uid**, **current page index**, UI mode / phase (intro vs character picker vs plot vs end choice), toggles (dialog on, mute, music on). **Always restore** on `/anytale.html` load.
- Store timeline as ordered entries rather than only uids, e.g. `{ plotUid, startedAt, pageCount, progressionDisabledPartsApplied }`, so future save/load/share features have room to grow.
- Store generated assets keyed by a stable signature containing plot uid, page index, character uid, background part uid, background attribute signature, and relevant prompt/page inputs. Cache entries hold image URL/task id/status, dialog text/status, voice URL/status, errors, and generated timestamps. Character/background changes should naturally invalidate old generated entries by changing the signature.

### Plot data model (editor-aligned)

- Plot blocks: **`uid`**, **`name`**, **`section`**, **`pages[]`** (each page: **`tags`**, **`dialogPrompt`**, **`hiddenParts`**), **`progressionSections`**, **`progressionDisabledParts`** — see `createBlankPlot` / `loadPlot` in `public/js/app-ui/anytale/anytale-state.mjs` and server `GET /anytale/plot/:uid`.
- During plot progression, apply the selected/current plot's `progressionDisabledParts` to subsequent prompt assembly by suppressing matching part names/types until reset or until a future rule explicitly re-enables them.
- Missing character/part/plot fields are treated as empty fallbacks (empty strings, empty arrays, empty objects) except for the hard load failures listed under cold start.
- Do not show character portrait preview imagery when a character has no saved portrait image.

### Part attribute options migration

- Expand part attribute data so **category attributes store their concrete selectable option list**, similar to custom attributes. This is needed for random/bootstrap and the background attribute wizard without repeatedly traversing tag category trees at runtime.
- Keep the editor compatible: it may continue editing category references as today, but saved part configs should include hydrated option lists for play mode.
- Add a migration script for `server/database/anytale-data.json` that reads existing category attributes, resolves each category through tag data/category trees, and writes option lists into the part configs. The script should be idempotent and report unresolved categories.

## Tasks

- [ ] **Editor rename (routes and assets):** Add `public/anytale-editor.html` (or rename from `anytale.html`), point it at a dedicated editor entry module (e.g. rename `public/js/anytale.mjs` → `anytale-editor.mjs` and update the script tag). Set document title to **AnyTale Editor**. Keep `.html` routes only for now; do not add folder-style route rewrites. Ensure the editor page still loads tags/autocomplete as today. **Manual test:** open editor URL, verify layout, generation, hamburger.

- [ ] **Play shell:** Add `public/anytale.html` + `public/js/anytale-play.mjs` (name as you prefer) that mounts a new root component under `Page` / `ToastProvider` / `TooltipProvider` mirroring other pages. Title **AnyTale**. **Manual test:** blank page loads without console errors.

- [ ] **Hamburger and deep links:** Update `public/js/app-ui/hamburger-menu.mjs` labels and `href`s; grep the repo for `anytale.html` / `/anytale` string references (docs, HTML, comments) and fix breaks. **Manual test:** both entries navigate correctly; active highlighting works on each page.

- [ ] **AnyTale config workflow selection:** Remove the editor `WorkflowSelector` and load the AnyTale image workflow name/settings from config for both editor and play mode. Preserve current `/generate` payload behavior, workflow defaults, `extraInputs`, orientation, and progress handling. **Manual test:** editor can generate without manually selecting a workflow.

- [ ] **Glass button variants:** Extend `Button` with AnyTale-play-only glass variants for icon, text, and icon-text controls. Use the same glass material values as `Panel variant="glass"` but do not wrap buttons in `Panel`. **Manual test:** top-frame controls visually match the play panel glass material and remain accessible/tappable.

- [ ] **Page-local choice controls:** Build custom AnyTale play choice components for the three/four option area. They should share the glass effect but be local to play mode, support optional icons/images, and handle long text without layout shift. **Manual test:** character, background, intro, and branch choices render consistently on mobile.

- [ ] **Play session module:** Define a single `localStorage` key and `{ load, save, patch }` helpers for the session object described above. On load, merge missing keys using **random/default** repair. Never write into `anytale-state` / `anytale-plot` / `anytale-character`. **Manual test:** refresh play page retains mocked state when values are set in DevTools.

- [ ] **Data fetch layer for play:** Reuse `GET /anytale/parts`, `GET /anytale/plot`, `GET /anytale/plot/:uid`, `GET /anytale/characters` (and list endpoints as needed) to hydrate libraries client-side; cache in memory for random selection. **Manual test:** network panel shows successful fetches on play load.

- [ ] **Part attribute option migration:** Expand part configs so category attributes persist concrete selectable options in addition to the existing category reference. Add an idempotent migration script that hydrates existing `server/database/anytale-data.json` category attributes from tag data/category trees, reports unresolved categories, and leaves custom attributes compatible. **Manual test:** run migration twice; second run produces no material data churn.

- [ ] **Play data normalization:** Add helpers that normalize missing character/part/plot fields to empty strings/arrays/objects. Enforce hard load failure only when no usable prelude, epilogue, character, or background part exists. **Manual test:** intentionally remove optional fields from fixture data and verify play still loads; remove all epilogues and verify the editor guidance message appears.

- [ ] **Cold start + introduction:** Implement random selection for character, background+attrs using persisted category/custom option lists, prelude plot, page 0; render introduction with **three** buttons only. Wire “begin tale” to exit intro into plot navigation state. **Manual test:** first visit (empty play key) always reaches intro then plot when required library data exists.

- [ ] **Portrait panel UI scaffold:** Outlined portrait frame, placeholder for generated image, regions for bubble, glass choice area, bottom nav + progress bar (static/mock percentages acceptable initially). **Manual test:** resize to narrow viewport; controls remain tappable.

- [ ] **Prompt assembly + image generation:** Build the `enabledParts` structure from session character + background parts (matching editor part object shape), pass current `activePage`, apply any active `progressionDisabledParts`, call `assemblePrompt`, then trigger config-selected image generation and display result in-frame. **Manual test:** generated image updates when changing page tags in a test harness or real plot.

- [ ] **Plot navigation:** Implement forward/back clamped to page count; persist `currentPlotUid` + `pageIndex` on every change; on page change optionally kick pre-render. **Manual test:** step through pages, reload, resume same page.

- [ ] **Character change flow:** Random triple + fourth reroll; applying choice updates session and refreshes portrait pipeline. **Manual test:** reroll changes all three cards.

- [ ] **Background change flow:** Random background triple; attribute wizard with “None of these” → null; completion updates session + portrait. **Manual test:** skip an attribute and confirm prompt omits that tag category value.

- [ ] **End-of-plot branching:** Detect last page; show continuation UI: three plots filtered by `progressionSections` vs candidate plot `section`; fourth routes to random **`epilogue`** section plot. If no progression destinations are defined or no matching plot exists, show only the epilogue option. Append detailed entries to the linear timeline and load new plot at page 0. **Manual test:** with fixture plots, verify filtering, empty-destination behavior, and epilogue shortcut.

- [ ] **Dialog pipeline (stub ok):** Read model/base prompt paths from **config placeholders**; when enabled, call stub or real client that will later proxy to imported chat API; fill speech bubble; when disabled, clear pending dialog on page advance only. Skip dialog generation entirely when `dialogPrompt` is empty/missing or character personality is empty. **Manual test:** toggle dialog off, advance pages, no network to chat stub; blank page dialog prompts also produce no chat request.

- [ ] **Dialog TTS endpoint:** Add a play-mode server endpoint that accepts character uid/voice sample reference plus dialog text, preprocesses those inputs for a configured Chatterbox/Qwen-style text-to-speech workflow, runs generation, and returns speech URL + transcript/metadata. Do not reuse the existing personality-to-voice-sample endpoint for this. **Manual test:** generated speech reflects provided dialog text, not personality text.

- [ ] **Voice integration:** Pipe dialog text into the new play-mode TTS endpoint; respect mute (no playback, no new requests while muted); if voice sample is missing, treat character as muted for speech while still allowing text dialog; store URL + transcript in session asset cache. **Manual test:** mute during playback stops audio immediately; missing character voice sample produces text only.

- [ ] **Server cancellation endpoints:** Add server-side cancellation support for active ComfyUI workflow tasks and Ollama/dialog generations. Expose explicit cancel endpoints keyed by task id/session id and wire them into generation tracking. Verify whether current Ollama integration can actually stop a generation midstream; if not, stop and report that limitation before pretending cancellation works. **Manual test:** start slow ComfyUI and dialog jobs, cancel them, and verify backend work stops or the limitation is documented.

- [ ] **Client cancellation infrastructure:** Central **session generation controller** (AbortController, task ids, stale-result guards, and explicit cancel calls) used by dialog, TTS, image jobs, and pre-renders; **reset** and **confirm** invoke cancel-all then cold start. Late completions must not mutate UI/session even if backend cancellation is unavailable. **Manual test:** start a slow generation, hit reset, confirm no late completion mutates UI.

- [ ] **Reset UX:** Confirmation modal copy; on confirm run cancel-all + stop all `HTMLAudioElement` / WebAudio used for voice and music; reroll session. **Manual test:** audio stops before new session paints.

- [ ] **Two-channel play audio runtime:** Build an AnyTale-play-only audio runtime with separate dialog voice and background music channels. It must support automatic voice playback, looped background playback, independent mute/stop, immediate speech stop, reset/leave cleanup, and no visible player UI. Do not use `globalAudioPlayer`. **Manual test:** background music can continue while voice plays; muting voice does not stop music; reset stops both.

- [ ] **Background music control:** Add play/stop next to mute; use a **small built-in loop list** or single placeholder asset; document TODO for full playlist + user generation. Prefer the new two-channel runtime now; keep AmbientBrew as a future optional adapter for recipe-based ambience rather than the core player. **Manual test:** music toggles without breaking voice.

- [ ] **Progress bar behavior:** Implement multi-segment visualization: at minimum **page index / page count** and **pre-render queue** state; document color mapping in code comments. **Manual test:** forward/back updates segments predictably.

- [ ] **Generated asset cache:** Store images, dialog text, voice URLs, statuses, errors, and timestamps by stable signature: plot uid, page index, character uid, background uid, background attribute signature, and relevant page/prompt inputs. Character/background changes should invalidate by signature rather than destructive cache clearing. **Manual test:** reload reuses matching generated assets; character change causes new generation for the same page.

- [ ] **Polish and regression:** Confirm editor localStorage keys unchanged; run through mobile viewport; fix any broken global navigation. **Manual test:** full scripted walk: cold start → intro → plot → branch → reset → restore.

## Future Implementation Rules Suggestions

_None — planning only._
