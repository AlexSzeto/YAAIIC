# Video Generation Improvements

## Goal
- Update the video length frame number so it must fit in the formula (X * 4) + 1
- Move video properties between 1st and 3rd row (between workflow and descriptions)
- client side Change length in seconds to number of frames (length)
- Unify gallery behavior so new generations are always added to the start and gallery resets to viewing the first item

[] (Client) Remove the close button in the upper right corner of the image preview modal, and maintain current capability to close the image preview modal by clicking outside of it.
[] (Client) Enable the select button on image preview during gallery view. When selected, immediately load in a gallery with 1 image that consist of the selected image only.
[] (Client) Create a new row in the generate form in the main page specifically for video workflow types, and move the Length and Frame rate fields into the new row. Hide this row if the currently selected workflow is not a video workflow.
[] (Client) Change the video `frames` field to use the label `Length (frames)`, and update the logic so that the value sent to the server is no longer based on frame rate, but it must be a number in the following sequence: `(n * 4) + 1`, where `n` is 0 or greater. For example, acceptable frame numbers would start with `1, 5, 9, 13, ...`. Do not restrict the number the user can input, but modify the number, rounding up to the next valid number if necessary, before it is sent to the server. Change the default length to `25`.
[] (Client) Insert a new form field, `orientation`, for video workflows, where the field is a dropdown and users can choose between the value `portrait` or `landscape`.
[] (Server) Rename all references of `preGenerationPrompts` to `preGenerationTasks`, and `postGenerationPrompts` to `postGenerationTasks`.
[] (Server) Implement a simple conditional data check:
```json
{
  "condition": {
    "where": { "generationData": "orientation" },
    "equals": { "value": "landscape" }
  },
  "value": 832,
  "to": ["64", "inputs", "width"]
}
```
where the task would only be executed if a data point (add support for `geenerationData` and `value` for now, with more sources added later) if it fulfills some specified criteria ( add support to just the `equals` condition for now ). Create a new utility function, `checkExecutionCondition(dataSources, conditionData)` that returns a boolean for whether the associated task should be executed. Implement condition checking in the following areas: pre generation tasks, comfyUI workflow modifications, and post generation tasks.

[] The data below is a report of all existing behavior related to gallery loading, or modifications after the generation data list is modified.
## Scenario 1: Image Upload via Upload Button
- **Gallery Created**: No (only refreshes if already open)
- **Index Affected**: Not affected
- **Insertion Point**: N/A - no carousel insertion occurs

## Scenario 2: Image/Video Generation Complete
- **Gallery Created**: No
- **Index Affected**: Carousel navigates to newly added item
- **Insertion Point**: End of carousel list (appended)

## Scenario 3: Gallery Load Button Click
- **Gallery Created**: No (closes after load)
- **Index Affected**: Maintains current item if exists in new data, otherwise index 0
- **Insertion Point**: N/A - carousel is replaced entirely (not insertion)

## Scenario 4: Inpaint Workflow Complete
- **Gallery Created**: No (not on inpaint page)
- **Index Affected**: Inpaint history navigates to newly added item
- **Insertion Point**: End of inpaint history array (appended)

Update all scenarios so that when an event creates a new data point in the gallery (from upload/generation/inpaint), the item is always inserted to the first position in the array. If the gallery is not open, open a new gallery with the newly added item as its sole data point. When a gallery is loaded or its content updated, always reset the shown item index back to the first item in the gallery.