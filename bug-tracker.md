# Bug Tracker: NotFoundError (insertBefore)

## Issue Description
**Error**: `Uncaught (in promise) NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.`

**Trigger**: 
- Changing Workflow (specifically when `setWorkflow` is called)
- Clicking "Gallery" button
- Clicking "Delete" button (opens Modal)

## Findings Log