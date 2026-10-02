import test from 'node:test';
import assert from 'node:assert/strict';
import { PagodaGrid } from '../js/grid.js';
import { TILE_STATUS } from '../js/config.js';
import { ThreePagodaRenderer } from '../js/threeRenderer.js';
import { RenderResources } from '../js/rendering/RenderResources.js';
import { ParticleSystem, PARTICLE_LIMITS } from '../js/rendering/ParticleSystem.js';
import { installRendering, enemy, materialsOf } from './rendering-helpers.js';

function rendererFixture(search = '') {
  const env = installRendering();
  window.location.search = search;
  const grid = new PagodaGrid();
  const renderer = new ThreePagodaRenderer(env.elements.get('gameCanvas'), grid);
  return { ...env, grid, renderer };
}

test('resource ownership preserves shared resources and releases unique resources exactly once', () => {
  installRendering();
  const resources = new RenderResources();
  const geometry = resources.geometry('BoxGeometry', 1, 2, 3);
  assert.equal(resources.geometry('BoxGeometry', 1, 2, 3), geometry);
  assert.notEqual(resources.geometry('BoxGeometry', 1, 3, 2), geometry);
  const shared = resources.material('bone', 'MeshStandardMaterial', { color: 0xe8ded2 });
  const unique = new THREE.MeshStandardMaterial();
  const uniqueGeometry = new THREE.SphereGeometry(1);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, [unique, shared]), new THREE.Mesh(uniqueGeometry, unique));
  resources.disposeObject(group);
  resources.disposeObject(group);
  assert.equal(geometry.disposals, 0);
  assert.equal(shared.disposals, 0);
  assert.equal(uniqueGeometry.disposals, 1);
  assert.equal(unique.disposals, 1);
  resources.dispose();
  resources.dispose();
  assert.equal(geometry.disposals, 1);
  assert.equal(shared.disposals, 1);
  assert.throws(() => resources.geometry('BoxGeometry', 1), /disposed/);
});

test('telegraph ticks and owner changes reuse a ring while retaining enemy color priority', () => {
  const { grid, renderer, allocations } = rendererFixture();
  const tile = grid.tiles[2][3];
  tile.telegraphs.player = { active: true, timer: 3 };
  tile.telegraphs.enemy = { active: true, timer: 3 };
  renderer.syncTiles();
  const holder = renderer.tileMeshes[2][3];
  const ring = holder.overlays.ring;
  const counts = [allocations.geometries.length, allocations.materials.length, renderer.tiles.overlayCreations];
  assert.equal(ring.material.color.getHex(), 0xff334b);
  for (let frame = 0; frame < 180; frame++) {
    tile.telegraphs.enemy.timer = 3 - frame / 60;
    renderer.syncTiles();
  }
  tile.telegraphs.enemy.active = false;
  renderer.syncTiles();
  assert.equal(holder.overlays.ring, ring);
  assert.equal(ring.material.color.getHex(), 0x10b981);
  assert.deepEqual([allocations.geometries.length, allocations.materials.length, renderer.tiles.overlayCreations], counts);
  tile.telegraphs.player.active = false;
  renderer.syncTiles();
  assert.equal(holder.overlayGroup.visible, false);
  assert.equal(ring.visible, false);
  renderer.dispose();
});

test('layered hazards survive resets without losing shapes or rebuilding warm overlays', () => {
  const { renderer, grid, allocations } = rendererFixture();
  const tile = grid.tiles[4][4];
  const showEffects = () => {
    tile.status = TILE_STATUS.INACCESSIBLE;
    tile.effects.player = { status: TILE_STATUS.DAMAGING };
    tile.effects.enemy = { status: TILE_STATUS.DAMAGING };
    tile.telegraphs.enemy = { active: true, timer: 2 };
    renderer.syncTiles();
    const overlays = renderer.tileMeshes[4][4].overlays;
    assert.equal(overlays.bone.children.length, 2);
    assert.equal(overlays.playerSpikes.children.length, 5);
    assert.equal(overlays.enemySpikes.children.length, 5);
    for (const name of ['bone', 'playerSpikes', 'enemySpikes', 'ring']) assert.equal(overlays[name].visible, true);
    tile.effects.player.status = TILE_STATUS.SHIELDED;
    renderer.syncTiles();
    assert.equal(overlays.ward.visible, true);
    assert.equal(overlays.playerSpikes.visible, false);
    assert.equal(overlays.enemySpikes.visible, true);
  };
  showEffects();
  const counts = [allocations.geometries.length, allocations.materials.length, renderer.tiles.overlayCreations];
  for (let floor = 0; floor < 100; floor++) {
    grid.reset();
    renderer.resetTransientState();
    assert.equal(renderer.tileMeshes[4][4].overlayGroup.visible, false);
    showEffects();
  }
  assert.deepEqual([allocations.geometries.length, allocations.materials.length, renderer.tiles.overlayCreations], counts);
  renderer.dispose();
});

test('particle bursts use three bounded batches and recycle records without GPU resource churn', () => {
  const { renderer, allocations } = rendererFixture();
  const counts = [allocations.geometries.length, allocations.materials.length];
  const particles = renderer.particles;
  particles.spawnBlood(0, 0, 1000);
  for (let i = 0; i < 30; i++) particles.spawnBones(0, 0);
  for (let i = 0; i < 100; i++) particles.spawnEmber();
  particles.sync();
  assert.equal(allocations.batches.length, 3);
  assert.equal(particles.blood.dropped, 1000 - PARTICLE_LIMITS.blood);
  assert.equal(particles.bones.dropped, 30 * 14 - PARTICLE_LIMITS.bones);
  assert.equal(particles.embers.dropped, 100 - PARTICLE_LIMITS.embers);
  const records = new Set(particles.batches.flatMap(batch => batch.active));
  for (const batch of particles.batches) {
    assert.equal(batch.active.length, batch.limit);
    assert.equal(batch.mesh.count, batch.limit);
    assert.equal(batch.mesh.frustumCulled, false);
    assert.equal(batch.mesh.instanceMatrix.usage, THREE.DynamicDrawUsage);
    if (batch.colored) {
      assert.equal(batch.mesh.instanceColor.count, batch.limit);
      assert.equal(batch.mesh.colors[batch.limit - 1], batch.active[batch.limit - 1].color);
    }
  }
  for (let iteration = 0; iteration < 100; iteration++) {
    particles.reset();
    particles.spawnBlood(0, 0, 256);
    for (let i = 0; i < 14; i++) particles.spawnBones(0, 0);
    for (let i = 0; i < 36; i++) particles.spawnEmber();
    particles.update(0.01);
    particles.sync();
    particles.batches.forEach(batch => batch.active.forEach(record => assert.ok(records.has(record))));
  }
  assert.deepEqual([allocations.geometries.length, allocations.materials.length], counts);
  particles.batches.forEach(batch => assert.equal(batch.allocated, batch.limit));
  renderer.dispose();
});

test('expired particles compact transforms and colors together, and zero dt freezes effects', () => {
  installRendering();
  const resources = new RenderResources();
  const scene = new THREE.Scene();
  const boneMat = resources.material('bone', 'MeshStandardMaterial', {});
  const particles = new ParticleSystem(scene, resources, boneMat, { blood: 3, bones: 14, embers: 1 });
  particles.spawnBlood(0, 0, 3);
  particles.sync();
  const [first, middle, last] = particles.blood.active;
  first.color = 0x123456;
  last.x = 5; last.color = 0xabcdef;
  middle.life = 0.001;
  const oldPosition = first.x;
  const oldLife = first.life;
  particles.update(0);
  assert.equal(first.x, oldPosition);
  assert.equal(first.life, oldLife);
  assert.equal(particles.embers.active.length, 0);
  particles.update(0.01);
  particles.sync();
  assert.deepEqual(particles.blood.active, [first, last]);
  assert.equal(particles.blood.mesh.count, 2);
  assert.equal(particles.blood.mesh.colors[1], last.color);
  assert.deepEqual(particles.blood.mesh.matrices[1].position, [last.x, last.y, last.z]);
  assert.equal(particles.blood.free[0], middle);
  particles.spawnBlood(0, 0, 1);
  assert.equal(particles.blood.active[2], middle);
  particles.reset();
  assert.equal(particles.blood.mesh.count, 0);
  assert.equal(particles.blood.mesh.visible, false);
  particles.dispose();
  particles.dispose();
  particles.spawnEmber();
  particles.batches.forEach(batch => assert.equal(batch.mesh.disposals, 1));
  resources.dispose();
});

test('enemy models restore animated poses and materials before reuse on another floor', () => {
  const { renderer, allocations } = rendererFixture();
  const moving = enemy('Hopping Jiangshi', { isMoving: true, moveTimer: 0.15 });
  renderer.entities.syncEnemies([moving], 1);
  const mesh = renderer.enemyMeshMap.get(moving);
  const sleeve = mesh.getObjectByName('leftSleeve');
  assert.notEqual(sleeve.rotation.x, 0);
  moving.isMoving = false;
  moving.isWindingUp = true;
  renderer.entities.syncEnemies([moving], 1);
  renderer.flashEnemyHit(moving);
  assert.equal(mesh.scale.y, 0.68);
  assert.equal(mesh.getObjectByName('dangerRing').material.color.getHex(), 0xffaa00);
  const counts = [allocations.geometries.length, allocations.materials.length, renderer.entities.modelsCreated];
  renderer.resetTransientState();
  assert.equal(renderer.flashingMeshes.size, 0);
  assert.deepEqual(mesh.scale.toArray(), [1, 1, 1]);
  assert.equal(sleeve.rotation.x, 0);
  assert.equal(mesh.getObjectByName('foreheadTalisman').rotation.x, -0.15);
  for (let floor = 0; floor < 100; floor++) {
    const next = enemy();
    renderer.entities.syncEnemies([next], 2);
    assert.equal(renderer.enemyMeshMap.get(next), mesh);
    assert.equal(mesh.getObjectByName('dangerRing').material.color.getHex(), 0xff2244);
    renderer.resetTransientState();
  }
  assert.deepEqual([allocations.geometries.length, allocations.materials.length, renderer.entities.modelsCreated], counts);
  renderer.dispose();
});

test('hit flashes remain local to a model and restore materials shared within crowns and swords', () => {
  const { renderer } = rendererFixture();
  const scribe = enemy('Corpse Scribe');
  const other = enemy('Corpse Scribe');
  const boss = enemy('Corpse Emperor', { invulnerableTimer: 2 });
  renderer.entities.syncEnemies([scribe, other, boss], 1);
  const otherMaterials = materialsOf(renderer.enemyMeshMap.get(other));
  const original = otherMaterials.map(material => material.emissive?.getHex());
  renderer.flashEnemyHit(scribe);
  assert.equal(renderer.boneMat.emissive.getHex(), 0);
  assert.deepEqual(otherMaterials.map(material => material.emissive?.getHex()), original);
  const crown = materialsOf(renderer.enemyMeshMap.get(boss)).find(material => material.color.getHex() === 0xfbbf24 && material.emissive?.getHex() === 0xd97706);
  const blade = renderer.playerSword.children[0].material;
  for (let hit = 0; hit < 3; hit++) {
    renderer.flashEnemyHit(boss);
    renderer.flashPlayerHit();
    assert.equal(crown.emissive.getHex(), 0xffffff);
    assert.equal(blade.emissive.getHex(), 0xffffff);
    renderer.entities.update(0.1);
    assert.equal(crown.emissive.getHex(), 0xd97706);
    assert.equal(crown.emissiveIntensity, 0.6);
    assert.equal(blade.emissive.getHex(), 0x00e5ff);
    assert.equal(blade.emissiveIntensity, 1.4);
  }
  renderer.dispose();
});

test('inactive model pools are bounded and overflow releases only model-owned materials', () => {
  const { renderer, allocations } = rendererFixture();
  const enemies = Array.from({ length: 12 }, () => enemy());
  renderer.entities.syncEnemies(enemies, 1);
  const models = [...renderer.enemyMeshMap.values()];
  const overflow = models.slice(8).flatMap(materialsOf);
  renderer.resetTransientState();
  assert.equal(renderer.entities.stats().pooled, 8);
  assert.equal(renderer.enemyMeshMap.size, 0);
  assert.ok(allocations.geometries.every(geometry => geometry.disposals === 0));
  assert.ok(overflow.every(material => material.disposals === 1));
  const retained = models.slice(0, 8).flatMap(materialsOf);
  assert.ok(retained.every(material => material.disposals === 0));
  renderer.dispose();
  assert.ok(allocations.materials.every(material => material.disposals === 1));
});

test('transient reset clears old hazards, effects, entities and boss light while retaining caches', () => {
  const { renderer, grid, allocations } = rendererFixture();
  const boss = enemy('Corpse Emperor', { invulnerableTimer: 2 });
  renderer.entities.syncEnemies([boss], 1);
  const mesh = renderer.enemyMeshMap.get(boss);
  assert.equal(renderer.bossLight.intensity, 2.4);
  renderer.flashEnemyHit(boss);
  renderer.flashPlayerHit();
  renderer.playerGroup.visible = false;
  renderer.triggerShake(8);
  renderer.shakeOffset.set(1, 2, 3);
  renderer.spawnBloodParticles(380, 380);
  renderer.spawnBoneShatterDebris(4, 4);
  renderer.addFloatingText('old floor', 10, 10);
  grid.tiles[0][0].telegraphs.enemy = { active: true, timer: 1 };
  renderer.syncTiles();
  renderer.resetTransientState();
  assert.equal(renderer.playerGroup.visible, true);
  assert.equal(renderer.playerFlashTimer, 0);
  assert.equal(renderer.bossLight.intensity, 0);
  assert.equal(renderer.screenShake, 0);
  assert.deepEqual(renderer.shakeOffset.toArray(), [0, 0, 0]);
  assert.equal(renderer.enemyMeshMap.size, 0);
  assert.equal(renderer.flashingMeshes.size, 0);
  assert.equal(renderer.floatingTexts.length, 0);
  assert.equal(renderer.bloodParticles.length, 0);
  assert.equal(renderer.boneDebris.length, 0);
  assert.equal(renderer.torchEmbers.length, 0);
  assert.equal(renderer.tileMeshes[0][0].overlayGroup.visible, false);
  assert.ok(allocations.geometries.every(geometry => geometry.disposals === 0));
  renderer.entities.syncEnemies([enemy('Corpse Emperor')], 1);
  assert.equal([...renderer.enemyMeshMap.values()][0], mesh);
  assert.equal(mesh.getObjectByName('immunityBarrier').visible, false);
  renderer.syncEnemies([]);
  assert.equal(renderer.bossLight.intensity, 0);
  renderer.dispose();
});

test('final disposal releases all cached, active and pooled resources exactly once and removes resize listener', () => {
  const { renderer, allocations } = rendererFixture();
  renderer.syncEnemies([enemy(), enemy('Corpse Scribe'), enemy('Corpse Emperor')]);
  renderer.resetTransientState();
  renderer.syncEnemies([enemy('Resentful Wraith')]);
  const shadow = { disposals: 0, dispose() { this.disposals++; } };
  renderer.scene.children.find(node => node.shadow).shadow.map = shadow;
  let resizeCalls = 0;
  renderer.handleResize = () => resizeCalls++;
  window.dispatchEvent(new Event('resize'));
  assert.equal(resizeCalls, 1);
  renderer.dispose();
  window.dispatchEvent(new Event('resize'));
  renderer.dispose();
  renderer.update(0.1);
  renderer.render(null, []);
  assert.equal(resizeCalls, 1);
  assert.equal(shadow.disposals, 1);
  assert.equal(renderer.renderer.disposals, 1);
  assert.equal(renderer.scene.children.length, 0);
  assert.equal(renderer.resources.geometries.size, 0);
  assert.equal(renderer.resources.materials.size, 0);
  for (const list of Object.values(allocations)) assert.ok(list.every(resource => resource.disposals === 1));
});

test('diagnostics are opt-in and report batch, model and resource counts', () => {
  const { renderer, labels } = rendererFixture('?renderStats=1');
  renderer.syncEnemies([enemy('Corpse Scribe')]);
  renderer.spawnBloodParticles(380, 380, 10);
  renderer.render(null, []);
  const stats = renderer.getPerformanceStats();
  assert.equal(stats.activeModels, 0);
  assert.equal(stats.pooledModels, 1);
  assert.equal(stats.modelCreations, 1);
  assert.equal(stats.particles.blood.active, 10);
  assert.equal(stats.geometryCreations, stats.cachedGeometries);
  assert.equal(stats.materialCreations, stats.cachedMaterials);
  assert.ok(labels.some(label => label.startsWith('Draw calls:')));
  renderer.dispose();
  const normal = rendererFixture();
  normal.renderer.render(null, []);
  assert.equal(normal.labels.length, 0);
  normal.renderer.dispose();
});
