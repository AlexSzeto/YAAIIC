# AnyTale Play Mode — Rollout 1: Foundation & Routing

## Goal

Establish the routing foundation for AnyTale play mode by renaming the existing editor entry point, creating a blank play mode shell page, updating navigation, migrating part attribute data for play mode consumption, and removing the manual workflow selector from the editor in favor of config-driven workflow selection.

## Tasks

- [ ] **Editor rename (routes and assets):** Add `public/anytale-editor.html` (rename from `anytale.html`), point it at a dedicated editor entry module (rename `public/js/anytale.mjs` → `public/js/anytale-editor.mjs` and update the `<script>` tag). Set the document title to **YAAIIG - AnyTale Editor** (already the current title). Keep `.html` routes only; do not add folder-style route rewrites. Ensure the editor page still loads tags/autocomplete as today. **Manual test:** open `/anytale-editor.html`, verify two-column layout renders, generation works, and hamburger menu appears.

- [ ] **Play shell:** Add `public/anytale.html` + `public/js/anytale-play.mjs` that mounts a new root component (`AnyTalePlayPage`) under `Page` / `ToastProvider` / `TooltipProvider` mirroring other page entry points. Title **YAAIIG - AnyTale**. The component body is an empty `VerticalLayout` with an `AppHeader` (including `HamburgerMenu`) and a placeholder "AnyTale Play Mode" heading. **Manual test:** open `/anytale.html`, verify blank page loads without console errors and hamburger menu works.

- [ ] **Hamburger and deep links:** Update `public/js/app-ui/hamburger-menu.mjs` items array. Rename the current `AnyTale` entry: label → `AnyTale Editor`, href → `/anytale-editor.html`, active check → `currentPath === '/anytale-editor.html'`. Add a new entry: label `AnyTale`, href `/anytale.html`, icon `play`, active check `currentPath === '/anytale.html'`. Place the new `AnyTale` entry *before* the editor entry. Grep the repo for remaining `anytale.html` / `/anytale` string references (HTML files, docs, comments) and fix any that point to the old editor URL. **Manual test:** both hamburger entries navigate correctly; active highlighting works on each page.

- [ ] **AnyTale config workflow selection:** The editor already loads its workflow from config (`anytale.generationWorkflow`) via `GET /anytale/config` and the `workflowConfig` state in `AnyTalePage`. Confirm no `WorkflowSelector` component is imported or rendered in any AnyTale editor module. Add `anytale.imageWorkflow` as an alias for `anytale.generationWorkflow` in `config.default.json` if it aids clarity, or document that `generationWorkflow` is the canonical key. Ensure the play mode shell can also load this config (the data fetch task below covers the fetch itself). Preserve current `/generate` payload behavior: `workflow`, `orientation`, `extraInputs` defaults, `seed`, `requestOrigin: 'anytale'`. **Manual test:** editor can generate an image without manually selecting a workflow; `/anytale/config` response contains the workflow name.

- [ ] **Part attribute option migration:** Add an idempotent migration script `scripts/migrate-part-attributes.mjs` that reads `server/database/anytale-data.json`, iterates each part's `attributes` array, and for any attribute whose `options` value is a reference to a tag category (rather than a concrete comma-separated list), resolves the category through tag data and writes the concrete option list back. Custom attributes with inline `options` strings are left untouched. The script reports unresolved categories to stderr. On completion, writes the updated data back only if changes were made. **Manual test:** run `node scripts/migrate-part-attributes.mjs` twice; the second run reports no changes and produces no material data churn.

- [ ] **Data fetch layer for play:** Add `public/js/app-ui/anytale-play/play-data.mjs` that exports an `async function loadPlayData()`. On call, it fetches `GET /anytale/parts`, `GET /anytale/plot`, `GET /anytale/characters`, `GET /anytale/outfits`, and `GET /anytale/config` in parallel. Returns an object `{ parts, plots, characters, outfits, config }`. Cache the result in a module-level variable so subsequent calls return the same data without re-fetching. Call `loadPlayData()` inside `AnyTalePlayPage`'s `useEffect` on mount. **Manual test:** open `/anytale.html`; network panel shows five successful fetches on page load; no errors in console.

- [ ] **Play data normalization:** Add `public/js/app-ui/anytale-play/play-normalizer.mjs` with helpers that normalize fetched data: missing character fields (`name`, `personality`, `parts`, `preferredOutfits`, `portraitUrl`, `voiceSampleUrl`) default to empty strings/arrays; missing part fields (`baseline`, `attributes`, `previewBaseline`, `isRevealing`) default to empty string / empty array / false; missing plot fields (`pages`, `section`, `progressionSections`, `progressionDisabledParts`) default to empty arrays/strings; missing outfit fields (`name`, `parts`, `previewUrl`) default to empty strings/arrays. Add a `validatePlayRequirements(data, config)` function that returns `{ ready: boolean, missing: string[] }` — it checks for at least one character, at least one `background`-typed part, at least one plot with `section` matching `prelude` (case-insensitive), at least one plot with `section` matching `epilogue`, and the introduction plot (looked up by `config.introductionPlotName`). If any check fails, the play page shows a guidance message listing the missing items. **Manual test:** intentionally remove optional fields from fixture data and verify play page still loads; remove all epilogue plots and verify the guidance message appears listing "epilogue plot" as missing.

## Implementation Details

### Reference

Refer to the [AnyTale Play Mode parent spec](anytale-play-mode.md) — specifically the **Routing and menu** and **Part attribute options migration** sections.

### File mapping after rename

| Before | After |
|---|---|
| `public/anytale.html` | `public/anytale-editor.html` |
| `public/js/anytale.mjs` | `public/js/anytale-editor.mjs` |
| *(new)* | `public/anytale.html` |
| *(new)* | `public/js/anytale-play.mjs` |

### Play shell entry point skeleton

```js
// public/js/anytale-play.mjs
import { render } from 'preact';
import { html } from 'htm/preact';
import { Page } from './custom-ui/layout/page.mjs';
import { ToastProvider } from './custom-ui/msg/toast.mjs';
import { TooltipProvider } from './custom-ui/overlays/tooltip.mjs';
import { AnyTalePlayPage } from './app-ui/anytale-play/anytale-play.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    render(html`
      <${TooltipProvider}>
        <${Page}>
          <${ToastProvider}>
            <${AnyTalePlayPage} />
          </${ToastProvider}>
        </${Page}>
      </${TooltipProvider}>
    `, root);
  }
});
```

### Hamburger menu items (relevant diff)

```diff
     {
-      label: 'AnyTale',
-      href:  '/anytale.html',
+      label: 'AnyTale',
+      href:  '/anytale.html',
       icon:  'book',
-      active: currentPath === '/anytale.html',
+      active: currentPath === '/anytale.html',
+    },
+    {
+      label: 'AnyTale Editor',
+      href:  '/anytale-editor.html',
+      icon:  'edit',
+      active: currentPath === '/anytale-editor.html',
     },
```

The `AnyTale` entry keeps the `/anytale.html` URL (now pointing to the play page) and appears before `AnyTale Editor`.

### Config key

The existing `anytale.generationWorkflow` key in `server/config.default.json` already drives workflow selection for the editor. Play mode will read the same key via `GET /anytale/config`. No `WorkflowSelector` component is used in the AnyTale editor — it was never added there (workflow selection has always been config-driven for AnyTale, unlike the main page and inpaint page).

The introduction plot is identified by name through a new config key:

```json
{
  "anytale": {
    "generationWorkflow": "Text to Image (Illustrious Portrait)",
    "introductionPlotName": "introduction"
  }
}
```

### Data fetch layer shape

```js
// public/js/app-ui/anytale-play/play-data.mjs
let cachedData = null;

export async function loadPlayData() {
  if (cachedData) return cachedData;
  const [parts, plots, characters, outfits, config] = await Promise.all([
    fetch('/anytale/parts').then(r => r.json()),
    fetch('/anytale/plot').then(r => r.json()),
    fetch('/anytale/characters').then(r => r.json()),
    fetch('/anytale/outfits').then(r => r.json()),
    fetch('/anytale/config').then(r => r.json()),
  ]);
  cachedData = { parts, plots, characters, outfits, config };
  return cachedData;
}

export function clearPlayDataCache() {
  cachedData = null;
}
```

### Play data validation rules

| Requirement | Check |
|---|---|
| At least one character | `characters.length > 0` |
| At least one `background` part | `parts.some(p => p.type?.includes('background'))` |
| At least one `prelude` plot | `plots.some(p => p.section?.toLowerCase() === 'prelude')` |
| At least one `epilogue` plot | `plots.some(p => p.section?.toLowerCase() === 'epilogue')` |
| Introduction plot exists | `plots.some(p => p.name === config.introductionPlotName)` |

### Migration script notes

- The current `anytale-data.json` part attributes already store concrete comma-separated option strings (not category references). The migration script should be a no-op on the current data but is needed as a safety net for any future parts that use category references.
- The script should read tag category trees from `server/database/tag-*.json` files (the same data loaded by `loadTagDefinitions` on the client).
- Idempotency: the script must produce identical JSON output when run multiple times on already-migrated data.

### Constraints

- Do **not** add server rewrites for `/anytale` or `/anytale-editor` in this pass.
- Editor must continue working identically after the rename — same layout, generation, hamburger, tags/autocomplete.
- The data fetch layer is a simple module; it does not manage WebSocket connections or SSE streams.
- Play mode `localStorage` key must be distinct from editor keys (`anytale-state`, `anytale-plot`, `anytale-character`). This rollout does not implement persistence, but the key reservation is noted here for future rollouts.
