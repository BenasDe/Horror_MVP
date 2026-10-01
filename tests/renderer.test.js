import test from 'node:test';
import assert from 'node:assert/strict';
import { ThreePagodaRenderer } from '../js/threeRenderer.js';

const resource = () => ({ disposals: 0, dispose() { this.disposals++; } });
const group = (children = []) => ({
  children, visible: false,
  traverse(fn) { fn(this); this.children.forEach(child => child.traverse ? child.traverse(fn) : fn(child)); },
  clear() { this.children = []; }
});

function rendererFixture() {
  const renderer = Object.create(ThreePagodaRenderer.prototype);
  Object.assign(renderer, {
    boneMat: resource(), jadeMat: resource(), crimsonMat: resource(), wardMat: resource(),
    scene: { removed: [], remove(mesh) { this.removed.push(mesh); } },
    screenShake: 8, shakeOffset: { set(...values) { this.values = values; } },
    camera: { position: { copy(position) { this.value = position; } }, lookAt() {} },
    baseCameraPos: {}, cameraTarget: {}, bossLight: { intensity: 2.4 },
    playerFlashTimer: 1, playerGroup: group(),
    playerGroundRing: { material: { color: { setHex(hex) { this.hex = hex; } } } },
    flashingMeshes: new Map(), enemyMeshMap: new Map(),
    bloodParticles: [], boneDebris: [], torchEmbers: [],
    floatingTexts: [{ text: 'old run' }], emberSpawnTimer: 1,
    tileMeshes: [], textCtx: { clearRect() {} }
  });
  return renderer;
}

test('transient disposal frees unique resources once and preserves shared floor materials', () => {
  const renderer = rendererFixture();
  const geometry = resource();
  const material = resource();
  renderer.disposeTransientMesh(group([
    { geometry, material }, { geometry, material: [material, renderer.boneMat] }
  ]));
  assert.equal(geometry.disposals, 1);
  assert.equal(material.disposals, 1);
  assert.equal(renderer.boneMat.disposals, 0);
});

test('renderer reset clears old entities, hazards, particles, boss light and visual effects', () => {
  const renderer = rendererFixture();
  const enemyGeo = resource();
  const enemyMat = resource();
  const enemyMesh = group([{ geometry: enemyGeo, material: enemyMat }]);
  renderer.enemyMeshMap.set({}, enemyMesh);
  renderer.flashingMeshes.set(enemyMesh, 1);
  const particleMat = resource();
  const particle = group([{ geometry: resource(), material: particleMat }]);
  renderer.bloodParticles.push({ mesh: particle });
  const overlay = group([{ geometry: resource(), material: renderer.wardMat }]);
  renderer.tileMeshes = [[{ overlayGroup: overlay, cacheKey: 'old hazard' }]];
  renderer.resetTransientState();
  assert.equal(renderer.bossLight.intensity, 0);
  assert.equal(renderer.screenShake, 0);
  assert.equal(renderer.playerFlashTimer, 0);
  assert.equal(renderer.playerGroup.visible, true);
  assert.deepEqual(renderer.shakeOffset.values, [0, 0, 0]);
  assert.equal(renderer.enemyMeshMap.size, 0);
  assert.equal(renderer.flashingMeshes.size, 0);
  assert.equal(renderer.floatingTexts.length, 0);
  assert.equal(renderer.bloodParticles.length, 0);
  assert.equal(overlay.children.length, 0);
  assert.equal(renderer.tileMeshes[0][0].cacheKey, null);
  assert.equal(enemyGeo.disposals, 1);
  assert.equal(enemyMat.disposals, 1);
  assert.equal(particleMat.disposals, 1);
  assert.equal(renderer.wardMat.disposals, 0);
  renderer.resetTransientState();
  assert.equal(enemyGeo.disposals, 1);
});

test('a removed Emperor extinguishes the boss light and releases its resources', () => {
  const renderer = rendererFixture();
  const geometry = resource();
  const material = resource();
  renderer.enemyMeshMap.set({ alive: false }, group([{ geometry, material }]));
  renderer.syncEnemies([]);
  assert.equal(renderer.bossLight.intensity, 0);
  assert.equal(renderer.enemyMeshMap.size, 0);
  assert.equal(geometry.disposals, 1);
  assert.equal(material.disposals, 1);
});
