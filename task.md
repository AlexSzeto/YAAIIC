# Workflow Import and Edit UI - Bug Fixing (Continued)

## Goals
Fix remaining design flaws and bugs for the Workflow Import and Edit UI.

## Bugs and Design Flaws

## Tasks

- [ ] Fix `ExtraInputForm` select-type options: change from a comma-separated text input to a `DynamicList` of `{ label, value }` objects, with a sub-form for each option item.

## Implementation Details

### select-type extra input options schema
Each item in the `options` array is an object: `{ label: string, value: string }`.
The `Select` component from `custom-ui/io/select.mjs` already accepts this format.
