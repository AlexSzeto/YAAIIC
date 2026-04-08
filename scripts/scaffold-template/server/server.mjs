import express from 'express';
import { loadConfig } from './core/config.mjs';
import { PUBLIC_DIR } from './core/paths.mjs';

const app = express();

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error('Failed to load configuration:', error);
  process.exit(1);
}

app.use(express.static(PUBLIC_DIR));
app.use(express.json());

const port = config.serverPort || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
