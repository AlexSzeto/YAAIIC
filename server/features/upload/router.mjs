/**
 * Upload Router – Express routes and Multer configuration for file uploads.
 *
 * Owns the Multer middleware setup and the /upload/* routes.
 * All business logic is delegated to the upload service.
 *
 * @module features/upload/router
 */
import { Router } from 'express';
import multer from 'multer';
import { processMediaUpload } from './service.mjs';
import { loadWorkflows } from '../generation/workflow-validator.mjs';

const router = Router();

// ---------------------------------------------------------------------------
// Multer configuration (in-memory storage for processing)
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
    files: 2                      // image + mask, or audio + reference
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and audio files are allowed'), false);
    }
  }
});

// Re-export so generation/inpaint routes can reuse the same Multer instance
export { upload };

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /upload/image
 * Upload an image file for processing.
 */
router.post('/upload/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('Received image upload:', req.file.originalname);
    const extractedName = req.body.name || null;

    const taskId = await processMediaUpload(req.file, loadWorkflows(), extractedName);

    res.json({ success: true, taskId, message: 'Upload task created' });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image', details: error.message });
  }
});

/**
 * POST /upload/audio
 * Upload an audio file for processing.
 */
router.post('/upload/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Received audio upload:', req.file.originalname);
    const extractedName        = req.body.name        || null;
    const extractedOrigin      = req.body.origin      ? parseInt(req.body.origin) : null;
    const extractedClips       = req.body.clips       != null ? JSON.parse(req.body.clips) : null;
    const extractedTags        = req.body.tags        ? JSON.parse(req.body.tags) : null;
    const extractedDescription = req.body.description || null;
    const extractedSummary     = req.body.summary     || null;
    const extractedPrompt      = req.body.prompt      || null;

    const metadata = (extractedTags || extractedDescription || extractedSummary || extractedPrompt)
      ? { tags: extractedTags, description: extractedDescription, summary: extractedSummary, prompt: extractedPrompt }
      : null;

    const taskId = await processMediaUpload(req.file, loadWorkflows(), extractedName, extractedOrigin, extractedClips, metadata);

    res.json({ success: true, taskId, message: 'Upload task created' });
  } catch (error) {
    console.error('Error uploading audio:', error);
    res.status(500).json({ error: 'Failed to upload audio', details: error.message });
  }
});

export default router;
