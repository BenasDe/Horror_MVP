/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * In-Game Game Menu & Cultivator Compendium Guide
 */

import { horrorAudio } from './audio.js';

export class GameMenuModal {
  constructor(game) {
    this.game = game;
    this.modalEl = document.getElementById('game-menu-modal');
    this.btnClose = document.getElementById('btn-close-game-menu');
    this.btnAudioToggle = document.getElementById('btn-audio-toggle');
    this.btnRestartCp = document.getElementById('btn-menu-restart-cp');
    this.tabButtons = document.querySelectorAll('.guide-tab-btn');
    this.tabPanels = document.querySelectorAll('.guide-tab-panel');

    this.bindEvents();
  }

  bindEvents() {
    // Close Menu
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => {
        horrorAudio.ensureContext();
        this.close();
      });
    }

    // Audio Mute Toggle
    if (this.btnAudioToggle) {
      this.btnAudioToggle.addEventListener('click', () => {
        const isMuted = horrorAudio.toggleMute();
        this.btnAudioToggle.textContent = isMuted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
      });
    }

    // Revive / Restart at Checkpoint
    if (this.btnRestartCp) {
      this.btnRestartCp.addEventListener('click', () => {
        horrorAudio.ensureContext();
        this.close();
        this.game.reviveAtCheckpoint();
      });
    }

    // Guide Tab Switching
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        horrorAudio.ensureContext();
        const targetId = btn.dataset.tab;

        this.tabButtons.forEach(b => b.classList.remove('active'));
        this.tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
      });
    });
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
