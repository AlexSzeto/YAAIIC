/**
 * Minimal Ollama mock server for integration tests.
 *
 * Handles:
 *   POST /api/generate  → returns a configurable fake text response
 *   POST /api/chat      → returns a configurable fake chat message
 *
 * Port: default 21434 (offset from real Ollama 11434 to avoid collision).
 */
import express from 'express'
import http from 'http'

let _server = null
let _fakeResponse = 'This is a fake Ollama response.'

export function setFakeResponse(text) {
  _fakeResponse = text
}

export function startOllamaMock(port = 21434) {
  const app = express()
  app.use(express.json())

  app.post('/api/generate', (req, res) => {
    res.json({
      model: req.body.model || 'llama3',
      created_at: new Date().toISOString(),
      response: _fakeResponse,
      done: true,
      context: [],
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 10,
      eval_count: 20,
      eval_duration: 900,
    })
  })

  app.post('/api/chat', (req, res) => {
    res.json({
      model: req.body.model || 'llama3',
      created_at: new Date().toISOString(),
      message: { role: 'assistant', content: _fakeResponse },
      done: true,
    })
  })

  _server = http.createServer(app)

  return new Promise((resolve, reject) => {
    _server.listen(port, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

export function stopOllamaMock() {
  return new Promise((resolve) => {
    if (_server) {
      _server.close(() => resolve())
    } else {
      resolve()
    }
  })
}
