# ComfyUI SSE Debug

## Goals
Fix the remaining discovered issues while implmementing live progress update for the image generator client.

[x] Fix progress banner component reuse bug preventing subsequent SSE subscriptions
1. Store the unmount function returned by `createProgressBanner()` in a variable (e.g., `currentProgressBanner`)
2. Before creating a new progress banner, check if `currentProgressBanner` exists
3. If it exists, call `currentProgressBanner.unmount()` to properly clean up the previous component
4. This ensures `componentWillUnmount()` is called on the old ProgressBanner, which unsubscribes from the old taskId
5. Then create the new progress banner and store its unmount function
6. In the `onComplete` callback passed to `createProgressBanner()`, call `currentProgressBanner.unmount()` after handling the completion data
7. Set `currentProgressBanner` to null after unmounting to indicate no active banner
**Root cause**: When reusing the same container element, Preact doesn't automatically call `componentWillUnmount()` on the old component when replacing it. The old component's SSE subscription remains active, preventing new subscriptions from being created properly. The fix ensures proper cleanup by explicitly unmounting both when creating a new banner and when a task completes.

[x] Integrate SSE library into inpaint page
1. Import SSEManager and ProgressBanner in `public/js/inpaint.mjs`
2. Modify inpaint generation handler to parse taskId from server response
3. Create and mount ProgressBanner component with taskId for inpaint operations
4. Pass onComplete callback to handle inpaint result
5. Ensure progress tracking works for both regular and inpaint workflows
