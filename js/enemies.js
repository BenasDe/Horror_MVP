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
    if (window.game && window.game.renderer && window.game.renderer.flashEnemyHit) {
      window.game.renderer.flashEnemyHit(this);
    }
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
    this.moveTimer = 0;
    this.moveCooldown = 1.6; // Repositions and glides every ~1.6s
    this.boneTimer = 0.6; // Starts casting bones quickly
    this.boneCooldown = 2.3; // Spawns bone cages way more often (every 2.3s!)
    this.lanceTimer = 2.0;
    this.lanceCooldown = 3.6; // Fires bone lance every 3.6s
  }

  update(dt, player, enemies) {
    if (!this.alive) return;
    this.updateMovement(dt);

    if (this.isCasting) {
      this.castTimer -= dt;
      if (this.castTimer <= 0) {
        this.isCasting = false;
      }
      return;
    }

    // 1. High-Frequency Bone Spawning
    this.boneTimer -= dt;
    if (this.boneTimer <= 0) {
      this.boneTimer = this.boneCooldown;
      this.castBoneCage(player);
      return;
    }

    // 2. Piercing Bone Lance Attack
    this.lanceTimer -= dt;
    if (this.lanceTimer <= 0) {
      this.lanceTimer = this.lanceCooldown;
      this.castRookLance(player);
      return;
    }

    // 3. Active Scribe Mobility (Glides, flanks, and kites away from close player)
    if (!this.isMoving) {
      this.moveTimer += dt;
      if (this.moveTimer >= this.moveCooldown) {
        this.moveTimer = 0;
        this.planScribeMove(player, enemies);
      }
    }
  }

  planScribeMove(player, enemies) {
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    const candidateMoves = [];

    // Cardinal steps
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    dirs.forEach(([dx, dy]) => {
      const tx = this.x + dx;
      const ty = this.y + dy;
      if (this.grid.isWalkable(tx, ty) && !this.isOccupiedByEnemy(tx, ty, enemies)) {
        const newDist = Math.hypot(player.x - tx, player.y - ty);
        candidateMoves.push({ x: tx, y: ty, dist: newDist });
      }
    });

    if (candidateMoves.length === 0) return;

    let chosen;
    if (dist <= 2.5) {
      // Kite: pick move that maximizes distance away from player
      candidateMoves.sort((a, b) => b.dist - a.dist);
      chosen = candidateMoves[0];
    } else {
      // Pick random valid step to keep moving actively
      chosen = candidateMoves[Math.floor(Math.random() * candidateMoves.length)];
    }

    if (chosen) {
      this.fromX = this.x;
      this.fromY = this.y;
      this.toX = chosen.x;
      this.toY = chosen.y;
      this.isMoving = true;
      this.moveTimer = 0;
      this.moveDuration = 0.32; // smooth eerie glide
    }
  }

  isOccupiedByEnemy(x, y, enemies) {
    return enemies.some(e => e !== this && e.alive && e.x === x && e.y === y);
  }

  castRookLance(player) {
    this.isCasting = true;
    this.castTimer = 0.75;

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

      this.grid.telegraphTile(tx, ty, TILE_STATUS.DAMAGING, 0.85, 'enemy', (px, py) => {
        if (px === player.x && py === player.y) {
          player.takeDamage(false, "Scribe's Bone Lance");
        }
      });
    }
  }

  castBoneCage(player) {
    this.isCasting = true;
    this.castTimer = 0.50;

    // Surround player with Inaccessible bone pillars
    const cardinals = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    cardinals.forEach(([ox, oy]) => {
      const tx = player.x + ox;
      const ty = player.y + oy;
      if (this.grid.isInBounds(tx, ty)) {
        this.grid.telegraphTile(tx, ty, TILE_STATUS.INACCESSIBLE, 0.50, 'enemy');
      }
    });

    horrorAudio.playSpellDetonation(0.8);
  }
}

// 4. Floor 26 Boss: The Corpse Emperor
export class CorpseEmperorBoss extends BaseEnemy {
  constructor(grid, x = 4, y = 2) {
    super(grid, x, y, "Corpse Emperor", 8, 100);
    this.phase = 1;
    this.attackTimer = 2.2; // initial prep time before first attack
    this.attackCycle = 0;
    this.moveCooldown = 1.2; // 2x faster movement frequency (moves every ~1.3s - 1.7s)
    this.invulnerableTimer = 0; // 2s damage immunity after each hit
    this.spawnTimer = 6.0; // spawns 1 minion every 6s
    this.thrones = [
      [2, 2], [6, 2], [2, 6], [6, 6],
      [4, 2], [4, 4], [4, 6], [2, 4], [6, 4]
    ];
  }

  takeDamage(amount = 1) {
    if (!this.alive) return false;
    // 2-second Damage Immunity check: ignore all extra spell ticks!
    if (this.invulnerableTimer > 0) {
      return false;
    }

    this.hits -= amount;
    this.invulnerableTimer = 2.0; // 2 seconds of damage immunity!
    horrorAudio.playShieldBreak();

    if (window.game && window.game.renderer) {
      window.game.renderer.triggerShake(5);
      const p = this.grid.gridToPixel(this.x, this.y);
      window.game.renderer.spawnBloodParticles(p.x + 38, p.y + 38, 20);
      window.game.renderer.addFloatingText("🛡️ IMMUNE (2s)", p.x + 38, p.y + 10, "#ffd15c", 13);
    }

    if (this.hits <= 0) {
      this.hits = 0;
      this.alive = false;

      // Disintegrate all minions when the Emperor falls
      if (window.game && window.game.enemies) {
        window.game.enemies.forEach(e => {
          if (e !== this && e.alive) {
            e.alive = false;
            if (window.game.renderer) {
              window.game.renderer.spawnBloodParticles(e.renderX + 35, e.renderY + 35, 16);
            }
          }
        });
      }

      return true;
    }
    return false;
  }

  update(dt, player, enemies) {
    if (!this.alive) return;

    // Tick down 2s damage immunity
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }

    // Process movement interpolation and damaging tiles check
    this.updateMovement(dt);

    // Active boss movement AI (2x frequency)
    this.updateBossMovement(dt, player);

    // Spawn 1 minion every 6s
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 6.0;
      this.spawnMinion(enemies, player);
    }

    // Attack cooldown (well-paced, giving player room to move)
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = 4.0; // 4.0s paced attack cycle
      this.executeBossAttack(player);
    }
  }

  spawnMinion(enemies, player) {
    let ex = 0;
    let ey = 0;
    let found = false;
    const occupied = new Set();
    if (player) occupied.add(`${player.x},${player.y}`);
    occupied.add(`${this.x},${this.y}`);
    enemies.forEach(e => {
      if (e.alive) occupied.add(`${e.x},${e.y}`);
    });

    for (let attempts = 0; attempts < 40; attempts++) {
      const rx = Math.floor(Math.random() * this.grid.cols);
      const ry = Math.floor(Math.random() * this.grid.rows);
      if (!occupied.has(`${rx},${ry}`) && this.grid.isWalkable(rx, ry)) {
        ex = rx;
        ey = ry;
        found = true;
        break;
      }
    }

    if (!found) return null;

    // Pick random minion type: Jiangshi, Wraith, or Scribe
    const roll = Math.random();
    let minion;
    if (roll < 0.40) {
      minion = new JiangshiEnemy(this.grid, ex, ey);
    } else if (roll < 0.75) {
      minion = new WraithEnemy(this.grid, ex, ey);
    } else {
      minion = new CorpseScribeEnemy(this.grid, ex, ey);
    }

    enemies.push(minion);

    // Visual & audio feedback
    horrorAudio.playSpellDetonation(1.2);
    if (window.game && window.game.renderer) {
      const p = this.grid.gridToPixel(ex, ey);
      window.game.renderer.spawnBloodParticles(p.x + 38, p.y + 38, 24);
      window.game.renderer.addFloatingText(`💀 ${minion.name.toUpperCase()} SUMMONED`, p.x + 38, p.y + 20, '#ff334b', 12);
    }

    return minion;
  }

  updateBossMovement(dt, player) {
    if (this.isMoving) return;

    this.moveCooldown -= dt;
    if (this.moveCooldown <= 0) {
      // Pick a strategic throne at least 2 tiles away, and not on player
      const availableThrones = this.thrones.filter(([tx, ty]) => {
        const dist = Math.abs(tx - this.x) + Math.abs(ty - this.y);
        const onPlayer = (tx === player.x && ty === player.y);
        return dist >= 2 && !onPlayer;
      });

      if (availableThrones.length > 0) {
        const [nextX, nextY] = availableThrones[Math.floor(Math.random() * availableThrones.length)];
        
        // Brief telegraph at landing site (snappy 0.45s telegraph)
        this.grid.telegraphTile(nextX, nextY, TILE_STATUS.DAMAGING, 0.45, 'enemy', (tx, ty) => {
          if (tx === player.x && ty === player.y) {
            player.takeDamage(false, "Emperor's Imperial Stomp");
          }
        });

        // Initiate leap/reposition (snappy 0.28s move, resets cooldown to 1.3 - 1.7s)
        this.isMoving = true;
        this.fromX = this.x;
        this.fromY = this.y;
        this.toX = nextX;
        this.toY = nextY;
        this.moveTimer = 0;
        this.moveDuration = 0.28;
        this.moveCooldown = 1.3 + Math.random() * 0.4;
      } else {
        this.moveCooldown = 0.8;
      }
    }
  }

  executeBossAttack(player) {
    this.attackCycle = (this.attackCycle + 1) % 3;

    if (this.attackCycle === 0) {
      // 1. Imperial Cardinal Lasers (Rook Cross) with generous 1.2s telegraph
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      dirs.forEach(([dx, dy]) => {
        for (let s = 1; s <= 8; s++) {
          const tx = this.x + dx * s;
          const ty = this.y + dy * s;
          if (this.grid.isInBounds(tx, ty)) {
            this.grid.telegraphTile(tx, ty, TILE_STATUS.DAMAGING, 1.2, 'enemy', (px, py) => {
              if (px === player.x && py === player.y) {
                player.takeDamage(false, "Imperial Cross Laser");
              }
            });
          }
        }
      });
    } else if (this.attackCycle === 1) {
      // 2. Demonic Knight Volley (8 L-shaped moves around Emperor)
      const offsets = [
        [1, 2], [2, 1], [-1, 2], [-2, 1],
        [1, -2], [2, -1], [-1, -2], [-2, -1]
      ];
      offsets.forEach(([ox, oy]) => {
        const tx = this.x + ox;
        const ty = this.y + oy;
        if (this.grid.isInBounds(tx, ty)) {
          this.grid.telegraphTile(tx, ty, TILE_STATUS.DAMAGING, 1.1, 'enemy', (px, py) => {
            if (px === player.x && py === player.y) {
              player.takeDamage(false, "Demonic Knight Rain");
            }
          });
        }
      });
    } else {
      // 3. Yin Void Cleave (Quadrant Cleave leaving 50% of the arena safe!)
      const cleaveTop = player.y > 4; // Cleave where player isn't initially, then sweep
      const startY = cleaveTop ? 0 : 5;
      const endY = cleaveTop ? 4 : 8;

      for (let y = startY; y <= endY; y++) {
        for (let x = 0; x < this.grid.cols; x++) {
          this.grid.telegraphTile(x, y, TILE_STATUS.DAMAGING, 1.6, 'enemy', (px, py) => {
            if (px === player.x && py === player.y) {
              player.takeDamage(false, "Yin Void Cleave");
            }
          });
        }
      }
    }
  }
}
