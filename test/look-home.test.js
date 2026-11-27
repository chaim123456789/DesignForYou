// Look-and-feel Task L2: the home page. A headline, one sentence about what DesignForYou does, "Try the sample" and "Start my own project",
// and the honest line that the design team is rule-based and AI is off. It feels like a showcase: a large light headline and calm motion that
// stops for "reduce motion".
// What these tests CANNOT show: whether it feels like a showcase on a real screen, how the motion looks, the type on a real display. Pending owner check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readDoc } from '../test-helpers/fake-page.js';
import { withLook } from '../test-helpers/look-page.js';
import { FIXED_SENTENCE } from '../docs/intake/report.js';

const html = readDoc('index.html');
const css = readDoc('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
const home = html.slice(html.indexOf('<div id="screen-start"'), html.indexOf('<div id="workspace"'));
const text = (markup) => markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

test('L2: the home page has a headline, one sentence about what DesignForYou does, and exactly two buttons: "Try the sample" and "Start my own project"', () => {
  assert.equal((home.match(/<h1[\s>]/g) || []).length, 1);
  const headline = /<h1 id="heading-start" tabindex="-1">([^<]+)<\/h1>/.exec(home)[1];
  assert.equal(headline, 'Design your home with taste, without CAD.');
  const about = text(/<p id="start-about"[^>]*>([\s\S]*?)<\/p>/.exec(home)[1]);
  assert.match(about, /^DesignForYou turns your notes and measurements into a draft of your home in 3D/);
  assert.equal((about.match(/[.!?](\s|$)/g) || []).length, 1, `one sentence: ${about}`);
  assert.deepEqual([...home.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]), ['Try the sample', 'Start my own project']);
  assert.equal((home.match(/<(a|input|select|textarea)\b/g) || []).length, 0, 'no other control on the home page');
  assert.match(home, /<p id="start-privacy">It needs no login, and nothing you enter leaves your browser\.<\/p>/);
});

test('L2: the home page says honestly that the design team is rule-based and AI is off, with the exact fixed sentence once', () => {
  assert.match(home, /<p id="start-ai-off" class="honest-chip">AI is off in this version\.<\/p>/);
  assert.ok(home.includes(`<p id="start-fixed-rules">${FIXED_SENTENCE}</p>`));
  assert.equal(html.split(FIXED_SENTENCE).length - 1, 1, 'the sentence is on the page once');
  assert.match(home, /Nothing is saved\. If you close or reload this page, everything you entered is lost\./);
  // Both honest lines come after the two buttons and before the end of the home page, in one block.
  const honest = home.slice(home.indexOf('class="home-honest"'));
  assert.ok(honest.includes('start-ai-off') && honest.includes('start-fixed-rules') && honest.includes('start-lost'));
  // It does not claim what the app does not do: no word that suggests the rules understand, learn or design.
  assert.doesNotMatch(text(home), /\b(smart|intelligent|learns?|understands?|AI-powered|powered by AI)\b/i);
});

test('L2: the home page and the workspace are never on screen together; "Try the sample" opens the workspace with the sample; the DesignForYou button comes back', async () => {
  await withLook({}, async (page) => {
    assert.equal(page.el('screen-start').hidden, false);
    assert.equal(page.el('workspace').hidden, true);
    assert.equal(page.document.body.dataset.screen, 'start');
    page.el('choose-sample').click();
    assert.equal(page.el('screen-start').hidden, true);
    assert.equal(page.el('workspace').hidden, false);
    assert.equal(page.el('screen-result').hidden, false);
    assert.equal(page.el('workspace-project-name').textContent, 'Sample two-storey home');
    page.el('home-button').click();
    assert.equal(page.el('screen-start').hidden, false);
    assert.equal(page.el('workspace').hidden, true);
    page.el('choose-own').click();
    assert.equal(page.el('workspace').hidden, false);
    assert.equal(page.el('screen-setup').hidden, false);
    assert.equal(page.document.title, 'Project setup - DesignForYou');
    page.el('rail-agents').click();
    assert.equal(page.document.title, 'Agents - DesignForYou');
    page.el('rail-project').click();
    assert.equal(page.document.title, 'Project setup - DesignForYou', 'the title goes back to the step');
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L2: the headline is large and light, from the theme: the hero size, the display weight and the display font', () => {
  const rule = (selector) => new RegExp(`(?:^|\\})\\s*${selector.replace(/[.#]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm').exec(css)[1];
  const h1 = rule('.home h1');
  assert.match(h1, /font-size: var\(--text-hero\)/);
  assert.match(h1, /line-height: var\(--leading-display\)/);
  assert.match(rule('h1, h2, h3'), /font-weight: var\(--weight-display\)/);
  assert.match(rule('h1, h2, h3'), /font-family: var\(--font-display\)/);
  const theme = readDoc('theme.css');
  assert.match(theme, /--text-hero: clamp\(2\.75rem, 7\.5vw, 6\.25rem\);/);
  assert.match(theme, /--weight-display: 300;/);
  // Thin fine lines and generous spacing, from the theme.
  assert.match(rule('.home-honest'), /border-top: var\(--line-width\) solid var\(--line\)/);
  assert.match(rule('.home-inner'), /gap: var\(--space-5\)/);
});

test('L2: the calm motion of the home page (a slow glow and a gentle rise) is in the stylesheet, and "reduce motion" switches all of it off', () => {
  assert.match(css, /\.home-glow \{[^}]*animation: glow-drift var\(--dur-glow\) ease-in-out infinite alternate;/);
  assert.match(css, /\.home-inner > \* \{ animation: rise var\(--dur-slow\) var\(--ease\) both; \}/);
  for (let n = 2; n <= 6; n += 1) assert.match(css, new RegExp(`\\.home-inner > :nth-child\\(${n}\\) \\{ animation-delay: calc\\(var\\(--stagger\\) \\* ${n - 1}\\); \\}`));
  assert.equal((html.slice(html.indexOf('<div class="home-inner">'), html.indexOf('<div id="workspace"')).match(/<(p|h1|div)\b[^>]*>/g) || []).length >= 6, true);
  const reduce = /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{([^}]*)\}/.exec(css);
  assert.match(reduce[1], /animation: none !important;/);
  // The glow is decoration: hidden from a screen reader and never in the way of a click.
  assert.match(home, /<div class="home-glow" aria-hidden="true"><\/div>/);
  assert.match(css, /\.home-glow \{[^}]*pointer-events: none;/);
});

test('L2: the home page needs no outside image or font, and on a short screen it scrolls inside itself, not the page', () => {
  assert.doesNotMatch(home, /<img\b|url\(|https?:\/\//);
  assert.match(css, /\.home \{[^}]*overflow-y: auto;[^}]*overflow-x: hidden;/);
  assert.match(css, /\.home \{[^}]*flex: 1 1 auto;[^}]*min-height: 0;/);
  assert.match(css, /\.home-inner \{[^}]*margin-block: auto;/, 'content is centred when it fits and starts at the top when it does not');
});
