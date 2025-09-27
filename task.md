# Create Inpaint Modal

[] On the client side, separate workflows by type and only supply `txt2img` workflows into the current index page.
[] On the server side, create a new endpoint, `/image-data/uid`, that accepts a single query param (`uid`) and only returns one object in the `imageData` that matches `uid`.
[] On the client side, create a new page, `inpaint.html` that is a copy of `index.html`, then make the following changes:
1. Remove the gallery button and any gallery related UI layout in the HTML.
2. Rename the text in the `Generate` button to `Inpaint`.
3. Remove the generated image display UI.
4. Create a new inpaint UI preact component, `InpaintComponent`, stored in `js/inpaint-canvas.mjs`, with a canvas element with the id `inpaint` that automatically resize to the image loaded within it, via the `imageUrl` property.
5. Place the inpaint UI beneath the inpaint form.
6. Use `js/inpaint.mjs` to host the scripts used for `inpaint.html`. On page load, parse the query param `uid` and use `/image-data/uid` to load the `name` and send the `imageUrl` to the `InpaintComponent`.