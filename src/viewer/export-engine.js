// Copies the engine files from src/ into docs/engine/ for the web page,
// the knowledge data files from src/knowledge/ into docs/knowledge/,
// and the design team's files into docs/team/ (with data.js made from the knowledge files and the registry).
// Run it with: npm run export-engine. Uses no network and installs nothing.
import { copyEngine, copyKnowledge, copyTeam, ENGINE_DIR, KNOWLEDGE_DIR, TEAM_DIR } from './engine-files.js';

const files = copyEngine();
const knowledge = copyKnowledge();
const team = copyTeam();
console.log(`Copied ${files.length} files to ${ENGINE_DIR}`);
console.log(`Copied ${knowledge.length} knowledge files to ${KNOWLEDGE_DIR}`);
console.log(`Copied ${team.length} design team files to ${TEAM_DIR}`);
