# YAAIIC — Yet Another AI Image Creator

**YAAIIC** (pronounced *yiiiikes*) is a self-hosted creative studio that wraps [ComfyUI](https://github.com/comfyanonymous/ComfyUI) and [Ollama](https://ollama.com/) behind a streamlined web interface. Generate images, videos, and audio from text prompts — then organize everything in a built-in gallery with AI-powered descriptions, tagging, and folder management.

## Highlights

- **Multi-modal generation** — images, videos, and audio through a unified interface
- **Plug any ComfyUI workflow** — upload a workflow JSON and let auto-detection wire up inputs and outputs
- **AI-powered metadata** — Ollama automatically names, describes, summarizes, and tags your creations
- **Inpainting** — draw masks directly in the browser and regenerate selected regions
- **Gallery with search** — browse, filter by tags/folders, bulk-edit, and export your history
- **Ambient Brew Editor** — assemble multi-channel ambient soundscapes from generated audio
- **Workflow Editor** — configure, reorder, test, and manage ComfyUI workflows without touching JSON
- **Smart VRAM management** — automatically unloads models when switching between workflows to run on consumer GPUs
- **Real-time progress** — SSE-based live progress bars with step-by-step status from ComfyUI
- **Danbooru tag autocomplete** — right-click any prompt field to search and insert tags with category-aware filtering
- **Export anywhere** — download files or push media to external APIs with configurable templates
- **Dark & light themes** — fully themed UI with cookie-persisted preference
- **No build step** — native ES modules + importmaps. Edit and refresh.
- **Portable component library** — the custom-ui design system syncs across projects

## Screenshots

*Coming soon*

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) running locally (default: `http://localhost:8188`)
- [Ollama](https://ollama.com/) running locally (default: `http://localhost:11434`)

### Installation

```bash
git clone <repo-url> yaaiic
cd yaaiic
npm install
```

### Configuration

On first run the server copies `server/config.default.json` to `server/config.json`. Edit `server/config.json` to match your environment:

```json
{
  "serverPort": 3000,
  "ollamaAPIPath": "http://localhost:11434",
  "ollamaLaunchPath": "path/to/start_ollama.bat",
  "comfyuiAPIPath": "http://localhost:8188",
  "comfyuiLaunchPath": "path/to/start_comfyui.bat",
  "exports": [...]
}
```

| Setting | Description |
|---------|-------------|
| `serverPort` | Port for the YAAIIC server (default: 3000) |
| `ollamaAPIPath` | Ollama API base URL |
| `ollamaLaunchPath` | Script/command to auto-start Ollama if not running |
| `ollamaUseCPU` | Force CPU-only inference for Ollama |
| `comfyuiAPIPath` | ComfyUI API base URL |
| `comfyuiLaunchPath` | Script/command to auto-start ComfyUI if not running |
| `exports` | Array of export destinations (see [Server API](docs/server.md#export-configuration)) |

### Running

```bash
npm start
```

Open `http://localhost:3000`. If ComfyUI or Ollama aren't ready yet, you'll see a loading page that polls until both services respond.

---

## Features

### Media Generation

YAAIIC can drive virtually any ComfyUI workflow — images, videos, audio, or anything else the ComfyUI ecosystem supports. Upload a workflow JSON to the Workflow Editor and the server auto-detects inputs (prompts, seeds, images, audio files) and outputs (save paths), generating a ready-to-use configuration. From there, every workflow appears in a unified generation form where you enter a prompt, tweak parameters, and hit Generate.

A real-time progress bar tracks each ComfyUI step, and once generation completes the result is automatically saved to the gallery. If an Ollama model is configured, the server runs post-generation LLM tasks to produce rich metadata for every result:

- **Name** — an LLM-generated title based on the content
- **Description** — a prose paragraph describing the output
- **Summary** — an objective visual inventory for searchability
- **Tags** — auto-generated descriptive tags

All metadata fields are editable. The original prompt and seed are preserved for reproducibility.

#### Workflow Types

| Type | Typical Inputs | Typical Outputs |
|------|---------------|-----------------|
| **Image** (text-to-image, img2img) | Text prompt, optional reference images, orientation, seed, extra inputs | Generated image with metadata |
| **Video** (image-to-video) | One or two reference frames, optional motion prompt, frame count, frame rate, seed | Animated video with metadata |
| **Audio** (text-to-audio) | Text prompt, name, optional lyrics, audio format, seed | Audio file with auto-generated album cover |
| **Inpaint** | Source image, hand-drawn mask, text prompt, seed | Modified image with masked region regenerated |
| **Custom** | Whatever the workflow requires — the Workflow Editor maps any ComfyUI node inputs to form fields | Whatever the workflow produces |

Each workflow can define its own pre-generation tasks (e.g., auto-generate a motion prompt from frame descriptions) and post-generation tasks (e.g., describe the result via LLM), conditional value replacements (e.g., different dimensions for portrait vs. landscape), and arbitrary extra inputs rendered in the form.

#### Inpainting

The inpaint page provides a dedicated canvas-based mask editor. Load an existing image from the gallery, draw a mask over the area you want to regenerate, write a prompt describing the replacement content, and generate. The surrounding context is preserved while the masked area is re-synthesized.

**Inputs**: Source image, hand-drawn mask, text prompt, inpaint workflow selection, seed.  
**Output**: Modified image with the masked region regenerated.

### Gallery

The gallery is a searchable, paginated history of every image, video, and audio file you've generated or uploaded. You can type a search query to match against names, descriptions, prompts, or dates, and narrow results further by selecting one or more tags (matched with AND logic). Items are organized into folders that you create, rename, and delete freely — moving media between folders or back to the default "Unsorted" bucket with a single action.

For quick browsing, a thumbnail grid overlay lets you scan results visually without opening each entry. When you do open an item, the full detail view shows all metadata fields (name, description, summary, tags, prompt, seed, workflow, timestamps) and lets you edit any of them inline. From there you can regenerate LLM text fields, export the item, or delete it. Bulk operations are supported too — select multiple items to move, re-tag, or delete them in one pass. Sort order toggles between newest-first and oldest-first.

### Upload

Bring existing media into the gallery by uploading image or audio files directly. Every upload goes through the same LLM analysis pipeline that runs after generation, automatically producing a name, description, summary, and tags. For audio uploads, the server can also trigger a hidden ComfyUI workflow to generate an album cover image so the audio entry has a visual thumbnail in the gallery.

### Tag Autocomplete

Prompt authoring is assisted by a Danbooru tag database with over a million entries. Right-click any prompt textarea to open a category-aware search panel that filters tags by type (general, artist, copyright, character), minimum usage count, and minimum length. Selecting a tag inserts it at the current cursor position in the textarea, making it easy to build precise prompts without memorizing exact tag names.

### Workflow Editor

The workflow editor is where you bring ComfyUI workflows into YAAIIC. Upload a raw workflow JSON and the server runs a multi-pass analysis of its node graph, automatically detecting prompts, seeds, image/audio inputs, save paths, and extra parameters. The result is a pre-populated configuration that you can fine-tune through a visual interface — mapping node inputs to form fields, defining where outputs are saved, setting up LLM tasks that run before or after generation, and adding conditional logic (for example, applying different width/height values depending on whether the user picks portrait or landscape).

Once a workflow is configured you can test it directly from the editor to verify everything works before it appears in the main generation form. Workflows can be reordered, hidden from the public list (useful for internal helper workflows like album cover generation), or deleted when no longer needed.

### Brew Editor

The brew editor is a multi-channel ambient audio mixing tool for assembling layered soundscapes. Each brew is built from channels — independent mixing groups with their own volume — and within each channel you place one or more tracks pointing to audio sources. A global sound source library lets you register reusable clips (from generated audio or uploads) that any brew can reference, so you don't duplicate files across recipes.

The master volume control sets the overall mix level. Brews are persisted on the server and can be loaded, renamed, and deleted from the editor.

### Export

Media can be exported to external destinations defined in `config.json`. A "save" export writes the file to a local folder using a template-based filename with pipe transformations (e.g., `{{name|split-by-spaces|kebabcase|lowercase}}`). A "post" export sends the media data to an external HTTP API — useful for pushing assets into other tools like a campaign management system. Each export destination declares which media types it supports (image, video, audio) and can run data preparation tasks with conditional logic before sending.

### Theme Switching

A dark and light theme are available from the navigation menu. The selection persists across sessions via cookies and flows through centralized theme tokens so every component — buttons, panels, inputs, modals, progress bars — updates consistently without per-component overrides.

---

## Developer Documentation

YAAIIC is built with a modular architecture designed for extension and reuse. The frontend has no build step — all JavaScript uses native ES modules resolved via importmaps. Several parts of the codebase are designed to work independently of YAAIIC itself and can be dropped into other projects.

### Portable Tools

These modules are decoupled from YAAIIC and useful in any Preact + Express project that follows the same conventions. Each one ships as a self-contained directory or script with no dependency on YAAIIC-specific code.

#### Component Library

The custom-ui directory (`public/js/custom-ui/`) is a standalone design system built on Preact, htm, and goober. It provides themed buttons, inputs, sliders, selects, modals, toasts, tab panels, pagination, floating panels, and layout primitives — everything needed to build a full application UI without writing component boilerplate from scratch. The library includes a centralized theme system with dark and light modes, a component showcase page for visual testing, and follows strict conventions around styling and accessibility. If you're starting a new Preact project and want a ready-made set of building blocks with consistent theming, this library can be pulled in wholesale.

**[Read the Component Library Docs →](docs/components.md)**

#### Library Download & Sync

The library management tooling solves two problems. First, `download-libs.mjs` fetches JavaScript libraries from CDNs (primarily esm.sh) and Google Fonts to local directories, so your frontend runs without any runtime CDN dependency — useful for offline-capable tools, air-gapped environments, or simply removing external requests. Second, `lib-sync.mjs` provides bidirectional file synchronization between the local `custom-ui` directory and a central repository, so multiple projects can share and evolve the same component library without copy-paste drift. Any project that uses the custom-ui library benefits from this sync workflow.

**[Read the Library Management Docs →](docs/lib-sync.md)**

#### Project Scaffolding

The scaffold tool generates a complete starter project from the YAAIIC template — Express server with domain-driven structure, the full custom-ui component library, library download configuration, font files, and a minimal Preact app wired up with theming. If you need to spin up a new Preact + Express project with the same conventions and component library, this gets you from zero to a running application in one command instead of assembling boilerplate manually.

**[Read the Scaffolding Docs →](docs/scaffolding.md)**

### YAAIIC Internals

These documents cover systems that are specific to YAAIIC's integration with ComfyUI and Ollama. They're essential for understanding, configuring, or extending YAAIIC itself.

#### Architecture

A full overview of the project's frontend and backend architecture, including the three-layer component model, domain-driven backend structure, generation and upload data flow, VRAM management strategy, configuration loading, data persistence, and migration scripts.

**[Read the Architecture Guide →](docs/architecture.md)**

#### Server API

Complete REST API reference covering all endpoints across eight feature domains: media management, generation orchestration, file uploads, media export, workflow CRUD, brew recipes, sound sources, LLM model listing, and SSE progress streaming. Includes request/response schemas, error states, and the asynchronous generation workflow.

**[Read the Server API Docs →](docs/server.md)**

#### Workflow Configuration

Detailed reference for the `comfyui-workflows.json` configuration format. Covers workflow object structure, value replacement mappings (direct and conditional), LLM task definitions (model-based, template-based, and copy-based), extra input fields, the template syntax with pipe transformations, and the multi-pass auto-detection algorithm that analyzes a raw ComfyUI workflow JSON to generate a ready-to-use configuration.

**[Read the Workflow Configuration Guide →](docs/workflow.md)**

---

## Project Structure

```
YAAIIC/
├── public/                          # Frontend (static, no build step)
│   ├── index.html                   # Main app & gallery
│   ├── brew-editor.html             # Ambient brew editor
│   ├── workflow-editor.html         # Workflow configuration
│   ├── inpaint.html                 # Inpainting tool
│   ├── loading.html                 # Service readiness page
│   ├── js/
│   │   ├── app.mjs                  # Main app entry point
│   │   ├── custom-ui/               # Reusable component library
│   │   └── app-ui/                  # Project-specific components
│   ├── lib/                         # Downloaded JS libraries
│   ├── css/                         # Stylesheets & font CSS
│   └── fonts/                       # Downloaded font files
├── server/
│   ├── server.mjs                   # Express entry point
│   ├── config.json                  # User configuration
│   ├── core/                        # Shared infrastructure
│   └── features/                    # Domain-driven feature modules
│       ├── media/                   # Gallery & tags
│       ├── generation/              # ComfyUI orchestration
│       ├── upload/                  # File uploads
│       ├── export/                  # Media export
│       ├── workflows/               # Workflow CRUD
│       ├── brew/                    # Brew recipes
│       ├── sound-sources/           # Audio source library
│       └── llm/                     # Ollama integration
├── scripts/
│   ├── scaffold.mjs                 # Project generator
│   ├── download-libs.mjs            # Library downloader
│   └── lib.config.json              # Library & font config
├── docs/                            # Documentation
│   ├── architecture.md              # Project architecture
│   ├── server.md                    # Server API reference
│   ├── workflow.md                  # Workflow configuration
│   ├── components.md                # Component library
│   ├── lib-sync.md                  # Library management
│   ├── scaffolding.md               # Project scaffolding
│   └── manual-test-suite.md         # QA test cases
└── package.json
```

## License

See [LICENSE](LICENSE) for details.
