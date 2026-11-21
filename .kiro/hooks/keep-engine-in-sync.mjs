// Used by .kiro/hooks/keep-engine-in-sync.json (PostToolUse hook).
//
// Kiro sends a JSON description of the finished tool call on STDIN. If the
// tool changed a file under src/, this script runs exactly two commands:
//   1. npm run export-engine                      (copies src/ to docs/engine/)
//   2. node --test test/engine-export.test.js     (proves they match byte for byte)
// For any other file it does nothing and exits 0.
//
// It never edits src/. The export only writes docs/engine/, which the Kiro
// write tools do not touch, so this hook cannot trigger itself. A guard
// variable stops it anyway if it were ever started from inside itself.
// No network, no installs.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = 'DESIGNFORYOU_ENGINE_SYNC_RUNNING';
if (process.env[GUARD]) process.exit(0);

// Repo root = two folders above this file (.kiro/hooks/).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const srcDir = resolve(root, 'src') + sep;

let event = {};
try {
  const raw = readFileSync(0, 'utf8');
  event = raw.trim() ? JSON.parse(raw) : {};
} catch {
  console.error('keep-engine-in-sync: could not read the hook event; doing nothing.');
  process.exit(0);
}

const input = event.tool_input || {};
const target = input.path || input.targetFile || input.file_path || '';
if (typeof target !== 'string' || target === '') process.exit(0);

const absolute = resolve(event.cwd || root, target);
if (!absolute.startsWith(srcDir)) process.exit(0);

function run(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, [GUARD]: '1' },
  });
  if (result.status !== 0) {
    console.error(`keep-engine-in-sync: ${label} FAILED (exit ${result.status}).`);
    console.error(`Changed file: ${absolute}`);
    console.error((result.stdout || '') + (result.stderr || ''));
    process.exit(1);
  }
  return result.stdout.trim();
}

const exported = run('npm run export-engine', 'npm', ['run', 'export-engine']);
run('engine-export test', process.execPath, ['--test', 'test/engine-export.test.js']);

console.log(`keep-engine-in-sync: ${absolute.slice(root.length + 1)} changed. ` +
  `Export done (${exported.split('\n').pop()}); engine-export test passed.`);
