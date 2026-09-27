/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Safe Floor (Marrow Font) Shop & Drafting Logic
 */

import { SPELL_CATALOG } from './config.js';
import { horrorAudio } from './audio.js';

export class MarrowFontManager {
  constructor(player, spellEngine, onAscend) {
    this.player = player;
    this.spellEngine = spellEngine;
    this.onAscend = onAscend;

    // Upgrade pricing & level tracking
    this.upgradeCosts = {
      health: 40,
      agility: 25,
      stamina: 20
    };

    // Cached draft spells
    this.currentDrafts = [];

    this.bindDomElements();
  }

  bindDomElements() {
    this.modal = document.getElementById('font-modal');
    this.marrowValEl = document.getElementById('font-marrow-val');
    this.btnAscend = document.getElementById('btn-ascend-font');

    this.statCurrHp = document.getElementById('stat-curr-hp');
    this.statCurrAgi = document.getElementById('stat-curr-agi');
    this.statCurrStam = document.getElementById('stat-curr-stam');

    this.btnBuyHp = document.getElementById('btn-buy-hp');
    this.btnBuyAgi = document.getElementById('btn-buy-agi');
    this.btnBuyStam = document.getElementById('btn-buy-stam');

    this.draftContainer = document.getElementById('draft-spells-container');

    // Upgrade event listeners
    this.btnBuyHp.addEventListener('click', () => this.buyHealthUpgrade());
    this.btnBuyAgi.addEventListener('click', () => this.buyAgilityUpgrade());
    this.btnBuyStam.addEventListener('click', () => this.buyStaminaUpgrade());

    this.btnAscend.addEventListener('click', () => {
      this.close();
      if (this.onAscend) this.onAscend();
    });
  }

  open(floorNumber) {
    // 1. Fully restore player hits and stamina
    this.player.restoreFull();
    horrorAudio.playGong(false);

    // 2. Generate 3 random spell drafts
    this.generateDrafts();

    // 3. Update UI displays
    this.updateUI();

    // 4. Reveal modal
    this.modal.classList.remove('hidden');
  }

  close() {
    this.modal.classList.add('hidden');
  }

  generateDrafts() {
    const allSpells = Object.values(SPELL_CATALOG);
    // Shuffle and pick 3
    const shuffled = [...allSpells].sort(() => 0.5 - Math.random());
    this.currentDrafts = shuffled.slice(0, 3);
  }

  updateUI() {
    this.marrowValEl.textContent = `💀 ${this.player.marrow}`;

    // Stat texts
    this.statCurrHp.textContent = `Current: ${this.player.maxHits} Hit(s)`;
    this.statCurrAgi.textContent = `Current: ${this.player.agility} ms / step`;
    this.statCurrStam.textContent = `Current: ${this.player.maxStamina} Casts`;

    // Button states
    this.btnBuyHp.textContent = `Refine (${this.upgradeCosts.health} Marrow)`;
    this.btnBuyHp.disabled = this.player.marrow < this.upgradeCosts.health;

    this.btnBuyAgi.textContent = `Refine (${this.upgradeCosts.agility} Marrow)`;
    this.btnBuyAgi.disabled = (this.player.marrow < this.upgradeCosts.agility) || (this.player.agility <= 100);

    this.btnBuyStam.textContent = `Refine (${this.upgradeCosts.stamina} Marrow)`;
    this.btnBuyStam.disabled = this.player.marrow < this.upgradeCosts.stamina;

    // Render Draft Cards
    this.renderDraftCards();

    // Auto-save checkpoint state at font
    if (window.game && window.game.saveCheckpoint) {
      window.game.saveCheckpoint(window.game.currentFloor);
    }
  }

  renderDraftCards() {
    this.draftContainer.innerHTML = '';

    this.currentDrafts.forEach((spell, idx) => {
      const card = document.createElement('div');
      card.className = 'draft-card';
      const canAfford = this.player.marrow >= spell.cost;

      card.innerHTML = `
        <div class="draft-title">${spell.icon} ${spell.name}</div>
        <div class="draft-meta">
          <span class="text-cyan">${spell.pattern.toUpperCase()}</span>
          <span class="text-gold">${spell.baseDelay}s delay</span>
        </div>
        <div class="draft-desc">${spell.desc}</div>
        <div class="draft-price">${canAfford ? 'Click to Draft' : 'Lacks Marrow'} (💀 ${spell.cost})</div>
      `;

      if (canAfford) {
        card.addEventListener('click', () => this.promptEquipSpell(spell));
      } else {
        card.style.opacity = '0.5';
        card.style.cursor = 'not-allowed';
      }

      this.draftContainer.appendChild(card);
    });
  }

  buyHealthUpgrade() {
    if (this.player.marrow >= this.upgradeCosts.health) {
      this.player.marrow -= this.upgradeCosts.health;
      this.player.maxHits++;
      this.player.currentHits = this.player.maxHits;
      this.upgradeCosts.health += 20;
      horrorAudio.playMarrowCollect();
      this.updateUI();
    }
  }

  buyAgilityUpgrade() {
    if (this.player.marrow >= this.upgradeCosts.agility && this.player.agility > 100) {
      this.player.marrow -= this.upgradeCosts.agility;
      this.player.setAgility(this.player.agility - 25);
      this.upgradeCosts.agility += 15;
      horrorAudio.playMarrowCollect();
      this.updateUI();
    }
  }

  buyStaminaUpgrade() {
    if (this.player.marrow >= this.upgradeCosts.stamina) {
      this.player.marrow -= this.upgradeCosts.stamina;
      this.player.maxStamina += 2;
      this.player.currentStamina = this.player.maxStamina;
      this.upgradeCosts.stamina += 15;
      horrorAudio.playMarrowCollect();
      this.updateUI();
    }
  }

  promptEquipSpell(spell) {
    const slotStr = prompt(`Draft ${spell.name}? Which spell slot should it replace? Enter 1, 2, 3, or 4:`, "1");
    if (!slotStr) return;
    const slotNum = parseInt(slotStr, 10);
    if (slotNum >= 1 && slotNum <= 4) {
      this.player.marrow -= spell.cost;
      this.spellEngine.equipSpell(slotNum - 1, spell);
      horrorAudio.playMarrowCollect();
      // Remove drafted spell
      this.currentDrafts = this.currentDrafts.filter(s => s.id !== spell.id);
      this.updateUI();
      if (window.game) window.game.updateHUD();
    } else {
      alert("Invalid slot number. Enter 1, 2, 3, or 4.");
    }
  }
}
