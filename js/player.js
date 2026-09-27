/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Player Entity: Real-Time Grid Movement, Stats, and Movement Lock
 */

import { INITIAL_PLAYER_STATS, TILE_STATUS } from './config.js';
import { horrorAudio } from './audio.js';

export class Player {
  constructor(grid, startX = 4, startY = 8) {
    this.grid = grid;
    this.x = startX;
    this.y = startY;
    
    // Pixel rendering interpolation
    const startPixel = grid.gridToPixel(startX, startY);
    this.renderX = startPixel.x;
    this.renderY = startPixel.y;
    this.fromX = startX;
    this.fromY = startY;
    this.toX = startX;
    this.toY = startY;
    this.isMoving = false;
    this.moveTimer = 0;
    this.moveDuration = INITIAL_PLAYER_STATS.AGILITY / 1000; // in seconds

    // Direction facing
    this.facing = { dx: 0, dy: -1 }; // default facing North

    // Stats
    this.maxHits = INITIAL_PLAYER_STATS.MAX_HITS;
    this.currentHits = this.maxHits;
    this.agility = INITIAL_PLAYER_STATS.AGILITY; // ms
    this.maxStamina = INITIAL_PLAYER_STATS.MAX_STAMINA;
    this.currentStamina = this.maxStamina;
    this.marrow = INITIAL_PLAYER_STATS.MARROW;

    // Movement lock & casting state
    this.isCasting = false;
    this.castElapsed = 0;
    this.castDuration = 0;
    this.currentCastSpell = null;
    this.onCastFinish = null;

    // Invulnerability frames (i-frames)
    this.isInvulnerable = false;
    this.invulnTimer = 0;
    this.invulnDuration = 1.2; // 1.2s i-frames on hit

    // Callbacks
    this.onHitTaken = null;
    this.onDeath = null;
    this.onMarrowChange = null;
    this.onCastProgress = null;
  }

  resetPosition(startX = 4, startY = 8) {
    this.x = startX;
    this.y = startY;
    this.fromX = startX;
    this.fromY = startY;
    this.toX = startX;
    this.toY = startY;
    this.isMoving = false;
    this.moveTimer = 0;
    this.facing = { dx: 0, dy: -1 };
    const p = this.grid.gridToPixel(startX, startY);
    this.renderX = p.x;
    this.renderY = p.y;
    this.cancelCasting();
  }

  // Restore hits and stamina (e.g. upon reaching a Safe Floor or new floor)
  restoreFull() {
    this.currentHits = this.maxHits;
    this.currentStamina = this.maxStamina;
  }

  // Restore only stamina (each floor change)
  restoreStamina() {
    this.currentStamina = this.maxStamina;
  }

  setAgility(newAgilityMs) {
    this.agility = Math.max(100, newAgilityMs);
    this.moveDuration = this.agility / 1000;
  }

  addMarrow(amount) {
    this.marrow += amount;
    horrorAudio.playMarrowCollect();
    if (this.onMarrowChange) this.onMarrowChange(this.marrow);
  }

  // Attempt real-time grid movement
  tryMove(dx, dy, enemies = []) {
    // RULE: Cannot move while casting! (Movement lock)
    if (this.isCasting) {
      return false;
    }

    // Update facing direction immediately
    if (dx !== 0 || dy !== 0) {
      this.facing = { dx, dy };
    }

    // Already transitioning between tiles
    if (this.isMoving) {
      return false;
    }

    const targetX = this.x + dx;
    const targetY = this.y + dy;

    // Check bounds & tile accessibility
    if (!this.grid.isWalkable(targetX, targetY)) {
      return false;
    }

    // Check if moving directly into an enemy
    const enemyAtTarget = enemies.find(e => e.alive && e.x === targetX && e.y === targetY);
    if (enemyAtTarget) {
      // Step into enemy -> Take 1 hit damage and bounce back
      this.takeDamage(false, "Collision with " + enemyAtTarget.name);
      return false;
    }

    // Begin movement transition
    this.isMoving = true;
    this.moveTimer = 0;
    this.moveDuration = this.agility / 1000;
    this.fromX = this.x;
    this.fromY = this.y;
    this.toX = targetX;
    this.toY = targetY;

    horrorAudio.playPlayerStep();
    return true;
  }

  // Begin channeling a spell
  startCasting(castData) {
    if (this.isCasting) return false;
    if (this.currentStamina <= 0) return false;

    this.currentStamina--;
    this.isCasting = true;
    this.castElapsed = 0;
    this.castDuration = castData.delay;
    this.currentCastSpell = castData.spell;
    this.onCastFinish = castData.onComplete;

    horrorAudio.startSpellChannel(castData.delay);
    return true;
  }

  cancelCasting() {
    this.isCasting = false;
    this.castElapsed = 0;
    this.castDuration = 0;
    this.currentCastSpell = null;
    this.onCastFinish = null;
  }

  takeDamage(ignoreShield = false, source = "Corpse Attack") {
    if (this.isInvulnerable) return;

    // Check if standing on a Shielded tile
    if (!ignoreShield && this.grid.isShielded(this.x, this.y)) {
      this.grid.breakShield(this.x, this.y);
      this.isInvulnerable = true;
      this.invulnTimer = 0.6; // short i-frames for shield break
      if (this.onHitTaken) this.onHitTaken("SHIELD ABSORBED HIT!");
      return;
    }

    // Deduct 1 Hit
    this.currentHits--;
    horrorAudio.playDamageTaken();

    if (this.currentHits <= 0) {
      this.currentHits = 0;
      if (this.onDeath) this.onDeath(source);
    } else {
      // Trigger i-frames
      this.isInvulnerable = true;
      this.invulnTimer = this.invulnDuration;
      if (this.onHitTaken) this.onHitTaken("SOUL TALISMAN BROKEN!");
    }
  }

  update(dt, enemies = []) {
    // 1. Update movement interpolation
    if (this.isMoving) {
      this.moveTimer += dt;
      const progress = Math.min(1, this.moveTimer / this.moveDuration);
      
      const p1 = this.grid.gridToPixel(this.fromX, this.fromY);
      const p2 = this.grid.gridToPixel(this.toX, this.toY);

      // Smooth step easing
      this.renderX = p1.x + (p2.x - p1.x) * progress;
      this.renderY = p1.y + (p2.y - p1.y) * progress;

      if (progress >= 1) {
        this.isMoving = false;
        this.x = this.toX;
        this.y = this.toY;
        this.renderX = p2.x;
        this.renderY = p2.y;

        // Check if landed on an enemy Damaging tile
        if (this.grid.isDamagingTo(this.x, this.y, 'player')) {
          this.takeDamage(false, "Damaging Yin Spikes");
        }
      }
    } else {
      const p = this.grid.gridToPixel(this.x, this.y);
      this.renderX = p.x;
      this.renderY = p.y;

      // Passive check if tile underneath became an enemy damaging tile
      if (this.grid.isDamagingTo(this.x, this.y, 'player')) {
        this.takeDamage(false, "Damaging Yin Spikes");
      }
    }

    // 2. Update Casting progress (Channeling root)
    if (this.isCasting) {
      this.castElapsed += dt;
      const progress = Math.min(1, this.castElapsed / this.castDuration);
      if (this.onCastProgress) {
        this.onCastProgress(this.currentCastSpell, progress, Math.max(0, this.castDuration - this.castElapsed));
      }

      if (this.castElapsed >= this.castDuration) {
        this.isCasting = false;
        if (this.onCastFinish) {
          this.onCastFinish();
        }
      }
    }

    // 3. Update i-frames
    if (this.isInvulnerable) {
      this.invulnTimer -= dt;
      if (this.invulnTimer <= 0) {
        this.isInvulnerable = false;
      }
    }
  }
}
