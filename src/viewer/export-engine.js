// Copies the engine files from src/ into docs/engine/ for the web page.
// Run it with: npm run export-engine. Uses no network and installs nothing.
import { copyEngine, ENGINE_DIR } from './engine-files.js';

const files = copyEngine();
console.log(`Copied ${files.length} files to ${ENGINE_DIR}`);
