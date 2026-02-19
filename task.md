
# Workflow Import and Edit UI - Bug Fixing (Continued)

## Goals
Fix remaining design flaws and bugs for the Workflow Import and Edit UI.

## Bugs and Design Flaws
- Add an option to delete a workflow. When a workflow is deleted, delete its associated comfyUI workflow JSON file ONLY if none of the other existing workflows is using that file as its base workflow.

When a comfyUI workflow file is uploaded:
- if a node with `class_type` value `VHS_VideoCombine` exists, change the workflow type to `video`.
- The requirement to be able to save a workflow should be one of the following: a `saveImagePath` or `saveAudioPath` replace bindings, or an `extractOutputMediaFromTextFile` post generation task.
- the workflow selection UI shows the workflow as hidden, but in the form, the `Hidden from main UI` checkbox remains unchecked.
- the default state for Name required should be `true` for new workflows. Autocomplete and Optional prompt should remain `false`, as they are currently.
- all primitives (those nodes with `class_type` values of `PrimitiveString`, `PrimitiveStringMultiline`, `PrimitiveInt`, and `PrimitiveFloat`, and `PrimitiveBoolean`) should be checked first to see if their `_meta.title` matches the strings "Name", "Prompt" or "Seed". For every match, one of the key replacements (for `name`, `prompt` and `seed`) are accounted for and there's no need to search for `KSampler`, `CLIPTextEncode`, or other nodes for the `inputs` for those three key values. If the names of other primitives discovered do not match one of those key values, create them as extra inputs - create them as `text`, `number`, or `checkbox` matching their primitive types. Add an appropriate replace mapping into the primitive type node.
- look for the following sets of node attributes:
```
  "class_type": "easy saveText"
  "file_name": "video-filename",
  "file_extension": "txt",
```
If this exists, automatically create a post-generation `process` task for `extraOutputMediaFromTextFile` with `video-filename.txt`
as its output type.
- For other nodes with `class_type` of `easy saveText` that isn't saving to `video-filename`, see if the `file_name` attribute matches one of the expected data properties: (`tag`, `prompt`, `description`, `summary`). If it does, create a post-generation `process` task for `extractOutputTexts` and add an entry for every data property name discovered.

## Tasks


## Implementation Details
