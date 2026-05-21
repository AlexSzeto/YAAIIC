---
name: create-feature
description: Captures a freeform feature idea into an individual file in project-management/planned/. Checks for conflicts with existing planned and groomed features before writing. USE FOR: capturing a new idea quickly; breaking down a brainstorm document into individual feature files; preserving an idea that surfaced during grooming of another feature.
---

# Create Feature

You are capturing a feature idea into `project-management/planned/`. This is a low-ceremony step — the goal is to get the idea recorded, not to fully specify it. Full grooming happens later via `groom-feature`.

## Steps

1. **Collect the idea.** If the user has not already described the feature, ask for a one-sentence description of what they want to build.

2. **Check for conflicts.** Read the titles and goals of all files in `project-management/planned/` and `project-management/groomed/`. If any existing file covers the same or overlapping ground:
   - Present the conflicting file(s) by name and goal.
   - Ask the user: merge into the existing file, or create a new one anyway?
   - If merging: append the new idea to the existing file under a clearly labelled section, then stop.

3. **Write the file.** If creating a new file:
   - Derive a kebab-case slug from the feature name (e.g. `outfit-preview-images`).
   - Write to `project-management/planned/<slug>.md` with this structure:

```markdown
# <Feature Title>

## Goal

<One to three sentences describing the desired outcome. No implementation details.>

## Notes

<Any rough ideas, constraints, or open questions the user mentioned. Leave blank if none.>
```

4. **Confirm.** Tell the user the file was created and suggest running `/groom-feature <slug>.md` when they are ready to develop a full spec.

## Rules

- Do **not** write tasks, implementation details, or technical specs into a `planned/` file — that is the job of `groom-feature`.
- Do **not** create a planned file for an idea that should go straight to grooming. If the user has a well-formed spec already in hand, tell them to use `groom-feature` directly.
- Do **not** modify any code.
