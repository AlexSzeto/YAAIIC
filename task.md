# Generated Image Data Edit

## Goal
- Rename generated image
- Image tagging
- Update title to reflect current step number

[] Dynamically update the title of the page and prefix it with the progress title, including the step indicator and node name, while any task with SSE updates is in progress. Currently this includes workflows and uploads, but try to future proof this if possible. It should be in the format of ex. "(5/10) Decoding Image - YAAIC" and reverts back to the plain title "YAAIC" when a task completes or fails.

[] Create a new endpoint, `/edit`, that allows POST requests and accepts payloads in the format of an image data (from `image-data.json`). The endpoint makes an edit to the image database by looking for an entry that matches the UID and replaces the data of the object, in place, with the values sent.

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

[] Modify the generated image display so the current pencil icon is replaced with a picture icon, same as the one for selecting a gallery image in the upload image component. Each data field displayed now has a third icon button, using the pencil icon, to trigger the editing of that field. In edit mode, the inactive text container is replaced by an editable but non-resizable text area of the exact same size. The copy/use/edit buttons are replaced by confirm (checkmark icon button with green background) and cancel (x icon button with red background) buttons. Once confirmed, the entire image data with the edit is sent to the server via the `/edit` endpoint, and the data is also updated locally. After a confirm or cancel, the UI should revert back to a normal generated image display view.

[] Add an additional field below `name` in the generated image display for a new string array field, `tags`. When an image data doesn't have this parameter, default it to an empty array. When displayed, it is single string of comma separated tag strings from the array. The field also has all three action icon buttons, but the `use` button is disabled. If it is being edited, before it is sent to the server, the string from the text area should be split by commas into an array of individual tags.

[] Modify the gallery search input so that when the search textbox detects a comma, the search becomes a tag search instead. Split the text by commas, remove empty string entries, and send this to the `/image-data` endpoint under a new field in the payload, `tags`, which accepts an array of strings. Modify the client behavior so when `tags` are sent, `query` is an empty string, and when `query` is sent, `tags` is an empty array. Update the criteria of a matching search result so that it must fulfill the current criteria for a `query` match AND the image must contain every tag (string must be equal but can be in different letter cases) that is being sent in the payload.