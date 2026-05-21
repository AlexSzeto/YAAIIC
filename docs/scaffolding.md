# Project Scaffolding

The scaffolding tool generates a clean starter project from the YAAIIC template, providing the same architecture, component library, and tooling out of the box.

## Usage

```bash
node scripts/scaffold.mjs <outputFolder> [projectName]
```

- **`outputFolder`** (required): Path where the new project will be created.
- **`projectName`** (optional): Human-readable project name. If omitted, the tool derives it from the folder name and prompts to confirm.

### Example

```bash
node scripts/scaffold.mjs F:\MyNewProject "My Cool App"
```

This creates a project at `F:\MyNewProject` with the name "My Cool App" and package name `my-cool-app`.

## What Gets Scaffolded

The scaffold copies and generates the following structure:

```
<outputFolder>/
├── .agents/                     # AI agent configurations
├── .claude/                     # Claude rules and skills
├── .github/                     # GitHub Actions workflows
├── .gitignore
├── scripts/                     # Build tools (download-libs, scaffold, lib.config.json)
│   └── scaffold-template/       # Template files used by scaffold.mjs
├── public/
│   ├── index.html               # Entry point (with project name)
│   ├── fonts/                   # Downloaded Google Fonts
│   ├── js/
│   │   ├── app.mjs              # Starter app component
│   │   ├── util.mjs             # Utility functions
│   │   ├── custom-ui/           # Full reusable component library
│   │   └── app-ui/              # (empty, for project-specific components)
│   ├── css/
│   ├── lib/                     # Downloaded JS libraries
│   └── media/                   # (empty, for static assets)
├── server/
│   ├── server.mjs               # Minimal Express server
│   ├── config.default.json      # Default configuration
│   ├── core/
│   │   ├── paths.mjs            # Centralized path constants
│   │   ├── config.mjs           # Config loader
│   │   └── index.mjs            # Barrel exports
│   ├── features/                # (empty, for domain modules)
│   └── database/                # (empty, for JSON data files)
├── project-management/
│   ├── planned/                 # (empty) Freeform ideas not yet fully specified
│   ├── groomed/                 # (empty) Fully specified features ready to implement
│   ├── in-progress/             # (empty) Features currently being implemented
│   ├── archived/                # (empty) Completed features preserved as history
│   └── abandoned/               # (empty) Shelved features
└── package.json                 # With project name and scripts
```

## Template Placeholders

Files in `scripts/scaffold-template/` support two placeholders:

| Placeholder | Replaced With | Example |
|-------------|--------------|---------|
| `{{PROJECT_NAME}}` | Title-cased project name | `"My Cool App"` |
| `{{PACKAGE_NAME}}` | Kebab-cased package name | `"my-cool-app"` |

These are applied to:
- `package.json` → sets the `name` field
- `public/index.html` → sets the `<title>` and heading

## Contents by Category

### Copied Directories

These are copied recursively from YAAIIC:

| Source | Purpose |
|--------|---------|
| `.agents/` | AI assistant configurations |
| `.claude/` | Claude rules and skill definitions |
| `.github/` | CI/CD workflows |
| `scripts/` | Build and library tools (excluding `migrate/`) |
| `public/js/custom-ui/` | Full reusable component library |
| `public/fonts/` | Downloaded font files |

Also copies `.gitignore` from the project root.

### Template Files

These come from `scripts/scaffold-template/` with placeholder substitution where noted:

| Template | Purpose |
|----------|---------|
| `package.json` | Project manifest with name and scripts *(placeholders applied)* |
| `public/index.html` | HTML entry point with importmap and script tags *(placeholders applied)* |
| `public/js/app.mjs` | Minimal "Hello World" Preact app |
| `public/js/util.mjs` | Starter utilities |
| `server/server.mjs` | Minimal Express server with static file serving |
| `server/config.default.json` | Default config (`{ "serverPort": 3000 }`) |
| `server/core/paths.mjs` | Centralized path constants |
| `server/core/config.mjs` | Config loader with auto-copy from defaults |
| `server/core/index.mjs` | Barrel exports |

### Empty Directories

Created to establish the project structure:

| Directory | Purpose |
|-----------|---------|
| `project-management/planned/` | Freeform ideas, not yet fully specified |
| `project-management/groomed/` | Fully specified features, ready to implement |
| `project-management/in-progress/` | Features currently being implemented |
| `project-management/archived/` | Completed features preserved as development record |
| `project-management/abandoned/` | Shelved features |
| `server/features/` | Domain-driven feature modules |
| `server/database/` | JSON data files |
| `public/js/app-ui/` | Project-specific UI components |
| `public/media/` | Static media assets |

## Starter Server

The scaffolded server is a minimal Express setup:

```javascript
import express from 'express';
import { loadConfig, getConfig } from './core/index.mjs';
import { PUBLIC_DIR } from './core/paths.mjs';

await loadConfig();
const config = getConfig();
const app = express();

app.use(express.static(PUBLIC_DIR));
app.use(express.json());

app.listen(config.serverPort, () => {
  console.log(`Server running on port ${config.serverPort}`);
});
```

From this starting point, add feature domains in `server/features/`, each with their own `router.mjs`, `service.mjs`, and optional `repository.mjs`.

## Post-Scaffold Steps

1. `cd <outputFolder>`
2. `npm install`
3. `node scripts/download-libs.mjs` — downloads JS libraries and fonts into `public/lib/` and `public/fonts/`
4. `npm start` — starts the server on port 3000
5. Add new features by creating domain folders in `server/features/` and `public/js/app-ui/`
6. Use `npm run pull` / `npm run push` to sync the custom-ui library with other projects in the same family
