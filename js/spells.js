/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Spell Patterns & Demonic Talisman Engine
 */

import { SPELL_CATALOG, TILE_STATUS } from './config.js';
import { horrorAudio } from './audio.js';

export class SpellEngine {
  constructor(grid) {
    this.grid = grid;
    // Default starting spell slots: Player starts ONLY with Pawn's Stride
    this.equippedSpells = [
      { ...SPELL_CATALOG.PAWN_STRIDE },
      null,
      null,
      null
    ];
  }

  reset() {
    this.equippedSpells = [
      { ...SPELL_CATALOG.PAWN_STRIDE },
      null,
      null,
      null
    ];
  }

  getEquippedSpell(slotIndex) {
    if (slotIndex >= 0 && slotIndex < this.equippedSpells.length) {
      return this.equippedSpells[slotIndex];
    }
    return null;
  }

  equipSpell(slotIndex, spell) {
    if (slotIndex >= 0 && slotIndex < this.equippedSpells.length) {
      this.equippedSpells[slotIndex] = { ...spell };
    }
  }

  // Calculate target tiles for a given pattern
  getPatternTiles(originX, originY, pattern, facing = { dx: 0, dy: -1 }, range = 4) {
    const tiles = [];
    const addIfValid = (x, y) => {
      if (this.grid.isInBounds(x, y)) {
        tiles.push({ x, y });
      }
    };

    switch (pattern) {
      case 'pawn': {
        // 2 tiles ahead in facing direction to make it easier to hit enemies
        const pawnRange = range || 2;
        for (let s = 1; s <= pawnRange; s++) {
          addIfValid(originX + facing.dx * s, originY + facing.dy * s);
        }
        break;
      }

      case 'knight': {
        // 8 L-shaped moves relative to origin
        const offsets = [
          [1, 2], [2, 1], [-1, 2], [-2, 1],
          [1, -2], [2, -1], [-1, -2], [-2, -1]
        ];
        offsets.forEach(([dx, dy]) => addIfValid(originX + dx, originY + dy));
        break;
      }

      case 'rook': {
        // Cardinal lines
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        directions.forEach(([dx, dy]) => {
          for (let step = 1; step <= range; step++) {
            const tx = originX + dx * step;
            const ty = originY + dy * step;
            if (!this.grid.isInBounds(tx, ty)) break;
            tiles.push({ x: tx, y: ty });
          }
        });
        break;
      }

      case 'bishop': {
        // Diagonal lines
        const directions = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
        directions.forEach(([dx, dy]) => {
          for (let step = 1; step <= range; step++) {
            const tx = originX + dx * step;
            const ty = originY + dy * step;
            if (!this.grid.isInBounds(tx, ty)) break;
            tiles.push({ x: tx, y: ty });
          }
        });
        break;
      }

      case 'king': {
        // 3x3 perimeter box around origin (plus origin if requested)
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            addIfValid(originX + dx, originY + dy);
          }
        }
        break;
      }

      case 'cross_wall': {
        // 4 cardinal adjacent tiles
        const cardinals = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        cardinals.forEach(([dx, dy]) => addIfValid(originX + dx, originY + dy));
        break;
      }

      case 'queen': {
        // Full Cross + Full Diagonals (Queen's Ruin)
        const allDirs = [
          [1, 0], [-1, 0], [0, 1], [0, -1],
          [1, 1], [-1, 1], [1, -1], [-1, -1]
        ];
        allDirs.forEach(([dx, dy]) => {
          for (let step = 1; step <= range; step++) {
            const tx = originX + dx * step;
            const ty = originY + dy * step;
            if (!this.grid.isInBounds(tx, ty)) break;
            tiles.push({ x: tx, y: ty });
          }
        });
        break;
      }

      default:
        addIfValid(originX, originY);
        break;
    }

    return tiles;
  }

  // Cast spell: returns cast info object
  castSpell(spell, caster, facing, enemies = [], onComplete = null) {
    const targetTiles = this.getPatternTiles(caster.x, caster.y, spell.pattern, facing, spell.range || 4);
    
    // Scale activation delay based on tiles and base delay
    let delay = spell.baseDelay;
    if (spell.id === 'queen_ruin') {
      delay = 3.00; // Fixed 3.0s extreme root delay for Queen's Ruin
    }

    // Telegraph each target tile on the grid
    targetTiles.forEach(tile => {
      this.grid.telegraphTile(tile.x, tile.y, spell.effect, delay, 'player', (tx, ty, status) => {
        // On detonation
        horrorAudio.playSpellDetonation(spell.id === 'queen_ruin' ? 1.5 : 1.0);
      });
    });

    return {
      spell,
      delay,
      targetTiles,
      onComplete: () => {
        // Special rule for Queen's Ruin:
        // Demonic Backlash / Blood Sacrifice: If any living enemies remain alive on the board, caster loses 1 Health!
        if (spell.id === 'queen_ruin') {
          setTimeout(() => {
            const livingEnemies = enemies.filter(e => e.alive);
            if (livingEnemies.length > 0) {
              caster.takeDamage(true, "Queen's Blood Sacrifice");
            }
          }, 100);
        }
        if (onComplete) onComplete();
      }
    };
  }
}
