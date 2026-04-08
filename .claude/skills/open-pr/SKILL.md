---
name: open-pr
description: "Opens a GitHub pull request from the current branch to main. USE FOR: creating a PR after finishing feature work; merging a branch to main via pull request; submitting work for review. Stops with an error if already on main. Auto-fills PR title and description from branch name and recent commits."
argument-hint: "Optional: extra context or overrides for the PR title/description"
---

# Open Pull Request

Create a GitHub pull request merging the current branch into `main`, using the branch name and commit history to auto-generate a meaningful title and description.

## Procedure

### 1. Check Current Branch

Run `git branch --show-current` (or `git rev-parse --abbrev-ref HEAD`) to get the active branch name.

- If the branch is `main` (or `master`): **stop immediately** and tell the user:
  > "You are currently on the `main` branch. A pull request cannot be created from `main` to `main`. Please check out a feature branch first."
- Otherwise continue.

### 2. Gather Context

Run these commands in parallel to collect signal for the PR title and description:

- `git log main..HEAD --oneline` — list of commits on this branch not yet in main
- `git log main..HEAD --format="%s%n%b" | head -80` — commit subjects + bodies for richer context
- Check `task.md` (if it exists) for a feature title and goal summary

### 3. Compose Title and Description

**Title**: Derive from the branch name (convert `kebab-case` or `snake_case` to Title Case, strip ticket prefixes like `feature/` or `bugfix/`). If the commit list clearly points to a single purpose, sharpen the title from the commit messages.

**Description** (Markdown body):
- Write a single paragraph summarising what changed and why, inferred from the commit messages and task.md if available
- Only incorporate commits that describe specific, concrete changes (e.g. feature names, bug descriptions, component names). **Omit** generic commit messages such as "archive", "fix", "update", "cleanup", "misc", "wip", "pass", or any message that conveys no specific detail
- If task.md contains a `## Goal` section, use it as the opening sentence or to frame the paragraph
- Keep it concise — 3–6 sentences maximum

If the user supplied extra context as skill arguments, incorporate it in both the title and description.

### 4. Get the Remote URL

Run `git remote get-url origin` and extract `<owner>/<repo>` (strip the `.git` suffix and any `https://github.com/` prefix).

### 5. Link the PR

Construct the GitHub compare URL in this format:
```
https://github.com/<owner>/<repo>/compare/main...<branch>?expand=1&title=<encoded-title>&body=<encoded-body>
```
Get `<owner>/<repo>` from `git remote get-url origin` (strip `.git` suffix, extract the path segment).

Present it as a clickable Markdown link:
> "Pull request ready: [Create PR on GitHub](<url>)"

## Completion Check

- PR was created without errors
- Title accurately reflects the branch purpose
- Description references the key changes
- User received the direct link to open the PR on GitHub
