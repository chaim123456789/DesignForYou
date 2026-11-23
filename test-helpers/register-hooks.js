// Gives the tests `registerHooks` from node:module, or stops with a clear message on a Node that lacks it.
//
// Why a namespace import: `import { registerHooks } from 'node:module'` is checked before any code runs, so on an
// older Node it fails with a SyntaxError that does not say what to do. A namespace import always loads, so this
// file can look first and explain.
import * as nodeModule from 'node:module';

export const MIN_NODE = '22.15.0';

// Pure, so it can be tested. Returns the message to show, or null when all is well.
export function nodeProblem(hasRegisterHooks, nodeVersion) {
  if (hasRegisterHooks) return null;
  return `These tests need Node ${MIN_NODE} or newer. You have ${nodeVersion}.`;
}

const problem = nodeProblem(typeof nodeModule.registerHooks === 'function', process.versions.node);
if (problem) {
  console.error(problem);
  process.exit(1);
}

export const registerHooks = nodeModule.registerHooks;
