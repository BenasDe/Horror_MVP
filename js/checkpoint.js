/** Versioned sanctuary saves. Only catalog IDs and validated run data are stored. */
import { FLOORS_CONFIG, INITIAL_PLAYER_STATS, SPELL_CATALOG } from './config.js';

export const CHECKPOINT_VERSION = 1;
export const CHECKPOINT_STORAGE_KEY = 'blood-marrow-pagoda.checkpoint';

export function validateCheckpoint(value) {
  if (!value || typeof value !== 'object' || value.version !== CHECKPOINT_VERSION) return null;
  const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
  const spells = new Set(Object.values(SPELL_CATALOG).map(spell => spell.id));
  if (!FLOORS_CONFIG.SAFE_FLOORS.includes(value.floor) ||
      !integer(value.maxHits, INITIAL_PLAYER_STATS.MAX_HITS, 1000) ||
      !integer(value.agility, 100, INITIAL_PLAYER_STATS.AGILITY) ||
      !integer(value.maxStamina, INITIAL_PLAYER_STATS.MAX_STAMINA, 1000) ||
      !integer(value.marrow, 0, 1_000_000_000) ||
      !integer(value.totalKills, 0, 1_000_000_000)) return null;
  if (!Array.isArray(value.spells) || value.spells.length !== 4 ||
      !value.spells.every(id => id === null || spells.has(id))) return null;
  if (!Array.isArray(value.drafts) || value.drafts.length > 3 ||
      !value.drafts.every(id => spells.has(id) && id !== SPELL_CATALOG.PAWN_STRIDE.id) ||
      new Set(value.drafts).size !== value.drafts.length) return null;
  const costs = value.upgradeCosts;
  if (!costs || !integer(costs.health, 40, 1_000_000) ||
      !integer(costs.agility, 25, 1_000_000) || !integer(costs.stamina, 20, 1_000_000)) return null;

  // Copy only trusted fields; never load executable behavior or spell definitions from storage.
  return {
    version: CHECKPOINT_VERSION,
    floor: value.floor,
    maxHits: value.maxHits,
    agility: value.agility,
    maxStamina: value.maxStamina,
    marrow: value.marrow,
    totalKills: value.totalKills,
    spells: [...value.spells],
    drafts: [...value.drafts],
    upgradeCosts: { health: costs.health, agility: costs.agility, stamina: costs.stamina }
  };
}

export class CheckpointStore {
  constructor(getStorage = () => globalThis.localStorage) {
    this.getStorage = getStorage;
    this.lastError = null;
  }

  load() {
    this.lastError = null;
    let raw;
    try {
      raw = this.getStorage().getItem(CHECKPOINT_STORAGE_KEY);
    } catch {
      this.lastError = 'unavailable';
      return null;
    }
    if (raw === null) return null;
    try {
      const checkpoint = validateCheckpoint(JSON.parse(raw));
      if (checkpoint) return checkpoint;
    } catch {
      // A corrupt or incompatible save must not prevent the game from starting.
    }
    this.lastError = 'invalid';
    return null;
  }

  save(checkpoint) {
    const validated = validateCheckpoint(checkpoint);
    this.lastError = validated ? null : 'invalid';
    if (!validated) return false;
    try {
      this.getStorage().setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(validated));
      return true;
    } catch {
      this.lastError = 'unavailable';
      return false;
    }
  }

  clear() {
    this.lastError = null;
    try {
      this.getStorage().removeItem(CHECKPOINT_STORAGE_KEY);
      return true;
    } catch {
      this.lastError = 'unavailable';
      return false;
    }
  }
}
