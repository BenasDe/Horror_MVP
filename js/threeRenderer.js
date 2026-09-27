/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * 3D WebGL Renderer: Three.js 2.5D Isometric Diorama
 * Real-time dynamic lights, 3D entities, bone shatter physics, and atmospheric fog
 */

import { TILE_STATUS } from './config.js';

export class ThreePagodaRenderer {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.grid = grid;
    this.textCanvas = document.getElementById('textCanvas');
    this.textCtx = this.textCanvas ? this.textCanvas.getContext('2d') : null;

    this.TILE_SIZE = 1.8;
    this.screenShake = 0;
    this.shakeOffset = new THREE.Vector3();

    this.floatingTexts = [];
    this.boneDebris = [];
    this.bloodParticles = [];

    this.initThree();
    this.initFloorTiles();
    this.initEnvironment();
    this.initEntityMeshes();
  }

  initThree() {
    // 1. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(760, 760);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // 2. Scene with dark volumetric pagoda fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07050b);
    this.scene.fog = new THREE.FogExp2(0x07050b, 0.022);

    // 3. Tilted Isometric Perspective Camera
    this.camera = new THREE.PerspectiveCamera(40, 1.0, 0.1, 100);
    this.baseCameraPos = new THREE.Vector3(0, 23.5, 17.5);
    this.cameraTarget = new THREE.Vector3(0, -0.6, 0.8);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(this.cameraTarget);

    // Window resize binding
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();
  }

  handleResize() {
    if (!this.canvas) return;
    const w = this.canvas.clientWidth || 760;
    const h = this.canvas.clientHeight || 760;
    if (this.renderer && (this.canvas.width !== 760 || this.canvas.height !== 760)) {
      this.renderer.setSize(760, 760, false);
    }
    if (this.textCanvas && (this.textCanvas.width !== 760 || this.textCanvas.height !== 760)) {
      this.textCanvas.width = 760;
      this.textCanvas.height = 760;
    }
  }

  gridToWorld(gx, gy) {
    return {
      x: (gx - 4) * this.TILE_SIZE,
      z: (gy - 4) * this.TILE_SIZE
    };
  }

  worldToScreen(wx, wy, wz) {
    const v = new THREE.Vector3(wx, wy, wz);
    v.project(this.camera);
    const hw = 760 * 0.5;
    const hh = 760 * 0.5;
    return {
      x: v.x * hw + hw,
      y: -v.y * hh + hh
    };
  }

  initEnvironment() {
    // Ambient Light (deep mystic violet)
    const ambient = new THREE.AmbientLight(0x281938, 0.95);
    this.scene.add(ambient);

    // Moonlight Directional Light
    const moon = new THREE.DirectionalLight(0x8fa8cf, 1.1);
    moon.position.set(12, 28, 14);
    moon.castShadow = true;
    moon.shadow.mapSize.width = 1024;
    moon.shadow.mapSize.height = 1024;
    moon.shadow.bias = -0.001;
    this.scene.add(moon);

    // 4 Corner Altar Braziers with Flickering Fire Lights
    this.brazierLights = [];
    const cornerPositions = [
      [-8.6, -8.6], [8.6, -8.6],
      [-8.6, 8.6], [8.6, 8.6]
    ];

    const brazierMat = new THREE.MeshStandardMaterial({ color: 0x1f192b, roughness: 0.8 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });

    cornerPositions.forEach(([bx, bz]) => {
      // Stone Brazier Stand
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 6), brazierMat);
      stand.position.set(bx, 0.6, bz);
      stand.castShadow = true;
      this.scene.add(stand);

      // Glowing flame core
      const flame = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2), flameMat);
      flame.position.set(bx, 1.35, bz);
      this.scene.add(flame);

      // Flickering Point Light
      const pLight = new THREE.PointLight(0xff3344, 1.6, 9);
      pLight.position.set(bx, 1.5, bz);
      this.scene.add(pLight);
      this.brazierLights.push({ light: pLight, baseIntensity: 1.6 });
    });

    // Player Soul Light (Follows player)
    this.playerLight = new THREE.PointLight(0x00f0ff, 1.6, 7);
    this.playerLight.position.set(0, 2.5, 0);
    this.scene.add(this.playerLight);

    // Emperor Demonic Light
    this.bossLight = new THREE.PointLight(0xff1133, 0, 10);
    this.bossLight.position.set(0, 3.0, 0);
    this.scene.add(this.bossLight);

    // Outer Pagoda Wall Curb (bordering the 9x9 arena)
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x130e1c, roughness: 0.9 });
    const wallThick = 0.5;
    const arenaSpan = 9 * this.TILE_SIZE + wallThick;

    const northCurb = new THREE.Mesh(new THREE.BoxGeometry(arenaSpan, 0.6, wallThick), curbMat);
    northCurb.position.set(0, 0.3, -4.5 * this.TILE_SIZE - wallThick * 0.5);
    this.scene.add(northCurb);

    const southCurb = new THREE.Mesh(new THREE.BoxGeometry(arenaSpan, 0.6, wallThick), curbMat);
    southCurb.position.set(0, 0.3, 4.5 * this.TILE_SIZE + wallThick * 0.5);
    this.scene.add(southCurb);

    const westCurb = new THREE.Mesh(new THREE.BoxGeometry(wallThick, 0.6, arenaSpan), curbMat);
    westCurb.position.set(-4.5 * this.TILE_SIZE - wallThick * 0.5, 0.3, 0);
    this.scene.add(westCurb);

    const eastCurb = new THREE.Mesh(new THREE.BoxGeometry(wallThick, 0.6, arenaSpan), curbMat);
    eastCurb.position.set(4.5 * this.TILE_SIZE + wallThick * 0.5, 0.3, 0);
    this.scene.add(eastCurb);
  }

  initFloorTiles() {
    this.tileMeshes = [];
    const ts = this.TILE_SIZE;

    // Shared geometries and materials for performance
    const slabGeo = new THREE.BoxGeometry(ts * 0.94, 0.3, ts * 0.94);
    const runeGeo = new THREE.BoxGeometry(ts * 0.35, 0.02, ts * 0.35);

    const matLight = new THREE.MeshStandardMaterial({ color: 0x1a1525, roughness: 0.85, metalness: 0.1 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x130f1c, roughness: 0.85, metalness: 0.1 });
    const runeMat = new THREE.MeshStandardMaterial({ color: 0x3d274d, roughness: 0.6 });

    // Shared Spike / Obstacle Materials
    this.jadeMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.85,
      roughness: 0.2
    });

    this.crimsonMat = new THREE.MeshStandardMaterial({
      color: 0xff2244,
      emissive: 0x990011,
      emissiveIntensity: 0.9,
      roughness: 0.3
    });

    this.boneMat = new THREE.MeshStandardMaterial({
      color: 0xe8ded2,
      roughness: 0.65,
      metalness: 0.05
    });

    this.wardMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00a3cc,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1
    });

    for (let y = 0; y < 9; y++) {
      this.tileMeshes[y] = [];
      for (let x = 0; x < 9; x++) {
        const w = this.gridToWorld(x, y);
        const isAlt = (x + y) % 2 === 0;

        // Base Stone Slab
        const slab = new THREE.Mesh(slabGeo, isAlt ? matLight : matDark);
        slab.position.set(w.x, -0.15, w.z);
        slab.receiveShadow = true;
        this.scene.add(slab);

        // Subtle Rune Inlay
        const rune = new THREE.Mesh(runeGeo, runeMat);
        rune.position.set(w.x, 0.01, w.z);
        this.scene.add(rune);

        // Group container for dynamic tile hazards
        const overlayGroup = new THREE.Group();
        overlayGroup.position.set(w.x, 0, w.z);
        this.scene.add(overlayGroup);

        this.tileMeshes[y][x] = {
          slab,
          rune,
          overlayGroup,
          currentStatus: null,
          currentTelegraph: null
        };
      }
    }
  }

  initEntityMeshes() {
    // 1. Rogue Cultivator (Player)
    this.playerGroup = new THREE.Group();

    // Robed Body
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x174052, roughness: 0.6 });
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.15, 8), robeMat);
    robe.position.y = 0.58;
    robe.castShadow = true;
    this.playerGroup.add(robe);

    // Glowing Cyan Soul Head
    const soulMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00c4d8,
      emissiveIntensity: 0.9
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), soulMat);
    head.position.y = 1.35;
    this.playerGroup.add(head);

    // Direction Compass Talisman
    const talisMat = new THREE.MeshBasicMaterial({ color: 0xe0b04a });
    this.playerFacingArrow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), talisMat);
    this.playerFacingArrow.position.set(0, 0.3, -0.65);
    this.playerFacingArrow.rotation.x = Math.PI * 0.5;
    this.playerGroup.add(this.playerFacingArrow);

    // Orbiting Soul Hit Beads
    this.playerHitBeads = [];
    const beadMat = new THREE.MeshStandardMaterial({
      color: 0xff334b,
      emissive: 0xff1133,
      emissiveIntensity: 0.8
    });
    for (let i = 0; i < 6; i++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), beadMat);
      this.playerGroup.add(bead);
      this.playerHitBeads.push(bead);
    }

    this.scene.add(this.playerGroup);

    // 2. Active Enemy Meshes Map (keyed by enemy id/instance)
    this.enemyMeshMap = new Map();
  }

  getOrCreateEnemyMesh(enemy) {
    if (this.enemyMeshMap.has(enemy)) {
      return this.enemyMeshMap.get(enemy);
    }

    const group = new THREE.Group();

    if (enemy.name === "Hopping Jiangshi") {
      // Robe (Dark Qing blue)
      const robeMat = new THREE.MeshStandardMaterial({ color: 0x152433, roughness: 0.7 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 1.1, 8), robeMat);
      body.position.y = 0.55;
      body.castShadow = true;
      group.add(body);

      // Pale Head
      const headMat = new THREE.MeshStandardMaterial({ color: 0xd2dcd9, roughness: 0.8 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), headMat);
      head.position.y = 1.3;
      group.add(head);

      // Qing Official Cap
      const hatMat = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.5 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 12), hatMat);
      brim.position.y = 1.45;
      group.add(brim);

      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.28, 8), hatMat);
      crown.position.y = 1.62;
      group.add(crown);

      // Yellow Taoist Talisman on Forehead
      const talisMat = new THREE.MeshBasicMaterial({ color: 0xffda33 });
      const talis = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.32), talisMat);
      talis.position.set(0, 1.25, 0.28);
      group.add(talis);

      // Outstretched Arms
      const armMat = new THREE.MeshStandardMaterial({ color: 0x152433 });
      const arms = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.6), armMat);
      arms.position.set(0, 0.9, 0.32);
      group.add(arms);

    } else if (enemy.name === "Resentful Wraith") {
      // Ethereal floating specter
      const ghostMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x009bb3,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.75,
        roughness: 0.2
      });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 8), ghostMat);
      body.rotation.x = Math.PI;
      body.position.y = 1.1;
      group.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), ghostMat);
      head.position.y = 1.35;
      group.add(head);

    } else if (enemy.name === "Corpse Scribe") {
      // Skeletal sorcerer with bone scroll
      const robeMat = new THREE.MeshStandardMaterial({ color: 0x3a2745, roughness: 0.7 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 1.2, 8), robeMat);
      body.position.y = 0.6;
      group.add(body);

      // Skull
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), this.boneMat);
      skull.position.y = 1.35;
      group.add(skull);

      // Bone Scroll
      const scrollMat = new THREE.MeshStandardMaterial({ color: 0xd5c298, roughness: 0.6 });
      const scroll = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.28), scrollMat);
      scroll.position.set(0, 0.85, 0.35);
      group.add(scroll);

    } else if (enemy.name === "Corpse Emperor") {
      // 2.4x Colossus
      const emperorMat = new THREE.MeshStandardMaterial({ color: 0x4a0812, roughness: 0.6 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 2.2, 10), emperorMat);
      body.position.y = 1.1;
      body.castShadow = true;
      group.add(body);

      // Head
      const headMat = new THREE.MeshStandardMaterial({ color: 0x240308 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), headMat);
      head.position.y = 2.4;
      group.add(head);

      // Imperial Gold Crown
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xe0b04a, metalness: 0.8, roughness: 0.3 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.6, 6), crownMat);
      crown.position.y = 2.85;
      group.add(crown);

      // 2s Damage Immunity Spherical Barrier
      const barrierMat = new THREE.MeshStandardMaterial({
        color: 0xffd15c,
        emissive: 0xffa500,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1
      });
      const barrier = new THREE.Mesh(new THREE.SphereGeometry(1.65, 20, 20), barrierMat);
      barrier.position.y = 1.2;
      barrier.name = "immunityBarrier";
      group.add(barrier);
    }

    this.scene.add(group);
    this.enemyMeshMap.set(enemy, group);
    return group;
  }

  triggerShake(intensity = 6) {
    this.screenShake = intensity;
  }

  addFloatingText(text, x, y, color = '#ff334b', size = 13) {
    // Project 2D screen coordinate or grid position
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      size,
      alpha: 1.0,
      vy: -28,
      life: 1.2
    });
  }

  spawnBloodParticles(x, y, count = 16) {
    // Convert 2D pixel to 3D world
    const gx = Math.floor(x / this.grid.tileSize);
    const gy = Math.floor(y / this.grid.tileSize);
    const w = this.gridToWorld(gx, gy);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.5;
      const geo = new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.08);
      const mat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.3 ? 0xc1121f : 0xff334b });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(w.x, 0.4, w.z);

      this.scene.add(mesh);
      this.bloodParticles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 2.5 + Math.random() * 3.5,
        vz: Math.sin(angle) * speed,
        life: 0.8
      });
    }
  }

  spawnSpellShockwave(x, y, color = '#00f0ff') {
    this.triggerShake(4);
    this.spawnBloodParticles(x, y, 12);
  }

  spawnBoneShatterDebris(x, y) {
    const w = this.gridToWorld(x, y);
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.0;
      const geo = new THREE.BoxGeometry(0.12, 0.22 + Math.random() * 0.18, 0.12);
      const mesh = new THREE.Mesh(geo, this.boneMat);
      mesh.position.set(w.x + (Math.random() - 0.5) * 0.6, 0.4, w.z + (Math.random() - 0.5) * 0.6);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      this.scene.add(mesh);
      this.boneDebris.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 3.5 + Math.random() * 4.0,
        vz: Math.sin(angle) * speed,
        rvx: Math.random() * 12,
        rvy: Math.random() * 12,
        life: 1.4
      });
    }
  }

  update(dt) {
    // 1. Screen Shake decay
    if (this.screenShake > 0) {
      this.screenShake -= dt * 18;
      if (this.screenShake < 0) this.screenShake = 0;
      this.shakeOffset.set(
        (Math.random() * 2 - 1) * this.screenShake * 0.08,
        (Math.random() * 2 - 1) * this.screenShake * 0.08,
        (Math.random() * 2 - 1) * this.screenShake * 0.08
      );
      this.camera.position.copy(this.baseCameraPos).add(this.shakeOffset);
    } else {
      this.camera.position.copy(this.baseCameraPos);
    }

    // 2. Flickering corner torch lights
    const now = Date.now() / 1000;
    this.brazierLights.forEach((b, idx) => {
      const flicker = Math.sin(now * 10 + idx * 2) * 0.25 + Math.cos(now * 15 + idx) * 0.15;
      b.light.intensity = b.baseIntensity + flicker;
    });

    // 3. 3D Blood Particles
    for (let i = this.bloodParticles.length - 1; i >= 0; i--) {
      const p = this.bloodParticles[i];
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 18.0 * dt; // gravity

      if (p.mesh.position.y <= 0.05) {
        p.mesh.position.y = 0.05;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }

      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.bloodParticles.splice(i, 1);
      }
    }

    // 4. 3D Bone Shatter Physics Debris
    for (let i = this.boneDebris.length - 1; i >= 0; i--) {
      const b = this.boneDebris[i];
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      b.vy -= 22.0 * dt; // bone gravity

      b.mesh.rotation.x += b.rvx * dt;
      b.mesh.rotation.y += b.rvy * dt;

      if (b.mesh.position.y <= 0.08) {
        b.mesh.position.y = 0.08;
        b.vy = -b.vy * 0.42; // bounce
        b.vx *= 0.7;
        b.vz *= 0.7;
        b.rvx *= 0.6;
      }

      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        this.boneDebris.splice(i, 1);
      }
    }

    // 5. Floating Screen Text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      ft.alpha = Math.max(0, ft.life / 1.2);
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  render(player, enemies, activeFloorInfo) {
    // 1. Sync 3D Floor Tiles & Hazards
    this.syncTiles(player);

    // 2. Sync Player Position & 3D Pose
    this.syncPlayer(player);

    // 3. Sync Enemies & 3D Hops
    this.syncEnemies(enemies);

    // 4. Render 3D WebGL Scene
    this.renderer.render(this.scene, this.camera);

    // 5. Render Crisp 2D Floating Text Overlay
    this.renderTextOverlay();
  }

  syncTiles(player) {
    const now = Date.now() / 1000;

    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const tile = this.grid.tiles[y][x];
        const holder = this.tileMeshes[y][x];
        const group = holder.overlayGroup;

        // Check if status changed
        const statusKey = `${tile.status}_${tile.effects.player ? tile.effects.player.status : ''}_${tile.effects.enemy ? tile.effects.enemy.status : ''}_${tile.telegraphs.player ? tile.telegraphs.player.timer.toFixed(1) : ''}_${tile.telegraphs.enemy ? tile.telegraphs.enemy.timer.toFixed(1) : ''}`;

        if (holder.cacheKey !== statusKey) {
          holder.cacheKey = statusKey;

          // Clear old child objects
          while (group.children.length > 0) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
          }

          // A. Bone Obstacle (Inaccessible)
          if (tile.status === TILE_STATUS.INACCESSIBLE) {
            // Ivory Bone Pillar
            const bonePillar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 1.4, 6), this.boneMat);
            bonePillar.position.y = 0.7;
            bonePillar.castShadow = true;
            group.add(bonePillar);

            // Horn spikes on top
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 4), this.boneMat);
            horn.position.y = 1.6;
            group.add(horn);
          }

          // B. Taoist Shield Ward (Cyan)
          if (tile.effects.player && tile.effects.player.status === TILE_STATUS.SHIELDED) {
            const ward = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.08, 6), this.wardMat);
            ward.position.y = 0.28;
            group.add(ward);
          }

          // C. Jade Green Spikes (Player Damaging)
          const hasPlayerDmg = tile.effects.player && tile.effects.player.status === TILE_STATUS.DAMAGING;
          if (hasPlayerDmg) {
            const spikeOffsets = [
              [0, 0], [0.35, 0.35], [-0.35, 0.35],
              [0.35, -0.35], [-0.35, -0.35]
            ];
            spikeOffsets.forEach(([ox, oz]) => {
              const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.95, 4), this.jadeMat);
              spike.position.set(ox, 0.48, oz);
              group.add(spike);
            });
          }

          // D. Crimson Blood Spikes (Enemy Damaging)
          const hasEnemyDmg = tile.effects.enemy && tile.effects.enemy.status === TILE_STATUS.DAMAGING;
          if (hasEnemyDmg) {
            const spikeOffsets = [
              [0, 0], [0.4, 0], [-0.4, 0],
              [0, 0.4], [0, -0.4]
            ];
            spikeOffsets.forEach(([ox, oz]) => {
              const spike = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.1, 5), this.crimsonMat);
              spike.position.set(ox, 0.55, oz);
              group.add(spike);
            });
          }

          // E. Telegraph Rune Rings (Floor indicator)
          const et = tile.telegraphs.enemy;
          const pt = tile.telegraphs.player;
          if (et && et.active) {
            const ringGeo = new THREE.RingGeometry(0.2, 0.78, 20);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xff334b, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI * 0.5;
            ring.position.y = 0.03;
            group.add(ring);
          } else if (pt && pt.active) {
            const ringGeo = new THREE.RingGeometry(0.2, 0.78, 20);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI * 0.5;
            ring.position.y = 0.03;
            group.add(ring);
          }
        }
      }
    }
  }

  syncPlayer(player) {
    if (!player) return;

    // Convert player render coordinates
    const gx = player.renderX / this.grid.tileSize;
    const gy = player.renderY / this.grid.tileSize;
    const w = this.gridToWorld(gx, gy);

    // Floating spirit bob
    const now = Date.now() / 1000;
    const bob = Math.sin(now * 5) * 0.08;
    this.playerGroup.position.set(w.x, bob, w.z);

    // Soul Point Light follows cultivator
    this.playerLight.position.set(w.x, 2.4, w.z);

    // Facing arrow orientation
    const angle = Math.atan2(player.facing.dx, player.facing.dy);
    this.playerFacingArrow.position.set(player.facing.dx * 0.65, 0.35, player.facing.dy * 0.65);
    this.playerFacingArrow.rotation.z = -angle;

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

    // Invulnerability blink
    if (player.isInvulnerable) {
      this.playerGroup.visible = Math.floor(Date.now() / 80) % 2 === 0;
    } else {
      this.playerGroup.visible = true;
    }
  }

  syncEnemies(enemies) {
    const activeSet = new Set(enemies);

    // Clean up meshes of deceased enemies
    for (const [enemy, mesh] of this.enemyMeshMap.entries()) {
      if (!activeSet.has(enemy) || !enemy.alive) {
        this.scene.remove(mesh);
        this.enemyMeshMap.delete(enemy);
      }
    }

    enemies.forEach(enemy => {
      if (!enemy.alive) return;
      const mesh = this.getOrCreateEnemyMesh(enemy);

      const gx = enemy.renderX / this.grid.tileSize;
      const gy = enemy.renderY / this.grid.tileSize;
      const w = this.gridToWorld(gx, gy);

      // 3D Parabolic Hop Animation for Jiangshi
      let hopY = 0;
      if (enemy.name === "Hopping Jiangshi") {
        if (enemy.isMoving) {
          const hopProgress = Math.min(1, Math.max(0, enemy.moveTimer / enemy.moveDuration));
          hopY = Math.sin(hopProgress * Math.PI) * 1.35; // True parabolic jump arc!
          mesh.scale.set(1.0, 1.0, 1.0);
        } else if (enemy.isWindingUp) {
          mesh.scale.set(1.25, 0.68, 1.25); // Windup crouch squish!
        } else {
          mesh.scale.set(1.0, 1.0, 1.0);
        }
      } else if (enemy.name === "Resentful Wraith") {
        hopY = 0.3 + Math.sin(Date.now() / 250) * 0.12;
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

  renderTextOverlay() {
    if (!this.textCtx || !this.textCanvas) return;
    const ctx = this.textCtx;
    ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);

    // Render floating combat texts
    this.floatingTexts.forEach(ft => {
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.font = `bold ${ft.size}px Cinzel, JetBrains Mono, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1.0;
  }
}
