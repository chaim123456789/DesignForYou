// Tells Node where the page's imports go, the way the page's import map does in a browser.
import { registerHooks } from './register-hooks.js';

const here = (name) => new URL(name, import.meta.url).href;

export function installImportHooks() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'three') {
        const page = globalThis.__fakePage;
        return { url: here(page && page.failThreeImport ? 'broken-three.js' : 'three-shim.js'), shortCircuit: true };
      }
      if (specifier === './vendor/OrbitControls.js' && String(context.parentURL).includes('/docs/viewer.js')) {
        return { url: here('orbit-shim.js'), shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
}
