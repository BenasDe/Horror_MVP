import test from 'node:test';
import assert from 'node:assert/strict';
import { CheckpointStore, CHECKPOINT_STORAGE_KEY, validateCheckpoint } from '../js/checkpoint.js';
import { FLOORS_CONFIG } from '../js/config.js';
import { memoryStorage } from './helpers.js';

const snapshot = () => ({
  version: 1, floor: 10, maxHits: 3, agility: 225, maxStamina: 8,
  marrow: 120, totalKills: 40,
  spells: ['pawn_stride', 'queen_ruin', null, 'tortoise_sanctuary'],
  drafts: ['rook_severance', 'knight_talon'],
  upgradeCosts: { health: 80, agility: 55, stamina: 50 }
});

test('checkpoint round-trip across store instances preserves every sanctuary field', () => {
  const storage = memoryStorage();
  const original = snapshot();
  assert.equal(new CheckpointStore(() => storage).save(original), true);
  const restored = new CheckpointStore(() => storage).load();
  assert.deepEqual(restored, original);
  restored.spells[0] = null;
  restored.upgradeCosts.health = 1000;
  assert.deepEqual(new CheckpointStore(() => storage).load(), original);
});

test('all configured sanctuary floors accept saves, including an empty draft', () => {
  for (const floor of FLOORS_CONFIG.SAFE_FLOORS) {
    assert.ok(validateCheckpoint({ ...snapshot(), floor, drafts: [] }));
  }
});

test('invalid saves and future versions are rejected', () => {
  const cases = [
    null, {}, { ...snapshot(), version: 2 }, { ...snapshot(), floor: 26 },
    { ...snapshot(), maxHits: 0 }, { ...snapshot(), maxHits: 1_000_000 },
    { ...snapshot(), agility: NaN }, { ...snapshot(), agility: 99 },
    { ...snapshot(), maxStamina: 3 }, { ...snapshot(), marrow: -1 },
    { ...snapshot(), totalKills: Infinity }, { ...snapshot(), totalKills: 1.5 },
    { ...snapshot(), spells: ['pawn_stride'] },
    { ...snapshot(), spells: ['unknown', null, null, null] },
    { ...snapshot(), spells: [{ id: 'queen_ruin', baseDelay: 0 }, null, null, null] },
    { ...snapshot(), drafts: ['pawn_stride'] },
    { ...snapshot(), drafts: ['knight_talon', 'knight_talon'] },
    { ...snapshot(), upgradeCosts: { health: 0, agility: 25, stamina: 20 } }
  ];
  for (const value of cases) assert.equal(validateCheckpoint(value), null);
});

test('malformed JSON is ignored and a new run can clear it', () => {
  const storage = memoryStorage();
  storage.setItem(CHECKPOINT_STORAGE_KEY, '{broken');
  const store = new CheckpointStore(() => storage);
  assert.equal(store.load(), null);
  assert.equal(store.lastError, 'invalid');
  assert.equal(store.clear(), true);
  assert.equal(store.load(), null);
  assert.equal(store.lastError, null);
});

test('untrusted extra fields never enter a restored snapshot', () => {
  assert.deepEqual(validateCheckpoint({ ...snapshot(), enemy: {}, spellDefinitions: {} }), snapshot());
});

test('storage denial and quota errors do not throw', () => {
  for (const getStorage of [
    () => { throw new Error('SecurityError'); },
    () => ({
      getItem() { throw new Error('read denied'); },
      setItem() { throw new Error('QuotaExceededError'); },
      removeItem() { throw new Error('delete denied'); }
    })
  ]) {
    const store = new CheckpointStore(getStorage);
    assert.equal(store.load(), null);
    assert.equal(store.save(snapshot()), false);
    assert.equal(store.clear(), false);
    assert.equal(store.lastError, 'unavailable');
  }
});
