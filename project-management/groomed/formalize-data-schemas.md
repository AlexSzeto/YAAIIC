# Formalize Data Schemas

## Goal

Introduce standard JSON Schema (draft-07) files for all persisted data domains, replace the custom schema format with a generic core sanitizer that fills defaults, add permissive router-boundary validation via Ajv, and update all living docs and skills to reference the authoritative schema files.

## Tasks

### Phase 1 — Schema files

- [ ] Move `server/resource/media-data-schema.json` → `server/resource/schemas/media-data.schema.json` with `git mv`; update the hardcoded path in `server/features/media/sanitizer.mjs` to `RESOURCE_DIR/schemas/media-data.schema.json`; convert the file to JSON Schema draft-07 format; verify the server starts and existing media sanitizer behaviour is unchanged
- [ ] Create JSON Schema draft-07 files for anytale entity types in `server/resource/schemas/`:
  - `anytale-parts.schema.json`
  - `anytale-characters.schema.json`
  - `anytale-outfits.schema.json`
  - `anytale-plots.schema.json`
  - `anytale-genres.schema.json`
  - `anytale-sfx.schema.json`
- [ ] Create JSON Schema draft-07 files for remaining domains in `server/resource/schemas/`:
  - `brew-data.schema.json`
  - `sound-sources.schema.json`
  - `config.schema.json`
  - `workflows.schema.json` (covers `comfyui-workflows.json` registry format)

### Phase 2 — Core sanitizer infrastructure

- [ ] Install Ajv (`ajv`) as a production dependency; create `server/core/sanitizer.mjs` exporting:
  - `STRICT_VALIDATION_WARNINGS` — hardcoded `boolean` const; when `true`, logs unknown fields and validation failures to the server console
  - `sanitize(data, schema)` — fills missing fields with their `default` values from the JSON Schema at every nesting level; permissive (does not strip or reject unknown fields); logs warnings when `STRICT_VALIDATION_WARNINGS` is enabled
  - `validate(data, schema)` — runs an Ajv permissive check (only required fields and declared types); returns `{ valid: boolean, errors: AjvError[] | null }`
- [ ] Write unit tests in `server/core/sanitizer.test.mjs` covering: default-filling for flat and deeply nested objects, arrays of objects, missing vs. present fields, and `validate()` returning correct `valid`/`errors` for both passing and failing inputs

### Phase 3 — Domain integration

- [ ] Refactor `server/features/media/sanitizer.mjs`: call `sanitize(entry, mediaSchema)` as the first step, then continue with the existing extra-inputs domain logic (move unknowns to `extraInputs`, filter by workflow config)
- [ ] Create `server/features/anytale/sanitizer.mjs` — one exported sanitize function per entity type (part, character, outfit, plot, genre, sfx); each calls `sanitize()` then strips remaining unknown top-level fields; wire each function into the anytale service/repository load and save paths
- [ ] Create sanitizers for brew, sound-sources, and config following the same pattern; wire into their respective load and save paths
- [ ] Add router-boundary validation to all write endpoints (POST/PUT) for every domain: call `validate(req.body, schema)` and return `400` with Ajv `errors` when `valid` is `false`; add co-located test coverage for at least one valid and one invalid body per domain

### Phase 4 — Docs, comments, and skills audit

- [ ] Add schema file references to affected living docs — for each domain, point the relevant doc to its authoritative schema file in `server/resource/schemas/`:
  - `docs/server.md` — all domains
  - `docs/features/anytale.md` — anytale entity schemas
  - `docs/features/ambient-brew.md` — brew-data, sound-sources schemas
  - `docs/workflow.md` — workflows schema
- [ ] Audit all source files for code comments or docstrings referencing the old custom schema format (`{ fields: { ... } }`) and update them to describe the JSON Schema format
- [ ] Audit `.claude/skills/` and `.claude/rules/` for any references to the old schema format or the old schema file path and update them
- [ ] Review and update affected living docs: `docs/server.md`, `docs/architecture.md`, `docs/features/anytale.md`, `docs/features/ambient-brew.md`, `docs/workflow.md`, `.claude/rules/server.md`

## Implementation Details

### Schema location

All schema files live under `server/resource/schemas/`. The path constant `RESOURCE_DIR` (from `server/core/paths.mjs`) is the base.

### JSON Schema format

Use draft-07. Every schema must:
- Declare `"$schema": "http://json-schema.org/draft-07/schema#"`
- Use `"properties"` with `"default"` values for every field that has a known default
- Mark required fields in a `"required"` array
- Use `"$defs"` for shared sub-schemas (e.g., the `{ min, max }` range shape used in sound-sources)
- Go deep enough to cover every nested object and array-of-objects level so `sanitize()` can fill defaults throughout the tree

### Generic sanitizer (`server/core/sanitizer.mjs`)

```js
export const STRICT_VALIDATION_WARNINGS = false;

/**
 * Fills missing fields with their schema `default` values, recursively.
 * Does NOT strip unknown fields — that is domain-specific logic.
 * @param {Object} data
 * @param {Object} schema - JSON Schema draft-07
 * @returns {Object} The mutated data object
 */
export function sanitize(data, schema) { ... }

/**
 * Permissive Ajv validation — only checks required fields and declared types.
 * @param {Object} data
 * @param {Object} schema - JSON Schema draft-07
 * @returns {{ valid: boolean, errors: import('ajv').ErrorObject[] | null }}
 */
export function validate(data, schema) { ... }
```

Ajv should be instantiated once (module-level singleton) with `{ allErrors: true, useDefaults: false }` — defaults are handled by `sanitize()`, not Ajv.

### Domain-specific unknown-field handling

| Domain | Post-sanitize unknown-field behaviour |
|---|---|
| media-data | Move unknown top-level fields to `extraInputs`; filter `extraInputs` by workflow config (existing logic) |
| anytale (all types) | Strip unknown top-level fields |
| brew-data | Strip unknown top-level fields |
| sound-sources | Strip unknown top-level fields |
| config | Strip unknown top-level fields |
| workflows | Strip unknown top-level fields |

### Router boundary validation

Router write handlers call `validate(req.body, schema)` before any service call. On failure:

```js
const { valid, errors } = validate(req.body, schema);
if (!valid) return res.status(400).json({ error: 'Invalid request body', details: errors });
```

### `STRICT_VALIDATION_WARNINGS` usage

When `true`, `sanitize()` logs a warning for every field present in `data` that has no corresponding property in the schema, and `validate()` logs a warning for every Ajv error even when the route proceeds (permissive mode). This is a hardcoded developer toggle — not exposed to users or config.

### Sanitize call sites (following media's existing pattern)

Sanitization runs on both disk-load and write paths. For media: `database.mjs` (load) and `service.mjs` (write). New domains must follow the same dual-call pattern.
