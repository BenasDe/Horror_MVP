import { readFileSync } from 'node:fs';

class ClassList extends Set {
  remove(...names) { names.forEach(name => this.delete(name)); }
  contains(name) { return this.has(name); }
  toggle(name, force = !this.has(name)) {
    if (force) this.add(name);
    else this.delete(name);
    return force;
  }
}

export class Element extends EventTarget {
  constructor(tag = 'DIV', classes = '') {
    super();
    this.tagName = tag.toUpperCase();
    this.classList = new ClassList(classes.split(/\s+/).filter(Boolean));
    this.style = {};
    this.children = [];
    this.dataset = {};
    this.textContent = '';
    this.disabled = false;
  }
  set innerHTML(value) { this.children = []; this.html = value; }
  get innerHTML() { return this.html || ''; }
  appendChild(child) { this.children.push(child); return child; }
}

export function installDOM() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const elements = new Map();
  for (const [tag, name] of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*>/gi)) {
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    if (!id) continue;
    const el = new Element(name, tag.match(/\bclass="([^"]*)"/)?.[1]);
    el.id = id;
    elements.set(id, el);
  }
  const doc = new EventTarget();
  doc.hidden = false;
  doc.getElementById = id => {
    if (!elements.has(id)) throw new Error(`Unknown DOM id: ${id}`);
    return elements.get(id);
  };
  doc.createElement = tag => new Element(tag);
  doc.querySelectorAll = selector => [...elements.values()].filter(el => el.classList.contains(selector.slice(1)));
  globalThis.document = doc;
  globalThis.window = new EventTarget();
  window.AudioContext = FakeAudioContext;
  globalThis.requestAnimationFrame = () => 1;
  return { elements, doc };
}

export function dispatch(target, type, props = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, props);
  target.dispatchEvent(event);
  return event;
}

export function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

class AudioParam {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime() {}
  linearRampToValueAtTime() {}
  cancelScheduledValues() {}
}

export class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.sampleRate = 100;
    this.destination = {};
    this.nodes = [];
  }
  node() {
    const node = {
      connections: [], frequency: new AudioParam(), gain: new AudioParam(), Q: new AudioParam(),
      starts: [], stops: [],
      connect(target) { this.connections.push(target); },
      disconnect() { this.connections = []; },
      start(time) { this.starts.push(time); },
      stop(time) { this.stops.push(time); }
    };
    this.nodes.push(node);
    return node;
  }
  createGain() { return this.node(); }
  createOscillator() { return this.node(); }
  createBiquadFilter() { return this.node(); }
  createBufferSource() { return this.node(); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
