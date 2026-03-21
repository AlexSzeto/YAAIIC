---
trigger: model_decision
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