# Workflow Editor: ComfyUI Graph Recreation

**Priority:** low

## Goal

Extend the workflow editor to recreate and display the underlying ComfyUI node graph, allowing users to inspect and potentially edit the graph structure directly from the app rather than switching to ComfyUI's own UI.

## Notes

- Currently the workflow editor manages parameter mappings but does not visualize the raw ComfyUI graph.
- Graph recreation means parsing the workflow JSON and rendering nodes/edges as an interactive canvas.
- Scope (read-only vs. editable graph) should be decided during grooming.
