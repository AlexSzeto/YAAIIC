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

    const taskId = await processMediaUpload(req.file, req.app.locals.comfyuiWorkflows, extractedName);

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
    const extractedName = req.body.name || null;

    const taskId = await processMediaUpload(req.file, req.app.locals.comfyuiWorkflows, extractedName);

    res.json({ success: true, taskId, message: 'Upload task created' });
  } catch (error) {
    console.error('Error uploading audio:', error);
    res.status(500).json({ error: 'Failed to upload audio', details: error.message });
  }
});

export default router;
