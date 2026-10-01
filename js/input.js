/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Input Controller: Keyboard, Mobile D-Pad, and Touch Swipes
 */

import { horrorAudio } from './audio.js';

export class InputHandler {
  constructor(canvas, { onCast, onMoveImmediate, canAcceptInput = () => true, onMenu, onFocusLost }) {
    this.canvas = canvas;
    this.onCast = onCast;
    this.onMoveImmediate = onMoveImmediate;
    this.canAcceptInput = canAcceptInput;
    this.onMenu = onMenu;
    this.onFocusLost = onFocusLost;
    this.keysDown = {};
    this.touchDirection = null;
    this.touchStart = null;
    this.dpadButtons = [];

    this.bindKeyboard();
    this.bindDPad();
    this.bindTouchSwipe();
    window.addEventListener('blur', () => this.handleFocusLost());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.handleFocusLost();
    });
    window.addEventListener('pointerup', () => this.releaseDPad());
    window.addEventListener('pointercancel', () => this.resetTouch());
  }

  releaseDPad() {
    this.touchDirection = null;
    this.dpadButtons.forEach(btn => btn.classList.remove('active'));
  }

  resetTouch() {
    this.releaseDPad();
    this.touchStart = null;
  }

  reset() {
    this.keysDown = {};
    this.resetTouch();
  }

  handleFocusLost() {
    this.reset();
    if (this.onFocusLost) this.onFocusLost();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        if (!e.repeat && this.onMenu) this.onMenu();
        return;
      }
      if (!this.canAcceptInput()) return;
      const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      const spellKeys = ['Digit1', 'KeyQ', 'Digit2', 'KeyE', 'Digit3', 'KeyR', 'Digit4', 'Space'];
      if (!movementKeys.includes(e.code) && !spellKeys.includes(e.code)) return;
      e.preventDefault();
      // A held key cleared by pausing must be released and pressed again.
      if (e.repeat && !this.keysDown[e.code]) return;
      this.keysDown[e.code] = true;

      // Spell triggers
      if (e.repeat) return;
      if (e.code === 'Digit1' || e.code === 'KeyQ') this.onCast(0);
      else if (e.code === 'Digit2' || e.code === 'KeyE') this.onCast(1);
      else if (e.code === 'Digit3' || e.code === 'KeyR') this.onCast(2);
      else if (e.code === 'Digit4' || e.code === 'Space') this.onCast(3);
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown[e.code] = false;
    });
  }

  bindDPad() {
    const dpadButtons = [
      { id: 'btn-dpad-up', dx: 0, dy: -1 },
      { id: 'btn-dpad-down', dx: 0, dy: 1 },
      { id: 'btn-dpad-left', dx: -1, dy: 0 },
      { id: 'btn-dpad-right', dx: 1, dy: 0 }
    ];

    dpadButtons.forEach(({ id, dx, dy }) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      this.dpadButtons.push(btn);

      const handlePress = (e) => {
        if (!this.canAcceptInput()) return;
        if (e.cancelable) e.preventDefault();
        horrorAudio.ensureContext();
        btn.classList.add('active');
        this.touchDirection = { dx, dy };
        if (this.onMoveImmediate) {
          this.onMoveImmediate(dx, dy);
        }
      };

      const handleRelease = (e) => {
        btn.classList.remove('active');
        if (this.touchDirection && this.touchDirection.dx === dx && this.touchDirection.dy === dy) {
          this.touchDirection = null;
        }
      };

      btn.addEventListener('pointerdown', handlePress);
      btn.addEventListener('pointerup', handleRelease);
      btn.addEventListener('pointercancel', handleRelease);
      btn.addEventListener('pointerleave', handleRelease);
    });
  }

  bindTouchSwipe() {
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.canAcceptInput() && e.touches.length > 0) {
        this.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        horrorAudio.ensureContext();
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e) => {
      const start = this.touchStart;
      this.touchStart = null;
      if (this.canAcceptInput() && start && e.changedTouches.length > 0) {
        const deltaX = e.changedTouches[0].clientX - start.x;
        const deltaY = e.changedTouches[0].clientY - start.y;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const swipeThreshold = 24;

        if (absX > swipeThreshold || absY > swipeThreshold) {
          if (absX > absY) {
            const dx = deltaX > 0 ? 1 : -1;
            if (this.onMoveImmediate) this.onMoveImmediate(dx, 0);
          } else {
            const dy = deltaY > 0 ? 1 : -1;
            if (this.onMoveImmediate) this.onMoveImmediate(0, dy);
          }
        }
      }
    }, { passive: true });
    this.canvas.addEventListener('touchcancel', () => { this.touchStart = null; }, { passive: true });
  }

  getMovementVector() {
    if (!this.canAcceptInput()) return { dx: 0, dy: 0 };
    let dx = 0;
    let dy = 0;

    if (this.keysDown['KeyW'] || this.keysDown['ArrowUp'] || (this.touchDirection && this.touchDirection.dy < 0)) dy -= 1;
    else if (this.keysDown['KeyS'] || this.keysDown['ArrowDown'] || (this.touchDirection && this.touchDirection.dy > 0)) dy += 1;
    else if (this.keysDown['KeyA'] || this.keysDown['ArrowLeft'] || (this.touchDirection && this.touchDirection.dx < 0)) dx -= 1;
    else if (this.keysDown['KeyD'] || this.keysDown['ArrowRight'] || (this.touchDirection && this.touchDirection.dx > 0)) dx += 1;

    return { dx, dy };
  }
}
