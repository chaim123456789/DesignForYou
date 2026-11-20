// Puts the summary on the page without ever inserting visitor text as page code.
//
// make-summary.js (the same file the tests use) builds the summary as one HTML string and escapes every
// piece of text it puts in. This file does NOT hand that string to the browser as HTML. It reads the
// string with a small strict reader and builds page elements itself: only a short list of tags, only the
// class names the summary uses, and every piece of text goes in as a text node. If anything else turns up
// (for example a tag that escaping should have turned into plain text), nothing is shown and an error
// is thrown, so the page shows its plain "could not be shown" message instead of the summary.
//
// No network, no storage. Imports nothing.

const TAGS = new Set(['p', 'h1', 'h2', 'ul', 'li', 'strong', 'table', 'tr', 'th', 'td']);
// The summary page has its own title (h1). Inside the result screen the headings sit one level lower.
const RENAME = { h1: 'h2', h2: 'h3' };
const CLASSES = new Set(['statement', 'label', 'locked', 'unsure']);
const ENTITIES = { lt: '<', gt: '>', quot: '"', amp: '&' };
// Either a tag with plain quoted attributes, or text with no "<" in it. Matched one after the other, with no gaps.
const TOKEN = /<(\/?)([a-z][a-z0-9]*)((?:\s+[a-z-]+="[^"<>]*")*)\s*>|([^<]+)/y;
const ATTRIBUTE = /\s+([a-z-]+)="([^"<>]*)"/g;

// The part of the summary page between <body> and </body>.
export function bodyOf(html) {
  const start = html.indexOf('<body>');
  const end = html.lastIndexOf('</body>');
  if (start === -1 || end === -1 || end < start) throw new Error('The summary is not in the expected form.');
  return html.slice(start + '<body>'.length, end);
}

const decode = (text) => text.replace(/&(lt|gt|quot|amp);/g, (_, name) => ENTITIES[name]);

// Returns a list of page elements. doc is the page's document (it only needs createElement and createTextNode).
export function summaryNodes(html, doc) {
  const source = bodyOf(html);
  const root = doc.createElement('div');
  const open = [{ tag: null, node: root }];
  let headers = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < source.length) {
    const at = TOKEN.lastIndex;
    const m = TOKEN.exec(source);
    if (!m || m.index !== at) throw new Error('The summary contains something that cannot be shown safely.');
    const [, closing, tag, attributes, text] = m;
    const top = open[open.length - 1];
    if (text !== undefined) {
      if (text.trim() === '') continue; // the line breaks between tags
      if (top.tag === null) throw new Error('The summary has text outside any block.');
      top.node.append(doc.createTextNode(decode(text)));
      continue;
    }
    if (!TAGS.has(tag)) throw new Error(`The summary contains a "${tag}" tag, which is not allowed.`);
    if (closing) {
      if (top.tag !== tag) throw new Error('The summary tags do not match.');
      open.pop();
      if (tag === 'tr') {
        // Each cell remembers its column heading, so a narrow screen can show it next to the value.
        const cells = Array.from(top.node.children);
        if (cells.length > 0 && cells.every((c) => c.tagName === 'TH')) headers = cells.map((c) => c.textContent);
        else cells.forEach((c, i) => { if (headers[i]) c.setAttribute('data-label', headers[i]); });
      }
      continue;
    }
    if (tag === 'table') headers = [];
    const node = doc.createElement(RENAME[tag] || tag);
    for (const a of attributes.matchAll(ATTRIBUTE)) {
      if (a[1] !== 'class' || !CLASSES.has(a[2])) throw new Error('The summary contains an attribute that is not allowed.');
      node.className = `summary-${a[2]}`;
    }
    top.node.append(node);
    open.push({ tag, node });
  }
  if (open.length !== 1) throw new Error('The summary ends in the middle of a block.');
  return Array.from(root.children);
}
