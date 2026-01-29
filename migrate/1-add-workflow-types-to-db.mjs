import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if old database file exists and rename it
const oldMediaDataPath = path.join(__dirname, '..', 'server', 'database', 'image-data.json');
const newMediaDataPath = path.join(__dirname, '..', 'server', 'database', 'media-data.json');

if (fs.existsSync(oldMediaDataPath) && !fs.existsSync(newMediaDataPath)) {
  console.log('Renaming image-data.json to media-data.json...');
  fs.renameSync(oldMediaDataPath, newMediaDataPath);
  console.log('Database file renamed successfully.');
}

// Path to the media data JSON file
const mediaDataPath = path.join(__dirname, '..', 'server', 'database', 'media-data.json');

console.log('Starting migration: Adding workflow types to database entries...');

// Load media data
let mediaDataWrapper;
let mediaData;
try {
  const fileContent = fs.readFileSync(mediaDataPath, 'utf8');
  mediaDataWrapper = JSON.parse(fileContent);
  
  // Migrate from imageData to mediaData if needed
  if (mediaDataWrapper.imageData && !mediaDataWrapper.mediaData) {
    console.log('Migrating from imageData to mediaData property...');
    mediaDataWrapper.mediaData = mediaDataWrapper.imageData;
    delete mediaDataWrapper.imageData;
  }
  
  mediaData = mediaDataWrapper.mediaData || [];
  console.log(`Loaded ${mediaData.length} media entries from database.`);
} catch (error) {
  console.error('Error loading media data:', error);
  process.exit(1);
}

// Counter for updated entries
let updatedCount = 0;

// Process each entry
mediaData.forEach((entry, index) => {
  let detectedType = null;
  
  // Check if entry has audio files
  if (entry.saveAudioPath || entry.saveAudioFilename) {
    detectedType = 'audio';
  }
  // Check if entry is video based on filename extension (webp for video) or workflow name
  else if (
    entry.saveImageFilename?.endsWith('.webp') ||
    entry.workflow?.toLowerCase().includes('video')
  ) {
    detectedType = 'video';
  }
  // Otherwise, assume it's an image
  else {
    detectedType = 'image';
  }
  
  // Add the detected type
  entry.type = detectedType;
  updatedCount++;
  
  console.log(`Entry ${index + 1}: UID ${entry.uid} -> Type: ${detectedType}`);

  // Migrate imageUrl from "image/" to "media/" if needed
  if (entry.imageUrl && entry.imageUrl.startsWith('/image/')) {
    entry.imageUrl = entry.imageUrl.replace(/^\/image\//, '/media/');
    console.log(`  -> Migrated imageUrl: ${entry.imageUrl}`);
  }
});

// Write updated data back to the file
try {
  mediaDataWrapper.mediaData = mediaData;
  fs.writeFileSync(mediaDataPath, JSON.stringify(mediaDataWrapper, null, 2), 'utf8');
  console.log(`\nMigration complete! Updated ${updatedCount} entries.`);
  console.log(`Database saved to: ${mediaDataPath}`);
} catch (error) {
  console.error('Error saving media data:', error);
  process.exit(1);
}
