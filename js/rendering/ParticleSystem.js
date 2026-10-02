/** Three instanced batches replace per-particle meshes, geometries and materials. */
export const PARTICLE_LIMITS = Object.freeze({ blood: 256, bones: 196, embers: 36 });
const CORNERS = [[-8.6, -8.6], [8.6, -8.6], [-8.6, 8.6], [8.6, 8.6]];

class ParticleBatch {
  constructor(scene, geometry, material, limit, colored) {
    this.scene = scene;
    this.limit = limit;
    this.colored = colored;
    this.active = [];
    this.free = [];
    this.allocated = 0;
    this.dropped = 0;
    this.dirty = true;
    this.mesh = new THREE.InstancedMesh(geometry, material, limit);
    // r128 does not calculate a bounding sphere from individual instance transforms.
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (colored) {
      // r128 sizes the color buffer from mesh.count on its first setColorAt call.
      this.mesh.setColorAt(0, new THREE.Color(0xffffff));
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.mesh.count = 0;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  acquire() {
    if (this.active.length >= this.limit) {
      this.dropped++;
      return null;
    }
    const particle = this.free.pop() || this.createParticle();
    this.active.push(particle);
    this.dirty = true;
    return particle;
  }

  createParticle() {
    this.allocated++;
    return {};
  }

  releaseAt(index) {
    const particle = this.active[index];
    const last = this.active.pop();
    if (index < this.active.length) this.active[index] = last;
    this.free.push(particle);
    this.dirty = true;
  }

  reset() {
    while (this.active.length) this.free.push(this.active.pop());
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.dirty = true;
  }

  sync(transform, color) {
    if (!this.dirty) return;
    this.active.forEach((particle, index) => {
      transform.position.set(particle.x, particle.y, particle.z);
      transform.rotation.set(particle.rx, particle.ry, particle.rz);
      transform.scale.set(particle.sx, particle.sy, particle.sz);
      transform.updateMatrix();
      this.mesh.setMatrixAt(index, transform.matrix);
      if (this.colored) this.mesh.setColorAt(index, color.setHex(particle.color));
    });
    this.mesh.count = this.active.length;
    this.mesh.visible = this.mesh.count > 0;
    if (this.mesh.count > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.colored) this.mesh.instanceColor.needsUpdate = true;
    }
    this.dirty = false;
  }

  stats() {
    return { active: this.active.length, pooled: this.free.length,
      allocated: this.allocated, limit: this.limit, dropped: this.dropped };
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose(); // Releases the per-instance GPU buffers in Three.js r128.
    this.active.length = 0;
    this.free.length = 0;
  }
}

export class ParticleSystem {
  constructor(scene, resources, boneMat, limits = PARTICLE_LIMITS) {
    this.transform = new THREE.Object3D();
    this.color = new THREE.Color();
    this.disposed = false;
    const droplet = resources.geometry('DodecahedronGeometry', 1);
    const fragment = resources.geometry('BoxGeometry', 1, 1, 1);
    const bloodMat = resources.material('particle:blood', 'MeshBasicMaterial', { color: 0xffffff });
    const emberMat = resources.material('particle:ember', 'MeshBasicMaterial', { color: 0xffffff });
    this.blood = new ParticleBatch(scene, droplet, bloodMat, limits.blood, true);
    this.bones = new ParticleBatch(scene, fragment, boneMat, limits.bones, false);
    this.embers = new ParticleBatch(scene, droplet, emberMat, limits.embers, true);
    this.batches = [this.blood, this.bones, this.embers];
    this.emberSpawnTimer = 0;
  }

  spawnBlood(x, z, count) {
    if (this.disposed) return;
    for (let i = 0; i < count; i++) {
      const particle = this.blood.acquire();
      if (!particle) {
        this.blood.dropped += count - i - 1;
        break;
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.5;
      const size = 0.08 + Math.random() * 0.08;
      particle.color = Math.random() > 0.3 ? 0xc1121f : 0xff334b;
      particle.x = x; particle.y = 0.4; particle.z = z;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = 2.5 + Math.random() * 3.5;
      particle.vz = Math.sin(angle) * speed;
      particle.sx = particle.sy = particle.sz = size;
      particle.rx = particle.ry = particle.rz = 0;
      particle.life = 0.8;
    }
  }

  spawnBones(x, z) {
    if (this.disposed) return;
    for (let i = 0; i < 14; i++) {
      const particle = this.bones.acquire();
      if (!particle) {
        this.bones.dropped += 14 - i - 1;
        break;
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.0;
      particle.sx = particle.sz = 0.12;
      particle.sy = 0.22 + Math.random() * 0.18;
      particle.x = x + (Math.random() - 0.5) * 0.6;
      particle.y = 0.4;
      particle.z = z + (Math.random() - 0.5) * 0.6;
      particle.rx = Math.random() * Math.PI;
      particle.ry = Math.random() * Math.PI;
      particle.rz = Math.random() * Math.PI;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = 3.5 + Math.random() * 4.0;
      particle.vz = Math.sin(angle) * speed;
      particle.rvx = Math.random() * 12;
      particle.rvy = Math.random() * 12;
      particle.life = 1.4;
    }
  }

  spawnEmber() {
    if (this.disposed) return;
    const particle = this.embers.acquire();
    if (!particle) return;
    const [x, z] = CORNERS[Math.floor(Math.random() * CORNERS.length)];
    const size = 0.04 + Math.random() * 0.03;
    particle.color = Math.random() > 0.4 ? 0xffb703 : 0xfb8500;
    particle.x = x + (Math.random() - 0.5) * 0.35;
    particle.y = 1.45 + Math.random() * 0.2;
    particle.z = z + (Math.random() - 0.5) * 0.35;
    particle.vx = (Math.random() - 0.5) * 0.35;
    particle.vy = 0.75 + Math.random() * 0.85;
    particle.vz = (Math.random() - 0.5) * 0.35;
    particle.sx = particle.sy = particle.sz = size;
    particle.rx = particle.ry = particle.rz = 0;
    particle.life = 1.8 + Math.random() * 0.8;
  }

  update(dt) {
    if (this.disposed || dt <= 0) return;
    this.emberSpawnTimer += dt;
    if (this.emberSpawnTimer > 0.08 && this.embers.active.length < this.embers.limit) {
      this.emberSpawnTimer = 0;
      this.spawnEmber();
    }
    for (const batch of this.batches) {
      if (batch.active.length) batch.dirty = true;
      for (let i = batch.active.length - 1; i >= 0; i--) {
        const particle = batch.active[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.z += particle.vz * dt;
        if (batch === this.blood) {
          particle.vy -= 18 * dt;
          if (particle.y <= 0.05) {
            particle.y = 0.05;
            particle.vx *= 0.6;
            particle.vz *= 0.6;
          }
        } else if (batch === this.bones) {
          particle.vy -= 22 * dt;
          particle.rx += particle.rvx * dt;
          particle.ry += particle.rvy * dt;
          if (particle.y <= 0.08) {
            particle.y = 0.08;
            particle.vy = -particle.vy * 0.42;
            particle.vx *= 0.7;
            particle.vz *= 0.7;
            particle.rvx *= 0.6;
          }
        } else {
          particle.sx *= 0.985;
          particle.sy *= 0.985;
          particle.sz *= 0.985;
        }
        particle.life -= dt;
        if (particle.life <= 0) batch.releaseAt(i);
      }
    }
  }

  sync() {
    if (this.disposed) return;
    for (const batch of this.batches) batch.sync(this.transform, this.color);
  }

  reset() {
    this.blood.reset();
    this.bones.reset();
    this.embers.reset();
    this.emberSpawnTimer = 0;
  }

  stats() { return { blood: this.blood.stats(), bones: this.bones.stats(), embers: this.embers.stats() }; }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.blood.dispose();
    this.bones.dispose();
    this.embers.dispose();
  }
}
