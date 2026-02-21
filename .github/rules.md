# Task Planning Rules

A well-structured task file ensures that development goals are clear, measurable, and free of ambiguity. It serves as the primary contract between the user and the assistant, ensuring that implementation details align with the user's expectations.

- **Title**: The task file should start with a title for the new feature in the format `# Feature Title`.
- **Goal**: The goal of the feature should be described in a concise manner under the `## Goal` section, clearly summarizing the desired outcome of the feature without including implementation details.
- **Tasks Checklist**: All tasks should be placed under the `## Tasks` section, with each task preceded by a checkbox (i.e. `[] Task description`). Each task should focus on a single goal or outcome, and if there are multiple goals, they should be broken into separate tasks.
- **Implementation Details**: Any code snippets, class definitions, data formats, or other implementation details should be included in the `## Implementation Details` section of the task file. This section provides necessary context but should not dictate step-by-step instructions unless critical restrictions apply.

# Implementation Rules

Consistency in implementation is key to maintainability. The codebase follows strict patterns for frontend component architecture, styling, and data management. Deviations should only occur with explicit user approval.

## 1. Frontend Architecture
- **File Naming Conventions**: All source files should be lowercase with dashes (e.g., `workflow-editor.mjs`, `node-input-selector.mjs`).
- **Framework & Libraries**: Always use `preact` + `htm/preact` for dynamic components. React (via JSX) is not used.
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

## 2. Component Implementation Standards
- **State Management**:
    - Use `useState` or `useReducer` for local component state.
    - For global state or complex logic shared across components (like theme or SSE), use the subscription pattern (e.g., `currentTheme.subscribe`).
- **Styling Integration**:
    - Always use `styled` from `goober-setup.mjs` (which configures `goober` with `h` from Preact) unless a specific feature cannot support it and there are no reasonable workarounds.	
    - Do **not** import `styled` directly from `goober`.
- **Props & API**:
    - Destructure props with default values in the function signature (functional) or `render()` method (class).
    - Forward DOM-compatible props using `...rest`.
    - Document public props with JSDoc, including examples for non-trivial usage.

## 3. Styling & Theming
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

## 4. Backend Architecture (Domain-Driven)

The backend is organized into **Feature Domains** to avoid monolithic files. Each domain is a self-contained folder in `server/features/` managing its own routes, business logic, and data access.

### Directory Structure
- **`server/server.mjs`**: Entry point. initializes Express, loads config, and mounts domain routers.
- **`server/core/`**: Shared foundational code (Config, Logger, EventBus/SSE, Database Driver).
- **`server/features/`**:
    - **`media/`**:
        - `router.mjs`: Endpoints for `/media-data`, `/tags`.
        - `repository.mjs`: access to `media-data.json`.
        - `service.mjs`: Domain logic (filtering, editing).
    - **`generation/`**:
        - `router.mjs`: Endpoints for `/generate`.
        - `orchestrator.mjs`: Manages the generation lifecycle (pre-tasks -> comfy -> post-tasks).
        - `comfy-service.mjs`: Wraps ComfyUI API and WebSocket interactions.
        - `processors/`: Individual task handlers (e.g., `extract-text.mjs`, `crossfade.mjs`).
    - **`upload/`**:
        - `router.mjs`: Endpoints for `/upload/*`.
        - `service.mjs`: File processing and storage logic.

### Design Patterns
- **Service Layer**: Routes should **never** contain business logic. They should extract parameters and call a Service.
- **Repository Pattern**: Data access is isolated. `server.mjs` should not touch `globalData` directly; usage of a specific `MediaRepository` is required.
- **Strategy Pattern for Generation Tasks**: `generate.mjs` currently uses a giant switch/map. This must be refactored into individual processor modules loaded dynamically or registered explicitly.
- **Dependency Injection**: Services should accept their dependencies (like config or other services) in their constructor or factory function, rather than importing global singletons, to facilitate testing and modularity.

### Path Handling
- Always use `path.join()` for file paths.
- Use `process.cwd()` or a dedicated `AppPaths` constant from `server/core/paths.mjs` to resolve project roots, rather than `__dirname` hacks in every file.

## 5. Data Management
- **Persistence**:
    - Primary data storage is **JSON files** in `server/database/`.
    - **Do not use a SQL database** unless explicitly requested.
    - `media-data.json` stores metadata for generated content.
- **Configuration**:
    - System configuration lives in `config.json`.
    - Defaults are in `config.default.json`.
    - The server should handle missing `config.json` by copying the default on startup.

## 6. Code Hygiene
- **Cleanliness**: Remove unused imports, variables, and console logs before finalizing a task.
- **Modularity**:
    - Extract repeated logic into helper functions.
    - Keep files focused (Single Responsibility Principle).
- **Comments**:
    - Explain *why*, not just *what*.
    - Use `// TODO:` comments to mark areas for future improvement, but try to resolve them if they are within scope.
