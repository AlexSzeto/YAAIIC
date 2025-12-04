# ComfyUI SSE Debug

## Goals
Fix the remaining discovered issues while implmementing live progress update for the image generator client.

[] Add support for `progress_state` message type in ComfyUI WebSocket handler
1. Add `progress_state` case to the message switch statement in `handleComfyUIMessage` in `server/comfyui-websocket.mjs`
2. Create `handleProgressState(data)` function to process progress_state messages
3. Extract per-node state information from the `nodes` object (state: "running" | "finished", value, max, node_id)
4. Update `promptExecutionState` map to track individual node states and overall workflow progress
5. Optionally use `progress_state` as supplementary tracking alongside `progress` messages (keep both handlers active)
6. Consider logging `progress_state` data for debugging but rely primarily on `progress` messages for SSE emission since they're simpler
```javascript
// progress_state message format (observed from ComfyUI)
{
  type: "progress_state",
  data: {
    prompt_id: "abc123",
    nodes: {
      "3": {
        value: 10,
        max: 20,
        state: "running",
        node_id: "3",
        prompt_id: "abc123",
        display_node_id: "3",
        parent_node_id: null,
        real_node_id: "3"
      },
      "6": {
        value: 1,
        max: 1,
        state: "finished",
        node_id: "6",
        prompt_id: "abc123",
        display_node_id: "6",
        parent_node_id: null,
        real_node_id: "6"
      }
    }
  }
}
```

[] Integrate SSE library into inpaint page
1. Import SSEManager and ProgressBanner in `public/js/inpaint.mjs`
2. Modify inpaint generation handler to parse taskId from server response
3. Create and mount ProgressBanner component with taskId for inpaint operations
4. Pass onComplete callback to handle inpaint result
5. Ensure progress tracking works for both regular and inpaint workflows