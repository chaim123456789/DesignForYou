// Test only. Stands in for docs/intake/build-brain.js on the page, so a test can make one agent fail.
// Everything else is the real file. Set globalThis.__agentsOverride = { Layout: () => { throw new Error('x'); } }.
import * as real from '../docs/intake/build-brain.js';
export * from '../docs/intake/build-brain.js';
export function runDesignTeam(state, options = {}) {
  return real.runDesignTeam(state, { ...options, agents: { ...(options.agents || {}), ...(globalThis.__agentsOverride || {}) } });
}
