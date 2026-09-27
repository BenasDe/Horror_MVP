/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Grid System & Layered Tile State Manager (Player & Enemy Stacking)
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
          // Synced top-level status (enemy prioritized over player)
          status: TILE_STATUS.NORMAL,
          duration: 0,
          owner: null,
          // Layered active effects
          effects: {
            player: null,      // { status, duration }
            enemy: null,       // { status, duration }
            environment: null  // { status, duration }
          },
          // Layered telegraphs
          telegraphs: {
            player: null,      // { active, timer, totalDuration, targetStatus, onTrigger }
            enemy: null        // { active, timer, totalDuration, targetStatus, onTrigger }
          },
          // Legacy telegraph reference
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
        t.effects = { player: null, enemy: null, environment: null };
        t.telegraphs = { player: null, enemy: null };
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

  // Set tile directly to active status with layer ownership
  setTileStatus(x, y, status, duration = null, owner = 'player') {
    const tile = this.getTile(x, y);
    if (!tile) return false;

    // Ward check: If tile is shielded by player, enemy damaging cannot penetrate
    if (this.isShielded(x, y) && owner === 'enemy' && status !== TILE_STATUS.NORMAL) {
      return false; // Ward protects tile
    }

    let defaultDuration = 0;
    if (duration !== null) {
      defaultDuration = duration;
    } else {
      if (status === TILE_STATUS.DAMAGING) defaultDuration = TILE_DURATIONS.DAMAGING;
      else if (status === TILE_STATUS.INACCESSIBLE) defaultDuration = TILE_DURATIONS.INACCESSIBLE;
      else if (status === TILE_STATUS.SHIELDED) defaultDuration = TILE_DURATIONS.SHIELDED;
    }

    const key = (owner === 'environment') ? 'environment' : (owner === 'enemy' ? 'enemy' : 'player');

    if (status === TILE_STATUS.NORMAL) {
      if (owner) {
        tile.effects[key] = null;
      } else {
        tile.effects = { player: null, enemy: null, environment: null };
      }
    } else {
      tile.effects[key] = {
        status,
        duration: defaultDuration
      };
    }

    this.syncTileTopState(tile);
    return true;
  }

  // Queue a telegraphed activation per owner
  telegraphTile(x, y, targetStatus, delay, owner = 'player', onTrigger = null) {
    const tile = this.getTile(x, y);
    if (!tile) return;

    const tObj = {
      active: true,
      timer: delay,
      totalDuration: delay,
      targetStatus,
      owner,
      onTrigger
    };

    const key = owner === 'enemy' ? 'enemy' : 'player';
    tile.telegraphs[key] = tObj;

    // Legacy sync (enemy takes visual precedence)
    if (tile.telegraphs.enemy) {
      tile.telegraph = tile.telegraphs.enemy;
    } else {
      tile.telegraph = tile.telegraphs.player;
    }
  }

  cancelTelegraph(x, y, owner = null) {
    const tile = this.getTile(x, y);
    if (!tile) return;
    if (owner && tile.telegraphs[owner]) {
      tile.telegraphs[owner].active = false;
      tile.telegraphs[owner] = null;
    } else {
      tile.telegraphs.player = null;
      tile.telegraphs.enemy = null;
      tile.telegraph.active = false;
    }
  }

  isWalkable(x, y, isWraith = false) {
    if (!this.isInBounds(x, y)) return false;
    const tile = this.tiles[y][x];
    if (isWraith) return true;
    if (tile.effects.environment && tile.effects.environment.status === TILE_STATUS.INACCESSIBLE) return false;
    if (tile.effects.enemy && tile.effects.enemy.status === TILE_STATUS.INACCESSIBLE) return false;
    if (tile.effects.player && tile.effects.player.status === TILE_STATUS.INACCESSIBLE) return false;
    return true;
  }

  isDamaging(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) return false;
    return (tile.effects.player && tile.effects.player.status === TILE_STATUS.DAMAGING) ||
           (tile.effects.enemy && tile.effects.enemy.status === TILE_STATUS.DAMAGING);
  }

  // Prevents friendly fire:
  // Player is ONLY damaged by enemy damaging tiles!
  // Enemies are ONLY damaged by player damaging tiles!
  isDamagingTo(x, y, targetType = 'player') {
    const tile = this.getTile(x, y);
    if (!tile) return false;
    if (targetType === 'player') {
      return Boolean(tile.effects.enemy && tile.effects.enemy.status === TILE_STATUS.DAMAGING);
    }
    if (targetType === 'enemy') {
      return Boolean(tile.effects.player && tile.effects.player.status === TILE_STATUS.DAMAGING);
    }
    return false;
  }

  isShielded(x, y) {
    const tile = this.getTile(x, y);
    return Boolean(tile && tile.effects.player && tile.effects.player.status === TILE_STATUS.SHIELDED);
  }

  breakShield(x, y) {
    const tile = this.getTile(x, y);
    if (tile && tile.effects.player && tile.effects.player.status === TILE_STATUS.SHIELDED) {
      tile.effects.player = null;
      this.syncTileTopState(tile);
      horrorAudio.playShieldBreak();
      return true;
    }
    return false;
  }

  syncTileTopState(tile) {
    // Enemy effects take top priority in reporting, then player, then environment
    if (tile.effects.enemy) {
      tile.status = tile.effects.enemy.status;
      tile.owner = 'enemy';
      tile.duration = tile.effects.enemy.duration;
    } else if (tile.effects.player) {
      tile.status = tile.effects.player.status;
      tile.owner = 'player';
      tile.duration = tile.effects.player.duration;
    } else if (tile.effects.environment) {
      tile.status = tile.effects.environment.status;
      tile.owner = 'environment';
      tile.duration = tile.effects.environment.duration;
    } else {
      tile.status = TILE_STATUS.NORMAL;
      tile.owner = null;
      tile.duration = 0;
    }
  }

  update(dt) {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.tiles[y][x];

        // 1. Update Telegraphs for both player and enemy
        ['player', 'enemy'].forEach(ownerKey => {
          const t = tile.telegraphs[ownerKey];
          if (t && t.active) {
            t.timer -= dt;
            if (t.timer <= 0) {
              t.active = false;
              tile.telegraphs[ownerKey] = null;
              this.setTileStatus(x, y, t.targetStatus, null, ownerKey);
              if (t.onTrigger) {
                t.onTrigger(x, y, t.targetStatus);
              }
            }
          }
        });

        // 2. Update Active Effects duration decay
        ['player', 'enemy'].forEach(key => {
          const eff = tile.effects[key];
          if (eff) {
            eff.duration -= dt;
            if (eff.duration <= 0) {
              tile.effects[key] = null;
            }
          }
        });

        this.syncTileTopState(tile);

        // Legacy telegraph sync (enemy takes priority)
        if (tile.telegraphs.enemy && tile.telegraphs.enemy.active) {
          tile.telegraph = tile.telegraphs.enemy;
        } else if (tile.telegraphs.player && tile.telegraphs.player.active) {
          tile.telegraph = tile.telegraphs.player;
        } else {
          tile.telegraph = { active: false, timer: 0, totalDuration: 0, targetStatus: TILE_STATUS.NORMAL, owner: null };
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
