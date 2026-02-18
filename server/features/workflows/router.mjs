/**
 * Workflow Router – Express routes for workflow management API.
 *
 * Endpoints:
 *   GET    /api/workflows          - List all workflows (including hidden)
 *   GET    /api/workflows/:name    - Fetch a specific workflow by name
 *   POST   /api/workflows/upload   - Upload a ComfyUI JSON and auto-detect mappings
 *   POST   /api/workflows          - Save / update a workflow configuration
 *   DELETE /api/workflows/:name    - Remove a workflow
 *
 * @module features/workflows/router
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { RESOURCE_DIR, WORKFLOWS_PATH } from '../../core/paths.mjs';
import {
  getWorkflowByName,
  listWorkflowSummaries,
  saveWorkflow,
  deleteWorkflow,
  autoDetectWorkflow,
  parseWorkflowName,
} from './service.mjs';

const router = Router();

// ---------------------------------------------------------------------------
// Multer – in-memory storage for workflow JSON uploads
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/json' ||
      file.originalname.toLowerCase().endsWith('.json')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'), false);
    }
  },
});

// ---------------------------------------------------------------------------
// GET /api/workflows – list all workflows (including hidden)
// ---------------------------------------------------------------------------

router.get('/api/workflows', (req, res) => {
  try {
    const summaries = listWorkflowSummaries();
    res.json({ workflows: summaries });
  } catch (error) {
    console.error('Error listing workflows:', error);
    res.status(500).json({ error: 'Failed to list workflows' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/workflows/upload – upload and auto-detect
// ---------------------------------------------------------------------------
// NOTE: must come BEFORE /:name to avoid route shadowing

router.post('/api/workflows/upload', upload.single('workflow'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No workflow file provided' });
    }

    let workflowJson;
    try {
      workflowJson = JSON.parse(req.file.buffer.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON file' });
    }

    // Sanitise filename and save to resource/
    const originalName  = req.file.originalname;
    const sanitized     = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const baseFilename  = sanitized.endsWith('.json') ? sanitized : `${sanitized}.json`;
    const destPath      = path.join(RESOURCE_DIR, baseFilename);

    fs.writeFileSync(destPath, JSON.stringify(workflowJson, null, 2), 'utf8');
    console.log(`Workflow JSON saved to ${destPath}`);

    // Derive display name from filename
    const suggestedName = parseWorkflowName(baseFilename);

    // Auto-detect mappings
    const { workflow, detectedNodes } = autoDetectWorkflow(workflowJson, suggestedName);
    workflow.base = baseFilename;

    // Persist to comfyui-workflows.json (skip validation – user will edit first)
    const data = JSON.parse(fs.readFileSync(WORKFLOWS_PATH, 'utf8'));

    const existingIndex = data.workflows.findIndex(w => w.name === workflow.name);
    if (existingIndex !== -1) {
      data.workflows[existingIndex] = workflow;
    } else {
      data.workflows.push(workflow);
    }

    fs.writeFileSync(WORKFLOWS_PATH, JSON.stringify(data, null, 2), 'utf8');

    res.json({ workflow, detectedNodes, baseFilename, workflowJson });
  } catch (error) {
    console.error('Error uploading workflow:', error);
    res.status(500).json({ error: 'Failed to upload workflow', details: error.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/workflows/:name/base – serve the raw ComfyUI JSON for a workflow
// ---------------------------------------------------------------------------
// NOTE: must come BEFORE /:name to avoid being swallowed by the generic route

router.get('/api/workflows/:name/base', (req, res) => {
  try {
    const name     = decodeURIComponent(req.params.name);
    const workflow = getWorkflowByName(name);

    if (!workflow || !workflow.base) {
      return res.status(404).json({ error: 'Base workflow file not found' });
    }

    const basePath = path.join(RESOURCE_DIR, workflow.base);
    if (!fs.existsSync(basePath)) {
      return res.status(404).json({ error: `File "${workflow.base}" not found` });
    }

    res.setHeader('Content-Type', 'application/json');
    res.sendFile(basePath);
  } catch (error) {
    console.error('Error serving base workflow:', error);
    res.status(500).json({ error: 'Failed to load base workflow file' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/workflows/:name – fetch a specific workflow
// ---------------------------------------------------------------------------

router.get('/api/workflows/:name', (req, res) => {
  try {
    const name     = decodeURIComponent(req.params.name);
    const workflow = getWorkflowByName(name);

    if (!workflow) {
      return res.status(404).json({ error: `Workflow "${name}" not found` });
    }

    res.json({ workflow });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/workflows – save / update a workflow
// ---------------------------------------------------------------------------

router.post('/api/workflows', (req, res) => {
  try {
    const workflowData = req.body;

    if (!workflowData || typeof workflowData !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const result = saveWorkflow(workflowData);

    if (!result.success) {
      return res.status(422).json({ errors: result.errors });
    }

    res.json({ workflow: result.workflow });
  } catch (error) {
    console.error('Error saving workflow:', error);
    res.status(500).json({ error: 'Failed to save workflow', details: error.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/workflows/:name – delete a workflow
// ---------------------------------------------------------------------------

router.delete('/api/workflows/:name', (req, res) => {
  try {
    const name           = decodeURIComponent(req.params.name);
    const deleteBaseFile = req.query.deleteFile === 'true';

    const result = deleteWorkflow(name, deleteBaseFile);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: 'Failed to delete workflow', details: error.message });
  }
});

export default router;
