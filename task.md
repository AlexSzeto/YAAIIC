# Bug Fixes
[] The formatting of `generated-image-display` and the elements inside it are completely broken. Investigate if there are existing css styles incorrectly named that would apply to this component. It might be necessary to look at the recently deleted `generated-image-container` to determine why the css isn't applying.

[] Any attempt to open image modals through the generated image display or gallery preview fails. The console reports `Image modal created with CustomModal:` but nothing appears on screen. Investigate and fix this issue.

[] Using the close button in the gallery creates a call stack exceeded error, likely due to an infinite recursion:
```
gallery.js:99 Uncaught RangeError: Maximum call stack size exceeded
    at Object.closeModal [as onClose] (gallery.js:99:14)
    at Object.closeModal [as onClose] (gallery.js:100:12)
    at Object.closeModal [as onClose] (gallery.js:100:12)
    at Object.closeModal [as onClose] (gallery.js:100:12)
    at Object.closeModal [as onClose] (gallery.js:100:12)
    at Object.closeModal [as onClose] (gallery.js:100:12)
    at Object.closeModal [as onClose] (gallery.js:100:12)
    at Object.closeModal [as onClose] (gallery.js:100:12)
    at Object.closeModal [as onClose] (gallery.js:100:12)
    at Object.closeModal [as onClose] (gallery.js:100:12)
```
Investigate and fix this bug.

[] Remove the border from `gallery-content` since its container modal has a border already.

[] Gallery previews with portrait oriented images are pushing the name and timestamp below the visible frame. Fix the behavior of the preview so the image maintains its current aspect ratio while the textual info remains visible.

[] After an autocomplete phrase is accepted (by pressing tab or enter), clicking either `generate` or `gallery` would result in the previous autocompleted word not updating correctly in the prompt textfield. For example, if I type `mag` and autocomplete the phrase `magical girl`, press enter, then immediately click the `gallery` button, the most recently autocompleted phrase reverts back to `mag`. This might be due to interaction between preact and autocomplete.js and might require an internet search for an appropriate solution.