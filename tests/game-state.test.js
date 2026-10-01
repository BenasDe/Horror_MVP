import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CheckpointStore, CHECKPOINT_STORAGE_KEY } from '../js/checkpoint.js';
import { INITIAL_PLAYER_STATS, SPELL_CATALOG, TILE_STATUS } from '../js/config.js';
import { HorrorAudioEngine, horrorAudio } from '../js/audio.js';
import { installDOM, dispatch, memoryStorage } from './helpers.js';

installDOM();
const { DemonicPagodaGame } = await import('../js/main.js');

beforeEach(() => {
  installDOM();
  Object.assign(horrorAudio, new HorrorAudioEngine());
});

function createGame(storage = memoryStorage()) {
  const renderer = {
    resets: 0, updates: 0,
    resetTransientState() { this.resets++; },
    update() { this.updates++; }, render() {}, triggerShake() {}, flashPlayerHit() {},
    flashEnemyHit() {}, spawnBloodParticles() {}, spawnBoneShatterDebris() {}, addFloatingText() {}
  };
  const game = new DemonicPagodaGame({
    createRenderer: () => renderer,
    checkpointStore: new CheckpointStore(() => storage)
  });
  // Production spells use window.game for Queen's Ruin notifications.
  window.game = game;
  return { game, renderer, storage };
}

function hideBannerTimer(game) { clearTimeout(game.bannerTimeout); }

test('new run discards Floor 25 checkpoint and all previous run state', () => {
  const { game, storage, renderer } = createGame();
  game.startNewRun();
  game.player.maxHits = 7;
  game.player.maxStamina = 12;
  game.player.setAgility(100);
  game.player.marrow = 500;
  game.totalKills = 120;
  game.spellEngine.equipSpell(1, SPELL_CATALOG.QUEEN_RUIN);
  game.startFloor(25);
  assert.ok(storage.getItem(CHECKPOINT_STORAGE_KEY));
  game.player.isInvulnerable = true;
  game.player.invulnTimer = 5;
  game.player.isCasting = true;
  game.player.currentCastSpell = SPELL_CATALOG.QUEEN_RUIN;
  game.player.queensRuinCheck = { timer: 5, enemies: game.enemies };
  game.floorClearTimer = 1.3;
  game.input.keysDown.KeyW = true;
  game.fontManager.upgradeCosts.health = 200;
  game.startNewRun();
  assert.equal(game.currentFloor, 1);
  assert.equal(game.lastCheckpointFloor, 1);
  assert.equal(game.savedCheckpointState, null);
  assert.equal(storage.getItem(CHECKPOINT_STORAGE_KEY), null);
  assert.equal(game.player.maxHits, INITIAL_PLAYER_STATS.MAX_HITS);
  assert.equal(game.player.currentHits, INITIAL_PLAYER_STATS.MAX_HITS);
  assert.equal(game.player.maxStamina, INITIAL_PLAYER_STATS.MAX_STAMINA);
  assert.equal(game.player.agility, INITIAL_PLAYER_STATS.AGILITY);
  assert.equal(game.player.marrow, 0);
  assert.equal(game.totalKills, 0);
  assert.equal(game.floorClearTimer, 0);
  assert.equal(game.player.isInvulnerable, false);
  assert.equal(game.player.invulnTimer, 0);
  assert.equal(game.player.currentCastSpell, null);
  assert.equal(game.player.queensRuinCheck, null);
  assert.deepEqual(game.spellEngine.equippedSpells.map(s => s?.id ?? null), ['pawn_stride', null, null, null]);
  assert.deepEqual(game.fontManager.currentDrafts, []);
  assert.equal(game.fontManager.upgradeCosts.health, 40);
  assert.deepEqual(game.input.getMovementVector(), { dx: 0, dy: 0 });
  assert.ok(document.getElementById('font-modal').classList.contains('hidden'));
  assert.ok(game.castBarContainer.classList.contains('hidden'));
  assert.equal(renderer.resets, 3);
  hideBannerTimer(game);
});

test('reload offers Continue without starting combat and restores purchases and draft offers', () => {
  const { game, storage } = createGame();
  game.startNewRun();
  game.player.marrow = 200;
  game.totalKills = 15;
  game.startFloor(5);
  game.fontManager.buyHealthUpgrade();
  game.fontManager.buyAgilityUpgrade();
  game.fontManager.buyStaminaUpgrade();
  const remainingDrafts = [...game.fontManager.currentDrafts];
  game.spellEngine.equipSpell(2, remainingDrafts[0]);
  game.player.marrow -= remainingDrafts[0].cost;
  game.fontManager.currentDrafts = remainingDrafts.slice(1);
  game.fontManager.updateUI();
  const saved = structuredClone(game.savedCheckpointState);
  hideBannerTimer(game);
  installDOM();
  const { game: reloaded } = createGame(storage);
  assert.equal(reloaded.gameState, 'TITLE');
  assert.equal(reloaded.btnContinue.classList.contains('hidden'), false);
  assert.equal(reloaded.btnContinue.textContent, 'CONTINUE FROM FLOOR 5');
  dispatch(reloaded.btnContinue, 'click');
  assert.equal(reloaded.gameState, 'SAFE_FONT');
  assert.equal(reloaded.currentFloor, 5);
  assert.equal(reloaded.player.currentHits, 2);
  assert.equal(reloaded.player.maxStamina, 6);
  assert.equal(reloaded.player.agility, 250);
  assert.equal(reloaded.player.marrow, saved.marrow);
  assert.equal(reloaded.totalKills, 15);
  assert.equal(reloaded.spellEngine.getEquippedSpell(2).id, saved.spells[2]);
  assert.deepEqual(reloaded.fontManager.currentDrafts.map(s => s.id), saved.drafts);
  assert.deepEqual(reloaded.fontManager.upgradeCosts, saved.upgradeCosts);
  reloaded.restoreCheckpoint();
  assert.deepEqual(reloaded.fontManager.currentDrafts.map(s => s.id), saved.drafts);
  assert.ok(reloaded.titleModal.classList.contains('hidden'));
  hideBannerTimer(reloaded);
});

test('an exhausted draft stays empty after checkpoint restoration', () => {
  const { game } = createGame();
  game.startFloor(10);
  game.fontManager.currentDrafts = [];
  game.fontManager.updateUI();
  game.restoreCheckpoint();
  assert.deepEqual(game.fontManager.currentDrafts, []);
  hideBannerTimer(game);
});

test('pause freezes hazards, casting, movement, enemies, and floor-clear countdown', () => {
  const { game, renderer } = createGame();
  game.startNewRun();
  game.enemies = [{ alive: true, updates: 0, update() { this.updates++; } }];
  game.triggerSpellCast(0);
  game.updateGameplay(0.1);
  const elapsed = game.player.castElapsed;
  const timer = game.grid.getTile(4, 7).telegraphs.player.timer;
  const stamina = game.player.currentStamina;
  game.gameMenu.open();
  assert.equal(game.gameState, 'PAUSED');
  assert.equal(horrorAudio.activeChannel, null);
  game.triggerSpellCast(0);
  game.handleMoveImmediate(1, 0);
  game.gameLoop(game.lastTime + 1000);
  assert.equal(game.player.castElapsed, elapsed);
  assert.equal(game.grid.getTile(4, 7).telegraphs.player.timer, timer);
  assert.equal(game.player.currentStamina, stamina);
  assert.equal(game.player.isMoving, false);
  assert.equal(game.enemies[0].updates, 1);
  assert.equal(game.floorClearTimer, 0);
  assert.equal(renderer.updates, 0);
  game.gameMenu.open(); // Repeated open must not overwrite resume ownership.
  game.gameMenu.close();
  assert.equal(game.gameState, 'PLAYING');
  assert.ok(horrorAudio.activeChannel);
  game.updateGameplay(0.3);
  assert.equal(game.player.isCasting, false);
  assert.equal(game.player.currentCastSpell, null);
  assert.ok(game.grid.isDamagingTo(4, 7, 'enemy'));
  hideBannerTimer(game);
});

test('a paused movement step continues from its original progress after resume', () => {
  const { game } = createGame();
  game.startNewRun();
  game.enemies = [{ alive: true, update() {} }];
  game.player.tryMove(0, -1, []);
  game.updateGameplay(0.1);
  const position = game.player.renderY;
  game.gameMenu.open();
  game.updateGameplay(1);
  assert.equal(game.player.renderY, position);
  game.gameMenu.close();
  game.updateGameplay(0.2);
  assert.equal(game.player.y, 7);
  hideBannerTimer(game);
});

test('guide closing preserves title, sanctuary, game-over, and victory states', () => {
  const { game } = createGame();
  for (const state of ['TITLE', 'SAFE_FONT', 'GAME_OVER', 'VICTORY']) {
    game.gameState = state;
    game.gameMenu.open();
    assert.equal(game.gameState, state);
    assert.equal(game.gameMenu.btnClose.textContent, 'CLOSE GUIDE');
    assert.equal(game.gameMenu.btnRestartCp.disabled, state === 'TITLE' || state === 'VICTORY');
    game.gameMenu.close();
    assert.equal(game.gameState, state);
  }
});

test('focus loss auto-pauses and Escape resumes; a hidden page cannot resume', () => {
  const { game } = createGame();
  game.startNewRun();
  dispatch(window, 'blur');
  assert.equal(game.gameState, 'PAUSED');
  document.hidden = true;
  game.gameMenu.close();
  assert.equal(game.gameMenu.isOpen, true);
  assert.equal(game.gameState, 'PAUSED');
  document.hidden = false;
  dispatch(window, 'keydown', { code: 'Escape' });
  assert.equal(game.gameState, 'PLAYING');
  hideBannerTimer(game);
});

test('checkpoint restart from the paused menu closes both menu and old sanctuary', () => {
  const { game } = createGame();
  game.startNewRun();
  game.startFloor(5);
  game.advanceFloor();
  game.gameMenu.open();
  dispatch(game.gameMenu.btnRestartCp, 'click');
  assert.equal(game.currentFloor, 5);
  assert.equal(game.gameState, 'SAFE_FONT');
  assert.equal(game.gameMenu.isOpen, false);
  assert.ok(game.gameMenu.modalEl.classList.contains('hidden'));
  assert.equal(game.fontManager.modal.classList.contains('hidden'), false);
  hideBannerTimer(game);
});

test('storage failure retains a usable session checkpoint without claiming persistence', () => {
  const storage = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('denied'); }
  };
  const { game } = createGame(storage);
  game.startNewRun();
  game.startFloor(5);
  assert.equal(game.checkpointPersisted, false);
  assert.match(game.combatBanner.textContent, /SESSION CHECKPOINT ONLY/);
  assert.ok(game.savedCheckpointState);
  assert.equal(game.restoreCheckpoint(), true);
  assert.equal(game.currentFloor, 5);
  hideBannerTimer(game);
});

test('a damaged browser checkpoint leaves the title playable', () => {
  const storage = memoryStorage();
  storage.setItem(CHECKPOINT_STORAGE_KEY, '{bad');
  const { game } = createGame(storage);
  assert.equal(game.savedCheckpointState, null);
  assert.equal(game.btnContinue.classList.contains('hidden'), true);
  assert.match(game.checkpointStatus.textContent, /damaged/);
  game.startNewRun();
  assert.equal(game.gameState, 'PLAYING');
  hideBannerTimer(game);
});

test('fatal grid callback stops the frame before player/enemy updates or floor advance', () => {
  const { game } = createGame();
  game.startNewRun();
  game.floorClearTimer = 1.39;
  game.enemies = [{ alive: false, marrow: 1, renderX: 0, renderY: 0 }];
  game.triggerSpellCast(0);
  game.grid.telegraphTile(4, 8, TILE_STATUS.DAMAGING, 0.01, 'enemy', () => game.player.takeDamage(false, 'test'));
  game.updateGameplay(0.1);
  assert.equal(game.gameState, 'GAME_OVER');
  assert.equal(game.currentFloor, 1);
  assert.equal(game.player.isCasting, false);
  assert.ok(game.castBarContainer.classList.contains('hidden'));
  game.advanceFloor();
  assert.equal(game.currentFloor, 1);
  hideBannerTimer(game);
});

test('fatal enemy attack stops later enemies from acting in the same frame', () => {
  const { game } = createGame();
  game.startNewRun();
  let laterUpdates = 0;
  game.enemies = [
    { alive: true, update: () => game.player.takeDamage(false, 'test') },
    { alive: true, update: () => laterUpdates++ }
  ];
  game.updateGameplay(0.1);
  assert.equal(game.gameState, 'GAME_OVER');
  assert.equal(laterUpdates, 0);
  hideBannerTimer(game);
});

test('all deaths are rewarded once, including enemies killed before their update', () => {
  const { game } = createGame();
  game.startNewRun();
  game.enemies = [1, 2].map(marrow => ({ alive: false, marrow, renderX: 0, renderY: 0 }));
  game.updateGameplay(0.1);
  game.updateGameplay(0.1);
  assert.equal(game.totalKills, 2);
  assert.equal(game.player.marrow, 3);
  assert.equal(game.floorClearTimer, 0.2);
  hideBannerTimer(game);
});

test('victory clears the completed run checkpoint; Play Again starts at Floor 1', () => {
  const { game, storage } = createGame();
  game.startFloor(25);
  game.advanceFloor();
  game.handleVictory();
  assert.equal(game.gameState, 'VICTORY');
  assert.equal(game.savedCheckpointState, null);
  assert.equal(storage.getItem(CHECKPOINT_STORAGE_KEY), null);
  dispatch(document.getElementById('btn-play-again'), 'click');
  assert.equal(game.currentFloor, 1);
  assert.equal(game.lastCheckpointFloor, 1);
  assert.equal(game.gameState, 'PLAYING');
  hideBannerTimer(game);
});
