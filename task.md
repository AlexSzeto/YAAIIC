# Modal Refactor Feature
# Refactor `custom-modal.js` for more general use
[] export a new class, `CustomModal`, using preact/htm, in `js/custom-ui/modal.js`, with variables to manage the wrapper, container, and the close button UI elements of a modal.
1. Refactor out the code used to create a blank modal from `createImageModal` into this custom class. The class should provide public access to the container so elements can be added into the container.
2. Implement a method, `closeModal()`, for closing the modal. connect the listener for existing ways to close the modal to this method.
3. Implement a method, `setModalLock(lock)`, that disable all existing ways to close the modal (close button, clicking the overlay, pressing ESC) when `lock` is set to `true`, and re-enables all of these ways when `lock` is set to `false`.
4. Update the constructor to accept `lock` as a property and use `setModalLock()` to update the modal's lock state after the rest of the UI are initialized.
[] rewrite `createImageModal` to create an instance of `CustomModal`, then place the image element inside the blank modal.
[] export a new function, `createDialogModal(text, title)`, inside `js/custom-ui/modal.js` to create an instance of `CustomModal`, refactoring the function `showDialog()` from `custom-dialog.js`. If there are style inconsistencies, use the styles that are defined either in `CustomModal` or the UI of other existing function within `custom-modal.js`.
[] delete `custom-dialog.js` once all of its functionalities are ported over.
[] refactor `gallery.js` to use preact/htm. Take advantage of `CustomModal` to create the outer container for the gallery component.

