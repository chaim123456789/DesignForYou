import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import '../test-helpers/register-hooks.js'; // the Task 1c child script uses registerHooks; stop early with a clear message on an older Node
import { listEngineFiles, copyEngine } from '../src/viewer/engine-files.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = path.join(root, 'src');
const engineDir = path.join(root, 'docs', 'engine');

function allFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? allFiles(full) : [full];
  });
}

test('Task 1c: the engine file list holds the brain, four agents, config, coordinator, label, summary and run-data function', () => {
  const files = listEngineFiles();
  for (const f of [
    'brain/brain.js', 'brain/gatekeeper.js', 'brain/inspiration.js',
    'agents/style/agent.js', 'agents/layout/agent.js', 'agents/builder/agent.js', 'agents/reviewer/agent.js',
    'agents/config.js', 'coordinator.js', 'label.js', 'summary/make-summary.js', 'viewer/make-run-data.js',
  ]) assert.ok(files.includes(f), `missing from the list: ${f}`);
  assert.equal(files.length, 12);
});

test('Task 1c: every file in docs/engine/ is byte-identical to its source in src/', () => {
  for (const rel of listEngineFiles()) {
    const a = readFileSync(path.join(srcDir, rel));
    const b = readFileSync(path.join(engineDir, rel));
    assert.ok(a.equals(b), `docs/engine/${rel} differs from src/${rel}. Run: npm run export-engine`);
  }
});

test('Task 1c: docs/engine/ holds only the listed files', () => {
  const found = allFiles(engineDir).map((f) => path.relative(engineDir, f).split(path.sep).join('/')).sort();
  assert.deepEqual(found, [...listEngineFiles()].sort());
});

test('Task 1c: the copy function writes byte-identical files into a fresh folder', () => {
  const out = mkdtempSync(path.join(tmpdir(), 'engine-'));
  try {
    const copied = copyEngine(srcDir, out);
    for (const rel of copied) assert.ok(readFileSync(path.join(srcDir, rel)).equals(readFileSync(path.join(out, rel))));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('Task 1c: docs/engine/ has no static Node imports, no network calls, no web addresses, no environment variables', () => {
  const patterns = [
    /^\s*import[^;]*from\s+['"]node:/m,
    /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bEventSource\b/, /\bsendBeacon\b/,
    /import\(\s*['"]/,
    /\b[a-z][a-z0-9+.-]*:\/\/|\bwww\./i,
    /process\.env/, /import\.meta\.env/, /\bprocess\.argv\b/,
  ];
  const hits = [];
  for (const f of allFiles(engineDir)) {
    const text = readFileSync(f, 'utf8');
    for (const p of patterns) if (p.test(text)) hits.push(`${path.relative(root, f)}: ${p}`);
  }
  assert.deepEqual(hits, []);
});

test('Task 1c: docs/engine/coordinator.js runs a tiny project when every Node file tool throws', () => {
  const script = `
    import { registerHooks } from 'node:module';
    const bomb = 'data:text/javascript,throw new Error("a Node file tool was used")';
    registerHooks({
      resolve(specifier, context, next) {
        if (specifier.startsWith('node:') && context.parentURL && context.parentURL.includes('/docs/engine/')) {
          return { url: bomb, shortCircuit: true };
        }
        return next(specifier, context);
      },
    });
    process.getBuiltinModule = () => { throw new Error('a Node file tool was used'); };
    const base = ${JSON.stringify(path.join(root, 'docs', 'engine'))};
    const { createProject, createItem } = await import(base + '/brain/brain.js');
    const { runPipeline } = await import(base + '/coordinator.js');
    const { makeRunData } = await import(base + '/viewer/make-run-data.js');
    const { makeSummaryHtml } = await import(base + '/summary/make-summary.js');
    const p = createProject({ name: 'Tiny', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }] }] });
    createItem(p, { kind: 'style', value: { detail: 'Oak floor' }, owner: 'Style' });
    const configs = ['Style', 'Layout', 'Builder', 'Reviewer'].map((name) => ({ name, enabled: true }));
    const result = runPipeline(p, { configs });
    const run = makeRunData(p, { rooms: { Kitchen: { width: 4, depth: 4 } }, gapBetweenRooms: 1, floorToFloorHeight: 3, wallHeight: 2.5, doorHeight: 2, windowHeight: 1.2, windowBottom: 0.9, furnitureHeight: 0.8, styleMarker: {} });
    const html = makeSummaryHtml(p);
    console.log(JSON.stringify({ ok: result.ok, log: p.runLog.map((e) => e.agent + ':' + e.event), floors: run.floors.length, hasHtml: typeof html === 'string' && html.length > 0 }));
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim().split('\n').at(-1));
  assert.equal(out.ok, true);
  assert.deepEqual(out.log, [
    'Style:started', 'Style:finished', 'Layout:started', 'Layout:finished',
    'Builder:started', 'Builder:finished', 'Reviewer:started', 'Reviewer:finished',
  ]);
  assert.equal(out.floors, 1);
  assert.equal(out.hasHtml, true);
});
