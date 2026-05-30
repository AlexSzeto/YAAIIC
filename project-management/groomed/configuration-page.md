# Configuration Page (AnyTale-first)

## Goal

Build a tabbed configuration page at `/config.html` where all AnyTale config fields are editable through structured UI, organized by purpose. The Misc tab holds workflow filter inputs and storage actions.

## Tasks

### Phase 1 — Backend config API + migration
- [ ] Write `scripts/migrate/config/5-to-6.mjs` adding `anytale.workflowFilters` (`{ partPreviewWorkflow, portraitWorkflow, generationWorkflow, voiceWorkflow, musicWorkflow, sfxWorkflow, speechWorkflow }` each defaulting to `"AnyTale:"`); bump `config` `currentVersion` to `6` in `data-versions.mjs`
- [ ] Create `server/features/config/` domain: `service.mjs` (read/shallow-merge-write anytale config section), `router.mjs` (`GET /api/config/anytale`, `PATCH /api/config/anytale`); mount in `server.mjs`
- [ ] Write `server/features/config/router.test.mjs` covering GET and PATCH

### Phase 2 — AnyTale tab: Workflow Selectors
- [ ] Refactor `config-app.mjs` to render `TabPanels` (variant `"outlined"`) as its main content with `AnyTale` and `Misc` tabs; create stub `AnyTaleConfigTab` and `MiscConfigTab` components
- [ ] Implement `AnyTaleConfigTab` Workflow Selectors section in `public/js/app-ui/anytale-config-tab.mjs`: fetch `/api/config/anytale` + `/api/workflows` on mount; render 7 `Select` dropdowns filtered by `workflowFilters[key]` prefix; own `useFormRecord` (`recorded=true` always); Save/Revert
- [ ] Add the save/revert rule to `.claude/rules/client.md`

### Phase 3 — AnyTale tab: Editor Settings section
- [ ] Add Editor Settings section to `AnyTaleConfigTab` with fields: `defaultMusicLength` (number `Input`), `portraitBasePrompt` + `outfitBasePrompt` (`TagInput`), `previewBasePromptByType` (`DynamicList` with key `Input` + value `TagInput`); own Save/Revert row
- [ ] Add sub-section **Generate Text** to Editor Settings: `generateText.model` (`Select` from `GET /api/llm/models`), `generateText.templates.selfProfile` / `voiceProfile` / `outfitDescriptions` (three `Textarea` inputs); shared with above Save/Revert
- [ ] Add sub-section **Dialog Preview** to Editor Settings: `dialogPreview.name`, `dialogPreview.location`, `dialogPreview.profile` (three `Input` fields); shared Save/Revert

### Phase 4 — AnyTale tab: Play Mode section
- [ ] Add Play Mode section to `AnyTaleConfigTab` with pill+modal inputs for `portraitParts`, `recommendedCharacterPartTypes`, `recommendedOutfitPartTypes` — options = distinct `type` values across all parts fetched from `GET /anytale/parts`; `introductionPlotName` autocomplete from `GET /anytale/plot`; own Save/Revert row
- [ ] Add sub-section **Dialog** to Play Mode: `dialog.model` (`Input`), `dialog.systemMessage` (`Textarea`), `dialog.parameters.temperature` / `topP` / `maxTokens` (hardcoded number `Input`s), `dialog.mode` (`Select` with options `generate` / `chat`); shared with above Save/Revert

### Phase 5 — Misc tab
- [ ] Implement `MiscConfigTab` in `public/js/app-ui/misc-config-tab.mjs`: fetch `/api/config/anytale` on mount; 7 `Input` fields for `workflowFilters.*` (labels matching workflow field labels from the shared `ANYTALE_WORKFLOW_FIELDS` constant); `useFormRecord` Save/Revert
- [ ] Move storage purge buttons from `config-app.mjs` into `MiscConfigTab`; remove purge state and handlers from `config-app.mjs`
- [ ] Update `docs/features/anytale.md`: expand Part types section and Config keys table to document `recommendedCharacterPartTypes`, `recommendedOutfitPartTypes`, `previewBasePromptByType`, `generationWorkflow`, `speechWorkflow`, `outfitBasePrompt`, `introductionPlotName` with their roles
- [ ] Review and update affected living docs: `docs/server.md`, `.claude/rules/client.md`

## Implementation Details

### Config migration (v5 → v6)

Adds `anytale.workflowFilters` with a default `"AnyTale:"` prefix for each of the seven workflow selector fields.

```js
// scripts/migrate/config/5-to-6.mjs
export const fromVersion = 5;
export const toVersion = 6;

export function migrate(data) {
  data.anytale = data.anytale ?? {};
  data.anytale.workflowFilters = {
    partPreviewWorkflow: 'AnyTale:',
    portraitWorkflow:    'AnyTale:',
    generationWorkflow:  'AnyTale:',
    voiceWorkflow:       'AnyTale:',
    musicWorkflow:       'AnyTale:',
    sfxWorkflow:         'AnyTale:',
    speechWorkflow:      'AnyTale:',
  };
  return data;
}
```

### Config domain (`server/features/config/`)

`service.mjs`:
- `getAnytaleConfig()` — returns `getConfig().anytale`
- `patchAnytaleConfig(partial)` — shallow-merges `partial` into `config.anytale`, writes `config.json` to disk via `fs.writeFileSync`, calls `loadConfig()` to refresh in-memory state, returns the updated `anytale` section

`router.mjs`:
```
GET  /api/config/anytale  →  { anytale: getAnytaleConfig() }
PATCH /api/config/anytale  →  body: partial anytale object  →  { anytale: patchAnytaleConfig(body) }
```

Mount in `server.mjs` alongside other feature routers.

### UI architecture

`ConfigApp` (`public/js/app-ui/config-app.mjs`):
- `AppHeader` with `H1` + `HamburgerMenu` (unchanged)
- `TabPanels` (from `custom-ui/nav/tab-panels.mjs`, variant `"outlined"`) as the sole main content
- Tabs: `[{ id: 'anytale', label: 'AnyTale' }, { id: 'misc', label: 'Misc' }]`
- `activeTab` state initialized to `'anytale'`

### Shared workflow field constant

Defined in `anytale-config-tab.mjs`; imported by `misc-config-tab.mjs`.

```js
export const ANYTALE_WORKFLOW_FIELDS = [
  { key: 'partPreviewWorkflow',  label: 'Part Preview' },
  { key: 'portraitWorkflow',     label: 'Portrait' },
  { key: 'generationWorkflow',   label: 'Image Generation' },
  { key: 'voiceWorkflow',        label: 'Voice Design' },
  { key: 'musicWorkflow',        label: 'Background Music' },
  { key: 'sfxWorkflow',          label: 'SFX' },
  { key: 'speechWorkflow',       label: 'Dialog' },
];
```

### Save/Revert scope

Each visual section in the AnyTale tab manages its own `useFormRecord` (`recorded=true` always, since config always exists). Saving calls `PATCH /api/config/anytale` with only the fields owned by that section. Sections and their field ownership:

| Section | Fields sent on Save |
|---|---|
| Workflow Selectors | `partPreviewWorkflow`, `portraitWorkflow`, `generationWorkflow`, `voiceWorkflow`, `musicWorkflow`, `sfxWorkflow`, `speechWorkflow` |
| Editor Settings | `defaultMusicLength`, `portraitBasePrompt`, `outfitBasePrompt`, `previewBasePromptByType`, `generateText`, `dialogPreview` |
| Play Mode | `portraitParts`, `recommendedCharacterPartTypes`, `recommendedOutfitPartTypes`, `introductionPlotName`, `dialog` |

Misc tab saves `{ workflowFilters }` independently.

### AnyTaleConfigTab: Workflow Selectors section

On mount: fetch `GET /api/config/anytale` + `GET /api/workflows` in parallel.

Each selector filters the workflow list: `workflows.filter(w => w.name.startsWith(filters[field.key] ?? ''))`. An empty filter string shows all workflows.

### AnyTaleConfigTab: Editor Settings section

- `defaultMusicLength` — `Input` with `type="number"`, label "Default Music Length (seconds)"
- `portraitBasePrompt` — `TagInput`, label "Portrait Base Prompt"
- `outfitBasePrompt` — `TagInput`, label "Outfit Base Prompt"
- `previewBasePromptByType` — `DynamicList`; each row: key `Input` (part type string) + value `TagInput` (base prompt); add/remove rows
- **Generate Text sub-section** (`generateText`):
  - `model` — `Select` populated from `GET /api/llm/models`; label "Model"
  - `templates.selfProfile` — `Textarea`, label "Self Profile Template"
  - `templates.voiceProfile` — `Textarea`, label "Voice Profile Template"
  - `templates.outfitDescriptions` — `Textarea`, label "Outfit Descriptions Template"
- **Dialog Preview sub-section** (`dialogPreview`):
  - `name` — `Input`, label "Name"
  - `location` — `Input`, label "Location"
  - `profile` — `Input`, label "Profile"

All fields share one `useFormRecord` and one Save/Revert row for the whole Editor Settings section.

### AnyTaleConfigTab: Play Mode section

- `portraitParts` — pill display + multi-select modal; options = all distinct `type` values from `GET /anytale/parts`; label "Portrait Parts"
- `recommendedCharacterPartTypes` — same pattern; label "Recommended Character Part Types"
- `recommendedOutfitPartTypes` — same pattern; label "Recommended Outfit Part Types"
- `introductionPlotName` — autocomplete `Input`; options = plot `name` values from `GET /anytale/plot`; label "Introduction Plot Name"
- **Dialog sub-section** (`dialog`):
  - `model` — `Input`, label "Model"
  - `systemMessage` — `Textarea`, label "System Message"
  - `parameters.temperature` — number `Input`, label "Temperature"
  - `parameters.topP` — number `Input`, label "Top P"
  - `parameters.maxTokens` — number `Input`, label "Max Tokens"
  - `mode` — `Select` with options `[{ label: 'Generate', value: 'generate' }, { label: 'Chat', value: 'chat' }]`
  - `stream` — not exposed; always `false`

All fields share one `useFormRecord` and one Save/Revert row for the whole Play Mode section.

### MiscConfigTab

7 `Input` fields for `workflowFilters.*`, one per entry in `ANYTALE_WORKFLOW_FIELDS`, each labelled `"${field.label} Workflow Filter"`. Own `useFormRecord` + Save/Revert.

Storage purge buttons (moved from `config-app.mjs`) appear below the filter inputs with their existing handlers and toast logic.

### Save/Revert rule (to add to `.claude/rules/client.md`)

> **Save/Revert pattern (settings and persistent records)** — Use `useFormRecord` from `app-ui/forms.mjs` to manage dirty state. Derive button enable states via `formButtonStates(recorded, dirty)`. On save: call the API → `markSaved(newData)`. On revert: confirm via `showDialog` → reset form state to `savedData`. Config-style forms that always exist set `recorded = true` always and omit delete.

### Docs update (`docs/features/anytale.md`)

Add to Part types section — role of each config key that references part types:
- `portraitParts` — matches library parts by name or type (case-insensitive) to select which parts contribute to portrait prompt assembly
- `recommendedCharacterPartTypes` / `recommendedOutfitPartTypes` — used by the prompt-import classifier to route imported tags to character vs. outfit part lists
- `previewBasePromptByType` — map of `{ partType: basePromptString }`; auto-fills a part's `previewBaseline` when that type is first assigned in the editor and `previewBaseline` is empty

Add missing entries to Config keys table: `generationWorkflow`, `speechWorkflow`, `outfitBasePrompt`, `introductionPlotName`, `recommendedCharacterPartTypes`, `recommendedOutfitPartTypes`, `previewBasePromptByType`.
