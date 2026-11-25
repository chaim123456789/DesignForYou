// Copies the engine files from src/ into docs/engine/ for the web page,
// and the knowledge data files from src/knowledge/ into docs/knowledge/.
// Run it with: npm run export-engine. Uses no network and installs nothing.
import { copyEngine, copyKnowledge, ENGINE_DIR, KNOWLEDGE_DIR } from './engine-files.js';

const files = copyEngine();
const knowledge = copyKnowledge();
console.log(`Copied ${files.length} files to ${ENGINE_DIR}`);
console.log(`Copied ${knowledge.length} knowledge files to ${KNOWLEDGE_DIR}`);
