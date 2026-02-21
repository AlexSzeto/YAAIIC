# Math Operations Pre/Post Generation Task

## Goal

Add a new `math` task type to the pre/post-generation task pipeline that applies a chain of arithmetic formulas `(value + offset) * scale + bias` (with optional rounding) to a named data field. Use this to replace the client-side WAN video frame normalization with workflow-level math tasks.

## Tasks

- [x] Update `comfyui-workflows.schema.json` to define the `mathTask` type and accept it in task arrays
- [x] Handle the `math` task type in the orchestrator's pre/post-generation task loop
- [x] Add "Math Operations" task type to the workflow editor UI
- [x] Remove `normalizeFrameCount` from the client and add equivalent math pre-generation tasks to all 4 WAN workflows

## Implementation Details

### Data Shape

A math task is identified by the presence of the `math` array property:

```json
{
  "from": "frames",
  "to": "frames",
  "math": [
    { "offset": -1, "scale": 0.25, "bias": 0, "round": "ceil" },
    { "offset": 0,  "scale": 4,    "bias": 1, "round": "none" }
  ],
  "condition": { "..." : "..." }
}
```

Each step is applied in sequence: the output of step N is the input to step N+1. The initial value is read from `generationData[from]` and the final result is written to `generationData[to]`.

Per-step formula: `result = (value + offset) * scale + bias`, then:
- `round: "floor"` → `Math.floor(result)`
- `round: "ceil"` → `Math.ceil(result)`
- `round: "none"` → no rounding

Step defaults: `offset: 0`, `scale: 1`, `bias: 0`, `round: "none"`.

### WAN Frame Normalization

The existing `normalizeFrameCount` function in `public/js/app.mjs` implements:

```js
function normalizeFrameCount(inputValue) {
  const num = parseInt(inputValue, 10);
  if (isNaN(num) || num < 1) return 1;
  const n = Math.ceil((num - 1) / 4);
  return (n * 4) + 1;
}
```

This is expressed as two math steps:
- Step 1: `offset: -1, scale: 0.25, bias: 0, round: "ceil"` → `ceil((frames - 1) / 4)`
- Step 2: `offset: 0, scale: 4, bias: 1, round: "none"` → `n * 4 + 1`

This pre-generation math task must be added to all 4 WAN workflows in `server/resource/comfyui-workflows.json`:
- `Image to Video (WAN5b)`
- `Image to Video Loop (WAN5b)`
- `Image to Video (WAN22)`
- `Image to Video Loop (WAN22)`

After adding these tasks, `normalizeFrameCount` and all its call sites must be removed from `public/js/app.mjs`.

### Schema Changes (`server/resource/comfyui-workflows.schema.json`)

Add a `mathFormulaStep` definition:

```json
"mathFormulaStep": {
  "type": "object",
  "description": "A single arithmetic step: result = (value + offset) * scale + bias, with optional rounding",
  "properties": {
    "offset": { "type": "number", "default": 0, "description": "Added to value before multiplication" },
    "scale":  { "type": "number", "default": 1, "description": "Multiplied after offset" },
    "bias":   { "type": "number", "default": 0, "description": "Added after multiplication" },
    "round":  { "type": "string", "enum": ["none", "floor", "ceil"], "default": "none" }
  },
  "additionalProperties": false
}
```

Add a `mathTask` definition:

```json
"mathTask": {
  "type": "object",
  "description": "A math task that chains arithmetic formula steps on a named data field",
  "properties": {
    "from":      { "type": "string", "description": "Source field in generationData" },
    "to":        { "type": "string", "description": "Target field in generationData" },
    "math":      { "type": "array", "items": { "$ref": "#/definitions/mathFormulaStep" }, "minItems": 1 },
    "condition": { "$ref": "#/definitions/condition" }
  },
  "required": ["from", "to", "math"],
  "additionalProperties": false
}
```

Update `preGenerationTasks` and `postGenerationTasks` items from `$ref: llmTask` to:

```json
"items": {
  "oneOf": [
    { "$ref": "#/definitions/llmTask" },
    { "$ref": "#/definitions/mathTask" }
  ]
}
```

### Backend Changes (`server/features/generation/orchestrator.mjs`)

In both the pre-generation and post-generation task loops, detect the math task type and process it:

```js
} else if (Array.isArray(taskConfig.math)) {
  // Math operations task
  const from = taskConfig.from;
  const to   = taskConfig.to;
  let value  = Number(generationData[from]);
  for (const step of taskConfig.math) {
    const { offset = 0, scale = 1, bias = 0, round = 'none' } = step;
    value = (value + offset) * scale + bias;
    if (round === 'floor') value = Math.floor(value);
    else if (round === 'ceil')  value = Math.ceil(value);
  }
  generationData[to] = value;
}
```

Place this branch alongside the existing `from`, `template`, and `model` branches. Math tasks are not "important" (do not increment step count for progress tracking) just like `from` and `template` tasks.

### Frontend Changes (`public/js/app-ui/workflow-editor/task-form.mjs`)

**`getTaskType`**: add detection before the `template`/`from`/`model` checks:
```js
if (task.math !== undefined) return 'math';
```

**`TASK_TYPE_OPTIONS`**: add:
```js
{ value: 'math', label: 'Math Operations' }
```

**`BLANK_TASKS`**: add:
```js
math: { from: '', to: '', math: [{ offset: 0, scale: 1, bias: 0, round: 'none' }] }
```

**`MathTaskForm` sub-form**: renders two field inputs (Source Field, Target Field), then a compact `DynamicList` of formula steps. Each step renders on a single line:

```
( value + [offset Input] ) × [scale Input] + [bias Input]  [round Select]
```

Round select options:
```js
[
  { value: 'none',  label: 'No Rounding' },
  { value: 'floor', label: 'Round Down'  },
  { value: 'ceil',  label: 'Round Up'    },
]
```

`Input` fields for offset/scale/bias should use `type="number"`. All three are narrow (e.g., `maxWidth: '100px'`). The round select should also be narrow. The DynamicList `condensed` prop enables the compact variant.

### Manual Testing

**Math task UI:**
1. Open the Workflow Editor and select any workflow
2. Add a pre-generation task and change its type to "Math Operations"
3. Verify Source Field and Target Field inputs appear
4. Verify the DynamicList shows one default step: `( value + 0 ) × 1 + 0  No Rounding`
5. Click "Add" on the list and verify a new step appears with the same defaults
6. Change a step's rounding to "Round Down" / "Round Up" and verify the select updates
7. Save the workflow and reopen — verify all values are preserved

**Backend math task execution:**
1. In `comfyui-workflows.json`, add the following to the `preGenerationTasks` of any workflow:
   ```json
   { "from": "seed", "to": "seed", "math": [{ "offset": 1, "scale": 1, "bias": 0, "round": "none" }] }
   ```
2. Trigger a generation for that workflow and verify in the server logs (or the output metadata) that `seed` is incremented by 1

**WAN frame normalization:**
1. Open a WAN Image to Video workflow in the UI and set frames to `24`
2. Trigger generation and verify the server does not error on frame count
3. Verify (via ComfyUI logs or output) that the effective frame count is `25` (the nearest valid WAN value)
4. Verify the old frame count normalization no longer happens on the client side (no rounding before the request is sent)
