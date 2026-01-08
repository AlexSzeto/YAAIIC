# Basic VRAM Management

## Goals
Track the most recent workflow that is being used by the server. If a workflow about to be used by the current generation is different from the most recent workflow, Use comfyui API's /free endpoint to maximize VRAM for the upcoming workflow. In addition, track the most recent model that is used by ollama and manage ollama's VRAM use in the same way.

## Tasks
- [ ] Implement VRAM Management Logic in Generation Process
    1.  Add `lastUsedWorkflow` variable to `server/generate.mjs` to track the active workflow across requests.
    2.  Implement `freeComfyUIMemory` function in `server/generate.mjs` that calls the ComfyUI `/free` endpoint to unload models.
    3.  Update `processGenerationTask` in `server/generate.mjs` to check if the current workflow differs from `lastUsedWorkflow`.
    4.  If the workflow has changed, trigger `freeComfyUIMemory` and update `lastUsedWorkflow` before proceeding with the generation logic.
- [ ] Implement VRAM Management Logic in LLM Process
    1.  Add `lastUsedModel` variable to `server/llm.mjs` to track the active Ollama model.
    2.  Implement `unloadOllamaModel(modelName)` function in `server/llm.mjs` that sends a request to Ollama with `keep_alive: 0` to unload the specific model.
    3.  Update `sendTextPrompt` and `sendImagePrompt` in `server/llm.mjs` to check if the requested `model` differs from `lastUsedModel`.
    4.  If the model has changed, trigger `unloadOllamaModel` for the *previous* model and update `lastUsedModel`.
