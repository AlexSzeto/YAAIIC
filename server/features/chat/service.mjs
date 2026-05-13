/**
 * Chat Service
 * Prompt formatting and response normalization helpers
 */

/**
 * Builds a prompt string from a messages array using the specified format.
 * @param {Array<{role: string, content: string}>} messages
 * @param {"chatml"} format
 * @returns {string}
 */
export function buildPrompt(messages, format) {
  if (format !== 'chatml') {
    throw new Error(`Unsupported format: ${format}`);
  }

  const parts = messages.map(({ role, content }) =>
    `<|im_start|>${role}\n${content}<|im_end|>`
  );
  parts.push('<|im_start|>assistant\n');
  return parts.join('\n');
}

/**
 * Normalizes an /api/generate chunk to the unified client-facing format.
 * @param {Object} chunk - Raw chunk from Ollama /api/generate
 * @returns {{ message: { role: string, content: string }, done: boolean, context: number[]|null }}
 */
export function normalizeGenerateChunk(chunk) {
  return {
    message: { role: 'assistant', content: chunk.response ?? '' },
    done: chunk.done ?? false,
    context: chunk.done ? (chunk.context ?? null) : null
  };
}

/**
 * Normalizes an /api/chat chunk to the unified client-facing format.
 * @param {Object} chunk - Raw chunk from Ollama /api/chat
 * @returns {{ message: { role: string, content: string }, done: boolean, context: null }}
 */
export function normalizeChatChunk(chunk) {
  return {
    message: chunk.message ?? { role: 'assistant', content: '' },
    done: chunk.done ?? false,
    context: null
  };
}
