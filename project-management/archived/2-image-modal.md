# Create Image Modal
[x] Create a new utility file, `public/js/custom-modal.js`, and create a new exported function, `createImageModal(url, autoScale=true)`, that creates a modal showing the image referenced by `url`, with the following sizing properties:
1. When `autoScale` is `true`, size up the image to cover as much of the window as possible up to the image's original dimensions, while maintaining the image's original aspect ratio.
2. When `autoScale` is `false`, always show the image in its original pixel dimension. If the image size exceeds the current view area, add overflow scroll bars to allow the user to scroll the image.
[x] In `main.js`, add a click event to the gallery preview to open the preview image using `createImageModal`. Allow the default value for `autoScale` to flow through.
[x] In `generated-image-display.js`, add a click event to the generated image display to open the image using `createImageModal`. Set `autoScale` to `false`.

[x] Fix the same issue with a different approach. Place the modal close button outside of the image modal container so that it is not being cropped by it.