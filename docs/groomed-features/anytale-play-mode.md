# AnyTale play mode (`/anytale.html`)

## Goal

Ship a highly guided, tap-only **AnyTale play** experience on a dedicated page at **`/anytale.html`**, while renaming the existing editor surface to **`/anytale-editor.html`** and updating navigation so both coexist. Folder-style routes (`/anytale`, `/anytale-editor`) are intentionally deferred. Play mode consumes the same AnyTale data as the editor (`server/database/anytale-data.json` shape: `parts`, `plot`, `characters`, `outfits`, `music`; see samples in-repo and `public/js/app-ui/anytale/prompt-assembler.mjs` for prompt assembly). Persist a **single** session object in **`localStorage`** and **always restore** it on load; missing or invalid fields are healed with **defaults or fresh random** values (no schema-version work for now).

## Dependencies (must be completed before play mode)

- **Outfit preview images:** Outfits need preview images for the outfit change flow in the intro mood page.
- **Editor music tab:** AnyTale editor needs a Music tab for managing genres, genre settings, and track playlists. Genres/settings must be promoted from hard-coded config to the anytale database. Music generation via AceStep workflow happens in the editor, not in play mode.

## Implementation details (design record)

### Routing and menu

- Rename the current editor entry point: **`anytale.html` → `anytale-editor.html`** (or equivalent), with bundle/entry script paths updated so the editor still mounts `AnyTalePage` from `public/js/app-ui/anytale/anytale.mjs`.
- Add a new **`anytale.html`** (and **`/js/...` entry module**) for play mode only.
- Global hamburger (`public/js/app-ui/hamburger-menu.mjs`): rename **"AnyTale"** → **"AnyTale Editor"** pointing at the editor URL; add **"AnyTale"** pointing at the new play URL. Fix `active` path checks for both.
- Search the repo for hard-coded **`/anytale.html`** / **`anytale.html`** links and update them to the editor path where appropriate.
- Do **not** add server rewrites for `/anytale` or `/anytale-editor` in this pass.

### Reusable UI and page-local controls

- Reuse `Page`, `AppHeader`, `HamburgerMenu`, `Panel`, `ToggleSwitch`, `NavigatorControl`, `showDialog`, `ToastProvider`, and `TooltipProvider` where they fit.
- Extend `public/js/custom-ui/io/button.mjs` with AnyTale-play-only **glass button variants** (for example glass icon, glass icon-text, glass text) that use the same visual material as `Panel variant="glass"` without wrapping buttons in `Panel`.
- The main play choices are **custom page-local components**, not generic `Button` instances. They should share the same glass effect and be designed for the portrait panel layout.
- Do **not** show an audio player UI in play mode. Dialog voice and background music are automatic; the only visible audio controls are dialog mute/unmute and music play/stop or mute/unmute.
- Do **not** use `globalAudioPlayer` or `AudioPlayer` in AnyTale play mode; build a new play-mode audio runtime.

### Layout and UX

Play mode uses "**chapter**" as the user-facing term for plot blocks.

#### Normal page layout (during chapter navigation)

- Shared **`AppHeader`** as on other pages; below it, the experience is **one outlined portrait panel** (mobile-friendly, touch targets).
- **Top of frame:** Reset (with **confirm** dialog), Dialog on/off (controls **chat/dialog generation**), Mute (voice playback / new TTS), **Music** play/stop (looping background tracks).
- **Below controls:** speech bubble for **current dialog** (empty when none).
- **Generated image area:** full portrait display with **fade in/out transitions** between page images (same transition style as the editor slideshow mode).
- **Bottom controls** (two-row layout):
  - Left side:
    - Row 1: Progress bar (see Progress Bar section)
    - Row 2: `Chapter X  Page Y` labels
  - Right side: `[prev] [▶ play] [next] [show/hide UI]`
- **Navigation modes:**
  - **Manual mode:** `[prev] [▶ play] [next] [show/hide]` — user taps through pages, fade transitions between images.
  - **Autoplay mode:** `[⏹ stop]` — auto-advances to the next page when it is loaded (smart pacing tied to content readiness, not a fixed timer).
- **Show/hide UI:** When UI is hidden, only the **show UI button** remains visible — everything else (top controls, speech bubble, bottom bar) is hidden.

#### Decision point layout (intro, end-of-chapter, end screen)

- **Top controls** (same as normal page).
- **Decision hint:** Placed at the same position as the speech bubble, but styled as a **plain rectangle/caption** (not a speech bubble, since it is not spoken dialog).
- **Choice options** (glass panel area with 3 or 3+1 choices).
- **Bottom:** Single **back button** that returns the user to the most recent page on the timeline.

#### Three + one pattern

"Other" is always a **fourth** choice when the pattern applies. **Introduction main page** and **mood page** are exceptions with **exactly three** options and no fourth.

### Progress bar

Per-chapter progress bar using **three overlapping layers** (bottom to top):

1. **Loading** (full bar length, bottom layer, **danger/red**): represents the total page count. Red color bleeds through wherever content isn't loaded yet, creating visual urgency during generation.
2. **Loaded** (middle layer, **gray/elevated background color**): covers pages with both image and voice (if voice is enabled) ready. When voice is muted/unmuted, this layer updates accordingly since voice readiness is no longer/now a loading requirement.
3. **Current** (top layer, **blue/primary**): current page indicator showing the user's position in the chapter.

A **fully loaded chapter** appears clean — all gray with a blue position dot, no red visible. When navigating back to a completed chapter, the bar shows fully loaded state.

### Queue strategy

When the user enters a new chapter (plot block), **all media is queued at once** in this order:

1. **All dialogs** for every page in the chapter (via `/api/chat`, concurrent with ComfyUI since Ollama is a separate service).
2. **Page 1 image** (ComfyUI workflow).
3. **Page 1 voice** (if voice is applicable — character has a voice sample and dialog is enabled).
4. **All remaining images** (pages 2+, in order).
5. **All remaining voices** (pages 2+, in order, if applicable).

**Play cannot proceed** until all dialogs and page 1's required assets (image + voice if applicable) are ready.

**Dynamic reprioritization:** When the user navigates to a page whose voice is not yet generated and voice is enabled:
1. **Pause** the queue (leave the currently running generation in place).
2. **Move** the voice task for the current page to the **top position** in the queue.
3. **Restart** the queue so the needed voice gets processed first.

**Cancellation:** On reset, session invalidation, or chapter change, **cancel all** queued/in-flight image, dialog, TTS, and pre-render jobs.

### Session bootstrap (cold start)

- Random **character** (from library).
- Random **outfit** from the selected character's **preferred outfits** list.
- Random **`background`-typed** part plus **random attribute selections** (respect category/custom attribute rules from part config).
- Random **music genre** from the database, then random **track** from that genre's playlist.
- Random **plot** whose plot block **`section`** is **`prelude`** (case-insensitive match per product convention).
- Start at **page index 0** (page 1).
- After bootstrap, show **introduction** until the user picks an action.
- If the library has no usable prelude plot, no usable epilogue plot, no character, no `background`-typed part, or no music tracks, fail the play page load with a simple message asking the user to create the missing data in the editor before entering play mode.

### Interaction flows

#### 1. Introduction — main page

Three options only (no fourth):
1. **"Let me meet someone else"** → character change flow.
2. **"The mood isn't right"** → mood sub-page.
3. **"Begin the tale"** → exits intro, enters chapter navigation at page 1. Queues all media generation for the prelude chapter.

#### 2. Introduction — mood page

Three options only (no fourth):
1. **"Maybe try on a different outfit?"** → outfit change flow (3+1 pattern, fourth = "Nevermind" — no change).
2. **"Let's go somewhere else."** → background change flow.
3. **"Let's listen to something different."** → music change flow.

Completing any mood change returns to the intro main page.

#### 3. Character change

Show **three** random characters (name, personality profile, preview portrait). Fourth: **"Maybe someone else?"** → reroll the trio. On pick, update session character and auto-select a random outfit from the new character's preferred outfits.

#### 4. Outfit change

Show **three** random outfits (name, preview image). Fourth: **"Nevermind"** → no change, return to mood page. On pick, update session outfit.

#### 5. Background change

Show **three** random parts with type **`background`**. On pick, walk **each attribute**: three concrete options + fourth **"None of these"** leaves that attribute **unset / null**. Then return to the intro main page.

#### 6. Music change

Show **three genres** from the music database. On pick, select a **random track** from that genre's playlist. The new track begins playing immediately (with graceful crossfade from the previous track). Return to the mood page.

#### 7. Chapter navigation

While moving through pages, **no choice UI** — only the normal page layout (image, speech bubble, navigation controls, progress bar). Pages transition with **fade in/out** between images.

#### 8. End-of-chapter branching

When the user reaches the last page, a **decision page** is shown:
- Image is **reused from the last page** of the current chapter.
- Decision hint text and choice options are displayed.
- Offer **three** plots whose **`section`** matches one of the current plot's **`progressionSections`** entries.
- Fourth: **"Let's say goodbye for now"** → jumps to a **random** plot with **`section === epilogue`** (case-insensitive).
- If no progression section is defined or no matching plot exists, show **only** the epilogue option.

**After the user makes a choice:**

1. A **loading page** appears after the decision page in the timeline. The user is moved to this loading page.
2. While on the loading page, the user can **navigate back** to reconsider their choice.
3. All media for the new chapter is queued (see Queue Strategy).
4. Once the new chapter is **ready** (page 1 assets are done), the timeline transforms:
   - The loading page **auto-transitions** (fade) into page 1 of the new chapter.
   - The loading page is **removed from the timeline** to make future navigation seamless.
5. The user can now freely navigate between the current and new chapters.
6. The progress bar resets to show the **new chapter's** progress. Navigating back to a completed chapter shows a fully loaded bar.

Append chosen plots to a **linear timeline** in the persisted session object for future save/load/share features.

#### 9. Epilogue and end screen

When the epilogue chapter ends, a **final end screen** is appended:
- Image is **reused from the final page** of the epilogue.
- Simple message: *"You have reached the end of this tale."*
- Single option: **"Play again"** → triggers a **full reset** (same as the reset button — cancel all, stop all audio, full cold start reroll).

#### 10. Mid-session changes

Not supported in this version. Character, outfit, background, and music choices are locked to the introduction only. The system architecture supports mid-session changes, but they are deferred to reduce scope.

### Imagery

- Composite prompt via **`assemblePrompt(enabledParts, activePage)`** in `public/js/app-ui/anytale/prompt-assembler.mjs`: enabled parts include the **session character parts**, **session outfit parts**, **session background part**; **`activePage`** is the current plot page (`tags`, `hiddenParts`, etc.).
- Remove the editor `WorkflowSelector`; both AnyTale editor and play mode use the configured AnyTale image workflow directly from config (new config key if needed), including workflow defaults / `extraInputs`.
- Invoke the **same image generation path and settings** as the AnyTale editor after that config-based workflow selection is in place.
- Page images use **fade in/out transitions** when navigating between pages.

### Dialog (LLM)

- Chat generation is now available server-side through `server/features/chat/router.mjs` as **`POST /api/chat`**, backed by `server/core/llm.mjs::chat()`. AnyTale play mode should use this real endpoint rather than a placeholder stub.
- Add AnyTale dialog settings under `server/config.default.json` / runtime config, using the imported LLM preset/session shape: `model`, `systemMessage`, and `parameters` (`temperature`, `topP`, `maxTokens`). Also store mode (`chat` or `completion`), completion format (`chatml` when needed), and stream default.
- The configured `systemMessage` is a template. Substitute `{{profile}}` with the current character's personality profile and `{{location}}` with the current background part's **location attribute value**. If either substitution source is missing/blank, skip dialog generation for that page.
- Fetch the AnyTale dialog config through `GET /anytale/config`; do not hard-code model names in the play client.
- Add a small AnyTale dialog client module that renders the configured system-message template, sends the active page's `dialogPrompt` as the user/content prompt, then calls `/api/chat`. Prefer non-streaming for the first usable implementation unless the UI is explicitly wired for streaming partial text.
- When dialog is **on:** system prompt = rendered configured `systemMessage`; user/content prompt includes the active page's **`dialogPrompt`** one-liner. When dialog is **off:** **skip** generation; plot still advances on **new page entry** without dialog text.
- If the page has no `dialogPrompt` or the prompt is empty after trimming, skip dialog generation for that page as if the character is temporarily muted.
- If the character personality profile is missing, skip dialog generation.
- Cache generated dialog text by the same stable asset signature used for generated images/voice so reloads and back navigation can reuse it without re-calling `/api/chat`.
- **New capability:** cancel or abandon **in-progress** dialog/voice/**workflow** jobs; **speech stops immediately** mid-line when cancelled or muted per product rules (mute: stop playback and block new TTS while muted).
- Add server-side cancellation endpoints for ComfyUI workflow jobs and investigate cancellation for `/api/chat` / Ollama generations. The current imported chat route does not expose request ids or cancellation, so client-side `AbortController` and stale-result guards are required regardless. If Ollama cannot be stopped mid-generation or mid-stream with the current integration, document that limitation and do not implement a fake backend cancellation path.

### Voice

- Add a new text-to-speech path: **character voice sample** + **dialog text** → speech URL. Use a configured TTS workflow such as Chatterbox or Qwen text-to-speech, with server-side preprocessing that maps the selected character voice sample and generated dialog into the workflow inputs correctly.
- Existing `/anytale/characters/:uid/generate-voice` is a personality-to-voice-sample workflow and is **not** the play-mode dialog TTS endpoint.
- Persist **generated dialog text** and **voice URL** in the session object.
- If the character voice sample is missing, treat the character as muted: show text when dialog generation is otherwise allowed, but do not request TTS or play speech.

### Background music

- Music library is stored in the **anytale database** (not hard-coded config). Genres, genre settings, and track playlists are managed via the **AnyTale editor Music tab** (a dependency feature).
- On first run, the library is **seeded** with one piece of music per genre, generated through the AceStep workflow. New tracks are generated in the editor and permanently added to the genre's playlist.
- Play mode **only consumes** the existing library — no generation happens in the play UI.
- Music **loops indefinitely** and persists for the entire session (does not change between chapters).
- Do not use `globalAudioPlayer`. Build a play-mode audio runtime with two independent channels: one for dialog voice and one for background music. It must support immediate stop/mute, independent volume/mute state, background looping with graceful **fade-in and fade-out** for seamless loops, and reset/leave cleanup.
- AmbientBrew / `AmbientCoffee` can be considered for the background music channel only. Current assessment: it is useful for dynamic ambient recipes and channel effects, but is too heavy and recipe-oriented to replace the required two-channel play-mode runtime. Prefer a small dedicated two-channel runtime now, with optional AmbientBrew adapter later for richer ambient tracks.

### Reset

- **Confirm** dialog; on confirm: **stop all generations** (dialog, TTS, **images/pre-renders**, any other workflows), **stop all playing audio**, then perform a **full cold start** reroll (same rules as first visit).

### Persistence

- **One** `localStorage` JSON object (distinct key from editor keys `anytale-state`, `anytale-plot`, `anytale-character` — **do not clobber** editor storage). Contents: selected **character** (uid + snapshot fields needed for UI), **outfit** uid, **background part** uid + **attribute map**, **music genre** + **track id**, **linear plot timeline**, **generated asset cache**, **current plot uid**, **current page index**, UI mode / phase (intro vs mood vs character picker vs plot vs end-of-chapter vs end screen), toggles (dialog on, mute, music on), navigation mode (manual vs autoplay). **Always restore** on `/anytale.html` load.
- Store timeline as ordered entries rather than only uids, e.g. `{ plotUid, startedAt, pageCount, progressionDisabledPartsApplied }`, so future save/load/share features have room to grow.
- Store generated assets keyed by a stable signature containing plot uid, page index, character uid, outfit uid, background part uid, background attribute signature, and relevant prompt/page inputs. Cache entries hold image URL/task id/status, dialog text/status, voice URL/status, errors, and generated timestamps. Character/outfit/background changes should naturally invalidate old generated entries by changing the signature.

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

_Tasks will be broken into separate feature rollout documents in `docs/groomed-features/`._

## Future Implementation Rules Suggestions

_None — planning only._
