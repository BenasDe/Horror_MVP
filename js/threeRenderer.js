/** WebGL diorama orchestration. Gameplay continues to use the same renderer API. */
import { RenderResources } from './rendering/RenderResources.js';
import { TileRenderer } from './rendering/TileRenderer.js';
import { SceneEnvironment } from './rendering/SceneEnvironment.js';
import { EntityRenderer } from './rendering/EntityRenderer.js';
import { ParticleSystem } from './rendering/ParticleSystem.js';
import { CombatOverlay } from './rendering/CombatOverlay.js';

export class ThreePagodaRenderer {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.grid = grid;
    this.textCanvas = document.getElementById('textCanvas');
    this.textCtx = this.textCanvas ? this.textCanvas.getContext('2d') : null;
    this.TILE_SIZE = 1.8;
    this.screenShake = 0;
    this.shakeOffset = new THREE.Vector3();
    this.projectedVector = new THREE.Vector3();
    this.resources = new RenderResources();
    this.disposed = false;
    this.debugStats = new URLSearchParams(window.location?.search || '').get('renderStats') === '1';
    this.initThree();

    this.tiles = new TileRenderer(this.scene, grid, this.resources, this.TILE_SIZE);
    this.tileMeshes = this.tiles.holders;
    this.jadeMat = this.tiles.materials.jade;
    this.crimsonMat = this.tiles.materials.crimson;
    this.boneMat = this.tiles.materials.bone;
    this.wardMat = this.tiles.materials.ward;
    this.environment = new SceneEnvironment(this.scene, this.resources, this.TILE_SIZE);
    for (const key of ['playerLight', 'bossLight', 'brazierLights', 'spiritFogPlanes']) this[key] = this.environment[key];
    this.entities = new EntityRenderer(this, this.resources, this.environment, this.boneMat);
    for (const key of ['playerGroup', 'playerGroundRing', 'playerFacingArrow', 'playerHitBeads', 'playerSword', 'playerSash', 'enemyMeshMap', 'flashingMeshes']) {
      this[key] = this.entities[key];
    }
    this.particles = new ParticleSystem(this.scene, this.resources, this.boneMat);
    this.bloodParticles = this.particles.blood.active;
    this.boneDebris = this.particles.bones.active;
    this.torchEmbers = this.particles.embers.active;
    this.overlay = new CombatOverlay(this);
    this.floatingTexts = this.overlay.floatingTexts;
  }

  get playerFlashTimer() { return this.entities.playerFlashTimer; }
  get emberSpawnTimer() { return this.particles.emberSpawnTimer; }

  initThree() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(760, 760);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07050b);
    this.scene.fog = new THREE.FogExp2(0x07050b, 0.022);
    this.camera = new THREE.PerspectiveCamera(40, 1.0, 0.1, 100);
    this.baseCameraPos = new THREE.Vector3(0, 26.5, 9.5);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(this.cameraTarget);
    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
    this.handleResize();
  }

  handleResize() {
    if (!this.canvas || this.disposed) return;
    if (this.renderer && (this.canvas.width !== 760 || this.canvas.height !== 760)) this.renderer.setSize(760, 760, false);
    if (this.textCanvas && (this.textCanvas.width !== 760 || this.textCanvas.height !== 760)) {
      this.textCanvas.width = 760;
      this.textCanvas.height = 760;
    }
  }

  gridToWorld(gx, gy) { return { x: (gx - 4) * this.TILE_SIZE, z: (gy - 4) * this.TILE_SIZE }; }

  worldToScreen(wx, wy, wz) {
    this.projectedVector.set(wx, wy, wz).project(this.camera);
    return { x: this.projectedVector.x * 380 + 380, y: -this.projectedVector.y * 380 + 380 };
  }

  triggerShake(intensity = 6) { this.screenShake = intensity; }
  getOrCreateEnemyMesh(enemy) { return this.entities.getOrCreateEnemyMesh(enemy); }
  disposeTransientMesh(root) { this.resources.disposeObject(root); }
  addFloatingText(text, x, y, color = '#ff334b', size = 13) { this.overlay.addFloatingText(text, x, y, color, size); }
  flashPlayerHit() { this.entities.flashPlayerHit(); }
  resetPlayerFlash() { this.entities.restoreMeshFlash(this.playerGroup); }
  flashEnemyHit(enemy) { this.entities.flashEnemyHit(enemy); }
  restoreMeshFlash(mesh) { this.entities.restoreMeshFlash(mesh); }

  spawnBloodParticles(x, y, count = 16) {
    const world = this.gridToWorld((x - this.grid.padding) / this.grid.tileSize, (y - this.grid.padding) / this.grid.tileSize);
    this.particles.spawnBlood(world.x, world.z, count);
  }

  spawnSpellShockwave(x, y, color = '#00f0ff') {
    this.triggerShake(4);
    this.spawnBloodParticles(x, y, 12);
  }

  spawnBoneShatterDebris(x, y) {
    const world = this.gridToWorld(x, y);
    this.particles.spawnBones(world.x, world.z);
  }

  resetTransientState() {
    this.screenShake = 0;
    this.shakeOffset.set(0, 0, 0);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(this.cameraTarget);
    this.entities.reset();
    this.particles.reset();
    this.tiles.reset();
    this.overlay.clear();
  }

  update(dt) {
    if (this.disposed) return;
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 18);
      this.shakeOffset.set(
        (Math.random() * 2 - 1) * this.screenShake * 0.08,
        (Math.random() * 2 - 1) * this.screenShake * 0.08,
        (Math.random() * 2 - 1) * this.screenShake * 0.08
      );
      this.camera.position.copy(this.baseCameraPos).add(this.shakeOffset);
    } else this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(this.cameraTarget);
    this.environment.update(dt, Date.now() / 1000);
    this.entities.update(dt);
    this.particles.update(dt);
    this.overlay.update(dt);
  }

  syncTiles() { this.tiles.sync(); }
  syncPlayer(player) { this.entities.syncPlayer(player, Date.now() / 1000); }
  syncEnemies(enemies) { this.entities.syncEnemies(enemies, Date.now() / 1000); }
  renderTextOverlay(player, enemies) { this.overlay.render(player, enemies); }

  render(player, enemies, activeFloorInfo) {
    if (this.disposed) return;
    const now = Date.now() / 1000;
    this.tiles.sync();
    this.entities.syncPlayer(player, now);
    this.entities.syncEnemies(enemies, now);
    this.particles.sync();
    this.renderer.render(this.scene, this.camera);
    this.overlay.render(player, enemies);
  }

  getPerformanceStats() {
    const info = this.renderer.info;
    const models = this.entities.stats();
    return {
      drawCalls: info?.render?.calls ?? 0, triangles: info?.render?.triangles ?? 0,
      gpuGeometries: info?.memory?.geometries ?? 0, textures: info?.memory?.textures ?? 0,
      programs: info?.programs?.length ?? 0,
      cachedGeometries: this.resources.geometries.size, cachedMaterials: this.resources.materials.size,
      geometryCreations: this.resources.geometryCreations, materialCreations: this.resources.materialCreations,
      tileOverlayCreations: this.tiles.overlayCreations,
      activeModels: models.active, pooledModels: models.pooled, modelCreations: models.created,
      particles: this.particles.stats()
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.resizeHandler);
    this.entities.dispose();
    this.particles.dispose();
    this.environment.dispose();
    this.overlay.clear();
    this.resources.disposeObject(this.scene);
    this.resources.dispose();
    this.scene.clear();
    this.renderer.dispose();
  }
}
