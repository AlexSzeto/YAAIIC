# Implement Set Inpaint Area Functionality

[] Implement inpaint area tracking and mouse interaction functionality within `inpaint-canvas.mjs`:
1. Add `inpaintArea` state property to track the rectangular inpaint area (initially `null`).
2. Add `isDrawing` state property to track whether the user is currently selecting an area.
3. Implement left mouse button down handler to start area selection by setting the first point of `inpaintArea`.
4. Implement mouse move handler to continuously update the second point of `inpaintArea` while `isDrawing` is true.
5. Implement mouse up handler to stop the area selection process by setting `isDrawing` to false.
6. Implement right click handler to reset `inpaintArea` to `null` and clear any active selection.
7. Ensure left clicking with an existing `inpaintArea` restarts the selection process.
8. Add canvas coordinate conversion utilities to handle mouse position relative to canvas dimensions.

[] Implement visual feedback for the inpaint area selection:
1. Create a `redrawCanvas` method that first draws the original image onto the canvas.
2. When `inpaintArea` is active, overlay black at 50% opacity everywhere except within the inpaint area rectangle.
3. Call `redrawCanvas` continuously during area selection (on mouse move) and after area completion.
4. Use canvas composite operations or manual pixel manipulation to create the overlay effect.
5. Ensure the inpaint area remains fully visible (no overlay) while the rest of the image is darkened.

[] Add proper event handling and state management:
1. Update component state management to include `inpaintArea` and `isDrawing` properties.
2. Add proper event listener cleanup in `componentWillUnmount` for right-click events.
3. Prevent default context menu behavior on right-click within the canvas.
4. Ensure mouse coordinates are correctly calculated relative to the canvas element's position and scaling.
5. Handle edge cases where mouse events occur outside the canvas boundaries during area selection.

[] Enhance user experience and visual indicators:
1. Change cursor style to crosshair when hovering over the canvas to indicate area selection mode.
2. Ensure real-time visual updates during selection process by calling `redrawCanvas` on every mouse move event while `isDrawing` is true.
3. Consider adding keyboard shortcuts or additional UI indicators for the inpaint functionality status.
4. Update the inpaint info section to display current inpaint area coordinates when an area is selected.
