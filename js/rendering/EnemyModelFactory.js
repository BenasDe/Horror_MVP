/** Cached geometry, with separate materials for each enemy model to isolate hit flashes. */
export class EnemyModelFactory {
  constructor(resources, boneMat) {
    this.resources = resources;
    this.boneMat = boneMat;
  }

  create(enemy) {
    const group = new THREE.Group();

    if (enemy.name === "Corpse Emperor") {
      // Ground Boss Demonic Aura Ring
      const bossRingGeo = this.resources.geometry('RingGeometry', 1.3, 1.5, 36);
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
      const body = new THREE.Mesh(this.resources.geometry('CylinderGeometry', 0.85, 1.1, 2.2, 10), emperorMat);
      body.position.y = 1.1;
      body.castShadow = true;
      group.add(body);

      // Head
      const headMat = new THREE.MeshStandardMaterial({ color: 0x2b040a });
      const head = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.48, 12, 12), headMat);
      head.position.y = 2.4;
      group.add(head);

      // Glowing Demonic Red Eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
      const leftEye = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.08, 6, 6), eyeMat);
      leftEye.position.set(-0.18, 2.42, 0.44);
      group.add(leftEye);
      const rightEye = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.08, 6, 6), eyeMat);
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
      const crownBase = new THREE.Mesh(this.resources.geometry('CylinderGeometry', 0.55, 0.45, 0.55, 6), crownMat);
      crownBase.position.y = 2.85;
      group.add(crownBase);

      // Crown Spikes
      for (let s = 0; s < 6; s++) {
        const angle = (s / 6) * Math.PI * 2;
        const spike = new THREE.Mesh(this.resources.geometry('ConeGeometry', 0.1, 0.35, 4), crownMat);
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

        const plate = new THREE.Mesh(this.resources.geometry('BoxGeometry', 0.45, 0.28, 0.5), pauldronMat);
        pGroup.add(plate);

        const horn = new THREE.Mesh(this.resources.geometry('ConeGeometry', 0.12, 0.45, 4), hornMat);
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
      const barrier = new THREE.Mesh(this.resources.geometry('SphereGeometry', 1.65, 20, 20), barrierMat);
      barrier.position.y = 1.2;
      barrier.name = "immunityBarrier";
      group.add(barrier);

    } else {
      // Normal Enemy Ground Danger Ring
      const dangerRingGeo = this.resources.geometry('RingGeometry', 0.48, 0.6, 24);
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
        const body = new THREE.Mesh(this.resources.geometry('CylinderGeometry', 0.35, 0.42, 1.1, 8), robeMat);
        body.position.y = 0.55;
        body.castShadow = true;
        group.add(body);

        // Pale Ghastly Head
        const headMat = new THREE.MeshStandardMaterial({ color: 0xe8f0ed, roughness: 0.8 });
        const head = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.26, 12, 12), headMat);
        head.position.y = 1.3;
        group.add(head);

        // Glowing Red Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
        const leftEye = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.045, 6, 6), eyeMat);
        leftEye.position.set(-0.09, 1.32, 0.24);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.045, 6, 6), eyeMat);
        rightEye.position.set(0.09, 1.32, 0.24);
        group.add(rightEye);

        // Qing Official Cap
        const hatMat = new THREE.MeshStandardMaterial({ color: 0x161c28, roughness: 0.5 });
        const brim = new THREE.Mesh(this.resources.geometry('CylinderGeometry', 0.48, 0.48, 0.06, 12), hatMat);
        brim.position.y = 1.45;
        group.add(brim);

        const crown = new THREE.Mesh(this.resources.geometry('ConeGeometry', 0.28, 0.28, 8), hatMat);
        crown.position.y = 1.62;
        group.add(crown);

        // Red Tassel on top of hat (Crucial for top-down visibility!)
        const tasselMat = new THREE.MeshBasicMaterial({ color: 0xff1a35 });
        const tassel = new THREE.Mesh(this.resources.geometry('ConeGeometry', 0.09, 0.22, 6), tasselMat);
        tassel.position.y = 1.82;
        group.add(tassel);

        // Yellow Taoist Talisman on Forehead (Tilted so camera sees it)
        const talisMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
        const talis = new THREE.Mesh(this.resources.geometry('PlaneGeometry', 0.14, 0.32), talisMat);
        talis.position.set(0, 1.25, 0.28);
        talis.rotation.x = -0.15;
        talis.name = "foreheadTalisman";
        group.add(talis);

        // Outstretched Arms
        const armMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f });
        const arms = new THREE.Mesh(this.resources.geometry('BoxGeometry', 0.7, 0.14, 0.6), armMat);
        arms.position.set(0, 0.9, 0.32);
        group.add(arms);

        // Hanging Qing Official Sleeves (Bounces with hops)
        const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x162c4a });
        const leftSleeve = new THREE.Mesh(this.resources.geometry('BoxGeometry', 0.18, 0.36, 0.22), sleeveMat);
        leftSleeve.position.set(-0.35, 0.72, 0.28);
        leftSleeve.name = "leftSleeve";
        group.add(leftSleeve);
        const rightSleeve = new THREE.Mesh(this.resources.geometry('BoxGeometry', 0.18, 0.36, 0.22), sleeveMat);
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
        const body = new THREE.Mesh(this.resources.geometry('ConeGeometry', 0.4, 1.2, 8), ghostMat);
        body.rotation.x = Math.PI;
        body.position.y = 1.1;
        group.add(body);

        const headMat = new THREE.MeshStandardMaterial({
          color: 0xc084fc,
          emissive: 0xa855f7,
          emissiveIntensity: 1.3
        });
        const head = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.26, 12, 12), headMat);
        head.position.y = 1.35;
        group.add(head);

      } else if (enemy.name === "Corpse Scribe") {
        // Skeletal sorcerer with bone scroll
        const robeMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.65 });
        const body = new THREE.Mesh(this.resources.geometry('CylinderGeometry', 0.32, 0.45, 1.2, 8), robeMat);
        body.position.y = 0.6;
        group.add(body);

        // Bone Skull
        const skull = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.24, 10, 10), this.boneMat.clone());
        skull.position.y = 1.35;
        group.add(skull);

        // Glowing Crimson Eye Gems
        const skullEyeMat = new THREE.MeshBasicMaterial({ color: 0xff1144 });
        const se1 = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.04, 6, 6), skullEyeMat);
        se1.position.set(-0.08, 1.37, 0.22);
        group.add(se1);
        const se2 = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.04, 6, 6), skullEyeMat);
        se2.position.set(0.08, 1.37, 0.22);
        group.add(se2);

        // Glowing Bone Scroll
        const scrollMat = new THREE.MeshStandardMaterial({
          color: 0xfde047,
          emissive: 0xd97706,
          emissiveIntensity: 0.6,
          roughness: 0.5
        });
        const scroll = new THREE.Mesh(this.resources.geometry('BoxGeometry', 0.65, 0.12, 0.28), scrollMat);
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
          const orb = new THREE.Mesh(this.resources.geometry('SphereGeometry', 0.08, 8, 8), orbMat);
          orb.position.set(Math.cos(oAngle) * 0.65, 1.25, Math.sin(oAngle) * 0.65);
          scribeOrbs.add(orb);
        }
        group.add(scribeOrbs);
      }
    }

    return group;
  }
}
