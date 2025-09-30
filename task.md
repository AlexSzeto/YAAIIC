# Inpaint server side upload support
[] Convert the `inpaintArea` inside `inpaint-canvas.mjs` into a preact-signal.
[] Implement the click action for the inpaint button:
1. Prepare the mask image data in the following manner: create a canvas with the same dimension as the original image, then clear the canvas with black (rgb 0, 0, 0), then draw a filled rectangle of the `inpaintArea` in white (rgb 255, 255, 255).
2. Send the following data: `workflow`, `name`, `seed`, `prompt` (see `index.html` and `main.mjs` for references if necessary), as well as the following additional data: `image` as an encoded file containing the data from the image loaded from `imageUrl`, and `mask` from the previous step, to a new endpoint, `/generate/inpaint`, on the server.
[] Create a new endpoint, `/generate/inpaint`, with temporary test processing:
1. console log `workflow`, `name`, `seed`, and `prompt`.
2. save the data from `image` into `/storage` with the filename `image` and the extension of the original image.
3. save the data from `mask` into `/storage` with the filename `mask.png`.
