# Prompt Regeneration and Tabbed Long Descriptions Displays

## Goals
Create one more type of textual content for the generated images (summary, which is an objective inventory of objects in the picture, versus the more verbose, subjective, imaginative description). improve the UI by putting all paragraph length displays inside a tagged UI, powered by a new, tag selection UI

## Tasks
[] Create a new custom-ui component, tags.mjs, that displays a row of tags as clickable mini buttons.

> The tags component takes two sets of properties: items, an array of objects with a name and id property, both strings, to describe the selectagle tag buttons. The second property, selected, is a list of ids describing the currently selected items. For the buttons: its height should be the same as the smaller icon buttons, scaling down font size to fit, and its width should be variable depending on the label length. It should be blue (primary color) when selected and gray (default color) when deselected. Augment the existing custom button component with this button variation. The component should not be keeping state of which items are currently selected, but would emit an event whenever a tag (one of the buttons) is clicked and the implementation surrounding the tags would decide how the tags update. Create a test page, tag-test.html, to test the appearance of this component, with two sample implemetation where one would only allow one tag selected at a time and the other allow the tags to be toggled.

[] Move the tags, prompt, and description generated info into a tabbed UI, powered by the new tabs component.

> Collapse the tags/prompt/description UI within the generated result UI into a single info display that can be switched via tabs. Place the tabs (using the tags component) in the same row to the left of the action icon buttons. Default the tab shown to "prompt". When a tab is chosen, display the correct info and update the associated action buttons to reflect what is or isn't available. When the content is updated to a new set of generated data, update the info text (but not the currently selected tab). This new UI will require a new internal component, TabbedInfoField, to help manage its internal states.

[] Add the new summary field as one of the info tabs.

[] Add a new action, regenerate text, for all of the tab managed paragraph fields. This is disabled for generated videos.

> On the server side, create a new endpoint, /regenerate, that takes in the uid of the generated image as well as an array of fields (description, summary, name, tags) that needs to be regenerated. to find the task required to regenerate a tag, look up the list of postGenerationTasks from config and use the one that where the field corresponds to the "to" property of the task. refactor the function for resolving pre/post generation tasks into llm.mjs (as a more generic modifyDataWithPrompt function) so it can be accessed outside of generate.mjs. Use the task and sse system to communicate progress. On the client side, expose the action as an additional icon button (to the left of all other existing action buttons) with the refresh icon.