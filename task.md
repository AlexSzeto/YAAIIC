# Test Infrastructure Rollout

## Goal

Establish an automated testing baseline that integrates into the existing task execution loop, replacing the current pattern of manually copying console errors and verifying behavior by hand. Tests run automatically after each implemented task, covering endpoint contracts, component rendering, and generation pipeline logic via mock services.

## Tasks

### Package Setup
- [x] Install dev dependencies: `vitest`, `@vitest/coverage-v8`, `supertest`, `@testing-library/preact`, `happy-dom`.
- [x] Add `vitest.config.mjs` at the project root configuring two environments: `node` for `server/**/*.test.mjs` files and `happy-dom` for `public/js/**/*.test.mjs` files.
- [x] Add a `test` script to `package.json` (`vitest run`) and a `test:watch` script (`vitest`).

### Mock Services
- [x] Implement `server/test/mocks/comfy-mock.mjs`: a minimal Express + `ws` server that handles ComfyUI's `/prompt` POST (returns a fake `prompt_id`), `/history/{id}` GET (returns a completed status), and WebSocket progress events. Exports `startComfyMock(port)` and `stopComfyMock()`.
- [x] Implement `server/test/mocks/ollama-mock.mjs`: a minimal Express server that handles Ollama's `/api/generate` POST (returns a configurable fake response). Exports `startOllamaMock(port)` and `stopOllamaMock()`.
- [x] Add a `server/test/setup.mjs` Vitest global setup file that starts both mocks before the test suite and stops them after.

### Baseline Endpoint Tests
- [x] Write `server/features/media/router.test.mjs`: tests for `GET /media-data` (returns array), `GET /tags` (returns array), and `DELETE /media-data/delete` (accepts uid array, returns success).
- [x] Write `server/features/upload/router.test.mjs`: tests for `POST /upload` with a minimal image buffer — verify task ID returned and SSE completion event structure.
- [x] Write `server/features/generation/router.test.mjs`: tests for `POST /generate` with a ComfyUI-enabled workflow using the comfy mock — verify task ID returned and that the mock receives the prompt.

### Baseline Component Tests
- [x] Write `public/js/custom-ui/test.vitest.mjs`: renders each component exported from `custom-ui/` with minimal props and asserts no thrown errors and no `console.error` calls.
- [x] Write smoke tests for the three main app pages (`anytale`, `brew-editor`, `gallery`): each test imports the root component, renders it into happy-dom, and asserts the page mounts without errors.

### Skill & Loop Integration
- [x] Create `.claude/skills/test/SKILL.md`: a `/test` skill that runs `vitest run` and reports pass/fail counts and any failure output.
- [x] Create `.claude/skills/debug-server/SKILL.md`: an agent skill for ad-hoc server-side debugging — accepts a free-form description of a client-server scenario and uses curl/Bash to fire requests, inspect responses, and reason about the behavior.
- [x] Update `.claude/skills/execute/SKILL.md`: after each task that modifies code, run `vitest run --changed` and report results. If tests fail, pause and surface the output before asking the user how to proceed. If no tests match the changed files, continue silently.
- [x] Update `.claude/skills/execute-all/SKILL.md`: same `vitest run --changed` step after each task, but on failure emit the error output and halt the run rather than continuing to the next task.

## Implementation Details

### Vitest config structure

```js
// vitest.config.mjs
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './server/test/setup.mjs',
    workspace: [
      {
        test: {
          name: 'server',
          include: ['server/**/*.test.mjs'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'client',
          include: ['public/js/**/*.test.mjs'],
          environment: 'happy-dom',
        },
      },
    ],
  },
})
```

### Test file co-location convention

Tests live next to the files they test:
- `server/features/media/router.mjs` → `server/features/media/router.test.mjs`
- `public/js/app-ui/anytale/anytale.mjs` → `public/js/app-ui/anytale/anytale.test.mjs`

### Mock port convention

ComfyUI mock: `17861` (offset from real ComfyUI default `8188` to avoid collision).  
Ollama mock: `21434` (offset from real Ollama default `11434`).  
Both ports are overridden in server config during test runs via environment variables.

### `vitest run --changed` behaviour

Vitest's `--changed` flag runs only tests whose covered source files have changed since the last git commit. If no tests are affected, the command exits 0 with no output — the skill treats this as a silent pass and continues.

### Component test baseline pattern

```js
import { render } from '@testing-library/preact'
import { html } from 'htm/preact'
import { MyComponent } from './my-component.mjs'

test('renders without errors', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  render(html`<${MyComponent} />`)
  expect(spy).not.toHaveBeenCalled()
  spy.mockRestore()
})
```

### Reminder (out of scope for this feature)
- Development loop overhaul (feature backlog organization, documentation drift) is planned as a follow-on feature.
