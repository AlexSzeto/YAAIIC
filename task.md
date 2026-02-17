# Fire and Forget Generation Feature

## Goal
Enable a "fire and forget" generation mode where clients can request media generation via a synchronous API. The server waits for generation to complete and returns the result directly. These generations are NOT logged to the internal media database, but files persist in storage.

## User Decisions
- **API Strategy**: Strict separation. New endpoint `POST /generate/sync`.
- **File Storage**: Files persist in `server/storage` indefinitely (no auto-deletion).
- **Persistence**: `media-data.json` is skipped for sync requests.

## Implementation Steps

### 1. Refactor `server/features/generation/orchestrator.mjs`
- **Deprecate**: `handleMediaGeneration` (it couples logic with Express Response).
- **Create**: `initializeGenerationTask(reqBody, workflowConfig, serverConfig, options)`
    - Generates `taskId`.
    - Creates task in SSE manager.
    - Returns `{ taskId }`.
- **Update**: `processGenerationTask`
    - Ensure it returns the `completionData` (generation result) when finished.
    - Ensure `silent` option skips `addMediaDataEntry` call.

### 2. Update `server/features/generation/router.mjs`
- **Refactor `POST /generate`**:
    - Call `initializeGenerationTask`.
    - Send `res.json({ taskId })` immediately.
    - Call `processGenerationTask` in background (catch errors internally).
- **Add `POST /generate/sync`**:
    - Validate inputs.
    - Call `initializeGenerationTask`.
    - **Await** `processGenerationTask(taskId, ..., { silent: true })`.
    - Return `res.json(result)`.
- **Update `POST /generate/inpaint`**:
    - Update to use `initializeGenerationTask` + background `processGenerationTask`.

## Verification Plan
- **Manual Test**: Use `curl` or Postman to hit `/generate/sync`.
- **Check**: Response is JSON with image URL. `media-data.json` is unchanged. File exists in storage.

# Tasks

- [x] Plan "Fire and Forget" Feature <!-- id: 0 -->
    - [x] Iteratively define spec via Q&A <!-- id: 1 -->
- [ ] Implement Fire and Forget Feature <!-- id: 2 -->
    - [ ] Refactor Orchestrator for Task Initialization <!-- id: 3 -->
        - Extract `initializeGenerationTask` from `handleMediaGeneration`.
        - Ensure `processGenerationTask` returns a promise that resolves with generation data.
    - [ ] Implement `POST /generate` (Async) with Refactored Logic <!-- id: 4 -->
        - Update existing endpoint to use `initializeGenerationTask`.
        - Verify existing async behavior (returns `taskId` immediately).
    - [ ] Implement `POST /generate/sync` Endpoint <!-- id: 5 -->
        - Create new route handler.
        - Call `initializeGenerationTask`.
        - Await `processGenerationTask` with `{ silent: true }`.
        - Return full generation result JSON.
    - [ ] Verify Endpoints<!-- id: 6 -->
        - Manual test: `curl` to `/generate/sync` and check response/storage.
        - Manual test: `curl` to `/generate` and check SSE/gallery.
