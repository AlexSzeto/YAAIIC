/**
 * play-dialog.mjs — Play-mode dialog generation via Ollama chat.
 *
 * Renders the configured system message template, calls POST /api/chat,
 * and returns generated dialog text.
 */

/**
 * Render `{{profile}}` and `{{location}}` placeholders in the system message template.
 * @param {string} template
 * @param {string} profile - character personality string
 * @param {string} location - location attribute value
 * @returns {string}
 */
function renderSystemMessage(template, name, profile, location) {
  return template
    .replace('{{name}}', name || '')
    .replace('{{profile}}', profile || '')
    .replace('{{location}}', location || '');
}

/**
 * Generate dialog text for a page using the Ollama chat endpoint.
 *
 * @param {Object} p
 * @param {Object} p.character - Session character ({ personality })
 * @param {string} p.locationAttributeValue - The primary location attribute value (for template)
 * @param {Object} p.page - Plot page object ({ dialogPrompt })
 * @param {Object} p.dialogConfig - From anytale config: { model, systemMessage, parameters, mode, format, stream }
 * @param {Array<{role: string, content: string}>} [p.history=[]] - Prior turns for context (injected after system, before current user message)
 * @param {AbortSignal} [p.signal]
 * @param {Function} [p.onChunk] - Called with accumulated text on each streaming chunk (streaming mode only)
 * @returns {Promise<string>} Resolved with final dialog text, or rejects on error
 */
export async function generateDialog({ character, locationAttributeValue, page, dialogConfig, history = [], signal, onChunk }) {
  const {
    model,
    systemMessage: systemTemplate = '',
    parameters = {},
    mode = 'chat',
    format,
    stream = false,
  } = dialogConfig;

  const systemMessage = renderSystemMessage(
    systemTemplate,
    character.name || '',
    character.personality || '',
    locationAttributeValue || ''
  );

  const messages = [
    { role: 'system', content: systemMessage },
    ...history,
    { role: 'user', content: page.dialogPrompt },
  ];

  // Map camelCase parameter names to Ollama option names
  const options = {};
  if (parameters.temperature !== undefined) options.temperature = parameters.temperature;
  if (parameters.topP !== undefined) options.top_p = parameters.topP;
  if (parameters.maxTokens !== undefined) options.num_predict = parameters.maxTokens;

  const body = { model, messages, stream, options, mode };
  if (format) body.format = format;

  console.log('[Dialog] POST /api/chat', JSON.stringify(body, null, 2));

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[Dialog] /api/chat error', res.status, errText);
    throw new Error(`Dialog generation failed: ${res.status} ${res.statusText}`);
  }

  if (!stream) {
    const data = await res.json();
    console.log('[Dialog] /api/chat response', data);
    return data.message?.content || '';
  }

  // Streaming: consume SSE and accumulate content
  return readStreamingDialog(res, signal, onChunk);
}

/**
 * Read a streaming /api/chat SSE response and return the full accumulated text.
 * @param {Response} res
 * @param {AbortSignal} [signal]
 * @param {Function} [onChunk] - Called with accumulated text after each chunk
 * @returns {Promise<string>}
 */
async function readStreamingDialog(res, signal, onChunk) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') return accumulated;
        try {
          const chunk = JSON.parse(payload);
          if (chunk.message?.content) {
            accumulated += chunk.message.content;
            onChunk?.(accumulated);
          }
        } catch { /* skip malformed chunks */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
}
