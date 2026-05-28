/**
 * Chat Router
 * Handles chat endpoints with streaming support via SSE
 */
import { Router } from 'express';
import { buildPrompt, normalizeGenerateChunk, normalizeChatChunk } from './service.mjs';
import { chat } from '../../core/llm.mjs';

const router = Router();

const SUPPORTED_COMPLETION_FORMATS = ['chatml'];

/**
 * POST /api/chat
 * Handles chat requests with optional streaming
 */
router.post('/api/chat', async (req, res) => {
  const { model, messages, stream = false, options = {}, mode = 'chat', format, context } = req.body;

  // Validation
  if (!model) {
    return res.status(400).json({ error: 'Model name is required' });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ 
      error: 'Messages array is required and must not be empty' 
    });
  }

  if (mode === 'completion' && !SUPPORTED_COMPLETION_FORMATS.includes(format)) {
    return res.status(400).json({
      error: `format is required and must be one of: ${SUPPORTED_COMPLETION_FORMATS.join(', ')} when mode is "completion"`
    });
  }

  const isCompletion = mode === 'completion';
  const normalizeChunk = isCompletion ? normalizeGenerateChunk : normalizeChatChunk;

  // For ChatML completion mode, add stop sequence so the model halts before generating a user turn
  const effectiveOptions = isCompletion && format === 'chatml'
    ? { ...options, stop: ['<|im_start|>user', ...(options.stop ?? [])] }
    : options;

  try {
    const prompt = isCompletion ? buildPrompt(messages, format) : undefined;
    
    const responseData = await chat({
      model,
      mode,
      messages: isCompletion ? undefined : messages,
      prompt,
      stream,
      options: effectiveOptions,
      context
    });

    // Handle streaming response
    if (stream) {
      // Set headers for Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        // Create a reader from the stream
        const reader = responseData.getReader();
        const decoder = new TextDecoder();

        // Process the stream
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Send done event
            res.write('data: [DONE]\n\n');
            res.end();
            break;
          }

          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });
          
          // Ollama sends NDJSON (newline-delimited JSON)
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                const normalized = normalizeChunk(data);
                
                // Send as SSE event
                res.write(`data: ${JSON.stringify(normalized)}\n\n`);

                // Check if this is the final message
                if (normalized.done) {
                  res.end();
                  return;
                }
              } catch (parseError) {
                console.error('Error parsing streaming chunk:', parseError);
              }
            }
          }
        }
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        
        // Send error as SSE event
        res.write(`data: ${JSON.stringify({ 
          error: true, 
          message: streamError.message 
        })}\n\n`);
        res.end();
      }
    } else {
      // Handle non-streaming response
      res.json(normalizeChunk(responseData));
    }
  } catch (error) {
    console.error('Error in chat:', error);
    
    // If headers haven't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Chat request failed',
        message: error.message 
      });
    }
  }
});

export default router;
