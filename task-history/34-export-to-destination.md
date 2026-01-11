# Export to Destination

## Goals
Create a configurable list of export destinations and allow the user to export files via an action in the generated result UI.

## Tasks

[x] Create Template Pipe Processing Utility
   1. Create new module `server/template-utils.mjs`
   2. Implement `parseTemplate(template, data)` - parses `{{property|pipe1|pipe2}}` syntax and substitutes values
   3. Implement pipe functions:
      - `split-by-spaces`: splits string by spaces → array
      - `snakecase`: joins array with underscores
      - `camelcase`: joins array in camelCase
      - `kebabcase`: joins array with hyphens
      - `titlecase`: joins array in Title Case
      - `join-by-spaces`: joins array with spaces
      - `lowercase`: lowercases string or each array element
      - `uppercase`: uppercases string or each array element
   4. If final result is array, join without spaces
   5. Export for use in server modules
   ```javascript
   // template-utils.mjs public methods:
   // parseTemplate(template: string, data: object): string
   //   - Parses {{property|pipe1|pipe2}} syntax
   //   - Substitutes property values from data object
   //   - Applies pipe transformations in order
   //   - Returns final string result
   
   // private pipe handlers:
   // applyPipe(value: string|array, pipeName: string): string|array
   ```

[x] Add Export Configurations to Server Config
   1. Add `exports` array to `config.default.json` with example export destinations
   2. Structure should support both `save` and `post` export types
   3. Load exports configuration alongside existing config in `server.mjs`
   ```json
   {
     "exports": [
       {
         "id": "example-save",
         "name": "Example Save Destination",
         "exportType": "save",
         "types": ["image", "video"],
         "folderTemplate": "C:\\exports\\",
         "filenameTemplate": "{{name|split-by-spaces|snakecase|lowercase}}"
       }
     ]
   }
   ```

[x] Create Server Export Endpoints
   1. Add `GET /exports` endpoint in `server.mjs`
      - Returns filtered exports list (id, name, types only for client display)
   2. Add `POST /export` endpoint in `server.mjs`
      - Accepts `{ exportId, mediaId }` body
      - Validates exportId exists and mediaId is valid
      - Calls appropriate export handler based on exportType
   3. Create `server/export.mjs` module with export handlers:
      - `handleSaveExport(exportConfig, mediaData)` - copies file to destination folder
      - `handlePostExport(exportConfig, mediaData)` - sends data to external endpoint
   4. Refactor media storage path resolver from `/media` static route into reusable `resolveMediaPath(mediaData)` function
   ```javascript
   // export.mjs public methods:
   // handleSaveExport(exportConfig, mediaData): Promise<{success, path}>
   //   - Resolves source file path from mediaData
   //   - Parses folderTemplate and filenameTemplate
   //   - Copies file to destination
   //   - Returns result with destination path
   
   // handlePostExport(exportConfig, mediaData): Promise<{success, response}>
   //   - Runs prepareDataTasks to transform data
   //   - Handles image_0/audio_0 special cases as file blobs
   //   - Filters to sendProperties
   //   - POSTs to endpoint
   //   - Returns result with endpoint response
   
   // resolveMediaPath(mediaData): string
   //   - Returns absolute file path from imageUrl/audioUrl
   ```

[x] Refactor Folder Select Modal to Generic List Select Modal
   1. Create new `list-select.mjs` component based on `folder-select.mjs`
   2. Add props: `title`, `items`, `itemIcon`, `actionLabel`, `showActions` (edit/delete/new)
   3. Each item has: `id`, `label`, `icon` (optional), `disabled` (optional)
   4. Callback: `onSelectItem(item)`, `onClose()`
   5. Keep `folder-select.mjs` as a wrapper around `list-select.mjs` with folder-specific logic
   ```javascript
   // list-select.mjs public methods:
   // showListSelect(options): cleanup function
   //   - options.title: string - modal title
   //   - options.items: array - list items with id, label, icon
   //   - options.itemIcon: string - default boxicon name for items
   //   - options.actionLabel: string - optional action button label
   //   - options.showActions: boolean - show edit/delete buttons
   //   - options.onSelectItem: function - callback when item selected
   //   - options.onAction: function - callback for action button
   //   - options.onClose: function - callback when modal closed
   ```

[x] Add Export Action to Generated Result UI
   1. Locate the generated result UI component (likely in main app or gallery)
   2. Add "Export" button to action bar
   3. On click: fetch `/exports` filtered by current media type
   4. Show list select modal with export destinations
   5. On selection: call `POST /export` with exportId and mediaId
   6. Show toast notification with success/error result

[x] Implement conditional tasks. Use the same conditional logic as the workflow replacement object. Refactor the definition "generationData" to just "data". Update documentation.
