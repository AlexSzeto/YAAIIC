# Implement freezeframe.js to improve gallery preview

## Goal
Reduce the amount of active animation in gallery view by importing the javascript version of the freezeframe.js library (https://github.com/ctrl-freaks/freezeframe.js)

[x] Setup and import freezeframe.js into index.html
1. Add freezeframe via CDN in `index.html` inside `<head>` after other script tags
   ```html
   <script src="https://unpkg.com/freezeframe/dist/freezeframe.min.js"></script>
   ```

2. Test basic freezeframe import by adding initialization to `main.mjs`
   - Add `new Freezeframe();` at the end of the initialization code
   - Verify the library loads without errors in browser console
   - This will allow testing the library behavior before committing to implementation

[] Use freezeframe.js to set all animations in the gallery view to animate on hover. Image preview and generated view should still autoplay animated images, retaining its current behavior.
3. Update `js/gallery-preview.mjs` to add freezeframe class to animated images
   - Add helper method `isAnimatedImage(url)` to check if URL ends with `.gif` or `.webp`
   - In `render()` method, conditionally add `freezeframe` class to img element when `isAnimatedImage(item.imageUrl)` returns true
   - Only apply to gallery items, not to modals or generated image display
   - Add method `applyFreezeframe()` that initializes/re-initializes freezeframe after render
   - Store freezeframe instance reference for cleanup

4. Initialize and manage freezeframe lifecycle in gallery
   - In `applyFreezeframe()` method: destroy previous instance if exists, then create new instance with `new Freezeframe('.gallery-container .freezeframe', { trigger: 'hover', overlay: false, responsive: false });`
   - Call `applyFreezeframe()` after rendering gallery items (in `render()` method after DOM updates)
   - This approach handles dynamically loaded images since freezeframe doesn't auto-detect new DOM elements
   
5. Test gallery animation behavior
   - Gallery view: animated images (gif/webp) should be frozen until hover
   - Image modal (when clicking gallery item): should autoplay (no freezeframe class)
   - Generated image display: should autoplay (no freezeframe class)
   - Gallery pagination: animations should freeze correctly when switching pages
