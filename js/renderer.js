/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Canvas Renderer: Dark Xianxia Horror Visuals, Particles, and Entities
 */

import { TILE_STATUS } from './config.js';

export class PagodaRenderer {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.grid = grid;
    this.particles = [];
    this.floatingTexts = [];
    this.screenShake = 0;
  }

  triggerShake(intensity = 6) {
    this.screenShake = intensity;
  }

  addFloatingText(text, x, y, color = '#ff334b', size = 13) {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      size,
      alpha: 1.0,
      vy: -25,
      life: 1.2
    });
  }

  spawnBloodParticles(x, y, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color: Math.random() > 0.3 ? '#c1121f' : '#ff334b',
        alpha: 1.0,
        decay: 0.8 + Math.random() * 0.6
      });
    }
  }

  spawnSpellShockwave(x, y, color = '#00f0ff') {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 100;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1.0,
        decay: 0.9 + Math.random() * 0.4
      });
    }
  }

  update(dt) {
    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake -= dt * 20;
      if (this.screenShake < 0) this.screenShake = 0;
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      ft.alpha = Math.max(0, ft.life / 1.2);
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  render(player, enemies, activeFloorInfo) {
    const ctx = this.ctx;
    ctx.save();

    // Screen shake offset
    if (this.screenShake > 0) {
      const sx = (Math.random() * 2 - 1) * this.screenShake;
      const sy = (Math.random() * 2 - 1) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Clear background
    ctx.fillStyle = '#0a0810';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Render Grid Tiles
    this.renderGridTiles(ctx);

    // 3. Render Inaccessible Obstacles / Walls
    this.renderObstacles(ctx);

    // 4. Render Active Tile Hazards (Damaging / Shielded)
    this.renderTileEffects(ctx);

    // 5. Render Telegraph Overlays
    this.renderTelegraphs(ctx);

    // 6. Render Enemies
    enemies.forEach(e => {
      if (e.alive) this.renderEnemy(ctx, e);
    });

    // 7. Render Player
    this.renderPlayer(ctx, player);

    // 8. Render Particles & Floating Text
    this.renderParticlesAndText(ctx);

    ctx.restore();
  }

  renderGridTiles(ctx) {
    const ts = this.grid.tileSize;
    for (let y = 0; y < this.grid.rows; y++) {
      for (let x = 0; x < this.grid.cols; x++) {
        const p = this.grid.gridToPixel(x, y);
        
        // Base tile: dark cracked stone
        const isAlt = (x + y) % 2 === 0;
        ctx.fillStyle = isAlt ? '#14101c' : '#181422';
        ctx.fillRect(p.x, p.y, ts, ts);

        // Tile border
        ctx.strokeStyle = '#272033';
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x, p.y, ts, ts);

        // Subtle inner rune accent
        ctx.fillStyle = 'rgba(74, 55, 84, 0.15)';
        ctx.fillRect(p.x + ts * 0.4, p.y + ts * 0.4, ts * 0.2, ts * 0.2);
      }
    }
  }

  renderObstacles(ctx) {
    const ts = this.grid.tileSize;
    for (let y = 0; y < this.grid.rows; y++) {
      for (let x = 0; x < this.grid.cols; x++) {
        const tile = this.grid.tiles[y][x];
        if (tile.status === TILE_STATUS.INACCESSIBLE) {
          const p = this.grid.gridToPixel(x, y);
          
          // Bone Pillar block
          ctx.fillStyle = '#2d2733';
          ctx.fillRect(p.x + 4, p.y + 4, ts - 8, ts - 8);

          ctx.strokeStyle = '#d5c9bd';
          ctx.lineWidth = 2;
          ctx.strokeRect(p.x + 8, p.y + 8, ts - 16, ts - 16);

          // Bone spikes emblem
          ctx.fillStyle = '#e8ded2';
          ctx.beginPath();
          ctx.moveTo(p.x + ts * 0.5, p.y + 10);
          ctx.lineTo(p.x + ts - 12, p.y + ts - 10);
          ctx.lineTo(p.x + 12, p.y + ts - 10);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#110e17';
          ctx.font = '10px JetBrains Mono';
          ctx.textAlign = 'center';
          ctx.fillText('BONE', p.x + ts * 0.5, p.y + ts * 0.65);
        }
      }
    }
  }

  renderTileEffects(ctx) {
    const ts = this.grid.tileSize;
    const now = Date.now() / 1000;

    for (let y = 0; y < this.grid.rows; y++) {
      for (let x = 0; x < this.grid.cols; x++) {
        const tile = this.grid.tiles[y][x];
        const p = this.grid.gridToPixel(x, y);

        // Damaging Status: Blood Spikes & Crimson Yin Flames
        if (tile.status === TILE_STATUS.DAMAGING) {
          const pulse = (Math.sin(now * 8) + 1) * 0.15;
          ctx.fillStyle = `rgba(193, 18, 31, ${0.45 + pulse})`;
          ctx.fillRect(p.x + 2, p.y + 2, ts - 4, ts - 4);

          ctx.strokeStyle = '#ff334b';
          ctx.lineWidth = 2;
          ctx.strokeRect(p.x + 2, p.y + 2, ts - 4, ts - 4);

          // Blood thorns
          ctx.fillStyle = '#ff7b89';
          for (let i = 0; i < 4; i++) {
            const bx = p.x + 15 + i * 14;
            const by = p.y + ts - 10;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + 4, by - 16);
            ctx.lineTo(bx + 8, by);
            ctx.fill();
          }
        }

        // Shielded Status: Cyan Taoist Ward
        if (tile.status === TILE_STATUS.SHIELDED) {
          const pulse = (Math.sin(now * 5) + 1) * 0.2;
          ctx.fillStyle = `rgba(0, 240, 255, ${0.25 + pulse})`;
          ctx.fillRect(p.x + 2, p.y + 2, ts - 4, ts - 4);

          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2;
          ctx.strokeRect(p.x + 2, p.y + 2, ts - 4, ts - 4);

          // Ward circle
          ctx.beginPath();
          ctx.arc(p.x + ts * 0.5, p.y + ts * 0.5, ts * 0.35, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.stroke();
        }
      }
    }
  }

  renderTelegraphs(ctx) {
    const ts = this.grid.tileSize;
    for (let y = 0; y < this.grid.rows; y++) {
      for (let x = 0; x < this.grid.cols; x++) {
        const tile = this.grid.tiles[y][x];
        if (tile.telegraph && tile.telegraph.active) {
          const p = this.grid.gridToPixel(x, y);
          const t = tile.telegraph;
          const ratio = Math.min(1, Math.max(0, 1 - (t.timer / t.totalDuration)));
          const isEnemy = t.owner === 'enemy';

          // Color scheme
          const mainColor = isEnemy ? 'rgba(255, 51, 75, 0.5)' : 'rgba(0, 240, 255, 0.4)';
          const strokeColor = isEnemy ? '#ff334b' : '#00f0ff';

          // Expanding fill box
          ctx.fillStyle = mainColor;
          ctx.fillRect(p.x + 4, p.y + 4, ts - 8, ts - 8);

          // Pulsing warning outline
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(p.x + 4, p.y + 4, ts - 8, ts - 8);

          // Center countdown circle
          ctx.beginPath();
          ctx.arc(p.x + ts * 0.5, p.y + ts * 0.5, (ts * 0.35) * ratio, 0, Math.PI * 2);
          ctx.fillStyle = strokeColor;
          ctx.fill();

          // Countdown number
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px JetBrains Mono';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(t.timer.toFixed(1) + 's', p.x + ts * 0.5, p.y + ts * 0.5);
        }
      }
    }
  }

  renderPlayer(ctx, player) {
    const ts = this.grid.tileSize;
    const px = player.renderX;
    const py = player.renderY;
    const cx = px + ts * 0.5;
    const cy = py + ts * 0.5;

    // Invulnerability blink
    if (player.isInvulnerable && Math.floor(Date.now() / 80) % 2 === 0) {
      return;
    }

    // Casting halo / Movement Root circle
    if (player.isCasting) {
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.45, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff334b';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Cultivator Soul Body (Robed figure)
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;

    // Body
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 16, 0, Math.PI * 2);
    ctx.fill();

    // Robe
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 18);
    ctx.lineTo(cx, cy - 2);
    ctx.lineTo(cx + 14, cy + 18);
    ctx.closePath();
    ctx.fillStyle = '#174052';
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.shadowBlur = 0; // reset

    // Facing direction arrow / talisman
    const fx = cx + player.facing.dx * 18;
    const fy = cy + player.facing.dy * 18;
    ctx.fillStyle = '#e0b04a';
    ctx.beginPath();
    ctx.arc(fx, fy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Floating Soul Talismans (Hits) orbiting around cultivator
    const now = Date.now() / 1000;
    const hits = player.currentHits;
    for (let i = 0; i < hits; i++) {
      const angle = now * 3 + (i * (Math.PI * 2 / Math.max(1, hits)));
      const bx = cx + Math.cos(angle) * 26;
      const by = cy + Math.sin(angle) * 26;

      ctx.fillStyle = '#ff334b';
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  renderEnemy(ctx, enemy) {
    const ts = this.grid.tileSize;
    const px = enemy.renderX;
    const py = enemy.renderY;
    const cx = px + ts * 0.5;
    const cy = py + ts * 0.5;

    if (enemy.name === "Hopping Jiangshi") {
      // Wind-up crouch squish
      let scaleY = 1.0;
      let scaleX = 1.0;
      if (enemy.isWindingUp) {
        scaleY = 0.75;
        scaleX = 1.25;
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scaleX, scaleY);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Corpse Body (Qing Robe)
      ctx.fillStyle = '#152433';
      ctx.fillRect(-12, -4, 24, 22);

      // Arms outstretched forward (classic Jiangshi)
      ctx.fillStyle = '#8f9da8';
      ctx.fillRect(-14, 0, 28, 6);

      // Pale Head
      ctx.fillStyle = '#d2dcd9';
      ctx.beginPath();
      ctx.arc(0, -12, 11, 0, Math.PI * 2);
      ctx.fill();

      // Yellow Taoist Talisman on forehead
      ctx.fillStyle = '#ffda33';
      ctx.fillRect(-4, -18, 8, 12);
      ctx.fillStyle = '#c1121f';
      ctx.fillRect(-2, -14, 4, 6);

      // Red Eyes (Glowing during wind-up)
      ctx.fillStyle = enemy.isWindingUp ? '#ff0022' : '#880011';
      ctx.beginPath();
      ctx.arc(-4, -11, enemy.isWindingUp ? 3 : 2, 0, Math.PI * 2);
      ctx.arc(4, -11, enemy.isWindingUp ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

    } else if (enemy.name === "Resentful Wraith") {
      // Ethereal floating specter
      const floatOffset = Math.sin(Date.now() / 200) * 4;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.arc(cx, cy - 6 + floatOffset, 14, 0, Math.PI * 2);
      ctx.fill();

      // Wraith trail
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + floatOffset);
      ctx.lineTo(cx, cy + 18 + floatOffset);
      ctx.lineTo(cx + 10, cy + floatOffset);
      ctx.fill();

      ctx.shadowBlur = 0;

      // Dark Eyes
      ctx.fillStyle = '#060509';
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 6 + floatOffset, 2.5, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 6 + floatOffset, 2.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (enemy.name === "Corpse Scribe") {
      // Robed skeleton with bone scroll
      ctx.fillStyle = '#3a2745';
      ctx.fillRect(cx - 12, cy - 6, 24, 24);

      // Bone Skull
      ctx.fillStyle = '#e8ded2';
      ctx.beginPath();
      ctx.arc(cx, cy - 12, 10, 0, Math.PI * 2);
      ctx.fill();

      // Scroll
      ctx.fillStyle = '#d5c298';
      ctx.fillRect(cx - 16, cy + 2, 32, 6);

    } else if (enemy.name === "Corpse Emperor") {
      // 2x2 Boss Titan
      ctx.fillStyle = '#4a0812';
      ctx.shadowColor = '#ff334b';
      ctx.shadowBlur = 20;

      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.fill();

      // Imperial Gold Crown
      ctx.fillStyle = '#e0b04a';
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy - 24);
      ctx.lineTo(cx - 12, cy - 40);
      ctx.lineTo(cx, cy - 26);
      ctx.lineTo(cx + 12, cy - 40);
      ctx.lineTo(cx + 24, cy - 24);
      ctx.closePath();
      ctx.fill();

      // Boss HP text
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(`${enemy.hits} / ${enemy.maxHits} HITS`, cx, cy + 4);
    }
  }

  renderParticlesAndText(ctx) {
    // Particles
    this.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Floating combat text
    this.floatingTexts.forEach(ft => {
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.font = `bold ${ft.size}px Cinzel, JetBrains Mono`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    });
    ctx.globalAlpha = 1.0;
  }
}
