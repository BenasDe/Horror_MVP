/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Game Configuration & Catalog Constants
 */

export const GRID_CONFIG = {
  COLS: 10,
  ROWS: 10,
  TILE_SIZE: 70, // 70x70 px per tile inside 760x760 canvas with 30px padding
  PADDING: 30
};

export const TILE_STATUS = {
  NORMAL: 0,
  DAMAGING: 1,      // Deals 1 hit to entities entering/standing
  INACCESSIBLE: 2,  // Solid bone wall / pillar blocking movement
  SHIELDED: 3       // Immune to status changes, absorbs 1 hit / negates damage
};

export const TILE_DURATIONS = {
  DAMAGING: 5.0,     // 5 seconds
  INACCESSIBLE: 9.0, // 9 seconds
  SHIELDED: 7.0      // 7 seconds
};

export const INITIAL_PLAYER_STATS = {
  MAX_HITS: 1,       // 1 hit death at start
  AGILITY: 250,      // ms per tile movement
  MAX_STAMINA: 4,    // Spell casts per floor
  MARROW: 0
};

// All Available Spells Catalog with Chess Patterns
export const SPELL_CATALOG = {
  PAWN_STRIDE: {
    id: 'pawn_stride',
    name: "Pawn's Stride",
    icon: '♟️',
    pattern: 'pawn',
    effect: TILE_STATUS.DAMAGING,
    baseDelay: 0.35,
    range: 2,
    desc: 'Forward thrust: turns 2 tiles directly ahead into Damaging Yin Spikes.',
    cost: 15
  },
  KNIGHT_TALON: {
    id: 'knight_talon',
    name: "Knight's Talon",
    icon: '♞',
    pattern: 'knight',
    effect: TILE_STATUS.DAMAGING,
    baseDelay: 0.95,
    desc: 'Strikes 8 L-shaped tiles around you with erupting blood talons.',
    cost: 25
  },
  ROOK_SEVERANCE: {
    id: 'rook_severance',
    name: "Rook's Severance",
    icon: '♜',
    pattern: 'rook',
    effect: TILE_STATUS.DAMAGING,
    baseDelay: 1.35,
    range: 4,
    desc: 'Piercing orthogonal cross: turns 4 tiles in all cardinal directions into Damaging Yin blades.',
    cost: 35
  },
  BISHOP_GAZE: {
    id: 'bishop_gaze',
    name: "Bishop's Gaze",
    icon: '♝',
    pattern: 'bishop',
    effect: TILE_STATUS.DAMAGING,
    baseDelay: 1.35,
    range: 4,
    desc: 'Diagonal spatial rupture: turns 4 tiles in all 4 diagonal lines into Damaging Yin cold.',
    cost: 35
  },
  TORTOISE_SANCTUARY: {
    id: 'tortoise_sanctuary',
    name: 'Tortoise Sanctuary',
    icon: '🛡️',
    pattern: 'king',
    effect: TILE_STATUS.SHIELDED,
    baseDelay: 0.50,
    range: 1,
    desc: 'Purifying ward: Shields your current tile and 4 adjacent cardinal tiles.',
    cost: 25
  },
  BONE_BASTION: {
    id: 'bone_bastion',
    name: 'Bone Bastion',
    icon: '🧱',
    pattern: 'cross_wall',
    effect: TILE_STATUS.INACCESSIBLE,
    baseDelay: 0.55,
    range: 1,
    desc: 'Erects impassable bone pillars on 4 cardinal tiles around target to block fiends.',
    cost: 20
  },
  QUEEN_RUIN: {
    id: 'queen_ruin',
    name: "Queen's Ruin",
    icon: '♛',
    pattern: 'queen',
    effect: TILE_STATUS.DAMAGING,
    baseDelay: 3.00, // 3.0 seconds extreme delay
    range: 9,
    desc: "Board-wide apocalypse (Full Cross + Diagonals). 3s channel root! Siphons 1 Health if enemies survive.",
    isSacrificial: true,
    cost: 50
  }
};

// Floor Progression Definitions (26 Floors Total)
export const FLOORS_CONFIG = {
  TOTAL_FLOORS: 26,
  SAFE_FLOORS: [5, 10, 15, 20, 25],
  BOSS_FLOOR: 26,
  
  // Tier info for atmosphere
  TIERS: [
    { start: 1, end: 4, name: "Outer Corrupted Hall", theme: 'jiangshi_early' },
    { start: 5, end: 5, name: "Marrow Font I", isSafe: true },
    { start: 6, end: 9, name: "Corpse Refinement Crypts", theme: 'jiangshi_wraith' },
    { start: 10, end: 10, name: "Marrow Font II", isSafe: true },
    { start: 11, end: 14, name: "Ghostly Asphyxiation Chambers", theme: 'wraiths_scribes' },
    { start: 15, end: 15, name: "Marrow Font III", isSafe: true },
    { start: 16, end: 19, name: "Demonic Puppet Scriptorium", theme: 'scribes_elites' },
    { start: 20, end: 20, name: "Marrow Font IV", isSafe: true },
    { start: 21, end: 24, name: "Abyssal Blood Core", theme: 'all_chaos' },
    { start: 25, end: 25, name: "Marrow Font V (Final Sanctuary)", isSafe: true },
    { start: 26, end: 26, name: "The Pagoda Seal (Elder Corpse Emperor)", isBoss: true }
  ]
};
