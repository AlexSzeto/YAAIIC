# Queue Banner Lifecycle Fix

**Priority:** high

## Goal

Fix the queue banner disappearing after the first running task completes. Queued items continue to process correctly, but the banner is dismissed prematurely, leaving no visible indication that the queue is still active and removing the user's ability to monitor or manage it mid-run.

## Notes

- Regression introduced during the recent SSE revamp.
- Banner should remain visible (and manageable) until the entire queue is empty, not just until the first task finishes.
