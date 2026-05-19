import fs from 'fs';
import path from 'path';

const DATABASE_DIR = path.join(process.cwd(), 'server', 'database');
const QUEUE_DATA_PATH = path.join(DATABASE_DIR, 'queue-data.json');

export function loadQueue() {
  try {
    if (!fs.existsSync(QUEUE_DATA_PATH)) {
      fs.writeFileSync(QUEUE_DATA_PATH, '[]', 'utf8');
      return [];
    }
    return JSON.parse(fs.readFileSync(QUEUE_DATA_PATH, 'utf8'));
  } catch (err) {
    console.error('[queue/repository] Failed to load queue:', err);
    return [];
  }
}

export function saveQueue(items) {
  try {
    if (!fs.existsSync(DATABASE_DIR)) {
      fs.mkdirSync(DATABASE_DIR, { recursive: true });
    }
    fs.writeFileSync(QUEUE_DATA_PATH, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('[queue/repository] Failed to save queue:', err);
  }
}
