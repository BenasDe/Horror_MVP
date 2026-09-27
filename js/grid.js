/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Grid System & Tile State Manager
 */

import { GRID_CONFIG, TILE_STATUS, TILE_DURATIONS } from './config.js';
import { horrorAudio } from './audio.js';

export class PagodaGrid {
  constructor(cols = GRID_CONFIG.COLS, rows = GRID_CONFIG.ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.tileSize = GRID_CONFIG.TILE_SIZE;
    this.padding = GRID_CONFIG.PADDING;
    this.tiles = [];
    this.init();
  }

  init() {
    this.tiles = [];
    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        row.push({
          x,
          y,
          status: TILE_STATUS.NORMAL,
          duration: 0,
          owner: null, // 'player' | 'enemy'
          telegraph: {
            active: false,
            timer: 0,
            totalDuration: 0,
            targetStatus: TILE_STATUS.NORMAL,
            owner: null,
            onTrigger: null
          }
        });
      }
      this.tiles.push(row);
    }
  }

  reset() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.tiles[y][x];
        t.status = TILE_STATUS.NORMAL;
        t.duration = 0;
        t.owner = null;
        t.telegraph.active = false;
        t.telegraph.timer = 0;
      }
    }
  }

  isInBounds(x, y) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  getTile(x, y) {
    if (!this.isInBounds(x, y)) return null;
    return this.tiles[y][x];
  }

  // Set tile directly to active status
  setTileStatus(x, y, status, duration = null, owner = 'player') {
    const tile = this.getTile(x, y);
    if (!tile) return false;

    // A Shielded tile cannot be overridden by DAMAGING or INACCESSIBLE unless owner is same or shield expires
    if (tile.status === TILE_STATUS.SHIELDED && status !== TILE_STATUS.SHIELDED && status !== TILE_STATUS.NORMAL) {
      return false; // Ward protects tile
    }

    tile.status = status;
    tile.owner = owner;

    if (duration !== null) {
      tile.duration = duration;
    } else {
      if (status === TILE_STATUS.DAMAGING) tile.duration = TILE_DURATIONS.DAMAGING;
      else if (status === TILE_STATUS.INACCESSIBLE) tile.duration = TILE_DURATIONS.INACCESSIBLE;
      else if (status === TILE_STATUS.SHIELDED) tile.duration = TILE_DURATIONS.SHIELDED;
      else tile.duration = 0;
    }

    return true;
  }

  // Queue a telegraphed activation
  telegraphTile(x, y, targetStatus, delay, owner = 'player', onTrigger = null) {
    const tile = this.getTile(x, y);
    if (!tile) return;

    tile.telegraph = {
      active: true,
      timer: delay,
      totalDuration: delay,
      targetStatus,
      owner,
      onTrigger
    };
  }

  cancelTelegraph(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) return;
    tile.telegraph.active = false;
    tile.telegraph.timer = 0;
  }

  isWalkable(x, y, isWraith = false) {
    if (!this.isInBounds(x, y)) return false;
    const tile = this.tiles[y][x];
    if (tile.status === TILE_STATUS.INACCESSIBLE && !isWraith) {
      return false;
    }
    return true;
  }

  isDamaging(x, y) {
    const tile = this.getTile(x, y);
    return tile && tile.status === TILE_STATUS.DAMAGING;
  }

  // Prevents self-damage: Player only takes damage from enemy tiles, enemies only from player tiles
  isDamagingTo(x, y, targetType = 'player') {
    const tile = this.getTile(x, y);
    if (!tile || tile.status !== TILE_STATUS.DAMAGING) return false;
    if (targetType === 'player') {
      return tile.owner === 'enemy';
    }
    if (targetType === 'enemy') {
      return tile.owner === 'player';
    }
    return true;
  }

  isShielded(x, y) {
    const tile = this.getTile(x, y);
    return tile && tile.status === TILE_STATUS.SHIELDED;
  }

  breakShield(x, y) {
    const tile = this.getTile(x, y);
    if (tile && tile.status === TILE_STATUS.SHIELDED) {
      tile.status = TILE_STATUS.NORMAL;
      tile.duration = 0;
      horrorAudio.playShieldBreak();
      return true;
    }
    return false;
  }

  update(dt) {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.tiles[y][x];

        // 1. Update Telegraph
        if (tile.telegraph.active) {
          tile.telegraph.timer -= dt;
          if (tile.telegraph.timer <= 0) {
            tile.telegraph.active = false;
            // Activate target status
            this.setTileStatus(x, y, tile.telegraph.targetStatus, null, tile.telegraph.owner);
            if (tile.telegraph.onTrigger) {
              tile.telegraph.onTrigger(x, y, tile.telegraph.targetStatus);
            }
          }
        }

        // 2. Update Active Status duration decay
        if (tile.status !== TILE_STATUS.NORMAL) {
          tile.duration -= dt;
          if (tile.duration <= 0) {
            tile.status = TILE_STATUS.NORMAL;
            tile.owner = null;
          }
        }
      }
    }
  }

  gridToPixel(gx, gy) {
    return {
      x: this.padding + gx * this.tileSize,
      y: this.padding + gy * this.tileSize
    };
  }

  pixelToGrid(px, py) {
    const gx = Math.floor((px - this.padding) / this.tileSize);
    const gy = Math.floor((py - this.padding) / this.tileSize);
    return { gx, gy, valid: this.isInBounds(gx, gy) };
  }
}
