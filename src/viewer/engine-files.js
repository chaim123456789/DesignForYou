// The list of files the browser page needs from src/, and the function that copies them.
// The copies go to docs/engine/ with the same folder layout, byte for byte,
// so the page runs the very same code as the tests. The copies are never edited by hand.
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SRC_DIR = fileURLToPath(new URL('..', import.meta.url));
export const ENGINE_DIR = fileURLToPath(new URL('../../docs/engine', import.meta.url));
// Knowledge files are data, not code. They go to docs/knowledge/, next to docs/engine/, so the
// list of engine code files stays exactly as it was.
export const KNOWLEDGE_DIR = fileURLToPath(new URL('../../docs/knowledge', import.meta.url));

// Paths are relative to src/.
export function listEngineFiles() {
  const brain = readdirSync(join(SRC_DIR, 'brain')).filter((f) => f.endsWith('.js')).sort().map((f) => `brain/${f}`);
  return [
    ...brain,
    'agents/style/agent.js',
    'agents/layout/agent.js',
    'agents/builder/agent.js',
    'agents/reviewer/agent.js',
    'agents/config.js',
    'coordinator.js',
    'label.js',
    'summary/make-summary.js',
    'viewer/make-run-data.js',
  ];
}

// Copy every engine file from srcDir to outDir. Returns the list of relative paths copied.
export function copyEngine(srcDir = SRC_DIR, outDir = ENGINE_DIR) {
  const files = listEngineFiles();
  for (const rel of files) {
    const target = join(outDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(srcDir, rel), target);
  }
  return files;
}

// Every knowledge data file (.json) under src/knowledge/, relative to src/knowledge/, in a fixed order.
export function listKnowledgeFiles(srcDir = SRC_DIR) {
  const base = join(srcDir, 'knowledge');
  const walk = (dir) => readdirSync(dir).sort().flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name.endsWith('.json') ? [full.slice(base.length + 1).split('\\').join('/')] : [];
  });
  return walk(base);
}

// Copy every knowledge file from srcDir/knowledge to outDir, byte for byte. Returns the relative paths copied.
export function copyKnowledge(srcDir = SRC_DIR, outDir = KNOWLEDGE_DIR) {
  const files = listKnowledgeFiles(srcDir);
  for (const rel of files) {
    const target = join(outDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(srcDir, 'knowledge', rel), target);
  }
  return files;
}
