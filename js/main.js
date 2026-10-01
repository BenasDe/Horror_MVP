/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Master Game Loop, Input Controller, and Floor State Machine
 */

import { FLOORS_CONFIG, INITIAL_PLAYER_STATS, SPELL_CATALOG } from './config.js';
import { CHECKPOINT_VERSION, CheckpointStore, validateCheckpoint } from './checkpoint.js';
import { horrorAudio } from './audio.js';
import { PagodaGrid } from './grid.js';
import { Player } from './player.js';
import { SpellEngine } from './spells.js';
import { ThreePagodaRenderer } from './threeRenderer.js';
import { MarrowFontManager } from './font.js';
import { LevelGenerator } from './levelGenerator.js';
import { GameMenuModal } from './gameMenu.js';
import { InputHandler } from './input.js';

export class DemonicPagodaGame {
  constructor({ createRenderer = (canvas, grid) => new ThreePagodaRenderer(canvas, grid), checkpointStore = new CheckpointStore() } = {}) {
    this.canvas = document.getElementById('gameCanvas');
    this.grid = new PagodaGrid();
    this.renderer = createRenderer(this.canvas, this.grid);
    this.player = new Player(this.grid);
    this.spellEngine = new SpellEngine(this.grid);

    this.currentFloor = 1;
    this.lastCheckpointFloor = 1;
    this.savedCheckpointState = null;
    this.checkpointStore = checkpointStore;
    this.checkpointPersisted = false;
    this.gameState = 'TITLE'; // 'TITLE', 'PLAYING', 'PAUSED', 'SAFE_FONT', 'GAME_OVER', 'VICTORY'
    this.enemies = [];
    this.totalKills = 0;
    this.floorClearTimer = 0;
    this.rewardedEnemies = new Set();

    this.initMarrowFont();
    this.gameMenu = new GameMenuModal(this);
    this.input = new InputHandler(this.canvas, {
      onCast: (slot) => this.triggerSpellCast(slot),
      onMoveImmediate: (dx, dy) => this.handleMoveImmediate(dx, dy),
      canAcceptInput: () => this.gameState === 'PLAYING',
      onMenu: () => this.gameMenu.isOpen ? this.gameMenu.close() : this.gameMenu.open(),
      onFocusLost: () => {
        if (this.gameState === 'PLAYING') this.gameMenu.open();
      }
    });

    this.bindDOM();
    this.savedCheckpointState = this.checkpointStore.load();
    if (this.savedCheckpointState) {
      this.lastCheckpointFloor = this.savedCheckpointState.floor;
      this.checkpointPersisted = true;
    }
    this.updateContinueButton();
    this.updateHUD();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  initMarrowFont() {
    this.fontManager = new MarrowFontManager(this.player, this.spellEngine, () => {
      if (this.gameState === 'SAFE_FONT') this.advanceFloor();
    }, () => {
      this.updateHUD();
      this.saveCheckpoint(this.currentFloor);
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
    this.btnContinue = document.getElementById('btn-continue-game');
    this.checkpointStatus = document.getElementById('checkpoint-status');

    // Title Start Button
    document.getElementById('btn-start-game').addEventListener('click', () => {
      horrorAudio.ensureContext();
      this.startNewRun();
    });

    this.btnContinue.addEventListener('click', () => {
      horrorAudio.ensureContext();
      this.restoreCheckpoint();
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
      this.startNewRun();
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
      if (this.renderer.flashPlayerHit) {
        this.renderer.flashPlayerHit();
      }
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

  pause() {
    if (this.gameState !== 'PLAYING') return false;
    this.gameState = 'PAUSED';
    this.input.reset();
    horrorAudio.stopSpellChannel();
    return true;
  }

  resume() {
    if (this.gameState !== 'PAUSED' || document.hidden) return;
    this.input.reset();
    this.lastTime = performance.now();
    this.gameState = 'PLAYING';
    if (this.player.isCasting) {
      horrorAudio.startSpellChannel(this.player.castDuration - this.player.castElapsed);
    }
  }

  updateContinueButton() {
    const checkpoint = this.savedCheckpointState;
    this.btnContinue.classList.toggle('hidden', !checkpoint);
    document.getElementById('btn-start-game').textContent = checkpoint ? 'NEW RUN (FLOOR 1)' : 'AWAKEN ROGUE SOUL';
    if (checkpoint) {
      this.btnContinue.textContent = `CONTINUE FROM FLOOR ${checkpoint.floor}`;
      this.checkpointStatus.textContent = this.checkpointPersisted
        ? `Sanctuary checkpoint: Floor ${checkpoint.floor}. New Run replaces it.`
        : 'Checkpoint available for this session only. Browser storage is unavailable.';
    } else {
      this.checkpointStatus.textContent = this.checkpointStore.lastError === 'invalid'
        ? 'The saved checkpoint is incompatible or damaged. Start a new run.'
        : this.checkpointStore.lastError === 'unavailable'
          ? 'Browser storage is unavailable. Checkpoints will last for this session only.'
          : 'Sanctuary checkpoints are saved in this browser.';
    }
  }

  startNewRun() {
    this.currentFloor = 1;
    this.lastCheckpointFloor = 1;
    this.savedCheckpointState = null;
    this.checkpointPersisted = false;
    const cleared = this.checkpointStore.clear();
    this.updateContinueButton();
    this.totalKills = 0;
    this.player.maxHits = INITIAL_PLAYER_STATS.MAX_HITS;
    this.player.currentHits = INITIAL_PLAYER_STATS.MAX_HITS;
    this.player.setAgility(INITIAL_PLAYER_STATS.AGILITY);
    this.player.maxStamina = INITIAL_PLAYER_STATS.MAX_STAMINA;
    this.player.currentStamina = INITIAL_PLAYER_STATS.MAX_STAMINA;
    this.player.marrow = INITIAL_PLAYER_STATS.MARROW;
    this.spellEngine.reset();
    this.fontManager.reset();

    this.startFloor(this.currentFloor);
    if (!cleared) this.showCombatBanner('BROWSER CHECKPOINT COULD NOT BE CLEARED • STORAGE UNAVAILABLE', 3);
  }

  startFloor(floorNum, drafts = null) {
    this.currentFloor = floorNum;
    this.gameMenu.close(false);
    this.fontManager.close();
    this.titleModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');
    this.victoryModal.classList.add('hidden');
    this.input.reset();
    this.floorClearTimer = 0;
    this.rewardedEnemies.clear();
    clearTimeout(this.bannerTimeout);
    this.combatBanner.classList.add('hidden');
    this.castBarContainer.classList.add('hidden');
    this.castProgressFill.style.width = '0%';
    this.castTimerText.textContent = '0.0s';
    this.castSpellName.textContent = '';
    this.renderer.resetTransientState();
    this.grid.reset();
    this.player.resetPosition(4, 8);
    this.player.restoreStamina(); // replenish floor stamina

    // Check if this is a Marrow Font Safe Floor
    if (FLOORS_CONFIG.SAFE_FLOORS.includes(floorNum)) {
      this.gameState = 'SAFE_FONT';
      this.enemies = [];
      this.fontManager.open(floorNum, drafts);
      this.showCombatBanner(this.checkpointPersisted
        ? `SANCTUARY REACHED • CHECKPOINT SAVED (FLOOR ${floorNum})`
        : `SANCTUARY REACHED • SESSION CHECKPOINT ONLY (FLOOR ${floorNum}) • STORAGE UNAVAILABLE`, 3);
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
    if (this.gameState !== 'SAFE_FONT' || !FLOORS_CONFIG.SAFE_FLOORS.includes(floorNum)) return false;
    this.lastCheckpointFloor = floorNum;
    this.savedCheckpointState = {
      version: CHECKPOINT_VERSION,
      floor: floorNum,
      maxHits: this.player.maxHits,
      agility: this.player.agility,
      maxStamina: this.player.maxStamina,
      marrow: this.player.marrow,
      totalKills: this.totalKills,
      spells: this.spellEngine.equippedSpells.map(s => s ? s.id : null),
      drafts: this.fontManager.currentDrafts.map(s => s.id),
      upgradeCosts: { ...this.fontManager.upgradeCosts }
    };
    this.checkpointPersisted = this.checkpointStore.save(this.savedCheckpointState);
    this.updateContinueButton();
    if (!this.checkpointPersisted) this.showCombatBanner('CHECKPOINT KEPT FOR THIS SESSION • BROWSER STORAGE UNAVAILABLE', 3);
    return this.checkpointPersisted;
  }

  handleGameOver(source) {
    if (this.gameState !== 'PLAYING') return;
    this.gameState = 'GAME_OVER';
    this.input.reset();
    this.player.cancelCasting();
    this.castBarContainer.classList.add('hidden');
    this.updateHUD();
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

  restoreCheckpoint() {
    const checkpoint = validateCheckpoint(this.savedCheckpointState);
    if (!checkpoint) return false;
    const catalog = new Map(Object.values(SPELL_CATALOG).map(spell => [spell.id, spell]));
    this.player.maxHits = checkpoint.maxHits;
    this.player.currentHits = checkpoint.maxHits;
    this.player.setAgility(checkpoint.agility);
    this.player.maxStamina = checkpoint.maxStamina;
    this.player.currentStamina = checkpoint.maxStamina;
    this.player.marrow = checkpoint.marrow;
    this.totalKills = checkpoint.totalKills;
    this.fontManager.upgradeCosts = { ...checkpoint.upgradeCosts };
    this.spellEngine.equippedSpells = checkpoint.spells.map(id => id ? { ...catalog.get(id) } : null);
    this.lastCheckpointFloor = checkpoint.floor;
    this.startFloor(checkpoint.floor, checkpoint.drafts.map(id => catalog.get(id)));
    return true;
  }

  reviveAtCheckpoint() {
    if (!this.restoreCheckpoint()) this.startNewRun();
  }

  restartFromFloor1() {
    this.startNewRun();
  }

  handleVictory() {
    if (this.gameState !== 'PLAYING' && this.gameState !== 'SAFE_FONT') return;
    this.gameState = 'VICTORY';
    this.input.reset();
    this.player.cancelCasting();
    this.castBarContainer.classList.add('hidden');
    this.savedCheckpointState = null;
    this.lastCheckpointFloor = 1;
    this.checkpointPersisted = false;
    this.checkpointStore.clear();
    this.updateContinueButton();
    horrorAudio.playGong(false);
    document.getElementById('vic-kills').textContent = this.totalKills;
    document.getElementById('vic-hp').textContent = this.player.currentHits;
    document.getElementById('vic-agi').textContent = this.player.agility;
    this.victoryModal.classList.remove('hidden');
  }

  advanceFloor() {
    if (this.gameState !== 'PLAYING' && this.gameState !== 'SAFE_FONT') return;
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

  updateGameplay(dt) {
    if (this.gameState !== 'PLAYING') return;
    this.processMovementInput();
    if (this.gameState !== 'PLAYING') return;
    this.grid.update(dt);
    if (this.gameState !== 'PLAYING') return;
    this.player.update(dt, this.enemies);
    if (this.gameState !== 'PLAYING') return;

    // Use the starting roster: newly summoned enemies begin updating next frame.
    for (const enemy of [...this.enemies]) {
      if (this.gameState !== 'PLAYING') return;
      if (enemy.alive) enemy.update(dt, this.player, this.enemies);
    }
    if (this.gameState !== 'PLAYING') return;
    for (const enemy of this.enemies) {
      if (!enemy.alive && !this.rewardedEnemies.has(enemy)) {
        this.rewardedEnemies.add(enemy);
        this.totalKills++;
        this.player.addMarrow(enemy.marrow);
        this.renderer.spawnBloodParticles(enemy.renderX + 35, enemy.renderY + 35, 24);
        this.renderer.addFloatingText(`+${enemy.marrow} MARROW`, enemy.renderX + 35, enemy.renderY + 20, '#e0b04a');
      }
    }

    if (this.enemies.length > 0 && !this.enemies.some(enemy => enemy.alive)) {
      this.floorClearTimer += dt;
      if (this.floorClearTimer >= 1.4) {
        this.floorClearTimer = 0;
        if (this.currentFloor === FLOORS_CONFIG.BOSS_FLOOR) this.handleVictory();
        else this.advanceFloor();
      }
    } else {
      this.floorClearTimer = 0;
    }
  }

  gameLoop(timestamp) {
    const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;
    this.updateGameplay(dt);

    // Update renderer effects
    if (this.gameState !== 'PAUSED') this.renderer.update(dt);

    // Draw frame
    this.renderer.render(this.player, this.enemies, null);

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// Instantiate on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.game = new DemonicPagodaGame();
});
