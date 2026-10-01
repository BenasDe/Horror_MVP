import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HorrorAudioEngine, horrorAudio } from '../js/audio.js';
import { InputHandler } from '../js/input.js';
import { installDOM, dispatch } from './helpers.js';

beforeEach(() => {
  installDOM();
  Object.assign(horrorAudio, new HorrorAudioEngine());
});

test('mute silences every sound through the master output, including active channels', () => {
  const audio = new HorrorAudioEngine();
  audio.ensureContext();
  for (const sound of ['playGong', 'playJiangshiHop', 'playPlayerStep', 'playSpellDetonation', 'playDamageTaken', 'playShieldBreak', 'playMarrowCollect']) audio[sound]();
  const channel = audio.startSpellChannel(3);
  const outputs = audio.ctx.nodes.filter(node => node.connections.includes(audio.ctx.destination));
  assert.deepEqual(outputs, [audio.masterGain]);
  assert.ok(channel.gain.connections.includes(audio.masterGain));
  assert.equal(audio.toggleMute(), true);
  assert.equal(audio.masterGain.gain.value, 0);
  assert.equal(audio.toggleMute(), false);
  assert.equal(audio.masterGain.gain.value, 1);
});

test('channeling while muted creates no audible nodes, and cancellation is idempotent', () => {
  const audio = new HorrorAudioEngine();
  audio.toggleMute();
  const count = audio.ctx.nodes.length;
  assert.equal(audio.startSpellChannel(2), null);
  assert.equal(audio.ctx.nodes.length, count);
  audio.toggleMute();
  const channel = audio.startSpellChannel(2);
  audio.stopSpellChannel();
  audio.stopSpellChannel();
  assert.equal(channel.gain.gain.value, 0);
  assert.equal(channel.osc.stops.length, 2); // Scheduled ending, then cancellation.
  channel.osc.onended();
  assert.deepEqual(channel.gain.connections, []);
  assert.equal(audio.activeChannel, null);
});

test('pausing clears held keys; key repeat cannot restart movement or casting', () => {
  let enabled = true;
  const casts = [];
  const input = new InputHandler(document.getElementById('gameCanvas'), {
    onCast: slot => casts.push(slot), canAcceptInput: () => enabled
  });
  dispatch(window, 'keydown', { code: 'ArrowUp', repeat: false });
  assert.deepEqual(input.getMovementVector(), { dx: 0, dy: -1 });
  enabled = false;
  input.reset();
  dispatch(window, 'keydown', { code: 'KeyQ', repeat: false });
  enabled = true;
  dispatch(window, 'keydown', { code: 'ArrowUp', repeat: true });
  dispatch(window, 'keydown', { code: 'KeyQ', repeat: true });
  assert.deepEqual(input.getMovementVector(), { dx: 0, dy: 0 });
  assert.deepEqual(casts, []);
  dispatch(window, 'keydown', { code: 'KeyQ', repeat: false });
  dispatch(window, 'keydown', { code: 'KeyQ', repeat: true });
  assert.deepEqual(casts, [0]);
});

test('focus loss and a hidden document clear keyboard and D-pad input', () => {
  let lost = 0;
  const input = new InputHandler(document.getElementById('gameCanvas'), {
    onCast: () => {}, onFocusLost: () => lost++
  });
  const button = document.getElementById('btn-dpad-right');
  dispatch(button, 'pointerdown');
  dispatch(window, 'keydown', { code: 'ArrowUp' });
  dispatch(window, 'blur');
  assert.deepEqual(input.getMovementVector(), { dx: 0, dy: 0 });
  assert.equal(button.classList.contains('active'), false);
  document.hidden = true;
  dispatch(document, 'visibilitychange');
  assert.equal(lost, 2);
});

test('pointer-up does not erase a canvas swipe; reset cancels an unfinished swipe', () => {
  const canvas = document.getElementById('gameCanvas');
  const moves = [];
  const input = new InputHandler(canvas, { onCast: () => {}, onMoveImmediate: (dx, dy) => moves.push([dx, dy]) });
  dispatch(canvas, 'touchstart', { touches: [{ clientX: 0, clientY: 0 }] });
  dispatch(window, 'pointerup');
  dispatch(canvas, 'touchend', { changedTouches: [{ clientX: 60, clientY: 0 }] });
  assert.deepEqual(moves, [[1, 0]]);
  dispatch(canvas, 'touchstart', { touches: [{ clientX: 0, clientY: 0 }] });
  input.reset();
  dispatch(canvas, 'touchend', { changedTouches: [{ clientX: 60, clientY: 0 }] });
  assert.equal(moves.length, 1);
});
