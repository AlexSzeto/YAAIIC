# Data-Driven Post-Generation Processes

## Goals

Convert hard-coded pre/post generation process logic (e.g., extracting output paths from text files, crossfading video frames, extracting text outputs) into a data-driven configuration format within the generation task structure. This enables workflows to declare process tasks alongside prompt tasks in `preGenerationTasks` and `postGenerationTasks` arrays, making the system more flexible and maintainable.

## Implementation Details

### Process Task Format

Process tasks are detected by the presence of a `process` keyword and execute server-side operations. They are added to the `postGenerationTasks` array (or `preGenerationTasks` if applicable in future):

```json
{
  "process": "processName",
  "parameters": {
    "param1": "value1",
    "param2": 123
  },
  "condition": {
    "where": { "data": "someFlag" },
    "equals": { "value": true }
  }
}
```

### Process Handlers

Three process handlers will be implemented:

#### 1. extractOutputMediaFromTextFile
Reads a ComfyUI output path from a text file, modifies the file extension based on `imageFormat`, copies the file to `saveImagePath`.

**Parameters:**
- `filename` (required): Name of text file containing output path (e.g., "video-filename.txt")

**Example:**
```json
{
  "process": "extractOutputMediaFromTextFile",
  "parameters": {
    "filename": "video-filename.txt"
  }
}
```

**Replaces:** `extractOutputPathFromTextFile` workflow property

#### 2. crossfadeVideoFrames
Blends first and last N frames of a video to create seamless looping animations.

**Parameters:**
- `blendFrames` (optional, default: 10): Number of frames to blend at start/end

**Example:**
```json
{
  "process": "crossfadeVideoFrames",
  "parameters": {
    "blendFrames": 10
  }
}
```

**Replaces:** `blendLoopFrames` workflow property

#### 3. extractOutputTexts
Reads multiple ComfyUI text file outputs and assigns content to generationData properties.

**Parameters:**
- `properties` (required): Array of property names to extract from {propertyName}.txt files

**Example:**
```json
{
  "process": "extractOutputTexts",
  "parameters": {
    "properties": ["speakerProfile", "voiceDescription"]
  }
}
```

**Replaces:** `extractOutputTexts` workflow property

### Task Detection and Progress Tracking

Tasks are identified by keyword presence:
- `process` keyword → Process task (counted for progress)
- `prompt` keyword → LLM prompt task (counted for progress)
- `from` keyword → Data copy task (not counted)
- `template` keyword → Template expansion task (not counted)

The `calculateTotalSteps()` function counts tasks with `prompt` or `process` keywords for progress tracking.

### Error Handling

All process handlers fail immediately on error without graceful fallback. Errors are logged and thrown to halt generation.

### Conditional Execution

Process tasks support the existing `condition` field for conditional execution via `checkExecutionCondition()`.

### Affected Workflows

Four workflows need migration to new format:
1. "Image to Video (WAN22)" - line 1634: `extractOutputPathFromTextFile: "video-filename.txt"`
2. "Image to Video Loop (WAN5b)" - lines ~1720-1721: `extractOutputPathFromTextFile` + `blendLoopFrames: true`
3. "Image to Video (WAN5b)" - line ~1910: `extractOutputPathFromTextFile: "video-filename.txt"`
4. "Text to Voice Design (Qwen3-TTS)" - lines 2302-2303: `extractOutputTexts: ["speakerProfile", "voiceDescription"]`

### Migration Pattern

**Before:**
```json
{
  "name": "Image to Video Loop (WAN5b)",
  "extractOutputPathFromTextFile": "video-filename.txt",
  "blendLoopFrames": true
}
```

**After:**
```json
{
  "name": "Image to Video Loop (WAN5b)",
  "postGenerationTasks": [
    {
      "process": "extractOutputMediaFromTextFile",
      "parameters": {
        "filename": "video-filename.txt"
      }
    },
    {
      "process": "crossfadeVideoFrames",
      "parameters": {
        "blendFrames": 10
      }
    }
  ]
}
```

## Tasks

[x] Create process handler registry in generate.mjs
[x] Implement extractOutputMediaFromTextFile process handler
[x] Implement crossfadeVideoFrames process handler
[x] Implement extractOutputTexts process handler
[x] Update calculateTotalSteps() to count process tasks
[x] Modify task processing loop to detect and execute process tasks
[x] Remove hard-coded extractOutputPathFromTextFile logic from generate.mjs
[x] Remove hard-coded blendLoopFrames logic from generate.mjs
[x] Remove hard-coded extractOutputTexts logic from generate.mjs
[x] Migrate "Image to Video (WAN22)" workflow to new format
[x] Migrate "Image to Video Loop (WAN5b)" workflow to new format
[x] Migrate "Image to Video (WAN5b)" workflow to new format
[x] Migrate "Text to Voice Design (Qwen3-TTS)" workflow to new format
[] Test "Image to Video (WAN22)" workflow end-to-end
[] Test "Image to Video Loop (WAN5b)" workflow end-to-end
[] Test "Image to Video (WAN5b)" workflow end-to-end
[] Test "Text to Voice Design (Qwen3-TTS)" workflow end-to-end