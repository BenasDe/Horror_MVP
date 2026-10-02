import { TILE_STATUS } from '../config.js';

/** Tile geometry depends on visual state, never on a countdown timer. */
export class TileRenderer {
  constructor(scene, grid, resources, tileSize) {
    this.scene = scene;
    this.grid = grid;
    this.resources = resources;
    this.holders = [];
    this.overlayCreations = 0;
    this.materials = {
      jade: resources.material('tile:jade', 'MeshStandardMaterial', {
        color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.85, roughness: 0.2
      }),
      crimson: resources.material('tile:crimson', 'MeshStandardMaterial', {
        color: 0xff2244, emissive: 0x990011, emissiveIntensity: 0.9, roughness: 0.3
      }),
      bone: resources.material('tile:bone', 'MeshStandardMaterial', {
        color: 0xe8ded2, roughness: 0.65, metalness: 0.05
      }),
      ward: resources.material('tile:ward', 'MeshStandardMaterial', {
        color: 0x00f0ff, emissive: 0x00a3cc, emissiveIntensity: 0.9,
        transparent: true, opacity: 0.65, roughness: 0.1
      }),
      enemyRune: resources.material('tile:enemyRune', 'MeshBasicMaterial', { color: 0xff334b, side: THREE.DoubleSide }),
      playerRune: resources.material('tile:playerRune', 'MeshBasicMaterial', { color: 0x10b981, side: THREE.DoubleSide })
    };
    const slabGeo = resources.geometry('BoxGeometry', tileSize * 0.94, 0.3, tileSize * 0.94);
    const runeGeo = resources.geometry('BoxGeometry', tileSize * 0.35, 0.02, tileSize * 0.35);
    const light = resources.material('tile:light', 'MeshStandardMaterial', { color: 0x1a1525, roughness: 0.85, metalness: 0.1 });
    const dark = resources.material('tile:dark', 'MeshStandardMaterial', { color: 0x130f1c, roughness: 0.85, metalness: 0.1 });
    const runeMat = resources.material('tile:rune', 'MeshStandardMaterial', { color: 0x3d274d, roughness: 0.6 });
    for (let y = 0; y < grid.rows; y++) {
      const row = [];
      for (let x = 0; x < grid.cols; x++) {
        const wx = (x - 4) * tileSize;
        const wz = (y - 4) * tileSize;
        const slab = new THREE.Mesh(slabGeo, (x + y) % 2 === 0 ? light : dark);
        slab.position.set(wx, -0.15, wz);
        slab.receiveShadow = true;
        const rune = new THREE.Mesh(runeGeo, runeMat);
        rune.position.set(wx, 0.01, wz);
        const overlayGroup = new THREE.Group();
        overlayGroup.position.set(wx, 0, wz);
        overlayGroup.visible = false;
        scene.add(slab, rune, overlayGroup);
        row.push({ slab, rune, overlayGroup, mask: 0, overlays: {} });
      }
      this.holders.push(row);
    }
  }

  ensure(holder, name) {
    if (holder.overlays[name]) return holder.overlays[name];
    const object = this.createOverlay(name);
    holder.overlays[name] = object;
    holder.overlayGroup.add(object);
    this.overlayCreations++;
    return object;
  }

  createOverlay(name) {
    const r = this.resources;
    const m = this.materials;
    if (name === 'ring') {
      const ring = new THREE.Mesh(r.geometry('RingGeometry', 0.2, 0.78, 20), m.playerRune);
      ring.rotation.x = -Math.PI * 0.5;
      ring.position.y = 0.03;
      return ring;
    }
    if (name === 'ward') {
      const ward = new THREE.Mesh(r.geometry('CylinderGeometry', 0.72, 0.72, 0.08, 6), m.ward);
      ward.position.y = 0.28;
      return ward;
    }
    const group = new THREE.Group();
    if (name === 'bone') {
      const pillar = new THREE.Mesh(r.geometry('CylinderGeometry', 0.38, 0.45, 1.4, 6), m.bone);
      pillar.position.y = 0.7;
      pillar.castShadow = true;
      const horn = new THREE.Mesh(r.geometry('ConeGeometry', 0.24, 0.5, 4), m.bone);
      horn.position.y = 1.6;
      group.add(pillar, horn);
    } else {
      const player = name === 'playerSpikes';
      const geometry = player ? r.geometry('ConeGeometry', 0.16, 0.95, 4) : r.geometry('ConeGeometry', 0.2, 1.1, 5);
      const offsets = player
        ? [[0, 0], [0.35, 0.35], [-0.35, 0.35], [0.35, -0.35], [-0.35, -0.35]]
        : [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]];
      offsets.forEach(([x, z]) => {
        const spike = new THREE.Mesh(geometry, player ? m.jade : m.crimson);
        spike.position.set(x, player ? 0.48 : 0.55, z);
        group.add(spike);
      });
    }
    return group;
  }

  sync() {
    for (let y = 0; y < this.grid.rows; y++) {
      for (let x = 0; x < this.grid.cols; x++) {
        const tile = this.grid.tiles[y][x];
        const holder = this.holders[y][x];
        const player = tile.effects.player;
        const enemy = tile.effects.enemy;
        const enemyRune = !!tile.telegraphs.enemy?.active;
        const playerRune = !enemyRune && !!tile.telegraphs.player?.active;
        const mask = (tile.status === TILE_STATUS.INACCESSIBLE ? 1 : 0)
          | (player?.status === TILE_STATUS.SHIELDED ? 2 : 0)
          | (player?.status === TILE_STATUS.DAMAGING ? 4 : 0)
          | (enemy?.status === TILE_STATUS.DAMAGING ? 8 : 0)
          | (enemyRune ? 16 : 0) | (playerRune ? 32 : 0);
        if (holder.mask === mask) continue;
        holder.mask = mask;
        holder.overlayGroup.visible = mask !== 0;
        for (const [name, flag] of [['bone', 1], ['ward', 2], ['playerSpikes', 4], ['enemySpikes', 8], ['ring', 48]]) {
          const visible = (mask & flag) !== 0;
          if (visible) this.ensure(holder, name).visible = true;
          else if (holder.overlays[name]) holder.overlays[name].visible = false;
        }
        if (mask & 48) holder.overlays.ring.material = enemyRune ? this.materials.enemyRune : this.materials.playerRune;
      }
    }
  }

  reset() {
    for (const row of this.holders) {
      for (const holder of row) {
        holder.mask = 0;
        holder.overlayGroup.visible = false;
        Object.values(holder.overlays).forEach(object => { object.visible = false; });
      }
    }
  }
}
