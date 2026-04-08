---
name: new-branch
description: "Returns to main and creates a new feature branch. USE FOR: starting a new feature or task; switching from a completed branch back to main before branching; creating a branch named from a description. Prompts the user for a branch name if none is given."
argument-hint: "Optional: description or name for the new branch (e.g. 'fix login bug')"
---

# New Branch

Return to `main` and check out a new feature branch, deriving the branch name from a description supplied as a skill argument or by prompting the user.

## Procedure

### 1. Check for Uncommitted Changes

Run `git status --short` to detect uncommitted changes.

- If there are uncommitted changes, **stop** and tell the user:
  > "There are uncommitted changes in your working directory. Please commit or stash them before switching branches."
- Otherwise continue.

### 2. Determine Branch Name

- If the user supplied a description as a skill argument, convert it to a valid branch name:
  - Lowercase all characters
  - Replace spaces and special characters with hyphens
  - Strip leading/trailing hyphens
  - Collapse multiple consecutive hyphens into one
  - Example: `"Fix login bug"` → `fix-login-bug`
- If no argument was provided, ask the user:
  > "What should the new branch be called? (provide a short description or a kebab-case name)"
  Then apply the same conversion rules to their response.

### 3. Switch to Main

Run:
```
git checkout main
git pull origin main
```

- If either command fails, report the error and stop.

### 4. Create and Check Out the New Branch

Run:
```
git checkout -b <branch-name>
```

- If the branch already exists, tell the user:
  > "A branch named `<branch-name>` already exists. Please choose a different name."
  Then return to step 2 and prompt again.

### 5. Confirm

Tell the user:
> "Switched to new branch `<branch-name>`."

Also optionally clear or note that `task.md` may need updating if this is a new feature.

## Completion Check

- No uncommitted changes were present (or user was stopped with a clear message)
- `main` was pulled to the latest remote state
- New branch was created and is the active branch
- User received confirmation of the new branch name
