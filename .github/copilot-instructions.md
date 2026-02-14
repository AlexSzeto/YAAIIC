# Task Planning Rules of Thumb
1. The task file should start with a title for the new feature in the format `# Feature Title`.
2. The goal of the feature should be described in a concise manner under the `## Goal` section, clearly summarizing the desired outcome of the feature without including implementation details.
3. All tasks should be placed under the `## Tasks` section, with each task preceded by a checkbox (i.e. `[] Task description`). Each task should focus on a single goal or outcome, and if there are multiple goals, they should be broken into separate tasks.
4. Any code snippets, class definitions, data formats, or other implementation details should be included in the Implementation Details section of the task file. The Implementation Details section should be used to provide any necessary context or information for completing the task, but should not include any specific instructions or steps for how to complete the task.

# Implementation Rules of Thumb
1. Always use `preact` + `htm/preact` when dynamic components are created in JavaScript.
2. A Preact component should follow these standards:
	- Use `Component` from `preact` for class-based components.
	- Use `styled` from `goober-setup.mjs` for component styling.
	- Use `this.state` for state management.
	- Use `componentDidMount()` and `componentWillUnmount()` for lifecycle methods.
	- Use regular class methods/properties instead of hooks.
	- For theme-aware components, initialize `theme` from `currentTheme.value`, subscribe in `componentDidMount()`, and unsubscribe in `componentWillUnmount()`.
3. Styled element naming convention:
	- Assign component-prefixed kebab-case class names to styled elements.
	- Format: `<component>-<part>` (example: `button-root`, `button-text`, `input-label`).
	- Avoid generic class names like `container`, `label`, `wrapper` unless they are component-prefixed.
4. Theme token usage:
	- Prefer theme tokens for colors, typography, spacing, border, and transitions.
	- Avoid hardcoded visual values when an equivalent token exists in `theme.mjs`.
	- If no suitable token exists, add one to the theme system before introducing repeated hardcoded values.
5. Component API consistency:
	- Destructure props with defaults in `render()`.
	- Forward DOM-compatible props with `...rest` where appropriate.
	- Document public props and usage with concise JSDoc (include at least one example when non-trivial).
6. Variants and states:
	- Prefer object-based maps/helpers for variant sizing and color states over scattered conditionals.
	- Ensure disabled/loading states are reflected in both visuals and interaction behavior.
7. Accessibility and semantics:
	- Use semantic HTML elements (`button`, `input`, `label`, etc.).
	- Wire `id`/`for` (or equivalent) and `name` attributes where relevant.
	- Preserve keyboard and disabled behavior of native controls.
8. Shared code placement:
	- Reusable utility functions should go in `public/js/custom-ui/util.mjs` when broadly applicable.
	- Reusable UI components should be placed in `public/js/custom-ui/` (into one of the focused subfolder like `io/`, `layout/`, `media/`, etc.).
9. Code hygiene:
	- Remove unused imports, props, and variables.
	- Keep component files focused; extract reusable logic when it meaningfully improves clarity.
