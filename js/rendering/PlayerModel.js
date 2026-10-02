/** Procedural cultivator model; proportions and materials match the original renderer. */
export class PlayerModel {
  constructor(scene, resources) {
    this.scene = scene;
    this.resources = resources;
    // 1. Rogue Cultivator (Player)
    this.playerGroup = new THREE.Group();

    // A. Player Ground Tactical Rune Ring (clearly marks current tile & position)
    const ringGeo = this.resources.geometry('RingGeometry', 0.55, 0.68, 32);
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
    const innerDiscGeo = this.resources.geometry('CircleGeometry', 0.53, 32);
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
    const robe = new THREE.Mesh(this.resources.geometry('ConeGeometry', 0.48, 1.15, 8), robeMat);
    robe.position.y = 0.58;
    robe.castShadow = true;
    this.playerGroup.add(robe);

    // Glowing Jade/Cyan Trim collar on robe
    const trimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const trim = new THREE.Mesh(this.resources.geometry('TorusGeometry', 0.32, 0.045, 8, 20), trimMat);
    trim.rotation.x = Math.PI * 0.5;
    trim.position.y = 1.08;
    this.playerGroup.add(trim);

    // Glowing Cyan Soul Head
    const soulMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.3
    });
    const head = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.26, 16, 16), soulMat);
    head.position.y = 1.36;
    this.playerGroup.add(head);

    // Mystical Spirit Halo above head (visible clearly from top-down)
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(this.resources.geometry('TorusGeometry', 0.34, 0.035, 8, 24), haloMat);
    halo.rotation.x = Math.PI * 0.5;
    halo.position.y = 1.72;
    this.playerGroup.add(halo);

    // Direction Compass Arrow (High contrast bright gold chevron)
    const talisMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    this.playerFacingArrow = new THREE.Mesh(this.resources.geometry('ConeGeometry', 0.16, 0.42, 4), talisMat);
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
      const bead = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.11, 8, 8), beadMat);
      this.playerGroup.add(bead);
      this.playerHitBeads.push(bead);
    }

    // Hovering Jade Spirit Flying Sword (飞剑 - Classic Wuxia Daoist focus weapon)
    this.playerSword = new THREE.Group();
    const bladeGeo = this.resources.geometry('BoxGeometry', 0.06, 0.68, 0.025);
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

    const tip = new THREE.Mesh(this.resources.geometry('ConeGeometry', 0.045, 0.16, 4), bladeMat);
    tip.position.y = 0.76;
    this.playerSword.add(tip);

    const guardMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
    const guard = new THREE.Mesh(this.resources.geometry('BoxGeometry', 0.18, 0.035, 0.05), guardMat);
    this.playerSword.add(guard);

    const hilt = new THREE.Mesh(this.resources.geometry('CylinderGeometry', 0.02, 0.02, 0.16, 6), guardMat);
    hilt.position.y = -0.1;
    this.playerSword.add(hilt);

    this.playerSword.position.set(0.42, 1.35, -0.15);
    this.playerSword.rotation.x = Math.PI * 0.15;
    this.playerGroup.add(this.playerSword);

    // Flowing Daoist Silk Twin Sash / Ribbons trailing behind robe
    this.playerSash = new THREE.Group();
    const sashMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide });

    const leftRibbon = new THREE.Mesh(this.resources.geometry('PlaneGeometry', 0.12, 0.65), sashMat);
    leftRibbon.position.set(-0.12, -0.28, 0.26);
    leftRibbon.rotation.x = Math.PI * 0.1;
    this.playerSash.add(leftRibbon);

    const rightRibbon = new THREE.Mesh(this.resources.geometry('PlaneGeometry', 0.12, 0.65), sashMat);
    rightRibbon.position.set(0.12, -0.28, 0.26);
    rightRibbon.rotation.x = Math.PI * 0.1;
    this.playerSash.add(rightRibbon);

    this.playerSash.position.set(0, 0.6, 0);
    this.playerGroup.add(this.playerSash);

    this.scene.add(this.playerGroup);
  }
}
