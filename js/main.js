/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Master Game Loop, Input Controller, and Floor State Machine
 */

import { FLOORS_CONFIG, INITIAL_PLAYER_STATS } from './config.js';
import { horrorAudio } from './audio.js';
import { PagodaGrid } from './grid.js';
import { Player } from './player.js';
import { SpellEngine } from './spells.js';
import { PagodaRenderer } from './renderer.js';
import { MarrowFontManager } from './font.js';
import { LevelGenerator } from './levelGenerator.js';
import { GameMenuModal } from './gameMenu.js';
import { InputHandler } from './input.js';

class DemonicPagodaGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.grid = new PagodaGrid();
    this.renderer = new PagodaRenderer(this.canvas, this.grid);
    this.player = new Player(this.grid);
    this.spellEngine = new SpellEngine(this.grid);

    this.currentFloor = 1;
    this.lastCheckpointFloor = 1;
    this.savedCheckpointState = null;
    this.gameState = 'TITLE'; // 'TITLE', 'PLAYING', 'SAFE_FONT', 'GAME_OVER', 'VICTORY'
    this.enemies = [];
    this.totalKills = 0;
    this.floorClearTimer = 0;

    this.initMarrowFont();
    this.gameMenu = new GameMenuModal(this);
    this.input = new InputHandler(this.canvas, {
      onCast: (slot) => this.triggerSpellCast(slot),
      onMoveImmediate: (dx, dy) => this.handleMoveImmediate(dx, dy)
    });

    this.bindDOM();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  initMarrowFont() {
    this.fontManager = new MarrowFontManager(this.player, this.spellEngine, () => {
      this.advanceFloor();
    });
  }

  bindDOM() {
    this.titleModal = document.getElementById('title-modal');
    this.gameOverModal = document.getElementById('game-over-modal');
    this.victoryModal = document.getElementById('victory-modal');

    this.floorDisplay = document.getElementById('floor-display');
    this.floorSubtitle = document.getElementById('floor-subtitle');
    this.hitsContainer = document.getElementById('hits-container');
    this.staminaDisplay = document.getElementById('stamina-display');
    this.staminaPips = document.getElementById('stamina-pips');
    this.agilityDisplay = document.getElementById('agility-display');
    this.marrowDisplay = document.getElementById('marrow-display');

    this.castBarContainer = document.getElementById('cast-bar-container');
    this.castProgressFill = document.getElementById('cast-progress-fill');
    this.castSpellName = document.getElementById('cast-spell-name');
    this.castTimerText = document.getElementById('cast-timer-text');
    this.combatBanner = document.getElementById('combat-banner');

    this.btnRestart = document.getElementById('btn-restart');
    this.btnRestartFloor1 = document.getElementById('btn-restart-floor1');

    // Title Start Button
    document.getElementById('btn-start-game').addEventListener('click', () => {
      horrorAudio.ensureContext();
      this.titleModal.classList.add('hidden');
      this.startGame();
    });

    // Checkpoint Restart Button
    this.btnRestart.addEventListener('click', () => {
      this.reviveAtCheckpoint();
    });

    // Start Fresh from Floor 1 Button
    this.btnRestartFloor1.addEventListener('click', () => {
      this.restartFromFloor1();
    });

    // Play Again Button
    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.victoryModal.classList.add('hidden');
      this.startGame();
    });

    // Game Menu & Guide Buttons
    const btnOpenMenu = document.getElementById('btn-open-game-menu');
    if (btnOpenMenu) {
      btnOpenMenu.addEventListener('click', () => this.gameMenu.open());
    }
    const btnTitleGuide = document.getElementById('btn-title-guide');
    if (btnTitleGuide) {
      btnTitleGuide.addEventListener('click', () => this.gameMenu.open());
    }

    // Spell Slot clicks
    for (let i = 0; i < 4; i++) {
      const slotEl = document.getElementById(`slot-${i}`);
      if (slotEl) {
        slotEl.addEventListener('click', () => {
          horrorAudio.ensureContext();
          this.triggerSpellCast(i);
        });
      }
    }

    // Player callbacks
    this.player.onHitTaken = (msg) => {
      this.renderer.triggerShake(8);
      this.showCombatBanner(msg);
      this.updateHUD();
    };

    this.player.onDeath = (source) => {
      this.handleGameOver(source);
    };

    this.player.onMarrowChange = () => {
      this.updateHUD();
    };

    this.player.onCastProgress = (spell, progress, remaining) => {
      this.castProgressFill.style.width = `${progress * 100}%`;
      this.castTimerText.textContent = `${remaining.toFixed(1)}s`;
    };
  }

  handleMoveImmediate(dx, dy) {
    if (this.gameState === 'PLAYING' && !this.player.isMoving && !this.player.isCasting) {
      this.player.tryMove(dx, dy, this.enemies);
    }
  }

  showCombatBanner(text, duration = 1.8) {
    this.combatBanner.textContent = text;
    this.combatBanner.classList.remove('hidden');
    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      this.combatBanner.classList.add('hidden');
    }, duration * 1000);
  }

  startGame() {
    this.currentFloor = 1;
    this.totalKills = 0;
    this.player.maxHits = INITIAL_PLAYER_STATS.MAX_HITS;
    this.player.currentHits = INITIAL_PLAYER_STATS.MAX_HITS;
    this.player.setAgility(INITIAL_PLAYER_STATS.AGILITY);
    this.player.maxStamina = INITIAL_PLAYER_STATS.MAX_STAMINA;
    this.player.currentStamina = INITIAL_PLAYER_STATS.MAX_STAMINA;
    this.player.marrow = INITIAL_PLAYER_STATS.MARROW;
    this.spellEngine.reset();
    this.fontManager.upgradeCosts = { health: 40, agility: 25, stamina: 20 };

    this.startFloor(this.currentFloor);
  }

  startFloor(floorNum) {
    this.grid.reset();
    this.player.resetPosition(4, 8);
    this.player.restoreStamina(); // replenish floor stamina

    // Check if this is a Marrow Font Safe Floor
    if (FLOORS_CONFIG.SAFE_FLOORS.includes(floorNum)) {
      this.gameState = 'SAFE_FONT';
      this.enemies = [];
      this.saveCheckpoint(floorNum);
      this.updateHUD();
      this.fontManager.open(floorNum);
      this.showCombatBanner(`SANCTUARY REACHED • CHECKPOINT SAVED (FLOOR ${floorNum})`, 2.5);
      return;
    }

    this.gameState = 'PLAYING';
    horrorAudio.playGong(floorNum === 26);
    LevelGenerator.generateObstacles(this.grid, floorNum);
    this.enemies = LevelGenerator.spawnEnemies(this.grid, floorNum);
    this.updateHUD();
    this.showCombatBanner(`FLOOR ${floorNum} - PURGE ALL CORPSES`);
  }

  triggerSpellCast(slotIndex) {
    if (this.gameState !== 'PLAYING') return;
    if (this.player.isCasting) return;

    const spell = this.spellEngine.getEquippedSpell(slotIndex);
    if (!spell) return;

    if (this.player.currentStamina <= 0) {
      this.showCombatBanner("QI STAMINA DEPLETED FOR THIS FLOOR!", 1.2);
      return;
    }

    // Show cast overlay
    this.castBarContainer.classList.remove('hidden');
    this.castSpellName.textContent = spell.name;
    this.castProgressFill.style.width = '0%';
    this.castTimerText.textContent = `${spell.baseDelay.toFixed(1)}s`;

    // Start casting
    const castData = this.spellEngine.castSpell(
      spell,
      this.player,
      this.player.facing,
      this.enemies,
      () => {
        // Finished
        this.castBarContainer.classList.add('hidden');
        this.updateHUD();
      }
    );

    const started = this.player.startCasting(castData);
    if (started) {
      this.updateHUD();
    }
  }

  processMovementInput() {
    if (this.gameState !== 'PLAYING') return;
    if (this.player.isMoving || this.player.isCasting) return;

    const { dx, dy } = this.input.getMovementVector();
    if (dx !== 0 || dy !== 0) {
      this.player.tryMove(dx, dy, this.enemies);
    }
  }

  saveCheckpoint(floorNum) {
    this.lastCheckpointFloor = floorNum;
    this.savedCheckpointState = {
      floor: floorNum,
      maxHits: this.player.maxHits,
      agility: this.player.agility,
      maxStamina: this.player.maxStamina,
      marrow: this.player.marrow,
      totalKills: this.totalKills,
      spells: this.spellEngine.equippedSpells.map(s => s ? { ...s } : null),
      upgradeCosts: { ...this.fontManager.upgradeCosts }
    };
  }

  handleGameOver(source) {
    this.gameState = 'GAME_OVER';
    horrorAudio.playDamageTaken();
    document.getElementById('go-floors').textContent = this.currentFloor;
    document.getElementById('go-kills').textContent = this.totalKills;
    document.getElementById('go-marrow').textContent = this.player.marrow;

    const cpText = this.lastCheckpointFloor > 1 ? `Floor ${this.lastCheckpointFloor} (Marrow Font)` : 'Floor 1';
    document.getElementById('go-checkpoint').textContent = cpText;

    if (this.lastCheckpointFloor > 1) {
      this.btnRestart.textContent = `REVIVE AT CHECKPOINT (FLOOR ${this.lastCheckpointFloor})`;
      this.btnRestartFloor1.classList.remove('hidden');
    } else {
      this.btnRestart.textContent = 'REVIVE AT FLOOR 1';
      this.btnRestartFloor1.classList.add('hidden');
    }

    this.gameOverModal.classList.remove('hidden');
  }

  reviveAtCheckpoint() {
    this.gameOverModal.classList.add('hidden');
    if (this.savedCheckpointState && this.lastCheckpointFloor > 1) {
      // Restore player from checkpoint snapshot
      this.player.maxHits = this.savedCheckpointState.maxHits;
      this.player.currentHits = this.savedCheckpointState.maxHits;
      this.player.setAgility(this.savedCheckpointState.agility);
      this.player.maxStamina = this.savedCheckpointState.maxStamina;
      this.player.currentStamina = this.savedCheckpointState.maxStamina;
      this.player.marrow = this.savedCheckpointState.marrow;
      this.totalKills = this.savedCheckpointState.totalKills;
      this.fontManager.upgradeCosts = { ...this.savedCheckpointState.upgradeCosts };
      this.spellEngine.equippedSpells = this.savedCheckpointState.spells.map(s => s ? { ...s } : null);

      this.currentFloor = this.lastCheckpointFloor;
      this.startFloor(this.currentFloor);
    } else {
      this.startGame();
    }
  }

  restartFromFloor1() {
    this.gameOverModal.classList.add('hidden');
    this.lastCheckpointFloor = 1;
    this.savedCheckpointState = null;
    this.startGame();
  }

  handleVictory() {
    this.gameState = 'VICTORY';
    horrorAudio.playGong(false);
    document.getElementById('vic-kills').textContent = this.totalKills;
    document.getElementById('vic-hp').textContent = this.player.currentHits;
    document.getElementById('vic-agi').textContent = this.player.agility;
    this.victoryModal.classList.remove('hidden');
  }

  advanceFloor() {
    this.currentFloor++;
    if (this.currentFloor > FLOORS_CONFIG.TOTAL_FLOORS) {
      this.handleVictory();
      return;
    }
    this.startFloor(this.currentFloor);
  }

  updateHUD() {
    // Floor
    this.floorDisplay.textContent = `FLOOR ${this.currentFloor} / 26`;
    const tier = FLOORS_CONFIG.TIERS.find(t => this.currentFloor >= t.start && this.currentFloor <= t.end);
    this.floorSubtitle.textContent = tier ? tier.name : "Deep Pagoda";

    // Hits
    this.hitsContainer.innerHTML = '';
    for (let i = 0; i < this.player.maxHits; i++) {
      const bead = document.createElement('div');
      bead.className = 'soul-bead';
      if (i >= this.player.currentHits) {
        bead.classList.add('shattered');
      }
      this.hitsContainer.appendChild(bead);
    }

    // Stamina
    this.staminaDisplay.textContent = `${this.player.currentStamina} / ${this.player.maxStamina} CASTS`;
    this.staminaPips.innerHTML = '';
    for (let i = 0; i < this.player.maxStamina; i++) {
      const pip = document.createElement('div');
      pip.className = 'stamina-pip';
      if (i >= this.player.currentStamina) {
        pip.classList.add('empty');
      }
      this.staminaPips.appendChild(pip);
    }

    // Agility & Marrow
    this.agilityDisplay.textContent = `${this.player.agility} ms / step`;
    this.marrowDisplay.textContent = `💀 ${this.player.marrow}`;

    // Spell hotbar slots
    for (let i = 0; i < 4; i++) {
      const spell = this.spellEngine.getEquippedSpell(i);
      const slotEl = document.getElementById(`slot-${i}`);
      if (slotEl) {
        if (spell) {
          slotEl.classList.remove('disabled');
          document.getElementById(`icon-${i}`).textContent = spell.icon;
          document.getElementById(`name-${i}`).textContent = spell.name;
          document.getElementById(`pattern-${i}`).textContent = spell.pattern.toUpperCase();
          document.getElementById(`delay-${i}`).textContent = `${spell.baseDelay.toFixed(2)}s delay`;
          document.getElementById(`desc-${i}`).textContent = spell.desc;

          if (this.player.isCasting) {
            slotEl.classList.add('active-casting');
          } else {
            slotEl.classList.remove('active-casting');
          }
        } else {
          slotEl.classList.add('disabled');
          slotEl.classList.remove('active-casting');
          document.getElementById(`icon-${i}`).textContent = '➕';
          document.getElementById(`name-${i}`).textContent = '[Empty Slot]';
          document.getElementById(`pattern-${i}`).textContent = 'UNASSIGNED';
          document.getElementById(`delay-${i}`).textContent = 'Draft at Font';
          document.getElementById(`desc-${i}`).textContent = 'Acquire new chess talismans on safe floors (Marrow Fonts).';
        }
      }
    }
  }

  gameLoop(timestamp) {
    const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    if (this.gameState === 'PLAYING') {
      this.processMovementInput();

      // Update grid
      this.grid.update(dt);

      // Update player
      this.player.update(dt, this.enemies);

      // Update enemies & handle deaths
      let livingEnemies = 0;
      this.enemies.forEach(enemy => {
        if (enemy.alive) {
          livingEnemies++;
          enemy.update(dt, this.player, this.enemies);

          // Check if enemy died from status or blast
          if (!enemy.alive) {
            this.totalKills++;
            this.player.addMarrow(enemy.marrow);
            this.renderer.spawnBloodParticles(enemy.renderX + 35, enemy.renderY + 35, 24);
            this.renderer.addFloatingText(`+${enemy.marrow} MARROW`, enemy.renderX + 35, enemy.renderY + 20, '#e0b04a');
          }
        }
      });

      // Floor clearance check
      if (livingEnemies === 0 && this.enemies.length > 0) {
        this.floorClearTimer += dt;
        if (this.floorClearTimer >= 1.4) {
          this.floorClearTimer = 0;
          if (this.currentFloor === 26) {
            this.handleVictory();
          } else {
            this.advanceFloor();
          }
        }
      }
    }

    // Update renderer effects
    this.renderer.update(dt);

    // Draw frame
    this.renderer.render(this.player, this.enemies, null);

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// Instantiate on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.game = new DemonicPagodaGame();
});

