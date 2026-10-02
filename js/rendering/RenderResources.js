/** One renderer owns the shared GPU resources for its entire lifetime. */
export class RenderResources {
  constructor() {
    this.geometries = new Map();
    this.materials = new Map();
    this.sharedGeometries = new Set();
    this.sharedMaterials = new Set();
    this.disposedResources = new WeakSet();
    this.geometryCreations = 0;
    this.materialCreations = 0;
    this.disposed = false;
  }

  geometry(type, ...args) {
    if (this.disposed) throw new Error('Render resources have been disposed');
    const key = `${type}:${JSON.stringify(args)}`;
    if (!this.geometries.has(key)) {
      const geometry = new THREE[type](...args);
      this.geometries.set(key, geometry);
      this.sharedGeometries.add(geometry);
      this.geometryCreations++;
    }
    return this.geometries.get(key);
  }

  material(key, type, options) {
    if (this.disposed) throw new Error('Render resources have been disposed');
    if (!this.materials.has(key)) {
      const material = new THREE[type](options);
      this.materials.set(key, material);
      this.sharedMaterials.add(material);
      this.materialCreations++;
    }
    return this.materials.get(key);
  }

  disposeOnce(resource) {
    if (!this.disposedResources.has(resource)) {
      resource.dispose();
      this.disposedResources.add(resource);
    }
  }

  disposeObject(root) {
    // Entity-specific materials may be released without invalidating shared geometry.
    root.traverse(object => {
      if (object.geometry && !this.sharedGeometries.has(object.geometry)) this.disposeOnce(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (material && !this.sharedMaterials.has(material)) this.disposeOnce(material);
      });
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.sharedGeometries.forEach(resource => this.disposeOnce(resource));
    this.sharedMaterials.forEach(resource => this.disposeOnce(resource));
    this.geometries.clear();
    this.materials.clear();
    this.sharedGeometries.clear();
    this.sharedMaterials.clear();
  }
}
