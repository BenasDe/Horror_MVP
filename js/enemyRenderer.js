/**
 * THE BLOOD MARROW PAGODA: DEMONIC GRID
 * Enemy Entity Visuals & Animations
 */

export function renderEnemyEntity(ctx, enemy, tileSize) {
  const ts = tileSize;
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

    // 2-Second Damage Immunity Aura & Countdown
    if (enemy.invulnerableTimer > 0) {
      const now = Date.now() / 1000;
      const pulse = (Math.sin(now * 12) + 1) * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 38 + pulse * 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd15c';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#ffd15c';
      ctx.shadowBlur = 18;
      ctx.stroke();

      // Shield timer text badge
      ctx.fillStyle = '#ffd15c';
      ctx.font = 'bold 10.5px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(`🛡️ IMMUNE ${enemy.invulnerableTimer.toFixed(1)}s`, cx, cy + 48);
      ctx.restore();
    }
  }
}
