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
    this.torchEmbers = [];
    this.spiritFogPlanes = [];
    this.emberSpawnTimer = 0;
    this.flashingMeshes = new Map();
    this.playerFlashTimer = 0;

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

    // 3. Tilted Isometric Perspective Camera (top-down view for clear grid navigation)
    this.camera = new THREE.PerspectiveCamera(40, 1.0, 0.1, 100);
    this.baseCameraPos = new THREE.Vector3(0, 26.5, 9.5);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
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
    // Ambient Light (deep mystic violet fill)
    const ambient = new THREE.AmbientLight(0x3e3256, 1.35);
    this.scene.add(ambient);

    // Moonlight Directional Light
    const moon = new THREE.DirectionalLight(0x9db2d5, 1.25);
    moon.position.set(12, 28, 14);
    moon.castShadow = true;
    moon.shadow.mapSize.width = 1024;
    moon.shadow.mapSize.height = 1024;
    moon.shadow.bias = -0.001;
    this.scene.add(moon);

    // Top-down Zenith Fill Light (directly illuminates tops of character heads, hats, and shoulders)
    const topLight = new THREE.DirectionalLight(0xfff8ed, 0.75);
    topLight.position.set(0, 32, 2);
    topLight.target.position.set(0, 0, 0);
    this.scene.add(topLight);
    this.scene.add(topLight.target);

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

    // Player Soul Light (Follows player with radiant cyan glow)
    this.playerLight = new THREE.PointLight(0x00f0ff, 2.2, 8.5);
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

    // Low-lying Ethereal Pagoda Spirit Mist Discs
    this.spiritFogPlanes = [];
    const mistGeo = new THREE.CircleGeometry(5.2, 24);
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0x18102a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.12
    });

    for (let m = 0; m < 4; m++) {
      const mist = new THREE.Mesh(mistGeo, mistMat);
      mist.rotation.x = -Math.PI * 0.5;
      mist.position.set((m % 2 === 0 ? -2.8 : 2.8), 0.04, (m < 2 ? -2.8 : 2.8));
      this.scene.add(mist);
      this.spiritFogPlanes.push({ mesh: mist, rotSpeed: (m % 2 === 0 ? 0.018 : -0.022) });
    }
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

    // A. Player Ground Tactical Rune Ring (clearly marks current tile & position)
    const ringGeo = new THREE.RingGeometry(0.55, 0.68, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    this.playerGroundRing = new THREE.Mesh(ringGeo, ringMat);
    this.playerGroundRing.rotation.x = -Math.PI * 0.5;
    this.playerGroundRing.position.y = 0.03;
    this.playerGroup.add(this.playerGroundRing);

    // Inner glowing aura disc on floor
    const innerDiscGeo = new THREE.CircleGeometry(0.53, 32);
    const innerDiscMat = new THREE.MeshBasicMaterial({
      color: 0x00d4e8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25
    });
    const innerDisc = new THREE.Mesh(innerDiscGeo, innerDiscMat);
    innerDisc.rotation.x = -Math.PI * 0.5;
    innerDisc.position.y = 0.02;
    this.playerGroup.add(innerDisc);

    // Robed Body: Cultivator silk robe with bright cyan trims
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0x0c4b6e,
      roughness: 0.45,
      metalness: 0.2
    });
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.15, 8), robeMat);
    robe.position.y = 0.58;
    robe.castShadow = true;
    this.playerGroup.add(robe);

    // Glowing Jade/Cyan Trim collar on robe
    const trimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 20), trimMat);
    trim.rotation.x = Math.PI * 0.5;
    trim.position.y = 1.08;
    this.playerGroup.add(trim);

    // Glowing Cyan Soul Head
    const soulMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.3
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), soulMat);
    head.position.y = 1.36;
    this.playerGroup.add(head);

    // Mystical Spirit Halo above head (visible clearly from top-down)
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 24), haloMat);
    halo.rotation.x = Math.PI * 0.5;
    halo.position.y = 1.72;
    this.playerGroup.add(halo);

    // Direction Compass Arrow (High contrast bright gold chevron)
    const talisMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    this.playerFacingArrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), talisMat);
    this.playerFacingArrow.position.set(0, 0.35, -0.75);
    this.playerFacingArrow.rotation.x = Math.PI * 0.5;
    this.playerGroup.add(this.playerFacingArrow);

    // Orbiting Soul Hit Beads
    this.playerHitBeads = [];
    const beadMat = new THREE.MeshStandardMaterial({
      color: 0xff334b,
      emissive: 0xff1133,
      emissiveIntensity: 1.0
    });
    for (let i = 0; i < 6; i++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), beadMat);
      this.playerGroup.add(bead);
      this.playerHitBeads.push(bead);
    }

    // Hovering Jade Spirit Flying Sword (飞剑 - Classic Wuxia Daoist focus weapon)
    this.playerSword = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(0.06, 0.68, 0.025);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.88,
      roughness: 0.1
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.34;
    this.playerSword.add(blade);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 4), bladeMat);
    tip.position.y = 0.76;
    this.playerSword.add(tip);

    const guardMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.05), guardMat);
    this.playerSword.add(guard);

    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), guardMat);
    hilt.position.y = -0.1;
    this.playerSword.add(hilt);

    this.playerSword.position.set(0.42, 1.35, -0.15);
    this.playerSword.rotation.x = Math.PI * 0.15;
    this.playerGroup.add(this.playerSword);

    // Flowing Daoist Silk Twin Sash / Ribbons trailing behind robe
    this.playerSash = new THREE.Group();
    const sashMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide });

    const leftRibbon = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.65), sashMat);
    leftRibbon.position.set(-0.12, -0.28, 0.26);
    leftRibbon.rotation.x = Math.PI * 0.1;
    this.playerSash.add(leftRibbon);

    const rightRibbon = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.65), sashMat);
    rightRibbon.position.set(0.12, -0.28, 0.26);
    rightRibbon.rotation.x = Math.PI * 0.1;
    this.playerSash.add(rightRibbon);

    this.playerSash.position.set(0, 0.6, 0);
    this.playerGroup.add(this.playerSash);

    this.scene.add(this.playerGroup);

    // 2. Active Enemy Meshes Map (keyed by enemy id/instance)
    this.enemyMeshMap = new Map();
  }

  getOrCreateEnemyMesh(enemy) {
    if (this.enemyMeshMap.has(enemy)) {
      return this.enemyMeshMap.get(enemy);
    }

    const group = new THREE.Group();

    if (enemy.name === "Corpse Emperor") {
      // Ground Boss Demonic Aura Ring
      const bossRingGeo = new THREE.RingGeometry(1.3, 1.5, 36);
      const bossRingMat = new THREE.MeshBasicMaterial({
        color: 0xff1133,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const bossGroundRing = new THREE.Mesh(bossRingGeo, bossRingMat);
      bossGroundRing.rotation.x = -Math.PI * 0.5;
      bossGroundRing.position.y = 0.02;
      bossGroundRing.name = "dangerRing";
      group.add(bossGroundRing);

      // 2.4x Colossus Body
      const emperorMat = new THREE.MeshStandardMaterial({ color: 0x5a0815, roughness: 0.55 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 2.2, 10), emperorMat);
      body.position.y = 1.1;
      body.castShadow = true;
      group.add(body);

      // Head
      const headMat = new THREE.MeshStandardMaterial({ color: 0x2b040a });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), headMat);
      head.position.y = 2.4;
      group.add(head);

      // Glowing Demonic Red Eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
      const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
      leftEye.position.set(-0.18, 2.42, 0.44);
      group.add(leftEye);
      const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
      rightEye.position.set(0.18, 2.42, 0.44);
      group.add(rightEye);

      // Imperial Gold Crown (with radiant gold spikes visible from top-down)
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.6,
        metalness: 0.8,
        roughness: 0.25
      });
      const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.55, 6), crownMat);
      crownBase.position.y = 2.85;
      group.add(crownBase);

      // Crown Spikes
      for (let s = 0; s < 6; s++) {
        const angle = (s / 6) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 4), crownMat);
        spike.position.set(Math.cos(angle) * 0.52, 3.2, Math.sin(angle) * 0.52);
        group.add(spike);
      }

      // Imperial Dragon Shoulder Pauldrons
      const pauldronMat = new THREE.MeshStandardMaterial({
        color: 0x7a111e,
        metalness: 0.6,
        roughness: 0.3
      });
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8 });

      [-1.05, 1.05].forEach((px, idx) => {
        const pGroup = new THREE.Group();
        pGroup.position.set(px, 1.9, 0);

        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.5), pauldronMat);
        pGroup.add(plate);

        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), hornMat);
        horn.rotation.z = idx === 0 ? 0.7 : -0.7;
        horn.position.set(idx === 0 ? -0.22 : 0.22, 0.22, 0);
        pGroup.add(horn);

        group.add(pGroup);
      });

      // 2s Damage Immunity Spherical Barrier
      const barrierMat = new THREE.MeshStandardMaterial({
        color: 0xffd15c,
        emissive: 0xffa500,
        emissiveIntensity: 0.95,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1
      });
      const barrier = new THREE.Mesh(new THREE.SphereGeometry(1.65, 20, 20), barrierMat);
      barrier.position.y = 1.2;
      barrier.name = "immunityBarrier";
      group.add(barrier);

    } else {
      // Normal Enemy Ground Danger Ring
      const dangerRingGeo = new THREE.RingGeometry(0.48, 0.6, 24);
      const dangerRingMat = new THREE.MeshBasicMaterial({
        color: 0xff2244,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.82
      });
      const dangerRing = new THREE.Mesh(dangerRingGeo, dangerRingMat);
      dangerRing.rotation.x = -Math.PI * 0.5;
      dangerRing.position.y = 0.02;
      dangerRing.name = "dangerRing";
      group.add(dangerRing);

      if (enemy.name === "Hopping Jiangshi") {
        // Robe (Royal Qing Navy)
        const robeMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.65 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 1.1, 8), robeMat);
        body.position.y = 0.55;
        body.castShadow = true;
        group.add(body);

        // Pale Ghastly Head
        const headMat = new THREE.MeshStandardMaterial({ color: 0xe8f0ed, roughness: 0.8 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), headMat);
        head.position.y = 1.3;
        group.add(head);

        // Glowing Red Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
        const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat);
        leftEye.position.set(-0.09, 1.32, 0.24);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat);
        rightEye.position.set(0.09, 1.32, 0.24);
        group.add(rightEye);

        // Qing Official Cap
        const hatMat = new THREE.MeshStandardMaterial({ color: 0x161c28, roughness: 0.5 });
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 12), hatMat);
        brim.position.y = 1.45;
        group.add(brim);

        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.28, 8), hatMat);
        crown.position.y = 1.62;
        group.add(crown);

        // Red Tassel on top of hat (Crucial for top-down visibility!)
        const tasselMat = new THREE.MeshBasicMaterial({ color: 0xff1a35 });
        const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), tasselMat);
        tassel.position.y = 1.82;
        group.add(tassel);

        // Yellow Taoist Talisman on Forehead (Tilted so camera sees it)
        const talisMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
        const talis = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.32), talisMat);
        talis.position.set(0, 1.25, 0.28);
        talis.rotation.x = -0.15;
        talis.name = "foreheadTalisman";
        group.add(talis);

        // Outstretched Arms
        const armMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f });
        const arms = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.6), armMat);
        arms.position.set(0, 0.9, 0.32);
        group.add(arms);

        // Hanging Qing Official Sleeves (Bounces with hops)
        const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x162c4a });
        const leftSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.36, 0.22), sleeveMat);
        leftSleeve.position.set(-0.35, 0.72, 0.28);
        leftSleeve.name = "leftSleeve";
        group.add(leftSleeve);
        const rightSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.36, 0.22), sleeveMat);
        rightSleeve.position.set(0.35, 0.72, 0.28);
        rightSleeve.name = "rightSleeve";
        group.add(rightSleeve);

      } else if (enemy.name === "Resentful Wraith") {
        // Ethereal floating specter (Spectral Violet/Amethyst for zero confusion with player)
        const ghostMat = new THREE.MeshStandardMaterial({
          color: 0x9333ea,
          emissive: 0x7e22ce,
          emissiveIntensity: 1.1,
          transparent: true,
          opacity: 0.85,
          roughness: 0.2
        });
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 8), ghostMat);
        body.rotation.x = Math.PI;
        body.position.y = 1.1;
        group.add(body);

        const headMat = new THREE.MeshStandardMaterial({
          color: 0xc084fc,
          emissive: 0xa855f7,
          emissiveIntensity: 1.3
        });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), headMat);
        head.position.y = 1.35;
        group.add(head);

      } else if (enemy.name === "Corpse Scribe") {
        // Skeletal sorcerer with bone scroll
        const robeMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.65 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 1.2, 8), robeMat);
        body.position.y = 0.6;
        group.add(body);

        // Bone Skull
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), this.boneMat);
        skull.position.y = 1.35;
        group.add(skull);

        // Glowing Crimson Eye Gems
        const skullEyeMat = new THREE.MeshBasicMaterial({ color: 0xff1144 });
        const se1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), skullEyeMat);
        se1.position.set(-0.08, 1.37, 0.22);
        group.add(se1);
        const se2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), skullEyeMat);
        se2.position.set(0.08, 1.37, 0.22);
        group.add(se2);

        // Glowing Bone Scroll
        const scrollMat = new THREE.MeshStandardMaterial({
          color: 0xfde047,
          emissive: 0xd97706,
          emissiveIntensity: 0.6,
          roughness: 0.5
        });
        const scroll = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.28), scrollMat);
        scroll.position.set(0, 0.85, 0.35);
        group.add(scroll);

        // Orbiting Skull Spirit Orbs (Triangular rotation)
        const scribeOrbs = new THREE.Group();
        scribeOrbs.name = "scribeOrbs";
        for (let o = 0; o < 3; o++) {
          const oAngle = (o / 3) * Math.PI * 2;
          const orbMat = new THREE.MeshStandardMaterial({
            color: 0xe9d5ff,
            emissive: 0xa855f7,
            emissiveIntensity: 1.2
          });
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), orbMat);
          orb.position.set(Math.cos(oAngle) * 0.65, 1.25, Math.sin(oAngle) * 0.65);
          scribeOrbs.add(orb);
        }
        group.add(scribeOrbs);
      }
    }

    this.scene.add(group);
    this.enemyMeshMap.set(enemy, group);
    return group;
  }

  triggerShake(intensity = 6) {
    this.screenShake = intensity;
  }

  disposeTransientMesh(root) {
    const geometries = new Set();
    const materials = new Set();
    const sharedMaterials = new Set([this.boneMat, this.jadeMat, this.crimsonMat, this.wardMat]);
    root.traverse(child => {
      if (child.geometry) geometries.add(child.geometry);
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
      childMaterials.forEach(material => {
        if (material && !sharedMaterials.has(material)) materials.add(material);
      });
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }

  resetTransientState() {
    this.screenShake = 0;
    this.shakeOffset.set(0, 0, 0);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(this.cameraTarget);
    this.bossLight.intensity = 0;
    this.playerFlashTimer = 0;
    this.resetPlayerFlash();
    this.playerGroup.visible = true;
    this.playerGroundRing.material.color.setHex(0x00f0ff);
    for (const mesh of this.flashingMeshes.keys()) {
      this.restoreMeshFlash(mesh);
    }
    this.flashingMeshes.clear();
    for (const mesh of this.enemyMeshMap.values()) {
      this.scene.remove(mesh);
      this.disposeTransientMesh(mesh);
    }
    this.enemyMeshMap.clear();
    for (const particles of [this.bloodParticles, this.boneDebris, this.torchEmbers]) {
      for (const particle of particles) {
        this.scene.remove(particle.mesh);
        this.disposeTransientMesh(particle.mesh);
      }
      particles.length = 0;
    }
    this.floatingTexts.length = 0;
    this.emberSpawnTimer = 0;
    for (const row of this.tileMeshes) {
      for (const holder of row) {
        this.disposeTransientMesh(holder.overlayGroup);
        holder.overlayGroup.clear();
        holder.cacheKey = null;
      }
    }
    if (this.textCtx) this.textCtx.clearRect(0, 0, 760, 760);
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
    const gx = (x - this.grid.padding) / this.grid.tileSize;
    const gy = (y - this.grid.padding) / this.grid.tileSize;
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
    this.camera.lookAt(this.cameraTarget);

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
        p.mesh.material.dispose();
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

    // 6. Spirit Fog Celestial Motion
    this.spiritFogPlanes.forEach(fp => {
      fp.mesh.rotation.z += dt * fp.rotSpeed;
    });

    // 7. Rising Golden Torch Embers
    this.emberSpawnTimer += dt;
    if (this.emberSpawnTimer > 0.08 && this.torchEmbers.length < 36) {
      this.emberSpawnTimer = 0;
      const cornerPositions = [
        [-8.6, -8.6], [8.6, -8.6],
        [-8.6, 8.6], [8.6, 8.6]
      ];
      const [bx, bz] = cornerPositions[Math.floor(Math.random() * cornerPositions.length)];
      const geo = new THREE.DodecahedronGeometry(0.04 + Math.random() * 0.03);
      const mat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.4 ? 0xffb703 : 0xfb8500 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(bx + (Math.random() - 0.5) * 0.35, 1.45 + Math.random() * 0.2, bz + (Math.random() - 0.5) * 0.35);
      this.scene.add(mesh);
      this.torchEmbers.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.35,
        vy: 0.75 + Math.random() * 0.85,
        vz: (Math.random() - 0.5) * 0.35,
        life: 1.8 + Math.random() * 0.8
      });
    }

    for (let i = this.torchEmbers.length - 1; i >= 0; i--) {
      const ember = this.torchEmbers[i];
      ember.mesh.position.x += ember.vx * dt;
      ember.mesh.position.y += ember.vy * dt;
      ember.mesh.position.z += ember.vz * dt;
      ember.mesh.scale.multiplyScalar(0.985);
      ember.life -= dt;
      if (ember.life <= 0) {
        this.scene.remove(ember.mesh);
        ember.mesh.geometry.dispose();
        ember.mesh.material.dispose();
        this.torchEmbers.splice(i, 1);
      }
    }

    // 8. Hit Flash Processing
    if (this.playerFlashTimer > 0) {
      this.playerFlashTimer -= dt;
      if (this.playerFlashTimer <= 0) {
        this.resetPlayerFlash();
      }
    }
    for (const [mesh, timer] of this.flashingMeshes.entries()) {
      const newTimer = timer - dt;
      if (newTimer <= 0) {
        this.restoreMeshFlash(mesh);
        this.flashingMeshes.delete(mesh);
      } else {
        this.flashingMeshes.set(mesh, newTimer);
      }
    }
  }

  flashPlayerHit() {
    this.playerFlashTimer = 0.09;
    this.playerGroup.traverse(child => {
      if (child.isMesh && child.material && child.material.emissive) {
        if (!child.userData.origEmissive) {
          child.userData.origEmissive = child.material.emissive.clone();
          child.userData.origEmissiveIntensity = child.material.emissiveIntensity;
        }
        child.material.emissive.setHex(0xffffff);
        child.material.emissiveIntensity = 2.4;
      }
    });
  }

  resetPlayerFlash() {
    this.restoreMeshFlash(this.playerGroup);
  }

  restoreMeshFlash(mesh) {
    mesh.traverse(child => {
      if (child.isMesh && child.material && child.userData.origEmissive) {
        child.material.emissive.copy(child.userData.origEmissive);
        child.material.emissiveIntensity = child.userData.origEmissiveIntensity || 0;
      }
    });
  }

  flashEnemyHit(enemy) {
    const mesh = this.enemyMeshMap.get(enemy);
    if (!mesh) return;
    mesh.traverse(child => {
      if (child.isMesh && child.material && child.material.emissive) {
        if (!child.userData.origEmissive) {
          child.userData.origEmissive = child.material.emissive.clone();
          child.userData.origEmissiveIntensity = child.material.emissiveIntensity;
        }
        child.material.emissive.setHex(0xffffff);
        child.material.emissiveIntensity = 2.4;
      }
    });
    this.flashingMeshes.set(mesh, 0.09);
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

    // 5. Render Crisp 2D Floating Text & Tactical Overlays
    this.renderTextOverlay(player, enemies);
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
          this.disposeTransientMesh(group);
          while (group.children.length > 0) {
            const child = group.children[0];
            group.remove(child);
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

    // Convert player render coordinates (subtract grid padding to center on tile)
    const gx = (player.renderX - this.grid.padding) / this.grid.tileSize;
    const gy = (player.renderY - this.grid.padding) / this.grid.tileSize;
    const w = this.gridToWorld(gx, gy);

    // Floating spirit bob
    const now = Date.now() / 1000;
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

  syncEnemies(enemies) {
    const activeSet = new Set(enemies);
    const now = Date.now() / 1000;
    this.bossLight.intensity = 0;

    // Clean up meshes of deceased enemies
    for (const [enemy, mesh] of this.enemyMeshMap.entries()) {
      if (!activeSet.has(enemy) || !enemy.alive) {
        this.restoreMeshFlash(mesh);
        this.flashingMeshes.delete(mesh);
        this.scene.remove(mesh);
        this.disposeTransientMesh(mesh);
        this.enemyMeshMap.delete(enemy);
      }
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

  renderTextOverlay(player, enemies) {
    if (!this.textCtx || !this.textCanvas) return;
    const ctx = this.textCtx;
    ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);

    // 1. Tactical Enemy Overhead Indicators (Health Pips, Attack Warnings, Boss Bar)
    if (enemies && Array.isArray(enemies)) {
      enemies.forEach(enemy => {
        if (!enemy.alive) return;

        const gx = (enemy.renderX - this.grid.padding) / this.grid.tileSize;
        const gy = (enemy.renderY - this.grid.padding) / this.grid.tileSize;
        const w = this.gridToWorld(gx, gy);

        if (enemy.name === "Corpse Emperor") {
          // Boss Health Bar & Shield Countdown
          const sp = this.worldToScreen(w.x, 3.6, w.z);
          if (sp.x >= -60 && sp.x <= 820 && sp.y >= -60 && sp.y <= 820) {
            const barW = 130;
            const barH = 10;
            const bx = sp.x - barW * 0.5;
            const by = sp.y - 14;

            // Background & border
            ctx.fillStyle = 'rgba(10, 6, 18, 0.85)';
            ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
            ctx.strokeStyle = '#e0b04a';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx - 2, by - 2, barW + 4, barH + 4);

            // Health fill
            const pct = Math.max(0, Math.min(1, enemy.hits / (enemy.maxHits || 10)));
            ctx.fillStyle = '#ff2244';
            ctx.fillRect(bx, by, barW * pct, barH);

            // Boss label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px JetBrains Mono, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`EMPEROR: ${enemy.hits}/${enemy.maxHits}`, sp.x, by + 8);

            // Immunity Shield Countdown
            if (enemy.invulnerableTimer > 0) {
              ctx.fillStyle = '#ffd15c';
              ctx.font = 'bold 11px JetBrains Mono, sans-serif';
              ctx.shadowColor = '#000';
              ctx.shadowBlur = 5;
              ctx.fillText(`🛡️ IMMUNE ${enemy.invulnerableTimer.toFixed(1)}s`, sp.x, by - 6);
              ctx.shadowBlur = 0;
            }
          }
        } else {
          // Normal Enemy Overheads
          const sp = this.worldToScreen(w.x, 2.1, w.z);
          if (sp.x >= -40 && sp.x <= 800 && sp.y >= -40 && sp.y <= 800) {
            // A. Attack Windup Warning Badge
            if (enemy.isWindingUp) {
              const pulse = Math.floor(Date.now() / 90) % 2 === 0;
              ctx.fillStyle = pulse ? '#ff334b' : '#ffaa00';
              ctx.font = 'bold 11px JetBrains Mono, sans-serif';
              ctx.textAlign = 'center';
              ctx.shadowColor = '#000';
              ctx.shadowBlur = 6;
              ctx.fillText(`⚠️ ATTACK!`, sp.x, sp.y - 14);
              ctx.shadowBlur = 0;
            }

            // B. Enemy Hit Pips (compact red soul beads showing remaining HP)
            const maxHits = enemy.maxHits || 2;
            const currentHits = enemy.hits;
            if (maxHits > 1) {
              const pipRadius = 3.5;
              const spacing = 10;
              const totalW = (maxHits - 1) * spacing;
              const startX = sp.x - totalW * 0.5;
              const pipY = sp.y - (enemy.isWindingUp ? 26 : 12);

              for (let h = 0; h < maxHits; h++) {
                const px = startX + h * spacing;
                ctx.beginPath();
                ctx.arc(px, pipY, pipRadius, 0, Math.PI * 2);
                if (h < currentHits) {
                  ctx.fillStyle = '#ff2244';
                  ctx.fill();
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = 1;
                  ctx.stroke();
                } else {
                  ctx.fillStyle = 'rgba(40, 20, 30, 0.7)';
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(100, 50, 60, 0.5)';
                  ctx.lineWidth = 0.8;
                  ctx.stroke();
                }
              }
            }
          }
        }
      });
    }

    // 2. Render Player Queen's Ruin Immunity Badge
    if (player && player.queensRuinCheck && player.isInvulnerable) {
      const pgx = (player.renderX - this.grid.padding) / this.grid.tileSize;
      const pgy = (player.renderY - this.grid.padding) / this.grid.tileSize;
      const pw = this.gridToWorld(pgx, pgy);
      const psp = this.worldToScreen(pw.x, 2.2, pw.z);
      if (psp.x >= -40 && psp.x <= 800 && psp.y >= -40 && psp.y <= 800) {
        ctx.fillStyle = '#ffd15c';
        ctx.font = 'bold 11px JetBrains Mono, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText(`👑 IMMUNE ${player.invulnTimer.toFixed(1)}s`, psp.x, psp.y - 14);
        ctx.shadowBlur = 0;
      }
    }

    // 3. Render floating combat texts
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
