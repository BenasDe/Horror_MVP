import { PlayerModel } from './PlayerModel.js';
import { EnemyModelFactory } from './EnemyModelFactory.js';

const POOL_LIMITS = Object.freeze({
  'Hopping Jiangshi': 8, 'Resentful Wraith': 8, 'Corpse Scribe': 8, 'Corpse Emperor': 1
});

/** Models retain geometry; each pooled enemy owns its mutable materials. */
export class EntityRenderer {
  constructor(host, resources, environment, boneMat) {
    this.host = host;
    this.scene = host.scene;
    this.grid = host.grid;
    this.resources = resources;
    this.playerLight = environment.playerLight;
    this.bossLight = environment.bossLight;
    const playerModel = new PlayerModel(this.scene, resources);
    for (const key of ['playerGroup', 'playerGroundRing', 'playerFacingArrow', 'playerHitBeads', 'playerSword', 'playerSash']) {
      this[key] = playerModel[key];
    }
    this.factory = new EnemyModelFactory(resources, boneMat);
    this.enemyMeshMap = new Map();
    this.pools = new Map(Object.keys(POOL_LIMITS).map(name => [name, []]));
    this.modelDefaults = new WeakMap();
    this.flashDefaults = new WeakMap();
    this.flashingMeshes = new Map();
    this.playerFlashTimer = 0;
    this.modelsCreated = 0;
  }

  captureModel(mesh) {
    const nodes = [];
    const materials = new Map();
    mesh.traverse(node => {
      nodes.push({ node, position: node.position.clone(), quaternion: node.quaternion.clone(),
        scale: node.scale.clone(), visible: node.visible });
      const list = Array.isArray(node.material) ? node.material : [node.material];
      list.forEach(material => {
        if (material && !materials.has(material)) {
          materials.set(material, { color: material.color?.clone(), emissive: material.emissive?.clone(),
            emissiveIntensity: material.emissiveIntensity, opacity: material.opacity });
        }
      });
    });
    this.modelDefaults.set(mesh, { nodes, materials });
  }

  restoreModel(mesh) {
    const defaults = this.modelDefaults.get(mesh);
    for (const state of defaults.nodes) {
      state.node.position.copy(state.position);
      state.node.quaternion.copy(state.quaternion);
      state.node.scale.copy(state.scale);
      state.node.visible = state.visible;
    }
    for (const [material, state] of defaults.materials) {
      if (state.color) material.color.copy(state.color);
      if (state.emissive) {
        material.emissive.copy(state.emissive);
        material.emissiveIntensity = state.emissiveIntensity;
      }
      material.opacity = state.opacity;
    }
  }

  getOrCreateEnemyMesh(enemy) {
    if (this.enemyMeshMap.has(enemy)) return this.enemyMeshMap.get(enemy);
    let mesh = this.pools.get(enemy.name)?.pop();
    if (!mesh) {
      mesh = this.factory.create(enemy);
      this.captureModel(mesh);
      this.modelsCreated++;
    }
    this.scene.add(mesh);
    this.enemyMeshMap.set(enemy, mesh);
    return mesh;
  }

  release(enemy) {
    const mesh = this.enemyMeshMap.get(enemy);
    if (!mesh) return;
    this.restoreMeshFlash(mesh);
    this.flashingMeshes.delete(mesh);
    this.scene.remove(mesh);
    this.enemyMeshMap.delete(enemy);
    this.restoreModel(mesh);
    const pool = this.pools.get(enemy.name);
    if (pool && pool.length < POOL_LIMITS[enemy.name]) pool.push(mesh);
    else this.resources.disposeObject(mesh);
  }

  flashMesh(mesh) {
    mesh.traverse(node => {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        if (!material?.emissive) return;
        // Store defaults by material so multi-mesh crowns/swords restore correctly.
        if (!this.flashDefaults.has(material)) this.flashDefaults.set(material, {
          emissive: material.emissive.clone(), intensity: material.emissiveIntensity
        });
        material.emissive.setHex(0xffffff);
        material.emissiveIntensity = 2.4;
      });
    });
  }

  restoreMeshFlash(mesh) {
    mesh.traverse(node => {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        const original = material && this.flashDefaults.get(material);
        if (original) {
          material.emissive.copy(original.emissive);
          material.emissiveIntensity = original.intensity;
        }
      });
    });
  }

  flashPlayerHit() {
    this.playerFlashTimer = 0.09;
    this.flashMesh(this.playerGroup);
  }

  flashEnemyHit(enemy) {
    const mesh = this.enemyMeshMap.get(enemy);
    if (!mesh) return;
    this.flashMesh(mesh);
    this.flashingMeshes.set(mesh, 0.09);
  }

  update(dt) {
    if (this.playerFlashTimer > 0) {
      this.playerFlashTimer -= dt;
      if (this.playerFlashTimer <= 0) this.restoreMeshFlash(this.playerGroup);
    }
    for (const [mesh, timer] of this.flashingMeshes) {
      const remaining = timer - dt;
      if (remaining <= 0) {
        this.restoreMeshFlash(mesh);
        this.flashingMeshes.delete(mesh);
      } else this.flashingMeshes.set(mesh, remaining);
    }
  }

  gridToWorld(x, y) { return this.host.gridToWorld(x, y); }

  syncPlayer(player, now) {
    if (!player) return;

    // Convert player render coordinates (subtract grid padding to center on tile)
    const gx = (player.renderX - this.grid.padding) / this.grid.tileSize;
    const gy = (player.renderY - this.grid.padding) / this.grid.tileSize;
    const w = this.gridToWorld(gx, gy);

    // Floating spirit bob
    const bob = Math.sin(now * 5) * 0.08;
    this.playerGroup.position.set(w.x, bob, w.z);

    // Pulse player tactical ground ring
    if (this.playerGroundRing) {
      const ringPulse = 1.0 + Math.sin(now * 3.5) * 0.05;
      this.playerGroundRing.scale.set(ringPulse, ringPulse, ringPulse);
    }

    // Soul Point Light follows cultivator
    this.playerLight.position.set(w.x, 2.4, w.z);

    // Facing arrow orientation
    const angle = Math.atan2(player.facing.dx, player.facing.dy);
    this.playerFacingArrow.position.set(player.facing.dx * 0.75, 0.35, player.facing.dy * 0.75);
    this.playerFacingArrow.rotation.z = -angle;

    // Secondary motion: Floating spirit flying sword (飞剑)
    if (this.playerSword) {
      const swBob = Math.sin(now * 3.5) * 0.06;
      this.playerSword.position.y = 1.35 + swBob;
      this.playerSword.rotation.y = -angle + Math.PI * 0.5;
    }

    // Secondary motion: Flowing twin silk sash
    if (this.playerSash) {
      const sashSway = Math.sin(now * 5.5) * 0.12;
      this.playerSash.rotation.x = Math.PI * 0.1 + (player.isMoving ? 0.35 : 0) + sashSway;
    }

    // Orbiting Soul Hit Beads
    const hits = player.currentHits;
    this.playerHitBeads.forEach((bead, i) => {
      if (i < hits) {
        bead.visible = true;
        const bAngle = now * 3 + (i * (Math.PI * 2 / Math.max(1, hits)));
        bead.position.set(Math.cos(bAngle) * 0.85, 0.8, Math.sin(bAngle) * 0.85);
      } else {
        bead.visible = false;
      }
    });

    // Invulnerability display
    if (player.isInvulnerable) {
      if (player.queensRuinCheck) {
        // Divine golden barrier aura during Queen's Ruin (keep player fully visible)
        this.playerGroup.visible = true;
        if (this.playerGroundRing) {
          this.playerGroundRing.material.color.setHex(0xffd15c);
        }
      } else {
        this.playerGroup.visible = Math.floor(Date.now() / 80) % 2 === 0;
        if (this.playerGroundRing) {
          this.playerGroundRing.material.color.setHex(0x00f0ff);
        }
      }
    } else {
      this.playerGroup.visible = true;
      if (this.playerGroundRing) {
        this.playerGroundRing.material.color.setHex(0x00f0ff);
      }
    }
  }

  syncEnemies(enemies, now) {
    this.bossLight.intensity = 0;
    const active = new Set(enemies);
    for (const enemy of this.enemyMeshMap.keys()) {
      if (!active.has(enemy) || !enemy.alive) this.release(enemy);
    }
    enemies.forEach(enemy => {
      if (!enemy.alive) return;
      const mesh = this.getOrCreateEnemyMesh(enemy);

      // Convert enemy render coordinates (subtract grid padding to center on tile)
      const gx = (enemy.renderX - this.grid.padding) / this.grid.tileSize;
      const gy = (enemy.renderY - this.grid.padding) / this.grid.tileSize;
      const w = this.gridToWorld(gx, gy);

      // Animate ground danger combat ring
      const dangerRing = mesh.getObjectByName("dangerRing");
      if (dangerRing) {
        if (enemy.isWindingUp) {
          const wp = 1.0 + Math.sin(Date.now() / 60) * 0.2;
          dangerRing.scale.set(wp, wp, wp);
          dangerRing.material.color.setHex(0xffaa00); // Flashing orange warning during attack windup!
        } else {
          dangerRing.scale.set(1.0, 1.0, 1.0);
          dangerRing.material.color.setHex(enemy.name === "Corpse Emperor" ? 0xff1133 : 0xff2244);
        }
      }

      // 3D Parabolic Hop Animation for Jiangshi
      let hopY = 0;
      if (enemy.name === "Hopping Jiangshi") {
        const talis = mesh.getObjectByName("foreheadTalisman");
        const leftSleeve = mesh.getObjectByName("leftSleeve");
        const rightSleeve = mesh.getObjectByName("rightSleeve");

        if (enemy.isMoving) {
          const hopProgress = Math.min(1, Math.max(0, enemy.moveTimer / enemy.moveDuration));
          hopY = Math.sin(hopProgress * Math.PI) * 1.35; // True parabolic jump arc!
          mesh.scale.set(1.0, 1.0, 1.0);

          // Dynamic Talisman Flutter: blows backward in the wind during jump arc
          if (talis) {
            talis.rotation.x = -0.15 - Math.sin(hopProgress * Math.PI) * 0.55;
          }
          // Sleeve sway with hop
          if (leftSleeve && rightSleeve) {
            const slRot = Math.sin(hopProgress * Math.PI) * 0.3;
            leftSleeve.rotation.x = slRot;
            rightSleeve.rotation.x = slRot;
          }
        } else if (enemy.isWindingUp) {
          mesh.scale.set(1.25, 0.68, 1.25); // Windup crouch squish!
          if (talis) talis.rotation.x = 0.1;
        } else {
          mesh.scale.set(1.0, 1.0, 1.0);
          if (talis) talis.rotation.x = -0.15;
          if (leftSleeve && rightSleeve) {
            leftSleeve.rotation.x = 0;
            rightSleeve.rotation.x = 0;
          }
        }
      } else if (enemy.name === "Resentful Wraith") {
        hopY = 0.3 + Math.sin(Date.now() / 250) * 0.12;
      } else if (enemy.name === "Corpse Scribe") {
        // Orbiting Skull Spirit Orbs Rotation
        const orbs = mesh.getObjectByName("scribeOrbs");
        if (orbs) {
          orbs.rotation.y = now * 2.2;
        }
      } else if (enemy.name === "Corpse Emperor") {
        // Boss light position
        this.bossLight.intensity = 2.4;
        this.bossLight.position.set(w.x, 3.5, w.z);

        // Immunity barrier toggle
        const barrier = mesh.getObjectByName("immunityBarrier");
        if (barrier) {
          if (enemy.invulnerableTimer > 0) {
            barrier.visible = true;
            const pulse = (Math.sin(Date.now() / 90) + 1) * 0.1;
            barrier.scale.set(1.0 + pulse, 1.0 + pulse, 1.0 + pulse);
          } else {
            barrier.visible = false;
          }
        }
      }

      mesh.position.set(w.x, hopY, w.z);
    });
  }

  reset() {
    this.playerFlashTimer = 0;
    this.restoreMeshFlash(this.playerGroup);
    this.playerGroup.visible = true;
    this.playerGroundRing.material.color.setHex(0x00f0ff);
    for (const enemy of this.enemyMeshMap.keys()) this.release(enemy);
    this.flashingMeshes.clear();
    this.bossLight.intensity = 0;
  }

  stats() {
    return { active: this.enemyMeshMap.size, pooled: [...this.pools.values()].reduce((sum, pool) => sum + pool.length, 0),
      created: this.modelsCreated };
  }

  dispose() {
    this.reset();
    for (const pool of this.pools.values()) {
      pool.forEach(mesh => this.resources.disposeObject(mesh));
      pool.length = 0;
    }
  }
}
