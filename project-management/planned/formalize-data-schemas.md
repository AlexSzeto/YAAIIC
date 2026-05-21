# Formalize Data Schemas

**Priority:** medium

## Goal

Move `server/resource/media-data-schema.json` to a dedicated `server/resource/schemas/` directory and create schema files for every major persisted data type (parts, characters, outfits, plots, workflows, brew, sound-sources, and any other entities stored in `server/database/` or config). Wire schema validation into the router endpoints that accept or return these structures as input/output. Incorporate the schema files into the living docs update loop so data-shape documentation always references the authoritative schema file rather than being hand-maintained.

## Notes

- `media-data-schema.json` already exists and is actively used by `sanitizer.mjs`; the sanitizer pattern (strip unknown fields, fill defaults) should be the model for other types.
- The `sanitizer.mjs` currently hard-codes its path — it must be updated when the file moves.
- Schema validation at router boundaries should reject bad input early with a clear error, not silently coerce or ignore.
- Consider whether the same schema file can drive both validation (input) and documentation (output shape) to avoid duplication.
