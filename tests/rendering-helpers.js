import { installDOM } from './helpers.js';

// Allocation/disposal spies for CPU regressions; these do not emulate WebGL.
export function installRendering() {
  const dom = installDOM();
  const allocations = { geometries: [], materials: [], batches: [] };
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
    copy(other) { return this.set(other.x, other.y, other.z); }
    clone() { return new Vector3(this.x, this.y, this.z); }
    add(other) { return this.set(this.x + other.x, this.y + other.y, this.z + other.z); }
    toArray() { return [this.x, this.y, this.z]; }
    project() { return this; }
  }
  class Color {
    constructor(hex = 0xffffff) { this.hex = hex; }
    setHex(hex) { this.hex = hex; return this; }
    copy(other) { return this.setHex(other.hex); }
    clone() { return new Color(this.hex); }
    getHex() { return this.hex; }
  }
  class Object3D {
    constructor() {
      this.children = [];
      this.parent = null;
      this.position = new Vector3();
      this.rotation = new Vector3();
      this.scale = new Vector3(1, 1, 1);
      this.visible = true;
      this.name = '';
      this.userData = {};
      // Quaternion snapshots restore Euler state without duplicating Three.js math.
      this.quaternion = {
        clone: () => ({ rotation: this.rotation.toArray() }),
        copy: snapshot => { this.rotation.set(...snapshot.rotation); }
      };
    }
    add(...children) {
      children.forEach(child => {
        child.parent?.remove(child);
        child.parent = this;
        this.children.push(child);
      });
    }
    remove(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) { this.children.splice(index, 1); child.parent = null; }
    }
    clear() { [...this.children].forEach(child => this.remove(child)); }
    traverse(fn) { fn(this); this.children.forEach(child => child.traverse(fn)); }
    getObjectByName(name) {
      if (this.name === name) return this;
      for (const child of this.children) {
        const found = child.getObjectByName(name);
        if (found) return found;
      }
    }
    lookAt() {}
    updateMatrix() {
      this.matrix = { position: this.position.toArray(), rotation: this.rotation.toArray(), scale: this.scale.toArray() };
    }
  }
  class Geometry {
    constructor(...args) {
      this.args = args;
      this.disposals = 0;
      allocations.geometries.push(this);
    }
    dispose() { this.disposals++; }
  }
  class Material {
    constructor(options = {}) {
      this.options = options;
      Object.assign(this, { opacity: 1, transparent: false }, options);
      this.color = new Color(options.color ?? 0xffffff);
      this.disposals = 0;
      allocations.materials.push(this);
    }
    clone() {
      return new this.constructor({ ...this.options, color: this.color.getHex(),
        emissive: this.emissive?.getHex(), emissiveIntensity: this.emissiveIntensity });
    }
    dispose() { this.disposals++; }
  }
  class MeshStandardMaterial extends Material {
    constructor(options = {}) {
      super(options);
      this.emissive = new Color(options.emissive ?? 0);
      this.emissiveIntensity = options.emissiveIntensity ?? 1;
    }
  }
  class MeshBasicMaterial extends Material {}
  class Mesh extends Object3D {
    constructor(geometry, material) { super(); this.isMesh = true; this.geometry = geometry; this.material = material; }
  }
  const buffer = count => ({ count, version: 0, setUsage(usage) { this.usage = usage; },
    set needsUpdate(value) { if (value) this.version++; } });
  class InstancedMesh extends Mesh {
    constructor(geometry, material, count) {
      super(geometry, material);
      this.count = count;
      this.matrices = [];
      this.colors = [];
      this.instanceMatrix = buffer(count);
      this.instanceColor = null;
      this.disposals = 0;
      allocations.batches.push(this);
    }
    setMatrixAt(index, matrix) { this.matrices[index] = structuredClone(matrix); }
    setColorAt(index, color) {
      this.instanceColor ??= buffer(this.count);
      if (index < this.instanceColor.count) this.colors[index] = color.getHex();
    }
    dispose() { this.disposals++; }
  }
  class Light extends Object3D {
    constructor(color, intensity, distance) {
      super();
      this.color = new Color(color);
      this.intensity = intensity;
      this.distance = distance;
      this.target = new Object3D();
      this.shadow = { mapSize: {}, bias: 0 };
    }
  }
  class WebGLRenderer {
    constructor({ canvas }) { this.canvas = canvas; this.shadowMap = {}; this.disposals = 0; }
    setPixelRatio() {}
    setSize(width, height) { Object.assign(this.canvas, { width, height }); }
    render() {}
    dispose() { this.disposals++; }
  }
  globalThis.THREE = {
    Object3D, Group: Object3D, Scene: Object3D, Vector3, Color, Mesh, InstancedMesh,
    MeshBasicMaterial, MeshStandardMaterial,
    AmbientLight: Light, PointLight: Light, DirectionalLight: Light,
    PerspectiveCamera: Object3D, FogExp2: class {}, WebGLRenderer,
    DoubleSide: 2, DynamicDrawUsage: 35048, PCFSoftShadowMap: 2, ACESFilmicToneMapping: 4
  };
  for (const name of ['BoxGeometry', 'CylinderGeometry', 'ConeGeometry', 'SphereGeometry',
    'RingGeometry', 'CircleGeometry', 'TorusGeometry', 'DodecahedronGeometry', 'PlaneGeometry']) {
    THREE[name] = class extends Geometry {};
  }
  const labels = [];
  const ctx = {
    clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
    fillText(text) { labels.push(text); }
  };
  dom.elements.get('textCanvas').getContext = () => ctx;
  window.devicePixelRatio = 1;
  window.location = { search: '' };
  return { ...dom, allocations, labels };
}

export function enemy(name = 'Hopping Jiangshi', overrides = {}) {
  return { name, alive: true, renderX: 380, renderY: 380, isMoving: false,
    isWindingUp: false, moveTimer: 0, moveDuration: 0.3, invulnerableTimer: 0,
    hits: 2, maxHits: 2, ...overrides };
}

export function materialsOf(mesh) {
  const materials = new Set();
  mesh.traverse(node => {
    const list = Array.isArray(node.material) ? node.material : [node.material];
    list.forEach(material => { if (material) materials.add(material); });
  });
  return [...materials];
}
