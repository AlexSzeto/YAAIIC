# Scaffold Script

## Goal
Create `scripts/scaffold.mjs` — a Node.js script that generates a clean, project-agnostic copy of this project's skeleton into a target folder. After running the script and doing `npm i` in the destination, the new project should immediately start with a functional Express server, a blank themed Preact/htm index page, and all custom-ui components available.

## Tasks

- [x] Refactor `.agents/rules/client.md` to remove the YAAIIC-specific hamburger-menu navigation registration requirement (line 20), keeping all generic architecture/styling rules intact.
- [x] Refactor `.agents/rules/server.md` to remove the specific feature domain bullet points (`media/`, `generation/`, `upload/`) from the Directory Structure section, replacing them with a generic description of the feature domain pattern. Keep all design pattern rules (Service Layer, Repository, DI, Path Handling, Data Management, Code Hygiene).
- [x] Create `.agents/rules/project.md` — a new rule file with YAAIIC-specific content extracted from the above files, including: the specific feature domains (`media`, `generation`, `upload`, `brew`, `sound-sources`, `export`, `workflows`, `llm`), the hamburger-menu navigation registration requirement, and any other project-specific conventions. Use the same frontmatter format as other rule files (`trigger: model_decision`).
- [x] Create the `scripts/scaffold-template/` directory with the following template files mirroring their destination paths:
  - `package.json` — current deps kept exactly, `"name": "{{PACKAGE_NAME}}"`, `"version": "1.0.0"`, `"description": ""`
  - `server/server.mjs` — minimal: imports `express`, `loadConfig` from `./core/config.mjs`, `PUBLIC_DIR` from `./core/paths.mjs`; serves `public/` as static; starts on `config.serverPort || 3000`
  - `server/config.default.json` — `{ "serverPort": 3000 }`
  - `public/index.html` — same importmap and lib `<script>` tags as current `index.html`, title = `{{PROJECT_NAME}}`, no favicon/css/font links
  - `public/js/app.mjs` — minimal Preact/htm stub: imports `h`, `render` from `preact`, `html` from `htm/preact`, `Page`, `currentTheme` from `custom-ui/themed-base.mjs`; renders a `<Page>` with a centered "Hello World" heading
  - `public/js/util.mjs` — verbatim copy of current `public/js/util.mjs`
- [x] Write `scripts/scaffold.mjs` with:
  - CLI: `node scripts/scaffold.mjs <outputFolder> [projectName]`
  - If `projectName` is omitted, derive a default by converting the folder basename from `dash-case` to `Title Case` and prompt the user via `readline` to confirm or override
  - A `DIR_COPIES` const for dynamic recursive directory copies (each entry: `{ src, dest, exclude? }`)
  - A `TEMPLATE_FILES` const for template file copies from `scripts/scaffold-template/` (each entry: `{ src, dest, replacements? }`)
  - A `EMPTY_DIRS` const listing folders to create with a `.gitkeep` placeholder
  - Script flow: create output dir → copy dirs from `DIR_COPIES` → copy `.gitignore` → copy+replace placeholders from `TEMPLATE_FILES` → create empty dirs from `EMPTY_DIRS` → print success summary with next steps

## Implementation Details

### `DIR_COPIES` const (in `scaffold.mjs`)
```js
const DIR_COPIES = [
  { src: '.agents',             dest: '.agents' },
  { src: '.github',             dest: '.github' },
  { src: 'scripts',             dest: 'scripts', exclude: ['migrate'] },
  { src: 'public/js/custom-ui', dest: 'public/js/custom-ui' },
  { src: 'public/fonts',        dest: 'public/fonts' },
  { src: 'server/core',         dest: 'server/core' },
];
```

### `TEMPLATE_FILES` const (in `scaffold.mjs`)
```js
const TEMPLATE_FILES = [
  { src: 'package.json',               dest: 'package.json',               replacements: true },
  { src: 'server/server.mjs',          dest: 'server/server.mjs' },
  { src: 'server/config.default.json', dest: 'server/config.default.json' },
  { src: 'public/index.html',          dest: 'public/index.html',          replacements: true },
  { src: 'public/js/app.mjs',          dest: 'public/js/app.mjs' },
  { src: 'public/js/util.mjs',         dest: 'public/js/util.mjs' },
];
```
Placeholders: `{{PROJECT_NAME}}` → human-readable title (e.g. "My Cool App"), `{{PACKAGE_NAME}}` → kebab-case npm name (e.g. "my-cool-app").

### `EMPTY_DIRS` const (in `scaffold.mjs`)
```js
const EMPTY_DIRS = [
  'docs/feature-history',
  'docs/groomed-features',
  'server/features',
  'server/database',
  'public/js/app-ui',
  'public/media',
];
```
Each directory is created and populated with a `.gitkeep` file.

### Individual file copies
- `.gitignore` — copied directly from project root to output root.

### Project name derivation
- Basename of `outputFolder` (e.g. `my-new-project`) → split on `-` → Title Case each word → join with spaces (e.g. `My New Project`).
- `PACKAGE_NAME` is the kebab-case basename of `outputFolder` (already in that format if user followed convention).

### `scripts/scaffold-template/` structure
```
scripts/scaffold-template/
  package.json
  server/
    server.mjs
    config.default.json
  public/
    index.html
    js/
      app.mjs
      util.mjs
```
