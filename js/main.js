/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Master Game Loop, Input Controller, and Floor State Machine
 */

import { FLOORS_CONFIG } from './config.js';
import { horrorAudio } from './audio.js';
import { PagodaGrid } from './grid.js';
import { Player } from './player.js';
import { SpellEngine } from './spells.js';
import { JiangshiEnemy, WraithEnemy, CorpseScribeEnemy, CorpseEmperorBoss } from './enemies.js';
import { PagodaRenderer } from './renderer.js';
import { MarrowFontManager } from './font.js';

class DemonicPagodaGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.grid = new PagodaGrid();
    this.renderer = new PagodaRenderer(this.canvas, this.grid);
    this.player = new Player(this.grid);
    this.spellEngine = new SpellEngine(this.grid);

    this.currentFloor = 1;
    this.gameState = 'TITLE'; // 'TITLE', 'PLAYING', 'SAFE_FONT', 'GAME_OVER', 'VICTORY'
    this.enemies = [];
    this.totalKills = 0;
    this.floorClearTimer = 0;

    // Keys currently pressed
    this.keysDown = {};

    this.initMarrowFont();
    this.bindDOM();
    this.bindInputs();

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

    // Title Start Button
    document.getElementById('btn-start-game').addEventListener('click', () => {
      horrorAudio.ensureContext();
      this.titleModal.classList.add('hidden');
      this.startGame();
    });

    // Restart Button
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.gameOverModal.classList.add('hidden');
      this.startGame();
    });

    // Play Again Button
    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.victoryModal.classList.add('hidden');
      this.startGame();
    });

    // Spell Slot clicks
    for (let i = 0; i < 4; i++) {
      const slotEl = document.getElementById(`slot-${i}`);
      if (slotEl) {
        slotEl.addEventListener('click', () => this.triggerSpellCast(i));
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

  bindInputs() {
    window.addEventListener('keydown', (e) => {
      this.keysDown[e.code] = true;

      if (this.gameState !== 'PLAYING') return;

      // Spell triggers
      if (e.code === 'Digit1' || e.code === 'KeyQ') this.triggerSpellCast(0);
      else if (e.code === 'Digit2' || e.code === 'KeyE') this.triggerSpellCast(1);
      else if (e.code === 'Digit3' || e.code === 'KeyR') this.triggerSpellCast(2);
      else if (e.code === 'Digit4' || e.code === 'Space') this.triggerSpellCast(3);
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown[e.code] = false;
    });
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
    this.player.maxHits = 1;
    this.player.currentHits = 1;
    this.player.agility = 250;
    this.player.maxStamina = 4;
    this.player.currentStamina = 4;
    this.player.marrow = 0;
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
      this.updateHUD();
      this.fontManager.open(floorNum);
      return;
    }

    this.gameState = 'PLAYING';
    horrorAudio.playGong(floorNum === 26);
    this.spawnFloorEnemies(floorNum);
    this.updateHUD();
    this.showCombatBanner(`FLOOR ${floorNum} - PURGE ALL CORPSES`);
  }

  spawnFloorEnemies(floorNum) {
    this.enemies = [];

    if (floorNum === 26) {
      // Floor 26 Boss
      const boss = new CorpseEmperorBoss(this.grid, 4, 2);
      this.enemies.push(boss);
      return;
    }

    // Number of enemies scales with floor
    const enemyCount = Math.min(8, 2 + Math.floor(floorNum / 3.5));

    for (let i = 0; i < enemyCount; i++) {
      let ex = Math.floor(Math.random() * this.grid.cols);
      let ey = Math.floor(Math.random() * 5); // spawn on top half

      // Determine enemy type based on floor tier
      let enemy;
      if (floorNum < 5) {
        enemy = new JiangshiEnemy(this.grid, ex, ey);
      } else if (floorNum < 10) {
        enemy = (i % 2 === 0) ? new JiangshiEnemy(this.grid, ex, ey) : new WraithEnemy(this.grid, ex, ey);
      } else if (floorNum < 15) {
        enemy = (i % 3 === 0) ? new CorpseScribeEnemy(this.grid, ex, ey) : new WraithEnemy(this.grid, ex, ey);
      } else {
        // Late tiers: mix of all
        const roll = Math.random();
        if (roll < 0.4) enemy = new JiangshiEnemy(this.grid, ex, ey);
        else if (roll < 0.7) enemy = new WraithEnemy(this.grid, ex, ey);
        else enemy = new CorpseScribeEnemy(this.grid, ex, ey);
      }

      this.enemies.push(enemy);
    }
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

    let dx = 0;
    let dy = 0;

    if (this.keysDown['KeyW'] || this.keysDown['ArrowUp']) dy -= 1;
    else if (this.keysDown['KeyS'] || this.keysDown['ArrowDown']) dy += 1;
    else if (this.keysDown['KeyA'] || this.keysDown['ArrowLeft']) dx -= 1;
    else if (this.keysDown['KeyD'] || this.keysDown['ArrowRight']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      this.player.tryMove(dx, dy, this.enemies);
    }
  }

  handleGameOver(source) {
    this.gameState = 'GAME_OVER';
    horrorAudio.playDamageTaken();
    document.getElementById('go-floors').textContent = this.currentFloor;
    document.getElementById('go-kills').textContent = this.totalKills;
    document.getElementById('go-marrow').textContent = this.player.marrow;
    this.gameOverModal.classList.remove('hidden');
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
