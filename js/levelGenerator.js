/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Level & Enemy Procedural Generator
 */

import { TILE_STATUS } from './config.js';
import { JiangshiEnemy, WraithEnemy, CorpseScribeEnemy, CorpseEmperorBoss } from './enemies.js';

export class LevelGenerator {
  /**
   * Generates procedural obstacles for a given floor
   * @param {PagodaGrid} grid 
   * @param {number} floorNum 
   */
  static generateObstacles(grid, floorNum) {
    if (floorNum === 26) {
      // Boss floor: fixed corner pillars, leaving center and havens open
      const bossPillars = [
        [0, 0], [8, 0], [0, 8], [8, 8],
        [2, 3], [6, 3], [2, 6], [6, 6]
      ];
      bossPillars.forEach(([ox, oy]) => {
        grid.setTileStatus(ox, oy, TILE_STATUS.INACCESSIBLE, 99999, 'environment');
      });
      return;
    }

    // Number of random obstacles on 9x9 grid: 6 to 12
    const obstacleCount = Math.min(12, 5 + Math.floor(floorNum / 3));
    const reservedTiles = [
      // Player start and immediate mobility radius
      '4,8', '4,7', '3,8', '5,8', '4,6', '3,7', '5,7'
    ];

    let placed = 0;
    let attempts = 0;

    // Thematic chess / horror obstacle patterns
    const patternType = floorNum % 4;

    if (patternType === 0) {
      // Symmetric Monoliths
      const monoliths = [
        [2, 2], [6, 2], [2, 5], [6, 5],
        [4, 3], [1, 4], [7, 4]
      ];
      monoliths.forEach(([ox, oy]) => {
        if (!reservedTiles.includes(`${ox},${oy}`) && grid.isInBounds(ox, oy)) {
          grid.setTileStatus(ox, oy, TILE_STATUS.INACCESSIBLE, 99999, 'environment');
          placed++;
        }
      });
    } else if (patternType === 1) {
      // Broken Crossroad Walls
      const walls = [
        [1, 2], [2, 2], [6, 2], [7, 2],
        [3, 4], [4, 4], [5, 4],
        [2, 6], [6, 6]
      ];
      walls.forEach(([ox, oy]) => {
        if (!reservedTiles.includes(`${ox},${oy}`) && grid.isInBounds(ox, oy)) {
          grid.setTileStatus(ox, oy, TILE_STATUS.INACCESSIBLE, 99999, 'environment');
          placed++;
        }
      });
    } else if (patternType === 2) {
      // Knight Bastions (L-shapes)
      const lShapes = [
        [2, 1], [2, 2], [3, 2],
        [6, 1], [6, 2], [5, 2],
        [1, 5], [2, 5], [2, 6],
        [7, 5], [6, 5], [6, 6]
      ];
      lShapes.forEach(([ox, oy]) => {
        if (!reservedTiles.includes(`${ox},${oy}`) && grid.isInBounds(ox, oy)) {
          grid.setTileStatus(ox, oy, TILE_STATUS.INACCESSIBLE, 99999, 'environment');
          placed++;
        }
      });
    } else {
      // Scattered Pagoda Bone Ruins
      while (placed < obstacleCount && attempts < 100) {
        attempts++;
        const ox = Math.floor(Math.random() * grid.cols);
        const oy = Math.floor(Math.random() * (grid.rows - 2)); // don't spawn on bottom 2 rows
        const key = `${ox},${oy}`;
        if (!reservedTiles.includes(key) && grid.isWalkable(ox, oy)) {
          grid.setTileStatus(ox, oy, TILE_STATUS.INACCESSIBLE, 99999, 'environment');
          placed++;
        }
      }
    }
  }

  /**
   * Spawns enemies for a given floor
   * @param {PagodaGrid} grid 
   * @param {number} floorNum 
   * @returns {Array} Array of enemy instances
   */
  static spawnEnemies(grid, floorNum) {
    const enemies = [];

    if (floorNum === 26) {
      // Floor 26 Boss + 1 random minion at start
      const boss = new CorpseEmperorBoss(grid, 4, 2);
      enemies.push(boss);

      // Start fight with 1 random enemy (Jiangshi, Wraith, or Scribe)
      const startSpots = [[2, 4], [6, 4], [3, 5], [5, 5]];
      const [sx, sy] = startSpots[Math.floor(Math.random() * startSpots.length)];
      const roll = Math.random();
      let minion;
      if (roll < 0.40) minion = new JiangshiEnemy(grid, sx, sy);
      else if (roll < 0.75) minion = new WraithEnemy(grid, sx, sy);
      else minion = new CorpseScribeEnemy(grid, sx, sy);
      enemies.push(minion);

      return enemies;
    }

    // Number of enemies scales with floor
    const enemyCount = Math.min(8, 2 + Math.floor(floorNum / 3.5));

    for (let i = 0; i < enemyCount; i++) {
      let ex = 0;
      let ey = 0;
      let attempts = 0;
      do {
        ex = Math.floor(Math.random() * grid.cols);
        ey = Math.floor(Math.random() * 5); // spawn on top half
        attempts++;
      } while (!grid.isWalkable(ex, ey) && attempts < 50);

      // Determine enemy type based on floor tier
      let enemy;
      if (floorNum < 5) {
        enemy = new JiangshiEnemy(grid, ex, ey);
      } else if (floorNum < 10) {
        enemy = (i % 2 === 0) ? new JiangshiEnemy(grid, ex, ey) : new WraithEnemy(grid, ex, ey);
      } else if (floorNum < 15) {
        enemy = (i % 3 === 0) ? new CorpseScribeEnemy(grid, ex, ey) : new WraithEnemy(grid, ex, ey);
      } else {
        // Late tiers: mix of all
        const roll = Math.random();
        if (roll < 0.4) enemy = new JiangshiEnemy(grid, ex, ey);
        else if (roll < 0.7) enemy = new WraithEnemy(grid, ex, ey);
        else enemy = new CorpseScribeEnemy(grid, ex, ey);
      }

      enemies.push(enemy);
    }

    return enemies;
  }
}
