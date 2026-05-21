# Image Inputs

## Goals
Prepare the main interface for image to image generation as well as image to video generation by adding image upload related features to main UI.

[x] (Server) Modify the image upload parameter to of the workflow data to include an image index so multiple images can be uploaded:
- Add an `inputImages` number parameter to the workflow data to specify the number of images to upload.
- Update `server/resource/comfyui-workflows.json` to include `inputImages` for workflows that require it.
```json
// Example workflow update
{
  "name": "Image to Image Workflow",
  "type": "img2img",
  "inputImages": 1 // Number of expected input images
}
```

[x] (Client) In the main UI, between the description text input and the generate button, add a section for uploading images that only appears when the selected workflow expects image inputs.
- Add a container element in `public/index.html` for the image upload section.
```html
<!-- In public/index.html -->
<div id="image-upload-container" class="form-group full-width" style="display: none;">
  <label>Input Images:</label>
  <div id="image-upload-slots" class="image-upload-slots"></div>
</div>
```
- Update `public/js/main.mjs` to show/hide this container based on `selectedWorkflow.inputImages`.

[x] (Client) Create a reusable image upload component.Use a blank square with a plus icon to represent the image upload area. When an image is selected, Replace the blank square with the selected image.
- Create `public/js/custom-ui/image-upload.mjs` defining the `ImageUpload` component.
```javascript
import { Component } from 'preact';
import { html } from 'htm/preact';

export class ImageUpload extends Component {
  constructor(props) {
    // props: 
    // - id: string/number (unique identifier)
    // - onImageChange: (file) => void
    // - onGalleryRequest: () => void
    super(props);
    this.state = {
      imagePreview: null,
      hasImage: false
    };
  }

  // Public method to set image externally (e.g. from gallery)
  setImage(blob, url) { 
    // Update state with new image
  }

  // Handle file input change
  handleFileSelect(e) { 
    // Read file and update state
  }

  render() {
    // Return html for upload square or image preview
  }
}
```

[x] (Client) Connect the image upload component to the main UI by displaying image upload components for each image input expected by the selected workflow. Whenever the workflow changes, wipe the image upload components and display new ones if needed.
- Update `public/js/main.mjs` to instantiate `ImageUpload` components.
```javascript
// In handleWorkflowChange
if (selectedWorkflow.inputImages > 0) {
  // Render N ImageUpload components
  // Store references to retrieve data later
}
```

[x] (Server) Add `inputImages` to the list of parameters returned by the workflow list endpoint so the client is aware of the number of image uploads associated with the workflow, then modify the client to use the data point to modify the number of upload slots displayed.

[x] (Client) Modify the image preview modal function to accept a new parameter, onSelect, that, when present, modifies the modal to add a select button that calls `onSelect` when clicked.
- Update `createImageModal` in `public/js/custom-ui/modal.mjs`.
```javascript
export function createImageModal(url, autoScale = true, title = null, onSelect = null) {
  // ... existing code
  if (onSelect) {
    // Create 'Select' button
    // On click: onSelect(url); closeModal();
  }
}
```

[x] (Client) Modify the gallery interface and create a mode for image selection:
- remove the multi-select checkboxes and the load button.
- Modify `public/js/custom-ui/gallery.mjs` to accept a `selectionMode` prop.
```javascript
// GalleryDisplay component
render() {
  const isSelectionMode = this.props.selectionMode;
  // If selection mode:
  // - Hide bulk delete button
  // - Hide Load button
  // - Hide checkboxes in items (via previewFactory argument or context)
}
```

[x] (Client) Complete the gallery selection mode by using the select button of the image preview modal to select an image from the gallery. This updates the selected data to an array of one single selected image.
- Update `GalleryDisplay` to handle item clicks in selection mode.
```javascript
// In GalleryDisplay
handleItemClick(item) {
  if (this.props.selectionMode) {
    // Open modal with onSelect callback
    createImageModal(item.imageUrl, true, item.name, () => {
      this.props.onSelect(item);
      this.hideModal();
    });
  }
}
```

[x] (Client) Connect the image upload components to the image selection mode of the gallery.
- Update `public/js/main.mjs` to pass a `onGalleryRequest` handler to `ImageUpload`.
```javascript
const handleGalleryRequest = (uploadComponentIndex) => {
  galleryDisplay.setSelectionMode(true, (selectedImage) => {
    // Get the specific upload component and set its image
    uploadComponents[uploadComponentIndex].current.setImage(selectedImage);
  });
  galleryDisplay.showModal();
};
```

[x] (Client) Reuse or duplicate the image upload code from the inpaint UI to add uploaded images to the image generation requests.
- Update `handleGenerate` in `public/js/main.mjs`.
```javascript
// Convert images to blobs and append to FormData
const formData = new FormData();
// ... other fields
for (const [index, component] of uploadComponents.entries()) {
  if (component.hasImage()) {
    formData.append(`image_${index}`, component.getImageBlob());
  }
}
// Use fetchWithRetry to POST FormData
```

[x] (Server) Modify the text to image generation process to process uploaded images, if it doesn't do so already
