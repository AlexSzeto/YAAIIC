# Global Undo

**Priority:** low

## Goal

Allow users to undo the most recent data change on any page with editing features using a keyboard shortcut (e.g. Ctrl+Z). A single step back should be sufficient — this is not a full multi-level undo stack.

## Notes

- Should work across pages that have editing features (e.g. workflow editor, anytale editor, media editing).
- Keyboard shortcut should follow platform conventions (Ctrl+Z on Windows/Linux, Cmd+Z on Mac).
- Open question: should undo be scoped per-page or truly global across pages?
- Open question: what counts as a "data change" vs. a transient UI state change?
