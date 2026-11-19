// A small stand-in for a browser page, built from the REAL docs/index.html.
// It is not a browser: it has no layout, no CSS and no graphics card. It only lets the real
// docs/viewer.js run against the real element ids, in the real order, so that mistakes in
// ids, set-up order and error handling show up in tests.
import { readFileSync } from 'node:fs';

const docs = new URL('../docs/', import.meta.url);
export const readDoc = (name) => readFileSync(new URL(name, docs), 'utf8');

export class FakeElement {
  constructor(page, tag, attributes = {}) {
    this.page = page;
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attributes };
    this.id = attributes.id || '';
    this.className = attributes.class || '';
    this.hidden = 'hidden' in attributes;
    this.disabled = 'disabled' in attributes;
    this.dataset = {};
    for (const [k, v] of Object.entries(attributes)) {
      if (k.startsWith('data-')) this.dataset[k.slice(5)] = v;
    }
    this.style = {};
    this.children = [];
    this.parent = null;
    this.listeners = {};
    this._text = '';
    this.min = attributes.min || '';
    this.max = attributes.max || '';
    this.value = attributes.value || '';
    this.type = attributes.type || '';
    this.checked = 'checked' in attributes;
  }

  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children.forEach((c) => { c.parent = null; }); this.children = []; }

  // Sizes: the 3D area is 900 x 600; a label is as wide as its text.
  get clientWidth() { return this.id === 'scene-area' || this.tagName === 'CANVAS' ? 900 : 100; }
  get clientHeight() { return this.id === 'scene-area' || this.tagName === 'CANVAS' ? 600 : 20; }
  get offsetWidth() { return Math.max(20, this.textContent.length * 7); }
  get offsetHeight() { return 20; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight }; }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  hasAttribute(name) { return name in this.attributes; }
  removeAttribute(name) { delete this.attributes[name]; }
  // Like a browser, focusing makes this the active element. A hidden element cannot take focus.
  focus() { if (!this.hidden && !this.disabled) this.page.document.activeElement = this; }
  // A click from the keyboard or mouse. A disabled control ignores it.
  click() { if (!this.disabled) this.dispatch('click'); }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  replaceChildren(...nodes) {
    this._text = '';
    this.children.forEach((c) => { c.parent = null; });
    this.children = [];
    nodes.forEach((n) => this.appendChild(n));
  }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }

  addEventListener(type, fn) {
    this.page.log.push(`listener:${this.id || this.tagName.toLowerCase()}:${type}`);
    if (this.page.failListenerOn === this.id && this.id) throw new Error(`cannot attach a listener to ${this.id}`);
    (this.listeners[type] ||= []).push(fn);
  }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }

  // Like a browser, one listener that throws does not stop the others: the error goes to the window.
  dispatch(type, event = {}) {
    const e = { type, target: this, preventDefault() {}, stopPropagation() {}, ...event };
    for (const fn of [...(this.listeners[type] || [])]) {
      try { fn(e); } catch (error) { this.page.window.dispatch('error', { error, message: error.message }); }
    }
    // Pointer events bubble up to the document, as in a browser (OrbitControls listens there while dragging).
    if (type.startsWith('pointer')) this.page.document.dispatch(type, e);
  }
  get ownerDocument() { return this.page.document; }
  getRootNode() { return this.page.document; }
  setPointerCapture() {}
  releasePointerCapture() {}
  hasPointerCapture() { return false; }
}

export function createFakePage({ sampleRunText = readDoc('sample-run.json') } = {}) {
  const html = readDoc('index.html');
  const page = {
    html,
    log: [],
    elements: [],
    byId: new Map(),
    missingIds: [],
    failCreate: [],       // element types that createElement refuses to make
    failListenerOn: null, // id of an element that refuses addEventListener
    failThreeImport: false,
    failRenderer: false,
    renders: 0,
    canvas: null,
    controls: null,
    consoleErrors: [],
  };

  for (const m of html.matchAll(/<(\w+)([^>]*\sid="[^"]+"[^>]*|[^>]*\sclass="[^"]*floor-button[^"]*"[^>]*)>/g)) {
    const attributes = {};
    for (const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attributes[a[1]] = a[2] ?? '';
    const el = new FakeElement(page, m[1], attributes);
    // Text inside simple elements such as buttons and the how-to line.
    const inner = html.slice(m.index + m[0].length).match(/^([^<]*)</);
    if (inner && m[1] === 'button') el._text = inner[1];
    const para = html.slice(m.index + m[0].length).match(/^<p>([^<]*)<\/p>/);
    if (para) el._text = para[1]; // e.g. the first line of the details panel
    page.elements.push(el);
    if (el.id) page.byId.set(el.id, el);
  }

  const windowListeners = {};
  page.window = {
    addEventListener(type, fn) { (windowListeners[type] ||= []).push(fn); },
    dispatch(type, event) { for (const fn of windowListeners[type] || []) fn(event); },
  };

  const documentListeners = {};
  page.document = {
    addEventListener(type, fn) { (documentListeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { documentListeners[type] = (documentListeners[type] || []).filter((f) => f !== fn); },
    dispatch(type, event) {
      for (const fn of [...(documentListeners[type] || [])]) {
        try { fn(event); } catch (error) { page.window.dispatch('error', { error, message: error.message }); }
      }
    },
    body: new FakeElement(page, 'body'),
    activeElement: null,
    title: 'Start - DesignForYou',
    getElementById(id) {
      const el = page.byId.get(id);
      if (!el) page.missingIds.push(id);
      return el || null;
    },
    querySelectorAll(selector) {
      if (!selector.startsWith('.')) throw new Error(`fake page only supports class selectors, got ${selector}`);
      const cls = selector.slice(1);
      const found = page.elements.filter((e) => e.className.split(/\s+/).includes(cls));
      if (found.length === 0) page.missingIds.push(selector);
      return found;
    },
    createElement(tag) {
      if (page.failCreate.includes(tag)) throw new Error(`cannot create a <${tag}> element`);
      return new FakeElement(page, tag);
    },
  };

  page.makeCanvas = () => {
    page.canvas = new FakeElement(page, 'canvas');
    return page.canvas;
  };

  page.el = (id) => page.byId.get(id);
  page.problemLines = () => {
    const box = page.el('error-message');
    return box.hidden ? [] : box.children.map((c) => c.textContent);
  };
  page.labels = () => page.el('scene-area').children.filter((c) => c.tagName === 'SPAN');

  page.fetch = async (url) => {
    page.log.push(`fetch:${url}`);
    if (url !== 'sample-run.json') return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => JSON.parse(sampleRunText) };
  };

  return page;
}

const KEYS = ['document', 'window', 'fetch', 'ResizeObserver', '__fakePage'];

// Put the fake page where viewer.js looks for the browser, run, then take it away again.
export function installFakePage(page) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  Object.defineProperty(globalThis, 'document', { value: page.document, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'window', { value: page.window, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'fetch', { value: page.fetch, configurable: true, writable: true });
  Object.defineProperty(globalThis, '__fakePage', { value: page, configurable: true, writable: true });
  // A real ResizeObserver reports once as soon as it starts watching.
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: class {
      constructor(callback) { this.callback = callback; }
      observe() { page.log.push('resize-observer'); queueMicrotask(() => this.callback([])); }
    },
  });
  const realError = console.error;
  console.error = (...args) => { page.consoleErrors.push(args.map(String).join(' ')); };
  return () => {
    console.error = realError;
    for (const k of KEYS) {
      if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k];
    }
  };
}

// Let the page script run until a condition holds (or give up).
export async function waitFor(condition, what, tries = 400) {
  for (let i = 0; i < tries; i += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`gave up waiting for: ${what}`);
}
