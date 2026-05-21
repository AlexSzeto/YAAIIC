/**
 * Minimal ComfyUI mock server for integration tests.
 *
 * Handles:
 *   POST /prompt        → returns a fake prompt_id
 *   GET  /history/:id   → returns a completed-status payload
 *   POST /upload/image  → echoes a fake filename
 *   WebSocket           → emits execution_start and execution_success events
 *
 * Ports: default 17861 (offset from real ComfyUI 8188 to avoid collision).
 */
import express from 'express'
import http from 'http'
import { WebSocketServer } from 'ws'

let _server = null
let _wss = null

export function startComfyMock(port = 17861) {
  const app = express()
  app.use(express.json())

  app.post('/prompt', (req, res) => {
    res.json({ prompt_id: 'fake-prompt-id', number: 1, node_errors: {} })
  })

  app.get('/history/:id', (req, res) => {
    const promptId = req.params.id
    res.json({
      [promptId]: {
        status: { completed: true, status_str: 'success', messages: [] },
        outputs: {},
        prompt: [0, promptId, {}],
      },
    })
  })

  app.post('/upload/image', (req, res) => {
    res.json({ name: 'uploaded-file.png', subfolder: '', type: 'input' })
  })

  app.post('/interrupt', (_req, res) => {
    res.json({ success: true })
  })

  _server = http.createServer(app)
  _wss = new WebSocketServer({ server: _server })

  _wss.on('connection', (ws) => {
    setTimeout(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'execution_start', data: { prompt_id: 'fake-prompt-id' } }))
      }
    }, 20)
    setTimeout(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'execution_success',
          data: { prompt_id: 'fake-prompt-id', timestamp: Date.now() },
        }))
      }
    }, 40)
  })

  return new Promise((resolve, reject) => {
    _server.listen(port, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

export function stopComfyMock() {
  return new Promise((resolve) => {
    if (_wss) _wss.close()
    if (_server) {
      _server.close(() => resolve())
    } else {
      resolve()
    }
  })
}
