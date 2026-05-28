---
description: when working on the client facing (i.e. /public) side of the website
---

## Frontend Architecture
- **File Naming Conventions**: All source files should be lowercase with dashes (e.g., `workflow-editor.mjs`, `node-input-selector.mjs`).
- **Framework & Libraries**: Always use `preact` + `htm/preact` for dynamic components.
- **Theme Usage**: All pages must utilize the `Page` component and initiate theming via `currentTheme.subscribe` to ensure consistent theming across the app.
- **Component Strategy**:
    - **Functional Components (Preferred)**: Use functional components with hooks (`useState`, `useEffect`, `useCallback`) for most UI elements. This aligns with modern Preact patterns seen in `App.mjs`.
    - **Class Components (Allowed)**: Use `Component` from `preact` for complex stateful logic or when lifecycle methods (`componentDidMount`, `componentWillUnmount`) offer cleaner abstraction than hooks (e.g., `ProgressBanner.mjs`).
    - **Reusable Components First**: Always prioritize existing reusable components from `public/js/custom-ui/` before creating new ones. This includes basic layouts (`HorizontalLayout`, `VerticalLayout`) and standard UI elements. Only create new components when no suitable reusable alternative exists.
    - **New Component Criteria**: When considering a new UI component, evaluate whether it would be reused elsewhere in this project or in similar projects. If yes, implement it as a reusable custom UI component in `public/js/custom-ui/`. If it's project-specific and unlikely to be reused, create it in `public/js/app-ui/` instead.
    - **Custom UI Component Documentation**: Every new custom UI component added to `public/js/custom-ui/` must include usage examples in `public/js/custom-ui/test.html` to demonstrate its API and typical use cases.
- **File Structure**:
    - **Reusable Components**: Place generic, reusable UI components in `public/js/custom-ui/` (e.g., `io/`, `layout/`, `msg/`).
    - **App-Specific Logic**: Place application-specific components and logic in `public/js/app-ui/`.
    - **Utility Functions**: Generic utilities go in `public/js/custom-ui/util.mjs`.
- **Navigation Registration**: Every new page must be registered in `public/js/app-ui/hamburger-menu.mjs` as part of the same task that creates it. Do not ship a page without a navigation entry.

## Component Implementation Standards
- **State Management**:
    - Use `useState` or `useReducer` for local component state.
    - For global state or complex logic shared across components (like theme or SSE), use the subscription pattern (e.g., `currentTheme.subscribe`).
- **Styling Integration**:
    - Always use `styled` from `goober-setup.mjs` (which configures `goober` with `h` from Preact) unless a specific feature cannot support it and there are no reasonable workarounds.	
    - Do **not** import `styled` directly from `goober`.
- **DOM Refs and Goober Styled Components**:
    - Attaching a `ref` to a `styled()` component (e.g., `<${StyledDiv} ref=${myRef}>`) yields the **Preact component instance**, not the underlying DOM node. Calling DOM methods like `getBoundingClientRect()`, `focus()`, or `select()` on such a ref will throw a runtime error. 
    - **Avoid `createRef` and direct DOM measurement wherever possible** — prefer event-driven alternatives (e.g., `e.currentTarget.getBoundingClientRect()` in event handlers, native `<input>` elements that expose DOM APIs natively). 
    - When a ref to a raw DOM node is absolutely necessary (e.g., for canvas or scroll APIs), attach the ref to a **plain HTML element** (`<div>`, `<canvas>`, `<input>`) rather than a styled wrapper, even if that means adding a minimal unstyled element whose sole purpose is to be the ref target.
- **Props & API**:
    - Destructure props with default values in the function signature (functional) or `render()` method (class).
    - Forward DOM-compatible props using `...rest`.
    - Document public props with JSDoc, including examples for non-trivial usage.

## Styling & Theming
- **Naming Conventions**:
    - All source files should be lowercase with dashes (e.g., `workflow-editor.mjs`, `node-input-selector.mjs`).
    - Use PascalCase for styled components (e.g., `StyledButton`).
    - Always attach a readable class name for debugging: `StyledButton.className = 'styled-button';`.
- **Theme Usage**:
    - Import `currentTheme` from `custom-ui/theme.mjs`.
    - **Never hardcode generic values**. Use theme tokens for:
        - Colors (`theme.colors.primary.background`, `theme.colors.text.secondary`)
        - Spacing (`theme.spacing.medium.padding`)
        - Borders (`theme.border.radius`, `theme.border.width`)
        - Typography (`theme.typography.fontSize`)
    - If a token is missing, add it to `theme.mjs` rather than hardcoding.
- **CSS-in-JS**:
    - Keep styles local to the component file whenever possible.
    - Avoid generic class names like `.container` or `.wrapper` in global CSS; scope them within the styled component.

## Multi-Tab / Queue SSE Patterns

### Per-tab client identity
- `public/js/app-ui/client-id.mjs` exports `getClientId()`, which returns a stable UUID stored in `sessionStorage` (isolated per tab, survives page refresh within the same tab).
- Every queue-submission fetch must include `clientId: getClientId()` in its request body (or `formData.append('clientId', getClientId())` for FormData requests). This lets the server associate each queue item with the submitting tab.

### Ownership-gated task SSE subscriptions
- The `queue:task-started` SSE event carries a `clientId` field.
- Every `queue:task-started` handler that opens a task SSE connection (directly or via `progressShow`) must check `if (clientId !== getClientId()) return;` before subscribing. This prevents idle tabs from opening task SSE connections for tasks they didn't submit.
- Idle tabs may still consume `queue:task-started` for UI display purposes (queue dashboard), but must not call `sseManager.subscribe()` or `progressShow()` for tasks they don't own.

### Queue SSE reconnect recovery
- `QueueSSEManager` exposes `onConnect(fn)` which fires every time the SSE connection (re)opens. Use it to re-fetch `/queue/status` so the client recovers its view of the queue after a dropped connection.
- `use-queue-status.mjs` already wires this up — new callers of `useQueueStatus()` get recovery for free.
- Any component or hook that subscribes directly to `queueSSEManager` and caches queue state should also call `onConnect` and refresh from the REST endpoint.

### SSEManager event coalescing
- `SSEManager` (in `public/js/app-ui/sse-manager.mjs`) batches events via `setTimeout(0)` before dispatching. This prevents replayed completed tasks from firing multiple `onComplete` calls.
- Pruning rule in `_flushEvents`: if a terminal event (`complete`/`error`/`cancelled`) is present in the batch, discard all `progress` events and dispatch only the terminal. If no terminal: discard all `progress` except the last, dispatch that one.
- `ProgressBanner` fast-complete bypass: if `handleComplete` fires before any `progress` event was received (`hadProgressRef.current === false`), skip the banner display and call `onComplete`/`onDismiss` immediately — the task was already done when the subscription opened.

## Testing
- **Custom UI components**: Every new component added to `public/js/custom-ui/` must have a render entry added to `public/js/custom-ui/test.vitest.mjs`. The entry should render the component with minimal props and assert no `console.error` calls.
- **Passing definition**: At phase boundaries, "passing" means `npx vitest run` (full suite) exits 0 — not just `--changed`. All tests, including pre-existing ones, must be green before a phase is considered complete.