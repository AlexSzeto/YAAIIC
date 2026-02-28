# Sound Editor Modal

## Goal
Allow users to open an in-browser audio editor from the generated results panel for any audio media item. The editor visualises the waveform, supports non-destructive region-based editing (trim/crop), and lets users define labelled clip regions. Saving physical edits produces a new derived media entry; saving clip-region-only changes updates the existing entry in place. The ambient brew sound source form is updated to bulk-import clips from a media item's defined regions.

## Tasks

- [ ] **Backend** – Add `origin` field to inpaint-generated media entries
- [ ] **Backend** – Add `POST /upload/audio-edit` endpoint for saving physically-edited audio
- [ ] **Frontend** – Add optional `onAdd` override prop to `DynamicList`
- [ ] **Frontend** – Update `SoundClip` in `ambient-coffee.js` to respect `start`/`end` offsets
- [ ] **Frontend** – Update `SoundSourceForm` clip add to bulk-import from gallery
- [ ] **Frontend** – Create `SoundEditorModal` component
- [ ] **Frontend** – Wire up the Edit button in `GeneratedResult` and `app.mjs`

---

## Implementation Details

---

### Task 1 – Add `origin` to inpaint saves

**File:** `server/features/generation/router.mjs`

When the inpaint route builds its `requestData`, include `origin` from the request body (the UID of the source image being inpainted):

```js
// inside the POST /generate/inpaint handler, when building requestData:
origin: req.body.origin ? parseInt(req.body.origin) : undefined,
```

**File:** `server/features/generation/orchestrator.mjs`

`processGenerationTask` spreads `requestData` into `generationData` (line ~291), so `origin` will flow through automatically. No changes needed in the orchestrator.

**File:** `public/js/app-ui/inpaint/inpaint-form.mjs` (or wherever the inpaint POST is built client-side)

When submitting the inpaint request, include `origin: image.uid` in the request body so the server receives it.

**Manual test:**
```bash
# After completing an inpaint generation, fetch the new entry and verify it has an origin field:
curl http://localhost:3000/media-data/<new_uid>
# Expected: { ..., "origin": <source_uid>, ... }
```

---

### Task 2 – Thread `origin` through the existing `/upload/audio` endpoint

No new endpoint or service function is needed. The existing `POST /upload/audio` route already accepts `req.body.name`; we extend it to also accept `req.body.origin`.

**File:** `server/features/upload/router.mjs`

Extract `origin` alongside `name` and forward it:

```js
router.post('/upload/audio', upload.single('audio'), async (req, res) => {
  ...
  const extractedName   = req.body.name   || null;
  const extractedOrigin = req.body.origin ? parseInt(req.body.origin) : null;

  const taskId = await processMediaUpload(req.file, loadWorkflows(), extractedName, extractedOrigin);
  ...
});
```

**File:** `server/features/upload/service.mjs`

Add `origin = null` as a fourth parameter to `processMediaUpload` and forward it to `processUploadTask`:

```js
export async function processMediaUpload(file, workflowsConfig, name = null, origin = null) {
  ...
  processUploadTask(taskId, file, workflowsConfig, name, origin).catch(...);
  ...
}
```

Add `origin = null` as a fifth parameter to `processUploadTask`. When building `generationData` for the audio path (inside the `if (isAudio)` block, around line 267), include `origin` if present:

```js
const generationData = {
  ...albumResult,
  saveAudioPath: saveMediaPath,
  audioUrl: `/media/${filename}`,
  audioFormat: ext.substring(1),
  workflow: 'Uploaded Audio',
  type: 'audio',
  ...(origin != null && { origin }),
};
```

**Client-side (Task 6 — `handleSave` in `SoundEditorModal`):**

Include `origin` in the `FormData` when uploading a physically-edited audio file:

```js
formData.append('audio',  blob, 'edit.wav');
formData.append('origin', String(item.uid));
```

**Manual test:**
```bash
curl -X POST http://localhost:3000/upload/audio \
  -F "audio=@/path/to/edited.wav" \
  -F "origin=1768003709505"
# After the task completes, fetch the new entry via SSE or GET /media-data
# Expected: { ..., "origin": 1768003709505, "type": "audio", ... }
```

---

### Task 3 – `onAdd` override prop for `DynamicList`

**File:** `public/js/custom-ui/layout/dynamic-list.mjs`

Add optional `onAdd` prop to the component signature:

```js
export function DynamicList({
  ...
  onAdd,   // optional: () => void – replaces default handleAdd when provided
  ...
})
```

Wire it to the add button:

```js
const addButton = html`
  <${Button}
    variant="small-icon"
    icon="plus"
    color="secondary"
    onClick=${onAdd ?? handleAdd}
  >
  </${Button}>
`;
```

No changes to `DynamicListItem` or condensed variant needed.

**Manual test:**
Verify existing brew editor clips list still adds a blank row when no `onAdd` prop is supplied (default behaviour unchanged). The overridden behaviour is visible after Task 5.

---

### Task 4 – `SoundClip` start/end offset support

**File:** `public/js/ambrew/ambient-coffee.js`

#### `SoundClip` class changes

Add `#start` and `#end` private fields (both default `null` = use full buffer):

```js
#start = null   // seconds, or null for buffer start
#end   = null   // seconds, or null for buffer end
```

Add a `setOffsets(start, end)` method:

```js
setOffsets(start, end) {
  this.#start = start ?? null;
  this.#end   = end   ?? null;
}
```

Add computed getters:

```js
get startOffset()       { return this.#start ?? 0 }
get effectiveDuration() { return (this.#end ?? this.#buffer.duration) - this.startOffset }
```

Update `duration` getter to return `effectiveDuration` when offsets are set:

```js
get duration() {
  if (!this.#buffer) return 0;
  return (this.#end ?? this.#buffer.duration) - (this.#start ?? 0);
}
```

#### `repeatInto` — use clip offsets

```js
// Replace:
bufferSource.start(when, 0, clip.buffer.duration)
// With:
bufferSource.start(when, clip.startOffset, clip.effectiveDuration)
// And update the time-advance line:
when += this.repeatDelay.random + clip.effectiveDuration
```

#### `playSegmentInto` — respect clip boundaries

```js
const clipStart  = clip.startOffset;
const clipEnd    = (clip.#end ?? clip.buffer.duration);  // expose via getter or use effectiveDuration
const available  = clipEnd - clipStart;
duration = Math.min(duration, available);
const offset = clipStart + Math.random() * (available - duration);
bufferSource.start(when, offset, duration);
```

#### `loadBrew` / `insertClip` — pass offsets

Find the `insertClip` helper inside `loadBrew` (around line 592). Update to accept the full clip object and forward `start`/`end`:

```js
const insertClip = (clipData) => {
  const url = typeof clipData === 'string' ? clipData : clipData.url;
  if (!clipLibrary.find(c => c.url === fullURL(url))) {
    const clip = new SoundClip();
    if (typeof clipData === 'object' && (clipData.start != null || clipData.end != null)) {
      clip.setOffsets(clipData.start ?? null, clipData.end ?? null);
    }
    clipLibrary.push(clip);
    loadingClips.push(clip.load(fullURL(url)));
  }
};
```

Update any callers of `insertClip` that currently pass a plain URL string to pass the full clip object.

**Manual test:**
Manually set `"start": 2, "end": 5` on a clip in `server/database/sound-sources.json`, play a brew preview in the brew editor, and confirm only the 3-second sub-segment plays.

---

### Task 5 – Bulk clip import in `SoundSourceForm`

**File:** `public/js/app-ui/brew-editor/sound-source-form.mjs`

#### Change `DynamicList` add behaviour

Replace the `createItem` / default add flow on the clips DynamicList with an `onAdd` override that opens the gallery immediately:

```js
const handleAddClipClick = useCallback(() => {
  setGalleryClipIndex('add');   // sentinel string distinguishing "add" from numeric replace-at-index
}, []);
```

Pass to the DynamicList:
```js
<${DynamicList}
  ...
  onAdd=${handleAddClipClick}
  addLabel="Add Clip"
  ...
/>
```

Remove `createItem` prop (no longer needed for the add path; keep it or make it a no-op to avoid breaking the component's prop types).

#### Update `handleGallerySelect`

When `galleryClipIndex === 'add'`:
- If the selected gallery entry has a non-empty `clips` array, bulk-import all of them, mapping each clip to:
  ```js
  { url: entry.audioUrl, label: clip.label, start: clip.start, end: clip.end }
  ```
- Otherwise, add a single full-file clip:
  ```js
  { url: entry.audioUrl || entry.url || '', label: entry.name || '' }
  ```
- Merge the new clips into existing ones and call `onChange`.

When `galleryClipIndex` is a numeric index (existing "Browse" flow), behaviour is unchanged.

**Manual test:**
Open the brew editor → add a sound source → click the "+" next to Clips. Gallery should open immediately. Select an audio item that has clip regions saved (from Task 6). Verify all clips are added at once. Select an audio item with no clips. Verify one full-file clip is added.

---

### Task 6 – `SoundEditorModal` component

**New file:** `public/js/app-ui/sound-editor/sound-editor-modal.mjs`

#### Library imports (full CDN URLs — no importmap changes needed)

```js
import WaveSurfer from 'https://esm.sh/wavesurfer.js@7';
import RegionsPlugin from 'https://esm.sh/wavesurfer.js@7/dist/plugins/regions.js';
```

#### Component props

```js
/**
 * @param {Object}   props
 * @param {Object}   props.item      – media-data entry for the audio being edited
 * @param {Function} props.onClose   – called when modal is dismissed without saving
 * @param {Function} props.onSaved   – called with the new (or updated) media-data entry after save
 */
export function SoundEditorModal({ item, onClose, onSaved }) { ... }
```

#### State

```js
const [clipRegions, setClipRegions]         = useState(
  (item.clips || []).map((c, i) => ({ ...c, id: `clip-${i}` }))
);
const [hasPhysicalEdits, setHasPhysicalEdits] = useState(false);
const [isSaving, setIsSaving]               = useState(false);

const wavesurferRef   = useRef(null);   // WaveSurfer instance
const wsRegionsRef    = useRef(null);   // Regions plugin instance
const audioBufferRef  = useRef(null);   // Current in-memory AudioBuffer
const activeRegionRef = useRef(null);   // The current active-selection region
const containerRef    = useRef(null);   // Plain <div> for WaveSurfer mount point
```

#### WaveSurfer initialisation (`useEffect` on mount)

```js
useEffect(() => {
  const ws = WaveSurfer.create({
    container: containerRef.current,   // plain DOM node, not a styled wrapper
    waveColor: theme.colors.primary.background,
    progressColor: theme.colors.primary.focus,
    interact: true,
    height: 128,
  });

  const regions = ws.registerPlugin(RegionsPlugin.create());
  regions.enableDragSelection({ color: 'rgba(255,165,0,0.3)' }); // active selection colour

  ws.load(item.audioUrl);

  // Decode audio into a buffer for editing
  ws.on('ready', async () => {
    const res = await fetch(item.audioUrl);
    const ab  = await res.arrayBuffer();
    audioBufferRef.current = await new AudioContext().decodeAudioData(ab);
    renderClipRegions(regions, clipRegions);
  });

  // Manage the single active selection: remove the previous one on new drag
  regions.on('region-created', region => {
    if (activeRegionRef.current && activeRegionRef.current.id !== region.id) {
      activeRegionRef.current.remove();
    }
    activeRegionRef.current = region;
  });

  wavesurferRef.current = ws;
  wsRegionsRef.current  = regions;

  return () => ws.destroy();
}, []);  // runs once on mount
```

#### Region rendering helper (module-level)

```js
function renderClipRegions(regionsPlugin, clips) {
  regionsPlugin.getRegions()
    .filter(r => r !== activeRegionRef.current)
    .forEach(r => r.remove());

  clips.forEach(clip => {
    regionsPlugin.addRegion({
      id:      clip.id,
      start:   clip.start,
      end:     clip.end,
      content: clip.label,
      color:   'rgba(0,200,100,0.25)',
      drag:    false,
      resize:  false,
    });
  });
}
```

#### WAV encoder helper (module-level)

```js
function audioBufferToWavBlob(audioBuffer) {
  const numCh     = audioBuffer.numberOfChannels;
  const rate      = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const dataBytes = numFrames * numCh * 2;           // 16-bit PCM
  const buf       = new ArrayBuffer(44 + dataBytes);
  const view      = new DataView(buf);
  const write     = (off, str) =>
    [...str].forEach((c, i) => view.setUint8(off + i, c.charCodeAt(0)));

  write(0, 'RIFF');  view.setUint32(4,  36 + dataBytes, true);
  write(8, 'WAVE');  write(12, 'fmt ');
  view.setUint32(16, 16,         true);  // PCM chunk size
  view.setUint16(20, 1,          true);  // PCM format
  view.setUint16(22, numCh,      true);
  view.setUint32(24, rate,       true);
  view.setUint32(28, rate * numCh * 2, true);
  view.setUint16(32, numCh * 2,  true);
  view.setUint16(34, 16,         true);
  write(36, 'data'); view.setUint32(40, dataBytes, true);

  let off = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}
```

#### AudioBuffer edit helpers (module-level)

```js
/** Remove audio between [selStart, selEnd] seconds. */
function applyTrim(src, selStart, selEnd) {
  const { sampleRate: rate, numberOfChannels: ch } = src;
  const s0     = Math.round(selStart * rate);
  const s1     = Math.round(selEnd   * rate);
  const newLen = src.length - (s1 - s0);
  const ctx    = new OfflineAudioContext(ch, newLen, rate);
  const dst    = ctx.createBuffer(ch, newLen, rate);
  for (let c = 0; c < ch; c++) {
    const s = src.getChannelData(c);
    const d = dst.getChannelData(c);
    d.set(s.subarray(0,  s0), 0);
    d.set(s.subarray(s1),    s0);
  }
  return dst;
}

/** Keep only audio between [selStart, selEnd] seconds. */
function applyCrop(src, selStart, selEnd) {
  const { sampleRate: rate, numberOfChannels: ch } = src;
  const s0  = Math.round(selStart * rate);
  const s1  = Math.round(selEnd   * rate);
  const ctx = new OfflineAudioContext(ch, s1 - s0, rate);
  const dst = ctx.createBuffer(ch, s1 - s0, rate);
  for (let c = 0; c < ch; c++) {
    dst.getChannelData(c).set(src.getChannelData(c).subarray(s0, s1));
  }
  return dst;
}
```

#### Clip region adjustment helper (module-level)

```js
/**
 * Recalculate clip region timestamps after a trim or crop.
 * @param {Array}            clips     – [{id, label, start, end}]
 * @param {'trim'|'crop'}    op
 * @param {number}           selStart  – seconds (relative to pre-edit buffer)
 * @param {number}           selEnd
 * @returns {Array}
 */
function adjustClipRegions(clips, op, selStart, selEnd) {
  if (op === 'crop') {
    return clips
      .filter(c => c.start < selEnd && c.end > selStart)
      .map(c => ({
        ...c,
        start: Math.max(0, c.start - selStart),
        end:   Math.min(selEnd - selStart, c.end - selStart),
      }));
  }
  // trim: delete [selStart, selEnd]
  const deleted = selEnd - selStart;
  return clips
    .filter(c => !(c.start >= selStart && c.end <= selEnd))  // remove fully-inside
    .map(c => {
      if (c.end   <= selStart) return c;                      // entirely before
      if (c.start >= selEnd)   return { ...c, start: c.start - deleted, end: c.end - deleted };
      // partial overlap – clamp
      return {
        ...c,
        start: c.start < selStart ? c.start : selStart,
        end:   c.end   > selEnd   ? c.end - deleted : selStart,
      };
    });
}
```

#### Button handlers (inside component)

```js
const getActiveRegion = () => activeRegionRef.current;

const handleTrim = useCallback(() => {
  const region = getActiveRegion();
  if (!region || !audioBufferRef.current) return;
  const newBuffer = applyTrim(audioBufferRef.current, region.start, region.end);
  const newClips  = adjustClipRegions(clipRegions, 'trim', region.start, region.end);
  audioBufferRef.current = newBuffer;
  setClipRegions(newClips);
  setHasPhysicalEdits(true);
  activeRegionRef.current = null;
  wavesurferRef.current.loadBlob(audioBufferToWavBlob(newBuffer));
  renderClipRegions(wsRegionsRef.current, newClips);
}, [clipRegions]);

const handleCrop = useCallback(() => {
  const region = getActiveRegion();
  if (!region || !audioBufferRef.current) return;
  const newBuffer = applyCrop(audioBufferRef.current, region.start, region.end);
  const newClips  = adjustClipRegions(clipRegions, 'crop', region.start, region.end);
  audioBufferRef.current = newBuffer;
  setClipRegions(newClips);
  setHasPhysicalEdits(true);
  activeRegionRef.current = null;
  wavesurferRef.current.loadBlob(audioBufferToWavBlob(newBuffer));
  renderClipRegions(wsRegionsRef.current, newClips);
}, [clipRegions]);

const handleAddClip = useCallback(async () => {
  const region = getActiveRegion();
  if (!region) return;
  const label = await showTextPrompt('Clip label', '', 'e.g. Rain soft');
  if (!label) return;
  const newClip  = { id: `clip-${Date.now()}`, label, start: region.start, end: region.end };
  const updated  = [...clipRegions, newClip];
  setClipRegions(updated);
  renderClipRegions(wsRegionsRef.current, updated);
}, [clipRegions]);

const handleScrub = useCallback(() => {
  const region = getActiveRegion();
  if (!region) return;
  const updated = clipRegions.filter(c => !(c.start >= region.start && c.end <= region.end));
  setClipRegions(updated);
  renderClipRegions(wsRegionsRef.current, updated);
}, [clipRegions]);

const handleSave = useCallback(async () => {
  setIsSaving(true);
  try {
    // Strip internal `id` before persisting
    const clipsForStorage = clipRegions.map(({ label, start, end }) => ({ label, start, end }));

    if (hasPhysicalEdits) {
      const blob     = audioBufferToWavBlob(audioBufferRef.current);
      const formData = new FormData();
      formData.append('audio',  blob, 'edit.wav');
      formData.append('origin', String(item.uid));
      const res  = await fetch('/upload/audio', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      // Patch the new entry with clip regions if any were defined
      if (clipsForStorage.length > 0) {
        await fetch('/edit', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ...data.entry, clips: clipsForStorage }),
        });
        data.entry.clips = clipsForStorage;
      }
      onSaved(data.entry);
    } else {
      // Metadata-only: patch the existing item in place
      const updated = { ...item, clips: clipsForStorage };
      const res = await fetch('/edit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(updated),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed'); }
      onSaved(updated);
    }
  } catch (err) {
    toast.error(`Save failed: ${err.message}`);
  } finally {
    setIsSaving(false);
  }
}, [clipRegions, hasPhysicalEdits, item, onSaved]);
```

#### Render structure

Use `BaseOverlay` / `BaseContainer` / `BaseHeader` / `BaseContent` / `BaseFooter` from `custom-ui/overlays/modal-base.mjs` (same primitives used by `dialog.mjs`). Render via `createPortal` to `document.body`.

```
BaseOverlay
  └─ BaseContainer (maxWidth: 90vw)
       ├─ BaseHeader: item.name as title
       ├─ BaseContent:
       │    └─ <div ref=${containerRef} />   ← plain <div>, NOT a styled wrapper
       └─ BaseFooter:
            └─ HorizontalLayout:
                 Trim | Crop | Add Clip | Scrub | [flex spacer] | Cancel | Save
```

Button disabled states:
- Trim, Crop, Add Clip, Scrub → disabled when `activeRegionRef.current` is null (track as state: `const [hasSelection, setHasSelection] = useState(false)` updated in the `region-created` listener)
- Save → disabled when `isSaving`

**Manual test:**
1. Select an audio result on the main page and click "Edit" — modal opens with the waveform.
2. Drag on the waveform — orange selection region appears.
3. Click "Add Clip", enter a label — green named region appears.
4. Create another selection and click "Trim" — waveform shortens, clip regions adjust.
5. Click "Save" (physical edit) — new entry appears in gallery with `origin` field.
6. Re-open the editor on the original item (no physical edits), add a clip region, Save — existing entry updated in place, no new gallery item.

---

### Task 7 – Wire up the Edit button

**File:** `public/js/app-ui/main/generated-result.mjs`

Add `onSoundEdit` to the component's props. Conditionally render Edit vs Inpaint based on media type:

```js
// Replace the single Inpaint button with a conditional:
${image.type === 'audio'
  ? html`
      <${Button}
        variant="primary"
        icon="pencil"
        onClick=${() => onSoundEdit && onSoundEdit(image)}
        title="Edit this audio"
      >
        Edit
      </${Button}>`
  : html`
      <${Button}
        variant="primary"
        icon="brush"
        onClick=${() => onInpaint && onInpaint(image)}
        disabled=${isInpaintDisabled}
        title="Inpaint this image"
      >
        Inpaint
      </${Button}>`
}
```

Remove `isInpaintDisabled` prop — it was only needed to disable inpaint for audio, which is now handled by showing a different button entirely. Update the prop signature accordingly.

**File:** `public/js/app.mjs`

1. Import `SoundEditorModal`:
   ```js
   import { SoundEditorModal } from './app-ui/sound-editor/sound-editor-modal.mjs';
   ```
2. Add state:
   ```js
   const [soundEditorItem, setSoundEditorItem] = useState(null);
   ```
3. Add handler:
   ```js
   const handleSoundEdit = useCallback((item) => setSoundEditorItem(item), []);
   ```
4. Pass to `GeneratedResult`:
   ```js
   onSoundEdit=${handleSoundEdit}
   ```
5. Remove the `isInpaintDisabled` calculation and prop pass (audio check no longer needed there).
6. Render the modal:
   ```js
   ${soundEditorItem ? html`
     <${SoundEditorModal}
       item=${soundEditorItem}
       onClose=${() => setSoundEditorItem(null)}
       onSaved=${(newEntry) => {
         // Optionally prepend to results and auto-select the new entry
         setSoundEditorItem(null);
       }}
     />
   ` : null}
   ```

**Manual test:**
1. Select an image result — Inpaint button is visible; no Edit button.
2. Select an audio result — Edit button is visible; no Inpaint button.
3. Click Edit — `SoundEditorModal` opens with the audio waveform.
