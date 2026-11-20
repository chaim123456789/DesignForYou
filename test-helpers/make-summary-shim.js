// Test only. Stands in for the engine's make-summary.js on the page, so a test can plant a faulty summary.
// globalThis.__summaryMode = 'unescaped': the text is not escaped (raw "<" in the HTML string).
// globalThis.__summaryMode = 'throws': the summary fails.
import { makeSummaryHtml as real } from '../docs/engine/summary/make-summary.js';
export function makeSummaryHtml(project) {
  const html = real(project);
  if (globalThis.__summaryMode === 'throws') throw new Error('the summary broke');
  if (globalThis.__summaryMode === 'unescaped') return html.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"');
  return html;
}
