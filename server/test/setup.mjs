/**
 * Vitest global setup – starts mock external services before the suite runs
 * and stops them afterwards.
 *
 * Ports used:
 *   17861 – ComfyUI mock  (real ComfyUI default: 8188)
 *   21434 – Ollama mock   (real Ollama default: 11434)
 */
import { startComfyMock, stopComfyMock } from './mocks/comfy-mock.mjs'
import { startOllamaMock, stopOllamaMock } from './mocks/ollama-mock.mjs'

export async function setup() {
  await Promise.all([
    startComfyMock(17861),
    startOllamaMock(21434),
  ])
}

export async function teardown() {
  await Promise.all([
    stopComfyMock(),
    stopOllamaMock(),
  ])
}
