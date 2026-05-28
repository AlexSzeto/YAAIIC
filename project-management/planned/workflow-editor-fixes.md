# Workflow Editor Fixes

**Priority:** high

## Goal

Fix several bugs in the workflow editor: allow files to be rearranged via drag and drop, fix auto-generated parameters that incorrectly use a comma instead of a period as the decimal separator, and fix formula replacement inputs that reject the minus (`-`) and period (`.`) characters.

## Notes

- Drag and drop rearrangement applies to files in the workflow editor file list.
- Decimal separator bug: auto-generated parameters produce values like `1,5` instead of `1.5`.
- Formula replacement inputs: typing `-` or `.` is blocked or stripped, preventing entry of negative numbers and decimals.
