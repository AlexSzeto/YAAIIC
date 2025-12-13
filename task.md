# Generated Image Data Edit

## Goal
- Rename generated image
- Image tagging
- Update title to reflect current step number

[x] Dynamically update the title of the page and prefix it with the progress title, including the step indicator and node name, while any task with SSE updates is in progress. Currently this includes workflows and uploads, but try to future proof this if possible. It should be in the format of ex. "(5/10) Decoding Image - YAAIIG" and reverts back to the plain title "YAAIIG" when a task completes or fails.
1. Create a `PageTitleManager` utility in `js/util.mjs` with methods to update and reset page title:
```javascript
/**
 * PageTitleManager - Manages dynamic page title updates
 */
class PageTitleManager {
  constructor(defaultTitle = 'YAAIIG') {
    this.defaultTitle = defaultTitle;
    this.currentTitle = defaultTitle;
  }
  
  /**
   * Update page title with custom text
   * @param {string} title - The title text to display
   */
  update(title) { }
  
  /**
   * Reset page title to default
   */
  reset() { }
  
  /**
   * Get the current title
   * @returns {string}
   */
  getTitle() { }
}
```
2. Modify `sse-manager.mjs` to accept optional `onProgress` callbacks that include step and total information
3. Update all SSE subscriptions in `main.mjs` and `inpaint.mjs` to format progress data as a string (e.g., `"(5/10) Decoding Image - YAAIIG"`) and pass it to `PageTitleManager.update()`
4. Add cleanup calls to `PageTitleManager.reset()` in SSE `onComplete` and `onError` callbacks
5. Ensure that the title updates work for both workflow generation and upload tasks

[] Create a new endpoint, `/edit`, that allows POST requests and accepts payloads in the format of an image data (from `image-data.json`). The endpoint makes an edit to the image database by looking for an entry that matches the UID and replaces the data of the object, in place, with the values sent.
1. Add a new `/edit` POST endpoint in `server/server.mjs` that accepts JSON payloads
2. Validate that the incoming payload contains a `uid` field
3. Search through `imageData.imageData` array to find the entry with matching `uid`
4. If found, replace the entire object in place with the new data from the payload
5. If not found, return a 404 error with message indicating UID not found
6. After successful update, call `saveImageData()` to persist changes
7. Return success response with updated image data
8. Update the documentation with details about this new endpoint

Sample data:
```json
    {
      "prompt": "grass",
      "seed": "1500405940",
      "imageUrl": "/image/image_79.jpg",
      "name": "Small Town (Fixed)",
      "description": "The image portrays a quaint European village, bathed in soft light that accentuates the rustic charm of the stone cottages with their pointed roofs and chimneys. The architecture suggests an older time period, hinting at historical significance. People are engaged in various activities within this picturesque setting, contributing to the lively atmosphere. The verdant surroundings and distant mountains create a serene backdrop that adds depth to the scene.",
      "workflow": "Inpaint (Realistic Vision Fantasy)",
      "inpaint": true,
      "inpaintArea": {
        "x1": 86,
        "y1": 748,
        "x2": 0,
        "y2": 768
      },
      "timestamp": "2025-10-03T02:48:57.749Z",
      "uid": 1759459737749
    }
```

Request/Response format:
```javascript
// POST /edit
// Request body: Complete image data object with uid
{
  uid: number,
  name: string,
  description: string,
  tags: string[], // optional
  // ... other image data fields
}

// Response on success (200):
{
  success: true,
  data: { /* updated image data */ }
}

// Response on error (404):
{
  error: "Image with uid X not found"
}

// Response on validation error (400):
{
  error: "Missing required field: uid"
}
```

[] Modify the generated image display so the current pencil icon is replaced with a picture icon, same as the one for selecting a gallery image in the upload image component. Each data field displayed now has a third icon button, using the pencil icon, to trigger the editing of that field. In edit mode, the inactive text container is replaced by an editable but non-resizable text area of the exact same size. The copy/use/edit buttons are replaced by confirm (checkmark icon button with green background) and cancel (x icon button with red background) buttons. Once confirmed, the entire image data with the edit is sent to the server via the `/edit` endpoint, and the data is also updated locally. After a confirm or cancel, the UI should revert back to a normal generated image display view.
1. Update the HTML template in `public/index.html` and `public/inpaint.html` to add edit buttons for each field
2. Change the pencil icon button (currently used for inpaint) to a picture/image icon (🖼️)
3. Add a new edit button with pencil icon (✏️) for each editable field: `name`, `tags`, `description`, `seed`, `workflow`
4. Modify `GeneratedImageDisplay` class in `generated-image-display.mjs` to track edit state:
```javascript
// Add to GeneratedImageDisplay class:
constructor() {
  // ... existing code ...
  this.editState = {
    isEditing: false,
    fieldBeingEdited: null, // 'name', 'tags', 'description', 'seed', or 'workflow'
    originalValue: null
  };
}

/**
 * Enter edit mode for a specific field
 * @param {string} fieldName - The name of the field to edit
 * @private
 */
_enterEditMode(fieldName) { }

/**
 * Exit edit mode and restore original view
 * @private
 */
_exitEditMode() { }

/**
 * Confirm the edit and save to server
 * @private
 */
async _confirmEdit() { }

/**
 * Cancel the edit and restore original value
 * @private
 */
_cancelEdit() { }

/**
 * Replace text display with editable textarea
 * @param {HTMLElement} element - The element to make editable
 * @param {string} fieldName - The field name
 * @private
 */
_makeFieldEditable(element, fieldName) { }

/**
 * Restore textarea to static text display
 * @param {HTMLElement} element - The element to restore
 * @param {string} value - The value to display
 * @private
 */
_restoreFieldDisplay(element, value) { }
```
5. When entering edit mode, store the original value, replace the text container with a textarea (non-resizable with `resize: none` CSS)
6. Replace copy/use/edit buttons with confirm (✓ with green background) and cancel (✗ with red background) buttons
7. On confirm, gather all current field values from `this.currentImageData`, apply the edited field value, and send POST request to `/edit` endpoint
8. On success, update `this.currentImageData` locally and call `_exitEditMode()`
9. On cancel, restore original value and call `_exitEditMode()`
10. Handle errors from the `/edit` endpoint by showing error toast and keeping edit mode active

[] Add an additional field below `name` in the generated image display for a new string array field, `tags`. When an image data doesn't have this parameter, default it to an empty array. When displayed, it is single string of comma separated tag strings from the array. The field also has all three action icon buttons, but the `use` button is disabled. If it is being edited, before it is sent to the server, the string from the text area should be split by commas into an array of individual tags.
1. Update HTML template in `public/index.html` and `public/inpaint.html` to add a new `tags` field row below the `name` field
2. Add HTML structure for tags display with label "Tags:" and container elements similar to other fields
3. Add copy, use (disabled), and edit buttons for the tags field
4. Modify `GeneratedImageDisplay.display()` method to handle the `tags` field:
```javascript
// In display() method:
// Default tags to empty array if not present
const tags = imageData.tags || [];
// Convert array to comma-separated string for display
const tagsString = tags.join(', ');
// Display in the tags element
this.tagsElement.textContent = tagsString;
```
5. Modify the copy button handler for tags to copy the comma-separated string to clipboard
6. Ensure the use button for tags is disabled (add `disabled` attribute and appropriate CSS styling)
7. In `_confirmEdit()` method, add special handling for tags field:
```javascript
// When confirming edit of tags field:
if (this.editState.fieldBeingEdited === 'tags') {
  // Get the edited string from textarea
  const tagsString = this.tagsElement.value || this.tagsElement.textContent;
  // Split by comma, trim whitespace, and filter out empty strings
  const tagsArray = tagsString
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
  // Update currentImageData with array
  this.currentImageData.tags = tagsArray;
}
```
8. Update the `display()` method to include tags when populating `this.currentImageData`
9. Ensure tags field styling matches other fields in `css/style.css` or `css/custom-ui.css`

[] Modify the gallery search input so that when the search textbox detects a comma, the search becomes a tag search instead. Split the text by commas, remove empty string entries, and send this to the `/image-data` endpoint under a new field in the payload, `tags`, which accepts an array of strings. Modify the client behavior so when `tags` are sent, `query` is an empty string, and when `query` is sent, `tags` is an empty array. Update the criteria of a matching search result so that it must fulfill the current criteria for a `query` match AND the image must contain every tag (string must be equal but can be in different letter cases) that is being sent in the payload.
1. Modify the gallery search handler in `main.mjs` and `inpaint.mjs` to detect commas in the search input
2. Add logic to determine search mode:
```javascript
// In search handler function:
const searchText = searchInput.value.trim();
let searchPayload = {
  page: 1,
  limit: currentLimit,
  query: '',
  tags: []
};

if (searchText.includes(',')) {
  // Tag search mode
  const tags = searchText
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
  searchPayload.tags = tags;
  searchPayload.query = '';
} else {
  // Normal query search mode
  searchPayload.query = searchText;
  searchPayload.tags = [];
}
```
3. Update the `/image-data` endpoint request to include the `tags` field in the payload
4. Modify the `/image-data` endpoint handler in `server/server.mjs` to accept and process `tags` parameter:
```javascript
// In /image-data endpoint:
const { page = 1, limit = 10, query = '', tags = [] } = req.body;
```
5. Update the filtering logic in the `/image-data` endpoint to implement tag matching:
```javascript
// Filter logic:
let filtered = imageData.imageData.filter(item => {
  // Existing query match logic
  const queryMatch = !query || 
    (item.name && item.name.toLowerCase().includes(query.toLowerCase())) ||
    (item.description && item.description.toLowerCase().includes(query.toLowerCase())) ||
    (item.prompt && item.prompt.toLowerCase().includes(query.toLowerCase())) ||
    (item.workflow && item.workflow.toLowerCase().includes(query.toLowerCase()));
  
  // Tag match logic - image must contain ALL tags (case insensitive)
  const tagMatch = tags.length === 0 || (
    item.tags && 
    tags.every(searchTag => 
      item.tags.some(itemTag => 
        itemTag.toLowerCase() === searchTag.toLowerCase()
      )
    )
  );
  
  // Both conditions must be true
  return queryMatch && tagMatch;
});
```
6. Ensure default value for `tags` field is empty array when not provided in image data
7. Test that tag search works with multiple tags (all tags must match)
8. Test that tag matching is case-insensitive

[] Add visual indicator in the UI to show when tag search mode is active
1. Modify the search input section in `gallery.mjs` render method to conditionally display different icons based on search mode
2. Check if `searchQuery` contains a comma to determine if tag search is active
3. When tag search is active, replace the search icon (`bx-search`) with a tag icon (`bx-purchase-tag`)
4. Optionally update the placeholder text to indicate tag search mode (e.g., "Tag search (comma-separated)")
5. Implementation in `gallery.mjs`:
```javascript
// In the render method, modify the gallery-search section:
html`
  <div class="gallery-search">
    <input
      type="text"
      placeholder=${this.state.searchQuery.includes(',') 
        ? 'Tag search (comma-separated)' 
        : 'Search images...'}
      value=${this.state.searchQuery}
      onInput=${this.handleSearchInput}
      ref=${(input) => { 
        if (input && this.state.shouldFocusSearch) {
          input.focus();
          this.setState({ shouldFocusSearch: false });
        }
      }}
    />
    <box-icon
      name=${this.state.searchQuery.includes(',') ? 'purchase-tag' : 'search'}
      color="#999999"
      class="gallery-search-icon"
    ></box-icon>
  </div>
`
```