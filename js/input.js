/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Input Controller: Keyboard, Mobile D-Pad, and Touch Swipes
 */

import { horrorAudio } from './audio.js';

export class InputHandler {
  constructor(canvas, { onCast, onMoveImmediate }) {
    this.canvas = canvas;
    this.onCast = onCast;
    this.onMoveImmediate = onMoveImmediate;
    this.keysDown = {};
    this.touchDirection = null;

    this.bindKeyboard();
    this.bindDPad();
    this.bindTouchSwipe();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keysDown[e.code] = true;

      // Spell triggers
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

      const handlePress = (e) => {
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
    let touchStartX = 0;
    let touchStartY = 0;

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        horrorAudio.ensureContext();
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e) => {
      if (e.changedTouches.length > 0) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
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
  }

  getMovementVector() {
    let dx = 0;
    let dy = 0;

    if (this.keysDown['KeyW'] || this.keysDown['ArrowUp'] || (this.touchDirection && this.touchDirection.dy < 0)) dy -= 1;
    else if (this.keysDown['KeyS'] || this.keysDown['ArrowDown'] || (this.touchDirection && this.touchDirection.dy > 0)) dy += 1;
    else if (this.keysDown['KeyA'] || this.keysDown['ArrowLeft'] || (this.touchDirection && this.touchDirection.dx < 0)) dx -= 1;
    else if (this.keysDown['KeyD'] || this.keysDown['ArrowRight'] || (this.touchDirection && this.touchDirection.dx > 0)) dx += 1;

    return { dx, dy };
  }
}
