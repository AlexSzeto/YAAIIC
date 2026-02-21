/**
 * LLM Router – Express routes for the LLM domain.
 *
 * Provides utility endpoints for LLM configuration, such as listing
 * the models currently installed on the local Ollama instance.
 *
 * @module features/llm/router
 */
import { Router } from 'express';
import { listOllamaModels } from '../../core/llm.mjs';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/llm/models – list installed Ollama models
// ---------------------------------------------------------------------------

/**
 * GET /api/llm/models
 *
 * Returns the list of model names currently installed in Ollama.
 * Used by the workflow editor to populate the model select input.
 */
router.get('/api/llm/models', async (req, res) => {
  try {
    const models = await listOllamaModels();
    res.json({ models });
  } catch (error) {
    console.error('Failed to list Ollama models:', error);
    res.status(502).json({ error: 'Failed to fetch models from Ollama', details: error.message });
  }
});

export default router;
