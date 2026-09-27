/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Menu & Testing Level Selector (Floors 1 - 26)
 */

import { FLOORS_CONFIG, SPELL_CATALOG } from './config.js';
import { horrorAudio } from './audio.js';

export class LevelSelectModal {
  constructor(game) {
    this.game = game;
    this.modalEl = document.getElementById('level-select-modal');
    this.gridEl = document.getElementById('level-select-grid');
    this.btnClose = document.getElementById('btn-close-level-select');

    this.initFloorButtons();
    this.bindEvents();
  }

  initFloorButtons() {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';

    for (let f = 1; f <= FLOORS_CONFIG.TOTAL_FLOORS; f++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'floor-select-btn';
      btn.dataset.floor = f;

      const isSafe = FLOORS_CONFIG.SAFE_FLOORS.includes(f);
      const isBoss = f === 26;
      const isBoneFloor = f === 11;

      let badge = '';
      if (isBoss) {
        btn.classList.add('boss-floor');
        badge = '<span class="floor-badge boss">💀 BOSS</span>';
      } else if (isSafe) {
        btn.classList.add('safe-floor');
        badge = '<span class="floor-badge safe">🩸 FONT</span>';
      } else if (isBoneFloor) {
        btn.classList.add('bone-floor');
        badge = '<span class="floor-badge bone">🦴 BONES</span>';
      }

      btn.innerHTML = `
        <div class="floor-num">F${f}</div>
        <div class="floor-name">${this.getFloorSubtitle(f)}</div>
        ${badge}
      `;

      btn.addEventListener('click', () => {
        horrorAudio.ensureContext();
        this.close();
        this.game.jumpToFloor(f);
      });

      this.gridEl.appendChild(btn);
    }
  }

  getFloorSubtitle(floorNum) {
    if (floorNum === 26) return "The Emperor";
    if (FLOORS_CONFIG.SAFE_FLOORS.includes(floorNum)) return "Sanctuary";
    if (floorNum <= 4) return "Jiangshi";
    if (floorNum <= 9) return "Crypts";
    if (floorNum <= 14) return "Scribes";
    if (floorNum <= 19) return "Puppets";
    return "Blood Core";
  }

  bindEvents() {
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }

    // Quick Test Cheats
    const btnAddMarrow = document.getElementById('btn-test-marrow');
    if (btnAddMarrow) {
      btnAddMarrow.addEventListener('click', () => {
        this.game.player.addMarrow(100);
        this.game.updateHUD();
      });
    }

    const btnRestore = document.getElementById('btn-test-restore');
    if (btnRestore) {
      btnRestore.addEventListener('click', () => {
        this.game.player.restoreFull();
        this.game.updateHUD();
      });
    }

    const btnAllSpells = document.getElementById('btn-test-spells');
    if (btnAllSpells) {
      btnAllSpells.addEventListener('click', () => {
        this.game.spellEngine.equipSpell(0, SPELL_CATALOG.PAWN_STRIDE);
        this.game.spellEngine.equipSpell(1, SPELL_CATALOG.KNIGHT_TALON);
        this.game.spellEngine.equipSpell(2, SPELL_CATALOG.ROOK_SEVERANCE);
        this.game.spellEngine.equipSpell(3, SPELL_CATALOG.QUEEN_RUIN);
        this.game.updateHUD();
      });
    }
  }

  open() {
    if (!this.modalEl) return;
    horrorAudio.ensureContext();
    this.modalEl.classList.remove('hidden');
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.add('hidden');
  }
}
