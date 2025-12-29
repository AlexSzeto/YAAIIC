# Prompt Regeneration and Tabbed Long Descriptions Displays

## Goals
Create one more type of textual content for the generated images (summary, which is an objective inventory of objects in the picture, versus the more verbose, subjective, imaginative description). improve the UI by putting all paragraph length displays inside a tagged UI, powered by a new, tag selection UI

## Tasks
[x] Create a new custom-ui component, tags.mjs, that displays a row of tags as clickable mini buttons.

> The tags component takes two sets of properties: items, an array of objects with a name and id property, both strings, to describe the selectagle tag buttons. The second property, selected, is a list of ids describing the currently selected items. For the buttons: its height should be the same as the smaller icon buttons, scaling down font size to fit, and its width should be variable depending on the label length. It should be blue (primary color) when selected and gray (default color) when deselected. Augment the existing custom button component with this button variation. The component should not be keeping state of which items are currently selected, but would emit an event whenever a tag (one of the buttons) is clicked and the implementation surrounding the tags would decide how the tags update. Create a test page, tag-test.html, to test the appearance of this component, with two sample implemetation where one would only allow one tag selected at a time and the other allow the tags to be toggled.

1. Create [public/js/custom-ui/tags.mjs](public/js/custom-ui/tags.mjs) with the Tags component
   - Component interface:
     ```javascript
     // Tags({ items, selected, onSelect, ...props })
     // items: Array<{ id: string, name: string }> - The selectable tag buttons
     // selected: Array<string> - Array of currently selected item ids
     // onSelect: (id: string) => void - Callback when a tag is clicked
     ```
   - Use preact `Component` class
   - Render a row of clickable buttons for each item in `items`
   - Each button should have variable width based on label length
   - Height should match small icon buttons (info-btn)
   - Selected state: blue background (primary color from CSS variables)
   - Deselected state: gray background (default color)
   - Component is stateless - selection state managed by parent
   - Fire `onSelect(id)` callback when tag clicked
   
2. Augment [public/js/custom-ui/button.mjs](public/js/custom-ui/button.mjs) to support tag button variant
   - Add new variant `primary-small-text` and `small-text` to Button component
   - Tag button style: small height, variable width, no icon, centered text
   - Use ``primary-small-text` variant to apply primary color
   - Use appropriate CSS classes for styling

3. Create test page [public/tag-test.html](public/tag-test.html) to validate Tags component
   - Set up basic HTML structure with preact/htm imports
   - Include two sample implementations:
     a) Single selection mode - only one tag selected at a time
     b) Toggle mode - multiple tags can be selected/deselected
   - Display sample tag sets with various label lengths
   - Test visual appearance and click behavior

[x] Move the tags, prompt, and description generated info into a tabbed UI, powered by the new tabs component.

> Collapse the tags/prompt/description UI within the generated result UI into a single info display that can be switched via tabs. Place the tabs (using the tags component) in the same row to the left of the action icon buttons. Default the tab shown to "prompt". When a tab is chosen, display the correct info and update the associated action buttons to reflect what is or isn't available. When the content is updated to a new set of generated data, update the info text (but not the currently selected tab). This new UI will require a new internal component, TabbedInfoField, to help manage its internal states.

1. Create new internal component `TabbedInfoField` in [public/js/app-ui/generated-result.mjs](public/js/app-ui/generated-result.mjs)
   - Component interface:
     ```javascript
     // TabbedInfoField class component with state management
     // Props: {
     //   tabs: Array<{ id: string, name: string, value: string, isTextarea: boolean, 
     //           canEdit: boolean, onUse: Function, useTitle: string }>,
     //   onCopy: (label, value) => void,
     //   onEditStart: (field) => void,
     //   onSave: (field, value) => void,
     //   onCancel: () => void,
     //   editingField: string | null,
     //   image: Object
     // }
     // State: { selectedTab: string }
     // Methods:
     //   - componentDidMount() - Set default tab to "prompt"
     //   - handleTabSelect(id) - Update selected tab
     //   - render() - Render tabs row and active tab content
     ```
   - Use Tags component to display tab buttons
   - Display active tab content (textarea)
   - Show appropriate action buttons (copy, use, edit/save/cancel) for active tab
   - Default to "prompt" tab on mount
   - Preserve selected tab when image data updates
   
2. Refactor [public/js/app-ui/generated-result.mjs](public/js/app-ui/generated-result.mjs) GeneratedResult component
   - Replace separate Tags, Prompt, and Description InfoField instances with single TabbedInfoField
   - Configure tabs array with entries for: tags, prompt, description
   - Position tabs in same row, to the left of existing action icon buttons
   - Remove individual InfoField components for tags/prompt/description
   - Keep Workflow, Name, and Seed as separate InfoField components
   - Update action button container to be on same row as tabs

3. Update CSS in [public/css/custom-ui.css](public/css/custom-ui.css)
   - Add styles for tag buttons (`.btn-tag` class)
   - Add styles for tabs container (flex row layout)
   - Add styles for tabbed info display area
   - Ensure proper spacing between tabs and action buttons
   - Style selected/deselected tag button states

[x] Add the new summary field as one of the info tabs.

1. Add summary field to image data structure
   - Update image data schema to include `summary` field
   - Summary should store objective description of image contents

2. Add summary tab to TabbedInfoField in [public/js/app-ui/generated-result.mjs](public/js/app-ui/generated-result.mjs)
   - Add summary to tabs array configuration
   - Configure as textarea with edit capability
   - Add copy and use handlers for summary
   - Position summary tab in tab list (order: tags, prompt, description, summary)

3. Copy new summary postGenerationTasks for `tag` and `summary` from [server/config.json] to [server/config.default.json](server/config.default.json)

4. Update database schema in [server/services.mjs](server/services.mjs)
   - Add `summary` field to image data entries
   - Update addImageDataEntry function to handle summary field
   - Update file save/load logic to include summary

[] Add a new action, regenerate text, for all of the tab managed paragraph fields. This is disabled for generated videos.

> On the server side, create a new endpoint, /regenerate, that takes in the uid of the generated image as well as an array of fields (description, summary, name, tags) that needs to be regenerated. to find the task required to regenerate a tag, look up the list of postGenerationTasks from config and use the one that where the field corresponds to the "to" property of the task. refactor the function for resolving pre/post generation tasks into llm.mjs (as a more generic modifyDataWithPrompt function) so it can be accessed outside of generate.mjs. Use the task and sse system to communicate progress. On the client side, expose the action as an additional icon button (to the left of all other existing action buttons) with the refresh icon.

1. Refactor modifyGenerationDataWithPrompt from [server/generate.mjs](server/generate.mjs) to [server/llm.mjs](server/llm.mjs)
   - Move `modifyGenerationDataWithPrompt` function to llm.mjs
   - Rename to more generic `modifyDataWithPrompt(promptData, dataObject)`
   - Function interface:
     ```javascript
     // export async function modifyDataWithPrompt(promptData, dataObject)
     // promptData: {
     //   model: string,
     //   template?: string,
     //   prompt?: string,
     //   to: string,
     //   replaceBlankFieldOnly?: boolean,
     //   imagePath?: string
     // }
     // dataObject: Object with fields to be modified
     // Returns: modified dataObject
     ```
   - Make function more generic to work with any data object, not just generationData
   - Update imports in generate.mjs to use the refactored function
   
2. Create new `/regenerate` endpoint in [server/server.mjs](server/server.mjs)
   - Endpoint: POST /regenerate
   - Request body:
     ```json
     {
       "uid": "string",
       "fields": ["description", "summary", "name", "tags"]
     }
     ```
   - Look up image data from database using uid
   - For each field, find matching postGenerationTask from config where `task.to === field`
   - Call `modifyDataWithPrompt` for each field regeneration task
   - Use SSE system to emit progress updates (reuse task/progress system)
   - Update image data in database with regenerated fields
   - Return updated image data

3. Add regenerate functionality to client side in [public/js/app-ui/generated-result.mjs](public/js/app-ui/generated-result.mjs)
   - Add `onRegenerate` prop to GeneratedResult component
   - Add refresh icon button to TabbedInfoField component
   - Position refresh button to the left of all other action buttons
   - Button disabled for video files
   - Button disabled if no matching postGenerationTask exists for active tab field
   - On click, call onRegenerate with field name of active tab
   
4. Implement regenerate handler in [public/js/app.mjs](public/js/app.mjs) or appropriate parent component
   - Create async function to POST to /regenerate endpoint
   - Pass uid and field name in request
   - Listen for SSE progress updates
   - Update UI with regenerated data when complete
   - Handle errors and display appropriate messages