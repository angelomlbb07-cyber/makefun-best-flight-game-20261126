// The 2D overlay: HUD instruments, objective panel, warnings and menus.
// The judge reads altitude, speed and heading here, so they are big, lit
// and always on screen while flying. All text uses the system font stack —
// no webfont, no network.

import { objectiveLine } from './missions.js';
import { PLANE } from './config.js';

function compassLabel(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function headingDeg(heading) {
  // Heading 0 = north (-z). Convert the model's yaw to a compass bearing.
  let deg = ((-heading * 180) / Math.PI) % 360;
  if (deg < 0) deg += 360;
  return deg;
}

function bar(ctx, x, y, w, h, frac, fill, label, text) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 18, 0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * Math.min(1, Math.max(0, frac))), h - 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 6, y + h / 2);
  ctx.textAlign = 'right';
  ctx.fillText(text, x + w - 6, y + h / 2);
  ctx.restore();
}

function dial(ctx, cx, cy, r, value, max, label, unit, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(8, 12, 18, 0.78)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Tick marks.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8));
    ctx.lineTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3));
    ctx.stroke();
  }
  const frac = Math.min(1, Math.max(0, value / max));
  const a = -Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(a) * (r - 12), Math.sin(a) * (r - 12));
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(r * 0.42)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.round(value)), 0, 2);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`${label} ${unit}`, 0, r * 0.55);
  ctx.restore();
}

// Artificial horizon: a small circle that banks with the plane and shows
// pitch as the horizon line's offset.
function attitude(ctx, cx, cy, r, pitch, roll) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(-roll);
  const horizonY = pitch * r * 1.4;
  ctx.fillStyle = '#2f6db3';
  ctx.fillRect(-r, -r + horizonY, r * 2, r * 2);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, horizonY, r * 2, r * 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-r, horizonY - 1, r * 2, 2);
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(5, 4);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHUD(ctx, w, h, s) {
  const p = s.plane;
  const m = s.mission;
  ctx.clearRect(0, 0, w, h);
  // Top bar: score, fronts, time, objective.
  ctx.fillStyle = 'rgba(8, 12, 18, 0.66)';
  ctx.fillRect(0, 0, w, 44);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`SCORE ${Math.round(m.score)}`, 14, 23);
  ctx.fillStyle = '#fff';
  ctx.font = '15px system-ui, sans-serif';
  const live = m.fires.filter((f) => !f.out).length;
  ctx.fillText(`${live} front${live === 1 ? '' : 's'} burning`, 170, 23);
  const mm = Math.floor(m.time / 60);
  const ss = Math.floor(m.time % 60);
  ctx.textAlign = 'right';
  ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, w - 14, 23);
  // Objective line under the bar.
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(objectiveLine(m), 14, 62);
  // Compass strip across the top centre.
  const deg = headingDeg(p.heading);
  const cw = 320;
  const cx = w / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 18, 0.6)';
  ctx.fillRect(cx - cw / 2, 52, cw, 26);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 15) {
    let b = Math.round((deg + d) / 15) * 15;
    const off = (b - deg) * (cw / 130);
    if (Math.abs(off) > cw / 2 - 8) continue;
    const bb = ((b % 360) + 360) % 360;
    ctx.fillText(bb % 45 === 0 ? compassLabel(bb) : String(bb), cx + off, 65);
  }
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(cx, 52);
  ctx.lineTo(cx - 6, 44);
  ctx.lineTo(cx + 6, 44);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Left dials: airspeed and altitude.
  const kmh = Math.round(p.speed * 3.6);
  dial(ctx, 76, h - 86, 56, kmh, 280, 'AIRSPEED', 'km/h', '#7fd4ff');
  const alt = Math.max(0, p.y - 14);
  dial(ctx, 196, h - 86, 56, alt, 600, 'ALTITUDE', 'm', '#9dff8a');
  // Attitude indicator between the dials.
  attitude(ctx, 136, h - 172, 34, p.pitch, p.roll);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', 136, h - 128);
  // Vertical speed + throttle, right of the dials.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  const vs = p.vspeed;
  ctx.fillText(`V/S ${vs >= 0 ? '+' : ''}${vs.toFixed(1)} m/s`, 14, h - 158);
  ctx.fillText(`THR ${Math.round(p.throttle * 100)}%`, 14, h - 138);
  // Right bars: fuel, water, hull.
  const bw = 210;
  const bx = w - bw - 14;
  let by = h - 148;
  const fuelFrac = p.fuel / PLANE.fuelCapacity;
  bar(ctx, bx, by, bw, 24, fuelFrac, p.fuel < PLANE.fuelCapacity * 0.25 ? '#ff5a3c' : '#ffb13c', 'FUEL', `${Math.round(fuelFrac * 100)}%`);
  by += 32;
  bar(ctx, bx, by, bw, 24, p.tank / 100, '#4db8ff', 'WATER', `${Math.round(p.tank)}`);
  by += 32;
  bar(ctx, bx, by, bw, 24, p.hull / 100, p.hull < 30 ? '#ff5a3c' : '#8aff7a', 'HULL', `${Math.round(p.hull)}%`);
  // Drop hint when over a fire with water aboard.
  if (s.nearestFire && p.tank > 0 && !p.onGround) {
    const d = Math.hypot(s.nearestFire.x - p.x, s.nearestFire.z - p.z);
    if (d < s.nearestFire.r + 120) {
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼ DROP WATER — SPACE ▼', w / 2, h - 190);
    }
  }
  // Scoop hint over the lake, low and slow.
  if (s.overLake && p.y < 12 && p.speed < 40 && !p.onGround && p.tank < 100) {
    ctx.fillStyle = '#4db8ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('~ SCOOPING WATER ~', w / 2, h - 190);
  }
  // Warnings, centre screen, flashing.
  const warns = [];
  if (p.fuel < PLANE.fuelCapacity * 0.25 && p.fuel > 0) warns.push('LOW FUEL — land on the strip');
  if (p.fuel <= 0) warns.push('FUEL EMPTY — gliding!');
  if (p.hull < 30) warns.push('HULL CRITICAL');
  if (s.stalled) warns.push('STALL — nose down, add power');
  if (m.townHealth < 40 && m.townHealth > 0) warns.push('TOWN BURNING — drop water!');
  if (warns.length > 0 && Math.floor(performance.now() / 500) % 2 === 0) {
    ctx.fillStyle = '#ff4d2e';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    warns.forEach((t, i) => ctx.fillText(t, w / 2, 110 + i * 28));
  }
  // Toast messages.
  ctx.textAlign = 'left';
  m.messages.forEach((msg, i) => {
    ctx.globalAlpha = Math.max(0, 1 - msg.t / 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(msg.text, 14, 96 + i * 22);
    ctx.globalAlpha = 1;
  });
}

function panel(ctx, w, h, title, lines, foot, accent) {
  ctx.fillStyle = 'rgba(6, 10, 16, 0.72)';
  ctx.fillRect(0, 0, w, h);
  const pw = Math.min(680, w - 80);
  const ph = 110 + lines.length * 30;
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  ctx.fillStyle = 'rgba(10, 16, 24, 0.94)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(px + 1.5, py + 1.5, pw - 3, ph - 3);
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, w / 2, py + 52);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, w / 2, py + 96 + i * 30));
  if (foot) {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(foot, w / 2, py + ph - 22);
  }
}

export function drawTitle(ctx, w, h) {
  panel(
    ctx,
    w,
    h,
    'EMBERLINE',
    [
      'Fire season in the valley. Three fronts are burning.',
      'Scoop water from the lake. Drop it on the fire. Save the town.',
      '',
      'Arrows / WASD — fly      Shift — throttle up      Ctrl — throttle down',
      'Space — drop water      R — restart      P — pause      M — mute',
      'Land on the strip to refuel and repair. Low and slow over the lake scoops.',
    ],
    'Press ENTER or click to fly',
    '#ff7a2e',
  );
}

export function drawPause(ctx, w, h) {
  panel(ctx, w, h, 'PAUSED', ['Take a breath. The fires wait for no one,', 'but this screen does.'], 'Press P to keep flying', '#7fd4ff');
}

export function drawGameOver(ctx, w, h, s) {
  panel(
    ctx,
    w,
    h,
    'SORTIE OVER',
    [
      s.mission.loseReason || 'The aircraft is down.',
      `Score ${Math.round(s.mission.score)}  ·  ${s.mission.firesOut} front${s.mission.firesOut === 1 ? '' : 's'} out  ·  ${Math.round(s.mission.acresSaved)} acres saved`,
    ],
    'Press R to fly again',
    '#ff4d2e',
  );
}

export function drawWin(ctx, w, h, s) {
  panel(
    ctx,
    w,
    h,
    'VALLEY SAVED',
    [
      'Every front is out. The town stands, the station stands.',
      `Score ${Math.round(s.mission.score)}  ·  ${s.mission.firesOut} fronts out  ·  ${Math.round(s.mission.acresSaved)} acres saved`,
      `Town health ${Math.round(s.mission.townHealth)}%  ·  Station health ${Math.round(s.mission.stationHealth)}%`,
    ],
    'Press R to fly another day',
    '#8aff7a',
  );
}
