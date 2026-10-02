/** Static pagoda scenery and ambient light animation. */
export class SceneEnvironment {
  constructor(scene, resources, tileSize) {
    this.scene = scene;
    this.resources = resources;
    this.TILE_SIZE = tileSize;
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

    const brazierMat = this.resources.material('environment:brazierMat', 'MeshStandardMaterial', { color: 0x1f192b, roughness: 0.8 });
    const flameMat = this.resources.material('environment:flameMat', 'MeshBasicMaterial', { color: 0xff3344 });

    cornerPositions.forEach(([bx, bz]) => {
      // Stone Brazier Stand
      const stand = new THREE.Mesh(this.resources.geometry('CylinderGeometry', 0.35, 0.45, 1.2, 6), brazierMat);
      stand.position.set(bx, 0.6, bz);
      stand.castShadow = true;
      this.scene.add(stand);

      // Glowing flame core
      const flame = new THREE.Mesh(this.resources.geometry('DodecahedronGeometry', 0.2), flameMat);
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
    const curbMat = this.resources.material('environment:curbMat', 'MeshStandardMaterial', { color: 0x130e1c, roughness: 0.9 });
    const wallThick = 0.5;
    const arenaSpan = 9 * this.TILE_SIZE + wallThick;

    const northCurb = new THREE.Mesh(this.resources.geometry('BoxGeometry', arenaSpan, 0.6, wallThick), curbMat);
    northCurb.position.set(0, 0.3, -4.5 * this.TILE_SIZE - wallThick * 0.5);
    this.scene.add(northCurb);

    const southCurb = new THREE.Mesh(this.resources.geometry('BoxGeometry', arenaSpan, 0.6, wallThick), curbMat);
    southCurb.position.set(0, 0.3, 4.5 * this.TILE_SIZE + wallThick * 0.5);
    this.scene.add(southCurb);

    const westCurb = new THREE.Mesh(this.resources.geometry('BoxGeometry', wallThick, 0.6, arenaSpan), curbMat);
    westCurb.position.set(-4.5 * this.TILE_SIZE - wallThick * 0.5, 0.3, 0);
    this.scene.add(westCurb);

    const eastCurb = new THREE.Mesh(this.resources.geometry('BoxGeometry', wallThick, 0.6, arenaSpan), curbMat);
    eastCurb.position.set(4.5 * this.TILE_SIZE + wallThick * 0.5, 0.3, 0);
    this.scene.add(eastCurb);

    // Low-lying Ethereal Pagoda Spirit Mist Discs
    this.spiritFogPlanes = [];
    const mistGeo = this.resources.geometry('CircleGeometry', 5.2, 24);
    const mistMat = this.resources.material('environment:mistMat', 'MeshBasicMaterial', {
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

  update(dt, now) {
    this.brazierLights.forEach((b, idx) => {
      const flicker = Math.sin(now * 10 + idx * 2) * 0.25 + Math.cos(now * 15 + idx) * 0.15;
      b.light.intensity = b.baseIntensity + flicker;
    });
    this.spiritFogPlanes.forEach(fp => { fp.mesh.rotation.z += dt * fp.rotSpeed; });
  }

  dispose() {
    this.scene.traverse(object => {
      object.shadow?.map?.dispose();
      object.shadow?.mapPass?.dispose();
    });
  }
}
