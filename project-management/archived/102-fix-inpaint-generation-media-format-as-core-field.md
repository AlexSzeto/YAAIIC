# Fix Inpaint Generation — Media Format as Core Field

## Goal

Fix the inpaint generation pipeline so that `imageFormat` (and `audioFormat`) are preserved through the full generation lifecycle. Currently, inpaint workflow configs declare no `extraInputs`, causing the sanitizer to strip these format fields from saved entries. On subsequent inpaints the source image has no format value, the pre-generation copy task throws, and generation fails immediately. The fix promotes these fields to required core schema fields, migrates existing entries, and adds an orchestrator safety-net fallback.

## Tasks

- [x] **Promote `imageFormat` and `audioFormat` to required core fields in the media data schema**

  Add `imageFormat` and `audioFormat` to `server/resource/media-data-schema.json` as non-auto-generated core fields with a default of `null`:

  ```json
  "imageFormat": { "type": "string", "default": null },
  "audioFormat": { "type": "string", "default": null }
  ```

  Because `sanitizer.mjs` treats every key listed in the schema as a core field (kept at the top level rather than moved into `extraInputs`), no other change to the sanitizer is needed. After this change, every newly generated media entry will store `imageFormat` and `audioFormat` as direct top-level properties.

  **Manual test:** Generate a new image via the main generation flow, open `server/database/media-data.json`, find the new entry, and confirm `imageFormat` appears as a top-level field (e.g., `"imageFormat": "png"`) rather than inside `extraInputs`.

- [x] **Write a migration script to promote format fields in existing media entries**

  Create `scripts/migrate/11-media-format-to-core-fields.mjs`. The script should:

  1. Read `server/database/media-data.json`
  2. For each entry in `mediaData`, for each of `imageFormat` and `audioFormat`:
     - If the top-level field is already set, leave it untouched
     - If a value exists in `extraInputs`, promote it to the top level
     - Otherwise derive the value from the file extension of `imageUrl` / `audioUrl` (e.g., `"/media/image_5.png"` → `"png"`); skip `audioFormat` derivation if `audioUrl` is absent
     - After promoting, remove `imageFormat` / `audioFormat` from `extraInputs`
  3. Write the updated data back to the file
  4. Print a summary: total entries processed, how many were updated, and for each updated entry its UID and what value was set

  The script should be idempotent (safe to run more than once). Use `path.extname` to derive the extension and strip the leading dot with `.slice(1).toLowerCase()`.

  **Manual test:**
  1. Backup `server/database/media-data.json`
  2. Run: `node scripts/migrate/11-media-format-to-core-fields.mjs`
  3. Inspect the console output for a summary of promoted entries
  4. Open `server/database/media-data.json` and spot-check several entries that previously had `imageFormat` inside `extraInputs` — they should now have it at the top level and it should be absent from `extraInputs`
  5. Entries that already had a top-level `imageFormat` should be unchanged

- [x] **Add safety-net format derivation from file extension in the orchestrator finalization**

  In `server/features/generation/orchestrator.mjs`, in the **FINALISATION** section immediately before the `addMediaDataEntry(generationData)` call (around line 767), add:

  ```javascript
  if (!generationData.imageFormat && generationData.saveImagePath) {
    const ext = path.extname(generationData.saveImagePath).slice(1).toLowerCase();
    if (ext) {
      generationData.imageFormat = ext;
      console.log('Auto-derived imageFormat from saveImagePath:', ext);
    }
  }
  if (!generationData.audioFormat && generationData.saveAudioPath) {
    const ext = path.extname(generationData.saveAudioPath).slice(1).toLowerCase();
    if (ext) {
      generationData.audioFormat = ext;
      console.log('Auto-derived audioFormat from saveAudioPath:', ext);
    }
  }
  ```

  By finalization `saveImagePath` is always set (it was just validated to exist), so the extension is always derivable.

  **Manual test:** Trigger any generation workflow. Under normal conditions the `Auto-derived` log lines should **not** appear. To exercise the fallback, temporarily comment out the `imageFormat` assignment in a workflow's pre-generation tasks, run a generation, and confirm the log appears and the saved entry has the correct `imageFormat` value. Restore the comment afterward.
