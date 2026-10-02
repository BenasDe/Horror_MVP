/** Canvas combat labels and an opt-in renderer diagnostic overlay. */
export class CombatOverlay {
  constructor(host) {
    this.host = host;
    this.textCanvas = host.textCanvas;
    this.textCtx = host.textCtx;
    this.floatingTexts = [];
  }

  addFloatingText(text, x, y, color, size) {
    // Project 2D screen coordinate or grid position
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      size,
      alpha: 1.0,
      vy: -28,
      life: 1.2
    });
  }

  update(dt) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const text = this.floatingTexts[i];
      text.y += text.vy * dt;
      text.life -= dt;
      text.alpha = Math.max(0, text.life / 1.2);
      if (text.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  clear() {
    this.floatingTexts.length = 0;
    if (this.textCtx) this.textCtx.clearRect(0, 0, 760, 760);
  }

  render(player, enemies) {
    if (!this.textCtx || !this.textCanvas) return;
    const ctx = this.textCtx;
    ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);

    // 1. Tactical Enemy Overhead Indicators (Health Pips, Attack Warnings, Boss Bar)
    if (enemies && Array.isArray(enemies)) {
      enemies.forEach(enemy => {
        if (!enemy.alive) return;

        const gx = (enemy.renderX - this.host.grid.padding) / this.host.grid.tileSize;
        const gy = (enemy.renderY - this.host.grid.padding) / this.host.grid.tileSize;
        const w = this.host.gridToWorld(gx, gy);

        if (enemy.name === "Corpse Emperor") {
          // Boss Health Bar & Shield Countdown
          const sp = this.host.worldToScreen(w.x, 3.6, w.z);
          if (sp.x >= -60 && sp.x <= 820 && sp.y >= -60 && sp.y <= 820) {
            const barW = 130;
            const barH = 10;
            const bx = sp.x - barW * 0.5;
            const by = sp.y - 14;

            // Background & border
            ctx.fillStyle = 'rgba(10, 6, 18, 0.85)';
            ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
            ctx.strokeStyle = '#e0b04a';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx - 2, by - 2, barW + 4, barH + 4);

            // Health fill
            const pct = Math.max(0, Math.min(1, enemy.hits / (enemy.maxHits || 10)));
            ctx.fillStyle = '#ff2244';
            ctx.fillRect(bx, by, barW * pct, barH);

            // Boss label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px JetBrains Mono, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`EMPEROR: ${enemy.hits}/${enemy.maxHits}`, sp.x, by + 8);

            // Immunity Shield Countdown
            if (enemy.invulnerableTimer > 0) {
              ctx.fillStyle = '#ffd15c';
              ctx.font = 'bold 11px JetBrains Mono, sans-serif';
              ctx.shadowColor = '#000';
              ctx.shadowBlur = 5;
              ctx.fillText(`🛡️ IMMUNE ${enemy.invulnerableTimer.toFixed(1)}s`, sp.x, by - 6);
              ctx.shadowBlur = 0;
            }
          }
        } else {
          // Normal Enemy Overheads
          const sp = this.host.worldToScreen(w.x, 2.1, w.z);
          if (sp.x >= -40 && sp.x <= 800 && sp.y >= -40 && sp.y <= 800) {
            // A. Attack Windup Warning Badge
            if (enemy.isWindingUp) {
              const pulse = Math.floor(Date.now() / 90) % 2 === 0;
              ctx.fillStyle = pulse ? '#ff334b' : '#ffaa00';
              ctx.font = 'bold 11px JetBrains Mono, sans-serif';
              ctx.textAlign = 'center';
              ctx.shadowColor = '#000';
              ctx.shadowBlur = 6;
              ctx.fillText(`⚠️ ATTACK!`, sp.x, sp.y - 14);
              ctx.shadowBlur = 0;
            }

            // B. Enemy Hit Pips (compact red soul beads showing remaining HP)
            const maxHits = enemy.maxHits || 2;
            const currentHits = enemy.hits;
            if (maxHits > 1) {
              const pipRadius = 3.5;
              const spacing = 10;
              const totalW = (maxHits - 1) * spacing;
              const startX = sp.x - totalW * 0.5;
              const pipY = sp.y - (enemy.isWindingUp ? 26 : 12);

              for (let h = 0; h < maxHits; h++) {
                const px = startX + h * spacing;
                ctx.beginPath();
                ctx.arc(px, pipY, pipRadius, 0, Math.PI * 2);
                if (h < currentHits) {
                  ctx.fillStyle = '#ff2244';
                  ctx.fill();
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = 1;
                  ctx.stroke();
                } else {
                  ctx.fillStyle = 'rgba(40, 20, 30, 0.7)';
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(100, 50, 60, 0.5)';
                  ctx.lineWidth = 0.8;
                  ctx.stroke();
                }
              }
            }
          }
        }
      });
    }

    // 2. Render Player Queen's Ruin Immunity Badge
    if (player && player.queensRuinCheck && player.isInvulnerable) {
      const pgx = (player.renderX - this.host.grid.padding) / this.host.grid.tileSize;
      const pgy = (player.renderY - this.host.grid.padding) / this.host.grid.tileSize;
      const pw = this.host.gridToWorld(pgx, pgy);
      const psp = this.host.worldToScreen(pw.x, 2.2, pw.z);
      if (psp.x >= -40 && psp.x <= 800 && psp.y >= -40 && psp.y <= 800) {
        ctx.fillStyle = '#ffd15c';
        ctx.font = 'bold 11px JetBrains Mono, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText(`👑 IMMUNE ${player.invulnTimer.toFixed(1)}s`, psp.x, psp.y - 14);
        ctx.shadowBlur = 0;
      }
    }

    // 3. Render floating combat texts
    this.floatingTexts.forEach(ft => {
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.font = `bold ${ft.size}px Cinzel, JetBrains Mono, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1.0;
    if (this.host.debugStats) this.renderStats();
  }

  renderStats() {
    const ctx = this.textCtx;
    const stats = this.host.getPerformanceStats();
    ctx.fillStyle = 'rgba(3, 2, 6, 0.85)';
    ctx.fillRect(8, 8, 370, 92);
    ctx.fillStyle = '#d1c8c5';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    const lines = [
      `Draw calls: ${stats.drawCalls} | Triangles: ${stats.triangles}`,
      `GPU geometries: ${stats.gpuGeometries} | Textures: ${stats.textures}`,
      `Cached geometries: ${stats.cachedGeometries} | Models: ${stats.activeModels}/${stats.pooledModels}`,
      `FX: blood ${stats.particles.blood.active}, bones ${stats.particles.bones.active}, embers ${stats.particles.embers.active}`
    ];
    lines.forEach((line, index) => ctx.fillText(line, 16, 28 + index * 19));
  }
}
