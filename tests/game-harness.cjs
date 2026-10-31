const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A small DOM for deterministic game-logic tests. It uses the real HTML ids,
// attributes and children so missing markup or broken menu selectors still fail.
function createHarness(initialStorage = {}) {
  let document;
  const dataKey = name => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  class Element {
    constructor(tagName) {
      this.tagName = tagName.toLowerCase();
      this.attributes = {};
      this.dataset = {};
      this.children = [];
      this.parentNode = null;
      this.listeners = new Map();
      this.style = { setProperty(name, value) { this[name] = String(value); } };
      this.hidden = false;
      this.disabled = false;
      this.open = false;
      this.value = '';
      this._text = '';
      this.clientWidth = 1100;
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
        remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
        toggle: (name, force) => {
          const next = force ?? !this.classList.contains(name);
          this.classList[next ? 'add' : 'remove'](name);
          return next;
        }
      };
    }
    get id() { return this.attributes.id || ''; }
    set id(value) { this.setAttribute('id', value); }
    get className() { return this.attributes.class || ''; }
    set className(value) { this.attributes.class = String(value); }
    get firstElementChild() { return this.children[0] || null; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.replaceChildren(); this._text = String(value); }
    get innerHTML() { return this._html || ''; }
    set innerHTML(value) { this.replaceChildren(); this._html = String(value); parseInto(this, this._html); }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name.startsWith('data-')) this.dataset[dataKey(name)] = String(value);
      if (name === 'hidden') this.hidden = true;
      if (name === 'disabled') this.disabled = true;
      if (name === 'value') this.value = String(value);
    }
    getAttribute(name) {
      if (name.startsWith('data-')) return this.dataset[dataKey(name)] ?? null;
      return this.attributes[name] ?? null;
    }
    removeAttribute(name) {
      delete this.attributes[name];
      if (name.startsWith('data-')) delete this.dataset[dataKey(name)];
      if (name === 'hidden') this.hidden = false;
    }
    append(...nodes) {
      for (const node of nodes) {
        node.remove();
        node.parentNode = this;
        this.children.push(node);
      }
    }
    appendChild(node) { this.append(node); return node; }
    replaceChildren(...nodes) {
      for (const node of this.children) node.parentNode = null;
      this.children = [];
      this._text = '';
      this.append(...nodes);
    }
    remove() {
      if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
      this.parentNode = null;
    }
    cloneNode(deep) {
      const clone = new Element(this.tagName);
      for (const [name, value] of Object.entries(this.attributes)) clone.setAttribute(name, value);
      clone._text = this._text;
      if (deep) clone.append(...this.children.map(child => child.cloneNode(true)));
      return clone;
    }
    matches(selector) {
      return selector.split(',').some(part => {
        const simple = part.trim();
        const tag = simple.match(/^[\w-]+/)?.[0];
        if (tag && this.tagName !== tag) return false;
        for (const [, id] of simple.matchAll(/#([\w-]+)/g)) if (this.id !== id) return false;
        for (const [, name] of simple.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(name)) return false;
        for (const [, name, , value] of simple.matchAll(/\[([\w-]+)(?:=(['"]?)(.*?)\2)?\]/g)) {
          const actual = this.getAttribute(name);
          if (actual === null || value !== undefined && actual !== value) return false;
        }
        return true;
      });
    }
    querySelectorAll(selector) {
      const found = [];
      const walk = node => { for (const child of node.children) { if (child.matches(selector)) found.push(child); walk(child); } };
      walk(this);
      return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    dispatchEvent(event) {
      event.target ||= this;
      event.preventDefault ||= () => {};
      for (const listener of this.listeners.get(event.type) || []) listener(event);
      return true;
    }
    click() { this.dispatchEvent({ type: 'click', detail: 0 }); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    setPointerCapture() {}
    getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 480, bottom: 480, width: 480, height: 480 }; }
  }
  function parseInto(parent, source) {
    const clean = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    const stack = [parent];
    const voids = new Set(['meta', 'link', 'input', 'br', 'hr', 'img', 'source', 'wbr', 'area', 'base', 'embed', 'param', 'track']);
    for (const match of clean.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?([\w-]+)\b([^>]*?)>/g)) {
      if (!match[1]) continue;
      const name = match[1].toLowerCase();
      if (match[0].startsWith('</')) {
        const index = stack.findLastIndex(node => node.tagName === name);
        if (index > 0) stack.length = index;
        continue;
      }
      const node = new Element(name);
      for (const [, attribute, , value, unquoted] of match[2].matchAll(/([^\s=/'">]+)(?:\s*=\s*(?:(["'])(.*?)\2|([^\s>]+)))?/g)) node.setAttribute(attribute, value ?? unquoted ?? '');
      stack.at(-1).append(node);
      if (!voids.has(name) && !match[0].endsWith('/>')) stack.push(node);
    }
  }

  document = new Element('#document');
  const rendererRoot = path.resolve(__dirname, '..', 'frontend');
  parseInto(document, fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8'));
  document.getElementById = id => document.querySelector(`#${id}`);
  document.createElement = tag => new Element(tag);
  document.createElementNS = (_, tag) => new Element(tag);
  document.documentElement = document.querySelector('html');
  document.body = document.querySelector('body');
  document.hidden = false;
  const storage = new Map(Object.entries(initialStorage).map(([key, value]) => [key, String(value)]));
  const frames = new Map();
  let frameID = 0;
  const sandbox = {
    console, document,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    navigator: {},
    location: { protocol: 'file:', href: 'file:///neon-parry.html' },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    getComputedStyle: () => ({ paddingLeft: '0', paddingRight: '0', paddingTop: '0', paddingBottom: '0' }),
    visualViewport: { height: 900, addEventListener() {} },
    innerHeight: 900,
    requestAnimationFrame: callback => { const id = ++frameID; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { observe() {} },
    addEventListener() {},
    setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.top = sandbox;
  const context = vm.createContext(sandbox);
  const run = source => vm.runInContext(source, context, { timeout: 2000 });
  run(fs.readFileSync(path.join(rendererRoot, 'js', 'game.js'), 'utf8'));
  run(fs.readFileSync(path.join(rendererRoot, 'js', 'features.js'), 'utf8'));
  run(fs.readFileSync(path.join(rendererRoot, 'js', 'menu.js'), 'utf8'));
  return {
    run,
    plain: source => JSON.parse(JSON.stringify(run(source))),
    element: id => document.getElementById(id),
    storage,
    frames,
    snapshotStorage: () => Object.fromEntries(storage)
  };
}

module.exports = { createHarness };
