/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Enemy Entities & Demonic Chess Spell Kits
 */

import { TILE_STATUS } from './config.js';
import { horrorAudio } from './audio.js';

class BaseEnemy {
  constructor(grid, x, y, name, maxHits = 1, marrow = 10) {
    this.grid = grid;
    this.x = x;
    this.y = y;
    this.name = name;
    this.maxHits = maxHits;
    this.hits = maxHits;
    this.marrow = marrow;
    this.alive = true;

    const p = grid.gridToPixel(x, y);
    this.renderX = p.x;
    this.renderY = p.y;
    this.fromX = x;
    this.fromY = y;
    this.toX = x;
    this.toY = y;
    this.isMoving = false;
    this.moveTimer = 0;
    this.moveDuration = 0.22; // snappier movement

    // Windup / Telegraph for physical collision
    this.isWindingUp = false;
    this.windupTimer = 0;
    this.windupDuration = 0.26; // 0.26s fast visible windup
    this.intendedTarget = null;

    // Casting state
    this.isCasting = false;
    this.castTimer = 0;
    this.castDuration = 0;
    this.currentSpell = null;
  }

  takeDamage(amount = 1) {
    if (!this.alive) return;
    this.hits -= amount;
    if (this.hits <= 0) {
      this.hits = 0;
      this.alive = false;
      return true; // died
    }
    return false;
  }

  updateMovement(dt) {
    if (this.isMoving) {
      this.moveTimer += dt;
      const progress = Math.min(1, this.moveTimer / this.moveDuration);
      const p1 = this.grid.gridToPixel(this.fromX, this.fromY);
      const p2 = this.grid.gridToPixel(this.toX, this.toY);

      this.renderX = p1.x + (p2.x - p1.x) * progress;
      this.renderY = p1.y + (p2.y - p1.y) * progress;

      if (progress >= 1) {
        this.isMoving = false;
        this.x = this.toX;
        this.y = this.toY;
        this.renderX = p2.x;
        this.renderY = p2.y;

        // Check if landed on a player Damaging tile
        if (this.grid.isDamagingTo(this.x, this.y, 'enemy')) {
          this.takeDamage(1);
        }
      }
    } else {
      const p = this.grid.gridToPixel(this.x, this.y);
      this.renderX = p.x;
      this.renderY = p.y;
      if (this.grid.isDamagingTo(this.x, this.y, 'enemy')) {
        this.takeDamage(1);
      }
    }
  }
}

// 1. Hopping Jiangshi (Corpse Fiend)
export class JiangshiEnemy extends BaseEnemy {
  constructor(grid, x, y) {
    super(grid, x, y, "Hopping Jiangshi", 1, 10);
    this.hopCooldown = 0.85; // faster rhythmic hops (was 1.1s)
    this.timer = 0.3 + Math.random() * 0.4;
    this.spellCooldown = 5.0;
    this.spellTimer = 2.5 + Math.random() * 1.5;
  }

  update(dt, player, enemies) {
    if (!this.alive) return;
    this.updateMovement(dt);

    if (this.isMoving) return;

    // Spell: Knight's Blood Pounce
    this.spellTimer += dt;
    if (this.spellTimer >= this.spellCooldown && !this.isCasting && !this.isWindingUp) {
      this.castBloodPounce(player);
      return;
    }

    // Spell casting progression
    if (this.isCasting) {
      this.castTimer -= dt;
      if (this.castTimer <= 0) {
        this.isCasting = false;
        this.executeBloodPounce(player);
      }
      return;
    }

    // Physical hop wind-up
    if (this.isWindingUp) {
      this.windupTimer -= dt;
      if (this.windupTimer <= 0) {
        this.isWindingUp = false;
        this.executeHop(this.intendedTarget, player);
      }
      return;
    }

    // Cooldown before next hop
    this.timer += dt;
    if (this.timer >= this.hopCooldown) {
      this.timer = 0;
      this.planHop(player, enemies);
    }
  }

  planHop(player, enemies) {
    // Choose step towards player
    const dx = player.x - this.x;
    const dy = player.y - this.y;

    let stepX = 0;
    let stepY = 0;

    // Cardinal step towards player
    if (Math.abs(dx) > Math.abs(dy)) {
      stepX = Math.sign(dx);
    } else if (dy !== 0) {
      stepY = Math.sign(dy);
    } else {
      stepX = Math.sign(dx);
    }

    const targetX = this.x + stepX;
    const targetY = this.y + stepY;

    if (this.grid.isWalkable(targetX, targetY)) {
      // Wind up for 0.35s
      this.isWindingUp = true;
      this.windupTimer = this.windupDuration;
      this.intendedTarget = { x: targetX, y: targetY };
    }
  }

  executeHop(target, player) {
    if (!target) return;
    this.fromX = this.x;
    this.fromY = this.y;
    this.toX = target.x;
    this.toY = target.y;
    this.isMoving = true;
    this.moveTimer = 0;
    horrorAudio.playJiangshiHop();

    // Collision check with player's current tile
    if (target.x === player.x && target.y === player.y) {
      player.takeDamage(false, "Jiangshi Bite & Hop");
    }
  }

  castBloodPounce(player) {
    this.isCasting = true;
    this.castTimer = 0.9; // 0.9s telegraph
    this.spellTimer = 0;

    // Calculate Knight L-shaped landing near player
    const offsets = [
      [1, 2], [2, 1], [-1, 2], [-2, 1],
      [1, -2], [2, -1], [-1, -2], [-2, -1]
    ];
    let bestOffset = offsets[0];
    let minDist = 999;
    for (const [ox, oy] of offsets) {
      const tx = this.x + ox;
      const ty = this.y + oy;
      if (this.grid.isInBounds(tx, ty)) {
        const dist = Math.hypot(player.x - tx, player.y - ty);
        if (dist < minDist) {
          minDist = dist;
          bestOffset = [ox, oy];
        }
      }
    }

    const landingX = this.x + bestOffset[0];
    const landingY = this.y + bestOffset[1];
    this.pounceLanding = { x: landingX, y: landingY };

    // Telegraph landing and adjacent cross tiles with crimson runes
    const targets = [
      { x: landingX, y: landingY },
      { x: landingX + 1, y: landingY },
      { x: landingX - 1, y: landingY },
      { x: landingX, y: landingY + 1 },
      { x: landingX, y: landingY - 1 }
    ];

    targets.forEach(t => {
      if (this.grid.isInBounds(t.x, t.y)) {
        this.grid.telegraphTile(t.x, t.y, TILE_STATUS.DAMAGING, 0.9, 'enemy', (tx, ty) => {
          if (tx === player.x && ty === player.y) {
            player.takeDamage(false, "Jiangshi Blood Pounce");
          }
        });
      }
    });
  }

  executeBloodPounce(player) {
    if (this.pounceLanding && this.grid.isInBounds(this.pounceLanding.x, this.pounceLanding.y)) {
      this.x = this.pounceLanding.x;
      this.y = this.pounceLanding.y;
      const p = this.grid.gridToPixel(this.x, this.y);
      this.renderX = p.x;
      this.renderY = p.y;
      horrorAudio.playSpellDetonation(1.1);

      if (this.x === player.x && this.y === player.y) {
        player.takeDamage(false, "Jiangshi Blood Pounce Slam");
      }
    }
  }
}

// 2. Resentful Wraith (Phases through walls, Bishop's Diagonal Hex)
export class WraithEnemy extends BaseEnemy {
  constructor(grid, x, y) {
    super(grid, x, y, "Resentful Wraith", 1, 15);
    this.moveCooldown = 1.05; // faster hovering (was 1.4)
    this.timer = Math.random() * 0.5;
    this.spellCooldown = 5.5;
    this.spellTimer = 1.5;
  }

  update(dt, player, enemies) {
    if (!this.alive) return;
    this.updateMovement(dt);

    if (this.isMoving) return;

    this.spellTimer += dt;
    if (this.spellTimer >= this.spellCooldown && !this.isCasting) {
      this.castBishopGaze(player);
      return;
    }

    if (this.isCasting) {
      this.castTimer -= dt;
      if (this.castTimer <= 0) {
        this.isCasting = false;
      }
      return;
    }

    this.timer += dt;
    if (this.timer >= this.moveCooldown) {
      this.timer = 0;
      this.glideTowards(player);
    }
  }

  glideTowards(player) {
    const dx = Math.sign(player.x - this.x);
    const dy = Math.sign(player.y - this.y);

    let nextX = this.x + dx;
    let nextY = this.y + dy;

    // Wraiths ignore inaccessible bone walls!
    if (this.grid.isInBounds(nextX, nextY)) {
      this.fromX = this.x;
      this.fromY = this.y;
      this.toX = nextX;
      this.toY = nextY;
      this.isMoving = true;
      this.moveTimer = 0;
      this.moveDuration = 0.35; // faster glide

      if (nextX === player.x && nextY === player.y) {
        player.takeDamage(false, "Wraith Soul Chill");
      }
    }
  }

  castBishopGaze(player) {
    this.isCasting = true;
    this.castTimer = 0.95;
    this.spellTimer = 0;

    // Diagonal X pattern across 4 directions
    const dirs = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
    dirs.forEach(([dx, dy]) => {
      for (let s = 1; s <= 4; s++) {
        const tx = this.x + dx * s;
        const ty = this.y + dy * s;
        if (this.grid.isInBounds(tx, ty)) {
          this.grid.telegraphTile(tx, ty, TILE_STATUS.DAMAGING, 0.95, 'enemy', (px, py) => {
            if (px === player.x && py === player.y) {
              player.takeDamage(false, "Wraith's Diagonal Hex");
            }
          });
        }
      }
    });
  }
}

// 3. Corpse Scribe (Backline Bone Sorcerer, Rook's Lance & Bone Cage)
export class CorpseScribeEnemy extends BaseEnemy {
  constructor(grid, x, y) {
    super(grid, x, y, "Corpse Scribe", 2, 25);
    this.spellTimer = 1.0;
    this.actionCooldown = 2.6; // faster casting rotation (was 3.5)
  }

  update(dt, player, enemies) {
    if (!this.alive) return;
    this.updateMovement(dt);

    if (this.isMoving || this.isCasting) {
      if (this.isCasting) {
        this.castTimer -= dt;
        if (this.castTimer <= 0) {
          this.isCasting = false;
        }
      }
      return;
    }

    this.spellTimer += dt;
    if (this.spellTimer >= this.actionCooldown) {
      this.spellTimer = 0;
      const dist = Math.hypot(player.x - this.x, player.y - this.y);

      // If aligned with player, fire Rook Bone Lance
      if (player.x === this.x || player.y === this.y) {
        this.castRookLance(player);
      } else if (dist <= 3) {
        // Trap player with Bone Cage
        this.castBoneCage(player);
      } else {
        this.castRookLance(player);
      }
    }
  }

  castRookLance(player) {
    this.isCasting = true;
    this.castTimer = 0.8;

    // Orthogonal line along same row or col towards player
    const dx = Math.sign(player.x - this.x);
    const dy = Math.sign(player.y - this.y);
    const useDirX = Math.abs(player.x - this.x) >= Math.abs(player.y - this.y);

    const stepX = useDirX ? (dx || 1) : 0;
    const stepY = !useDirX ? (dy || 1) : 0;

    for (let s = 1; s <= 7; s++) {
      const tx = this.x + stepX * s;
      const ty = this.y + stepY * s;
      if (!this.grid.isInBounds(tx, ty)) break;

      this.grid.telegraphTile(tx, ty, TILE_STATUS.DAMAGING, 0.8, 'enemy', (px, py) => {
        if (px === player.x && py === player.y) {
          player.takeDamage(false, "Scribe's Bone Lance");
        }
      });
    }
  }

  castBoneCage(player) {
    this.isCasting = true;
    this.castTimer = 0.55;

    // Surround player with Inaccessible bone pillars
    const cardinals = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    cardinals.forEach(([ox, oy]) => {
      const tx = player.x + ox;
      const ty = player.y + oy;
      if (this.grid.isInBounds(tx, ty)) {
        this.grid.telegraphTile(tx, ty, TILE_STATUS.INACCESSIBLE, 0.55, 'enemy');
      }
    });
  }
}

// 4. Floor 26 Boss: The Corpse Emperor
export class CorpseEmperorBoss extends BaseEnemy {
  constructor(grid, x = 4, y = 2) {
    super(grid, x, y, "Corpse Emperor", 6, 100);
    this.phase = 1;
    this.attackTimer = 0.8;
    this.attackCycle = 0;
  }

  update(dt, player, enemies) {
    if (!this.alive) return;
    this.updateMovement(dt);

    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = 2.4; // faster boss attack cycle (was 3.2s)
      this.executeBossAttack(player);
    }
  }

  executeBossAttack(player) {
    this.attackCycle = (this.attackCycle + 1) % 3;

    if (this.attackCycle === 0) {
      // Imperial Cross (Rook)
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      dirs.forEach(([dx, dy]) => {
        for (let s = 1; s <= 8; s++) {
          const tx = this.x + dx * s;
          const ty = this.y + dy * s;
          if (this.grid.isInBounds(tx, ty)) {
            this.grid.telegraphTile(tx, ty, TILE_STATUS.DAMAGING, 1.0, 'enemy', (px, py) => {
              if (px === player.x && py === player.y) {
                player.takeDamage(false, "Imperial Cross Laser");
              }
            });
          }
        }
      });
    } else if (this.attackCycle === 1) {
      // Demonic Knight Rain (L-shapes)
      const offsets = [
        [1, 2], [2, 1], [-1, 2], [-2, 1],
        [1, -2], [2, -1], [-1, -2], [-2, -1]
      ];
      offsets.forEach(([ox, oy]) => {
        const tx = this.x + ox;
        const ty = this.y + oy;
        if (this.grid.isInBounds(tx, ty)) {
          this.grid.telegraphTile(tx, ty, TILE_STATUS.DAMAGING, 0.8, 'enemy', (px, py) => {
            if (px === player.x && py === player.y) {
              player.takeDamage(false, "Demonic Knight Rain");
            }
          });
        }
      });
    } else {
      // Corpse Extraction (Board apocalypse with random safe tiles on 9x9 grid)
      const safeTiles = [
        { x: 1, y: 1 },
        { x: 7, y: 1 },
        { x: 1, y: 7 },
        { x: 7, y: 7 }
      ];
      // Telegraph everything except safe tiles
      for (let y = 0; y < this.grid.rows; y++) {
        for (let x = 0; x < this.grid.cols; x++) {
          const isSafe = safeTiles.some(st => st.x === x && st.y === y);
          if (!isSafe) {
            this.grid.telegraphTile(x, y, TILE_STATUS.DAMAGING, 2.0, 'enemy', (px, py) => {
              if (px === player.x && py === player.y) {
                player.takeDamage(false, "Emperor's Apocalyptic Purge");
              }
            });
          } else {
            this.grid.setTileStatus(x, y, TILE_STATUS.SHIELDED, 4.0, 'player');
          }
        }
      }
    }
  }
}
